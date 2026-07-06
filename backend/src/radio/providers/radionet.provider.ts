import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { BaseRadioProvider } from './base-radio-provider';
import { RadioProviderName, ProviderRadioResult, RadioProviderSearchParams, RadioProviderConfig } from '../types/radio-search.types';
import { getErrorMessage } from '../../common/utils/error-message.util';

/**
 * Radio.de / Radio.net Provider
 * Large European radio directory with global coverage
 * API: https://api.radio.net/info/v2/
 */
@Injectable()
export class RadioNetProvider implements BaseRadioProvider {
  readonly name: RadioProviderName = 'radionet';
  private readonly logger = new Logger(RadioNetProvider.name);
  private config: RadioProviderConfig;
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.radio.net/info/v2',
      timeout: 10000,
    });
  }

  configure(config: RadioProviderConfig): void {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.get('/search/stationsbykeyword', {
        params: { keyword: 'test', pageindex: 0, pagesize: 1 },
        timeout: 5000
      });
      return true;
    } catch (error) {
      this.logger.warn(`Radio.net provider unavailable: ${getErrorMessage(error)}`);
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
      const results: ProviderRadioResult[] = [];

      // If no search params, get popular stations
      if (!params.name && !params.country && !params.language && !params.tag) {
        const popularResults = await this.searchByKeyword('top', params.limit);
        results.push(...popularResults);
      } else {
        // Search by keyword if provided
        if (params.name) {
          const keywordResults = await this.searchByKeyword(params.name, params.limit);
          results.push(...keywordResults);
        }

        // Search by country if provided
        if (params.country && results.length < params.limit) {
          const countryResults = await this.searchByCountry(params.country, params.limit - results.length);
          results.push(...countryResults);
        }
      }

      // Apply language filter if provided
      let filtered = results;
      if (params.language) {
        const lang = params.language.toLowerCase();
        filtered = results.filter(s => s.language?.toLowerCase().includes(lang));
      }

      // Apply tag filter if provided
      if (params.tag) {
        const tag = params.tag.toLowerCase();
        filtered = filtered.filter(s =>
          s.tags?.some(t => t.toLowerCase().includes(tag))
        );
      }

      this.logger.log(`Radio.net provider returned ${filtered.length} stations`);
      return filtered.slice(0, params.limit);
    } catch (error) {
      this.logger.error(`Radio.net search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  private async searchByKeyword(keyword: string, limit: number): Promise<ProviderRadioResult[]> {
    try {
      const response = await this.client.get('/search/stationsbykeyword', {
        params: {
          keyword: keyword || 'music',
          pageindex: 0,
          pagesize: Math.min(limit, 100),
        },
      });

      const stations = response.data || [];
      return stations.map((s: any) => this.normalize(s));
    } catch (error) {
      this.logger.warn(`Radio.net keyword search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  private async searchByCountry(country: string, limit: number): Promise<ProviderRadioResult[]> {
    try {
      const response = await this.client.get('/search/stationsbycountry', {
        params: {
          country: country,
          pageindex: 0,
          pagesize: Math.min(limit, 100),
        },
      });

      const stations = response.data || [];
      return stations.map((s: any) => this.normalize(s));
    } catch (error) {
      this.logger.warn(`Radio.net country search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  private normalize(raw: any): ProviderRadioResult {
    return {
      id: raw.id || raw.stationId,
      name: raw.name || raw.title,
      streamUrl: this.extractStreamUrl(raw),
      country: raw.country,
      countryCode: raw.countryCode || raw.country_code,
      city: raw.city,
      language: raw.language,
      tags: this.extractTags(raw),
      homepage: raw.website || raw.homepage,
      favicon: raw.logo || raw.picture || raw.icon,
      bitrate: raw.bitrate || 128,
      codec: raw.codec || 'mp3',
      source: this.name,
      sourceProviders: [this.name],
    };
  }

  private extractStreamUrl(raw: any): string {
    // Try various possible stream URL fields
    return raw.streamUrl ||
      raw.stream_url ||
      raw.streamUrls?.[0] ||
      raw.stream ||
           raw.url ||
           `https://stream.radio.net/${raw.id}`;
  }

  private extractTags(raw: any): string[] {
    const tags: string[] = [];

    if (raw.genre) tags.push(raw.genre);
    if (raw.genres) tags.push(...(Array.isArray(raw.genres) ? raw.genres : [raw.genres]));
    if (raw.category) tags.push(raw.category);
    if (raw.categories) tags.push(...(Array.isArray(raw.categories) ? raw.categories : [raw.categories]));

    return tags.filter(Boolean);
  }
}
