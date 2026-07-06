import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { SearchQueryDto } from '../common/dto/pagination.dto';
import { LiveTvProviderRegistry } from './live-tv-provider.registry';
import { LiveTvProviderName, ProviderLiveTvResult } from './types/live-tv-search.types';

@Injectable()
export class LiveTvSearchManager {
  private readonly logger = new Logger(LiveTvSearchManager.name);

  constructor(
    @Inject(LiveTvProviderRegistry)
    private readonly providerRegistry: LiveTvProviderRegistry,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  async search(searchDto: SearchQueryDto): Promise<ProviderLiveTvResult[]> {
    const query = searchDto.query?.trim();
    const country = searchDto.country?.trim();
    const language = searchDto.language?.trim();
    const category = searchDto.tag?.trim();
    const limit = this.getBoundedLimit(searchDto.limit);
    const offset = searchDto.page ? (searchDto.page - 1) * limit : 0;

    const requestedProviders = Array.isArray(searchDto.providers)
      ? searchDto.providers.map((provider) => provider as LiveTvProviderName)
      : undefined;

    const cacheKey = this.buildCacheKey(query, country, language, category, limit, offset, requestedProviders);
    const cached = await this.cacheManager.get<ProviderLiveTvResult[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Live TV cache hit for ${cacheKey}`);
      return cached;
    }

    const providers = this.providerRegistry.getEnabledProviders(requestedProviders);
    if (!providers.length) {
      this.logger.warn('No live TV providers are enabled.');
      return [];
    }

    const searchParams = {
      name: query,
      country,
      language,
      category,
      limit,
      offset,
    };

    const settled = await Promise.allSettled(providers.map((provider) => provider.search(searchParams)));

    const combined: ProviderLiveTvResult[] = [];
    settled.forEach((result, index) => {
      const providerName = providers[index].name;
      if (result.status === 'fulfilled') {
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
    const final = sorted.slice(0, limit);

    if (final.length > 0) {
      const cacheTtl = this.configService.get<number>('liveTvProviders.search.cacheTtlMs') || 3600_000;
      await this.cacheManager.set(cacheKey, final, cacheTtl);
    }

    this.logger.log(`Live TV search returned ${final.length} channels from ${providers.length} providers`);
    return final;
  }

  async getProviderStatuses() {
    return this.providerRegistry.getStatuses();
  }

  private deduplicateResults(results: ProviderLiveTvResult[]): ProviderLiveTvResult[] {
    const byStream = new Map<string, ProviderLiveTvResult>();

    for (const item of results) {
      if (!item.streamUrl) continue;

      const streamKey = this.normalizeStreamUrl(item.streamUrl);
      const existing = byStream.get(streamKey);

      if (existing) {
        byStream.set(streamKey, this.mergeChannel(existing, item));
      } else {
        byStream.set(streamKey, {
          ...item,
          sourceProviders: Array.from(new Set([...(item.sourceProviders || []), item.source])),
        });
      }
    }

    return Array.from(byStream.values());
  }

  private mergeChannel(target: ProviderLiveTvResult, incoming: ProviderLiveTvResult): ProviderLiveTvResult {
    return {
      ...target,
      name: target.name || incoming.name,
      country: target.country || incoming.country,
      countryCode: target.countryCode || incoming.countryCode,
      language: target.language || incoming.language,
      category: target.category || incoming.category,
      logoUrl: target.logoUrl || incoming.logoUrl,
      websiteUrl: target.websiteUrl || incoming.websiteUrl,
      groupTitle: target.groupTitle || incoming.groupTitle,
      referrer: target.referrer || incoming.referrer,
      userAgent: target.userAgent || incoming.userAgent,
      quality: target.quality || incoming.quality,
      sourceProviders: Array.from(new Set([...(target.sourceProviders || []), ...(incoming.sourceProviders || []), incoming.source])),
      lastUpdated: target.lastUpdated || incoming.lastUpdated,
    };
  }

  private sortResultsByPriority(results: ProviderLiveTvResult[]): ProviderLiveTvResult[] {
    const priorityMap = this.buildPriorityMap();

    return results.sort((a, b) => {
      const priorityDiff = (priorityMap[a.source] || 99) - (priorityMap[b.source] || 99);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  private buildPriorityMap(): Record<LiveTvProviderName, number> {
    const statuses = this.providerRegistry.getStatuses();
    const map: Record<string, number> = {};
    statuses.forEach((status) => {
      map[status.name] = status.priority;
    });
    return map as Record<LiveTvProviderName, number>;
  }

  private normalizeStreamUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.host}${parsed.pathname}`.toLowerCase().replace(/\/+$/, '');
    } catch {
      return url.toLowerCase();
    }
  }

  private buildCacheKey(
    query: string,
    country: string,
    language: string,
    category: string,
    limit: number,
    offset: number,
    providers?: LiveTvProviderName[],
  ): string {
    return [
      'live-tv-search',
      query || 'all',
      country || 'any',
      language || 'any',
      category || 'any',
      limit,
      offset,
      providers?.join(',') || 'all',
    ].join(':');
  }

  private getBoundedLimit(limit?: number): number {
    const val = limit || 24;
    return Math.min(Math.max(val, 1), 100);
  }
}
