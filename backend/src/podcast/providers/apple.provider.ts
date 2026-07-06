import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { BasePodcastProvider } from './base-provider';
import { ProviderConfig, ProviderPodcastResult, ProviderSearchParams, ProviderName } from '../types/podcast-search.types';
import { RateLimiterService } from '../rate-limiter.service';
import { getErrorMessage } from '../../common/utils/error-message.util';

@Injectable()
export class AppleProvider implements BasePodcastProvider {
  readonly name: ProviderName = 'apple';
  private readonly logger = new Logger(AppleProvider.name);
  private axiosInstance: AxiosInstance;
  private config: ProviderConfig;

  constructor(private readonly rateLimiter: RateLimiterService) {}

  configure(config: ProviderConfig): void {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl || 'https://itunes.apple.com',
      timeout: config.timeoutMs || 5000,
    });
  }

  async search(params: ProviderSearchParams): Promise<ProviderPodcastResult[]> {
    if (!this.config?.enabled) return [];
    if (!params.query) return [];

    const canProceed = await this.rateLimiter.canMakeRequest(
      this.name,
      this.config.rateLimit,
      this.config.rateLimitPeriodSeconds,
    );
    if (!canProceed) return [];

    try {
      const response = await this.axiosInstance.get('/search', {
        params: {
          media: 'podcast',
          term: params.query,
          limit: params.limit,
          lang: params.language,
        },
      });

      await this.rateLimiter.recordRequest(
        this.name,
        this.config.rateLimit,
        this.config.rateLimitPeriodSeconds,
      );

      const items = Array.isArray(response.data?.results)
        ? response.data.results
        : [];

      return items.map((item: any): ProviderPodcastResult => ({
        id: item.trackId?.toString(),
        title: item.collectionName || item.trackName,
        authorName: item.artistName,
        description: item.description || item.collectionCensoredName,
        imageUrl: item.artworkUrl600 || item.artworkUrl100,
        feedUrl: item.feedUrl,
        itunesId: item.collectionId?.toString() || item.trackId?.toString(),
        categories: item.genres || [],
        episodeCount: item.trackCount,
        language: item.language,
        websiteUrl: item.collectionViewUrl,
        source: this.name,
        explicit: item.collectionExplicitness === 'explicit',
        lastUpdated: item.releaseDate,
      }));
    } catch (error) {
      this.logger.warn(`Apple search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config?.enabled;
  }

  requiresAuthentication(): boolean {
    return false;
  }
}
