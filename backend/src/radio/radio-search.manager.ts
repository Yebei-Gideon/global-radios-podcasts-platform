import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { SearchQueryDto } from '../common/dto/pagination.dto';
import { RadioProviderRegistry } from './radio-provider.registry';
import { ProviderRadioResult, RadioProviderName } from './types/radio-search.types';

@Injectable()
export class RadioSearchManager {
  private readonly logger = new Logger(RadioSearchManager.name);

  constructor(
    private readonly providerRegistry: RadioProviderRegistry,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  async search(searchDto: SearchQueryDto): Promise<ProviderRadioResult[]> {
    const query = searchDto.query?.trim();
    const country = searchDto.country?.trim();
    const language = searchDto.language?.trim();
    const tag = searchDto.tag?.trim();
    const limit = this.getBoundedLimit(searchDto.limit);
    const offset = searchDto.page ? (searchDto.page - 1) * limit : 0;

    const requestedProviders = Array.isArray(searchDto.providers)
      ? searchDto.providers.map((p) => p as RadioProviderName)
      : undefined;

    const cacheKey = this.buildCacheKey(query, country, language, tag, limit, offset, requestedProviders);
    const cached = await this.cacheManager.get<ProviderRadioResult[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Radio search cache hit for ${cacheKey}`);
      return cached;
    }

    const providers = this.providerRegistry.getEnabledProviders(requestedProviders);
    if (!providers.length) {
      this.logger.warn('No radio providers are enabled.');
      return [];
    }

    const searchParams = {
      name: query,
      country,
      language,
      tag,
      limit: limit, // Each provider gets the full limit to maximize results
      offset,
    };

    this.logger.debug(`Searching ${providers.length} radio providers with limit ${limit} each`, searchParams);

    const settled = await Promise.allSettled(
      providers.map((provider) => provider.search(searchParams)),
    );

    const combined: ProviderRadioResult[] = [];
    settled.forEach((result, index) => {
      const providerName = providers[index].name;
      if (result.status === 'fulfilled') {
        this.logger.debug(`Provider ${providerName} returned ${result.value.length} stations`);
        combined.push(
          ...result.value.map((item) => ({
            ...item,
            sourceProviders: item.sourceProviders || [providerName],
          })),
        );
      } else {
        this.logger.warn(`Provider ${providerName} failed: ${result.reason}`);
      }
    });

    const deduped = this.deduplicateResults(combined);
    const sorted = this.sortResultsByPriority(deduped);
    const final = sorted.slice(0, limit); // Apply final limit

    // Only cache if we have results to avoid caching empty results from failed providers
    if (final.length > 0) {
      const cacheTtl =
        this.configService.get<number>('radioProviders.search.cacheTtlMs') || 3600_000;
      await this.cacheManager.set(cacheKey, final, cacheTtl);
    }

    this.logger.log(`Radio search returned ${final.length} stations from ${providers.length} providers`);
    return final;
  }

  async getProviderStatuses(): Promise<any[]> {
    return this.providerRegistry.getStatuses();
  }

  private deduplicateResults(results: ProviderRadioResult[]): ProviderRadioResult[] {
    const byStream = new Map<string, ProviderRadioResult>();

    for (const item of results) {
      if (!item.streamUrl) continue;

      const streamKey = this.normalizeStreamUrl(item.streamUrl);
      const existing = byStream.get(streamKey);

      if (existing) {
        byStream.set(streamKey, this.mergeStation(existing, item));
      } else {
        byStream.set(streamKey, {
          ...item,
          sourceProviders: Array.from(new Set([...(item.sourceProviders || []), item.source])),
        });
      }
    }

    return Array.from(byStream.values());
  }

  private mergeStation(
    target: ProviderRadioResult,
    incoming: ProviderRadioResult,
  ): ProviderRadioResult {
    return {
      ...target,
      name: target.name || incoming.name,
      country: target.country || incoming.country,
      countryCode: target.countryCode || incoming.countryCode,
      state: target.state || incoming.state,
      city: target.city || incoming.city,
      language: target.language || incoming.language,
      tags: Array.from(new Set([...(target.tags || []), ...(incoming.tags || [])])),
      bitrate: target.bitrate || incoming.bitrate,
      codec: target.codec || incoming.codec,
      homepage: target.homepage || incoming.homepage,
      favicon: target.favicon || incoming.favicon,
      votes: (target.votes || 0) + (incoming.votes || 0),
      clickCount: (target.clickCount || 0) + (incoming.clickCount || 0),
      sourceProviders: Array.from(
        new Set([
          ...(target.sourceProviders || []),
          ...(incoming.sourceProviders || []),
          incoming.source,
        ]),
      ),
      lastUpdated: target.lastUpdated || incoming.lastUpdated,
    };
  }

  private sortResultsByPriority(results: ProviderRadioResult[]): ProviderRadioResult[] {
    const priorityMap = this.buildPriorityMap();

    return results.sort((a, b) => {
      // Sort by provider priority first
      const priorityDiff = (priorityMap[a.source] || 99) - (priorityMap[b.source] || 99);
      if (priorityDiff !== 0) return priorityDiff;

      // Then by votes/popularity
      const aPopularity = (a.votes || 0) + (a.clickCount || 0);
      const bPopularity = (b.votes || 0) + (b.clickCount || 0);
      if (bPopularity !== aPopularity) return bPopularity - aPopularity;

      // Finally alphabetically
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  private buildPriorityMap(): Record<RadioProviderName, number> {
    const statuses = this.providerRegistry.getStatuses();
    const map: Record<string, number> = {};
    statuses.forEach((s) => {
      map[s.name] = s.priority;
    });
    return map as Record<RadioProviderName, number>;
  }

  private normalizeStreamUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove protocol and trailing slashes for comparison
      return `${parsed.host}${parsed.pathname}`.toLowerCase().replace(/\/+$/, '');
    } catch {
      return url.toLowerCase();
    }
  }

  private buildCacheKey(
    query: string,
    country: string,
    language: string,
    tag: string,
    limit: number,
    offset: number,
    providers?: RadioProviderName[],
  ): string {
    const parts = [
      'radio-search',
      query || 'all',
      country || 'any',
      language || 'any',
      tag || 'any',
      limit,
      offset,
      providers?.join(',') || 'all',
    ];
    return parts.join(':');
  }

  private getBoundedLimit(limit?: number): number {
    const val = limit || 20;
    return Math.min(Math.max(val, 1), 100); // Between 1 and 100
  }
}
