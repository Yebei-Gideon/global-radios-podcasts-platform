import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { BasePodcastProvider } from './base-provider';
import { ProviderConfig, ProviderPodcastResult, ProviderSearchParams, ProviderName } from '../types/podcast-search.types';
import { RateLimiterService } from '../rate-limiter.service';
import { getErrorMessage } from '../../common/utils/error-message.util';

@Injectable()
export class PodcastIndexProvider implements BasePodcastProvider {
  readonly name: ProviderName = 'podcast_index';
  private readonly logger = new Logger(PodcastIndexProvider.name);
  private axiosInstance: AxiosInstance;
  private config: ProviderConfig;

  constructor(private readonly rateLimiter: RateLimiterService) {}

  configure(config: ProviderConfig): void {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl || 'https://api.podcastindex.org/api/1.0',
      timeout: config.timeoutMs || 5000,
      headers: {
        'User-Agent': 'GlobalRadioPodcastPlatform/1.0',
      },
    });
  }

  async search(params: ProviderSearchParams): Promise<ProviderPodcastResult[]> {
    if (!this.config?.enabled) return [];
    if (!params.query) return [];
    if (!this.config.apiKey || !this.config.apiSecret) {
      this.logger.warn('Podcast Index credentials missing; skipping search.');
      return [];
    }

    const canProceed = await this.rateLimiter.canMakeRequest(
      this.name,
      this.config.rateLimit,
      this.config.rateLimitPeriodSeconds,
    );
    if (!canProceed) return [];

    const authHeaders = this.buildAuthHeaders();

    try {
      const response = await this.axiosInstance.get('/search/byterm', {
        params: { q: params.query, max: params.limit },
        headers: authHeaders,
      });

      await this.rateLimiter.recordRequest(
        this.name,
        this.config.rateLimit,
        this.config.rateLimitPeriodSeconds,
      );

      const feeds = Array.isArray(response.data?.feeds) ? response.data.feeds : [];

      return feeds.map((feed: any): ProviderPodcastResult => ({
        id: feed.id?.toString(),
        title: feed.title,
        authorName: feed.author,
        description: feed.description,
        imageUrl: feed.image,
        feedUrl: feed.url,
        itunesId: feed.itunesId?.toString(),
        categories: feed.categories ? Object.values(feed.categories) : [],
        episodeCount: feed.episodeCount,
        language: feed.language,
        websiteUrl: feed.link,
        source: this.name,
        explicit: feed.explicit === 1,
        lastUpdated: feed.lastUpdateTime ? new Date(feed.lastUpdateTime * 1000).toISOString() : undefined,
      }));
    } catch (error) {
      this.logger.warn(`Podcast Index search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config?.enabled && !!this.config.apiKey && !!this.config.apiSecret;
  }

  requiresAuthentication(): boolean {
    return true;
  }

  private buildAuthHeaders(): Record<string, string> {
    const ts = Math.floor(Date.now() / 1000);
    const hash = crypto
      .createHash('sha1')
      .update(this.config.apiKey + this.config.apiSecret + ts)
      .digest('hex');

    return {
      'X-Auth-Date': ts.toString(),
      'X-Auth-Key': this.config.apiKey || '',
      Authorization: hash,
      'User-Agent': 'GlobalRadioPodcastPlatform/1.0',
    };
  }
}
