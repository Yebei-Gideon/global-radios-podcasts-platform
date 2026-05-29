import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { SearchQueryDto } from '../common/dto/pagination.dto';
import { ProviderRegistry } from './provider.registry';
import { RateLimiterService } from './rate-limiter.service';
import { ProviderName, ProviderPodcastResult } from './types/podcast-search.types';

@Injectable()
export class PodcastSearchManager {
  private readonly logger = new Logger(PodcastSearchManager.name);

  constructor(
    @Inject(ProviderRegistry)
    private readonly providerRegistry: ProviderRegistry,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(RateLimiterService)
    private readonly rateLimiter: RateLimiterService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async search(searchDto: SearchQueryDto): Promise<ProviderPodcastResult[]> {
    const query = searchDto.query?.trim() || 'podcast';
    const language = searchDto.language;
    const limit = this.getBoundedLimit(searchDto.limit);

    const requestedProviders = Array.isArray(searchDto.providers)
      ? searchDto.providers.map((p) => p as ProviderName)
      : undefined;

    const cacheKey = this.buildCacheKey(query, language, limit, requestedProviders);
    const cached = await this.cacheManager.get<ProviderPodcastResult[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Podcast search cache hit for ${cacheKey}`);
      return cached;
    }

    const providers = this.providerRegistry.getEnabledProviders(requestedProviders);
    if (!providers.length) {
      this.logger.warn('No podcast providers are enabled.');
      return [];
    }

    const searchParams = { query, limit, language };

    const settled = await Promise.allSettled(
      providers.map((provider) => provider.search(searchParams)),
    );

    const combined: ProviderPodcastResult[] = [];
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

    const cacheTtl =
      this.configService.get<number>('podcastProviders.search.cacheTtlMs') || 3600_000;
    await this.cacheManager.set(cacheKey, sorted, cacheTtl);

    return sorted;
  }

  async getUsageStats(): Promise<Record<ProviderName, any>> {
    const configs = this.configService.get('podcastProviders.providers');
    const statsEntries = await Promise.all(
      Object.keys(configs || {}).map(async (key) => {
        const name = key as ProviderName;
        const cfg = configs[name];
        const stats = await this.rateLimiter.getUsageStats(
          name,
          cfg?.rateLimit,
          cfg?.rateLimitPeriodSeconds,
        );
        return [name, stats];
      }),
    );

    return Object.fromEntries(statsEntries);
  }

  private deduplicateResults(results: ProviderPodcastResult[]): ProviderPodcastResult[] {
    const byFeed = new Map<string, ProviderPodcastResult>();

    for (const item of results) {
      const feedKey = item.feedUrl?.toLowerCase();
      const itunesKey = item.itunesId?.toString();
      const fallbackKey = this.normalizeTitleAuthor(item.title, item.authorName);

      const existing = (feedKey && byFeed.get(feedKey)) || (itunesKey && byFeed.get(itunesKey)) || (fallbackKey && byFeed.get(fallbackKey));

      if (existing) {
        byFeed.set(feedKey || itunesKey || fallbackKey, this.mergePodcast(existing, item));
      } else {
        const key = feedKey || itunesKey || fallbackKey || `${item.title}-${item.source}`;
        byFeed.set(key, {
          ...item,
          sourceProviders: Array.from(new Set([...(item.sourceProviders || []), item.source])),
        });
      }
    }

    return Array.from(byFeed.values());
  }

  private mergePodcast(target: ProviderPodcastResult, incoming: ProviderPodcastResult): ProviderPodcastResult {
    const merged: ProviderPodcastResult = {
      ...target,
      title: target.title || incoming.title,
      description:
        incoming.description && (!target.description || incoming.description.length > target.description.length)
          ? incoming.description
          : target.description,
      imageUrl: target.imageUrl || incoming.imageUrl,
      authorName: target.authorName || incoming.authorName,
      feedUrl: target.feedUrl || incoming.feedUrl,
      itunesId: target.itunesId || incoming.itunesId,
      categories: Array.from(new Set([...(target.categories || []), ...(incoming.categories || [])])),
      episodeCount: target.episodeCount || incoming.episodeCount,
      language: target.language || incoming.language,
      websiteUrl: target.websiteUrl || incoming.websiteUrl,
      source: target.source,
      sourceProviders: Array.from(
        new Set([...(target.sourceProviders || []), ...(incoming.sourceProviders || []), incoming.source]),
      ),
      lastUpdated: target.lastUpdated || incoming.lastUpdated,
      popularity: target.popularity || incoming.popularity,
      explicit: target.explicit ?? incoming.explicit,
    };

    return merged;
  }

  private sortResultsByPriority(results: ProviderPodcastResult[]): ProviderPodcastResult[] {
    const priorityMap = this.buildPriorityMap();

    return results.sort((a, b) => {
      const priorityDiff = (priorityMap[a.source] || 99) - (priorityMap[b.source] || 99);
      if (priorityDiff !== 0) return priorityDiff;
      const popularityDiff = (b.popularity || 0) - (a.popularity || 0);
      if (popularityDiff !== 0) return popularityDiff;
      return a.title.localeCompare(b.title);
    });
  }

  private buildPriorityMap(): Record<ProviderName, number> {
    const configs = this.configService.get('podcastProviders.providers') || {};
    const map: Record<ProviderName, number> = {} as Record<ProviderName, number>;
    Object.keys(configs).forEach((key) => {
      map[key as ProviderName] = configs[key]?.priority ?? 99;
    });
    return map;
  }

  private normalizeTitleAuthor(title?: string, author?: string): string | null {
    if (!title && !author) return null;
    return `${title || ''}-${author || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private buildCacheKey(query: string, language: string | undefined, limit: number, providers?: ProviderName[]): string {
    const providersKey = providers?.length ? providers.sort().join(',') : 'all';
    return `podcasts:multi:${query}:${language || 'any'}:${limit}:${providersKey}`;
  }

  private getBoundedLimit(limit?: number): number {
    const defaultLimit = this.configService.get<number>('podcastProviders.search.defaultLimit') || 20;
    const maxLimit = this.configService.get<number>('podcastProviders.search.maxLimit') || 200;
    const requested = limit || defaultLimit;
    return Math.min(Math.max(requested, 1), maxLimit);
  }
}
