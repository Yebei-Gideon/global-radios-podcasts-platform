import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { BasePodcastProvider } from './base-provider';
import { ProviderConfig, ProviderPodcastResult, ProviderSearchParams, ProviderName } from '../types/podcast-search.types';
import { RateLimiterService } from '../rate-limiter.service';
import { getErrorMessage } from '../../common/utils/error-message.util';

@Injectable()
export class TaddyProvider implements BasePodcastProvider {
  readonly name: ProviderName = 'taddy';
  private readonly logger = new Logger(TaddyProvider.name);
  private axiosInstance: AxiosInstance;
  private config: ProviderConfig;

  constructor(private readonly rateLimiter: RateLimiterService) {}

  configure(config: ProviderConfig): void {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl || 'https://api.taddy.org',
      timeout: config.timeoutMs || 8000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async search(params: ProviderSearchParams): Promise<ProviderPodcastResult[]> {
    if (!this.config?.enabled) return [];
    if (!params.query) return [];
    if (!this.config.apiKey) {
      this.logger.warn('Taddy API key missing; skipping search.');
      return [];
    }

    const canProceed = await this.rateLimiter.canMakeRequest(
      this.name,
      this.config.rateLimit,
      this.config.rateLimitPeriodSeconds,
    );
    if (!canProceed) return [];

    const query = `query Search($term: String!, $limit: Int!) {
      searchForTerm(term: $term, limitPerType: $limit) {
        podcastSeries {
          uuid
          name
          description
          imageUrl
          rssUrl
          language
          websiteUrl
        }
      }
    }`;

    try {
      const response = await this.axiosInstance.post(
        '/graphql',
        {
          query,
          variables: {
            term: params.query,
            limit: params.limit,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        },
      );

      await this.rateLimiter.recordRequest(
        this.name,
        this.config.rateLimit,
        this.config.rateLimitPeriodSeconds,
      );

      const series =
        response.data?.data?.searchForTerm?.podcastSeries &&
        Array.isArray(response.data.data.searchForTerm.podcastSeries)
          ? response.data.data.searchForTerm.podcastSeries
          : [];

      return series.map((item: any): ProviderPodcastResult => ({
        id: item.uuid,
        title: item.name,
        authorName: item.authorName,
        description: item.description,
        imageUrl: item.imageUrl,
        feedUrl: item.rssUrl,
        language: item.language,
        websiteUrl: item.websiteUrl,
        source: this.name,
        explicit: false,
      }));
    } catch (error) {
      this.logger.warn(`Taddy search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config?.enabled && !!this.config.apiKey;
  }

  requiresAuthentication(): boolean {
    return true;
  }
}
