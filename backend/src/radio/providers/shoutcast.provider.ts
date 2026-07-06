import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { BaseRadioProvider } from './base-radio-provider';
import { RadioProviderName, ProviderRadioResult, RadioProviderSearchParams, RadioProviderConfig } from '../types/radio-search.types';
import { getErrorMessage } from '../../common/utils/error-message.util';

/**
 * Shoutcast Directory Provider
 * One of the largest internet radio directories
 * Covers stations from all over the world
 */
@Injectable()
export class ShoutcastProvider implements BaseRadioProvider {
  readonly name: RadioProviderName = 'shoutcast';
  private readonly logger = new Logger(ShoutcastProvider.name);
  private config: RadioProviderConfig;
  private client: AxiosInstance;

  // Shoutcast public directory API
  private readonly baseUrl = 'https://directory.shoutcast.com';

  constructor() {
    this.client = axios.create({
      timeout: 10000,
    });
  }

  configure(config: RadioProviderConfig): void {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.get(`${this.baseUrl}/Search/UpdateSearch`, {
        params: { query: 'test' },
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  requiresAuthentication(): boolean {
    return false;
  }

  async search(params: RadioProviderSearchParams): Promise<ProviderRadioResult[]> {
    if (!this.config?.enabled) {
      return [];
    }

    try {
      let searchQuery = params.name || params.tag || '';

      // If no query provided, search for popular/top stations
      if (!searchQuery && !params.country && !params.language) {
        searchQuery = 'top';
      }

      // Add country to search if provided
      if (params.country) {
        searchQuery = searchQuery ? `${searchQuery} ${params.country}` : params.country;
      }

      // Add language to search if provided
      if (params.language) {
        searchQuery = searchQuery ? `${searchQuery} ${params.language}` : params.language;
      }

      // Ensure we have at least some query
      if (!searchQuery) {
        searchQuery = 'music';
      }

      const response = await this.client.get(`${this.baseUrl}/Search/UpdateSearch`, {
        params: {
          query: searchQuery,
          limit: params.limit || 20,
        },
        timeout: this.config?.timeoutMs || 10000,
      });

      const stations = response.data?.result || response.data || [];
      const results = Array.isArray(stations)
        ? stations.map((s: any) => this.normalize(s))
        : [];

      this.logger.log(`Shoutcast provider returned ${results.length} stations`);
      return results.slice(0, params.limit);
    } catch (error) {
      this.logger.error(`Shoutcast search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  private normalize(raw: any): ProviderRadioResult {
    return {
      id: raw.ID || raw.id || `shoutcast-${raw.Name}`,
      name: raw.Name || raw.name,
      streamUrl: this.buildStreamUrl(raw),
      country: raw.Country || raw.country,
      countryCode: raw.CountryCode || raw.country_code,
      language: raw.Language || raw.language,
      tags: this.extractGenres(raw),
      homepage: raw.Homepage || raw.homepage,
      favicon: raw.Logo || raw.logo,
      bitrate: parseInt(raw.Bitrate || raw.bitrate || '128', 10),
      codec: raw.Format || raw.codec || 'mp3',
      votes: parseInt(raw.Listeners || raw.listeners || '0', 10),
      source: this.name,
      sourceProviders: [this.name],
    };
  }

  private buildStreamUrl(raw: any): string {
    if (raw.StreamUrl || raw.stream_url) {
      return raw.StreamUrl || raw.stream_url;
    }

    // Construct Shoutcast stream URL
    const id = raw.ID || raw.id;
    if (id) {
      return `https://yp.shoutcast.com/sbin/tunein-station.pls?id=${id}`;
    }

    return raw.Url || raw.url || '';
  }

  private extractGenres(raw: any): string[] {
    const genres: string[] = [];

    if (raw.Genre) {
      genres.push(...raw.Genre.split(',').map((g: string) => g.trim()));
    }
    if (raw.genre) {
      genres.push(...raw.genre.split(',').map((g: string) => g.trim()));
    }
    if (raw.Genres) {
      genres.push(...(Array.isArray(raw.Genres) ? raw.Genres : [raw.Genres]));
    }

    return genres.filter(Boolean);
  }
}
