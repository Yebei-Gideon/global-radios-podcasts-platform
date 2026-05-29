import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ProviderRadioResult, RadioProviderConfig, RadioProviderName, RadioProviderSearchParams } from '../types/radio-search.types';
import { BaseRadioProvider } from './base-radio-provider';
import { resolveRadioBrowserBaseUrls } from './radio-browser-hosts';

/**
 * Radio Browser Provider
 * Radio Browser API is a community-driven open database of radio stations
 * API Documentation: https://api.radio-browser.info/
 */
@Injectable()
export class RadioBrowserProvider implements BaseRadioProvider {
  readonly name: RadioProviderName = 'radio_browser';
  private readonly logger = new Logger(RadioBrowserProvider.name);
  private preferredBaseUrl: string;
  private baseUrlsPromise: Promise<string[]> | null = null;
  private currentBaseUrl: string;
  private config: RadioProviderConfig;

  constructor() {
    const envBase = process.env.RADIO_BROWSER_API_URL;
    this.preferredBaseUrl = envBase?.replace(/\/+$/, '') || '';
    this.currentBaseUrl = this.preferredBaseUrl || 'https://de1.api.radio-browser.info';
  }

  configure(config: RadioProviderConfig): void {
    this.config = config;
    if (config.baseUrl) {
      this.preferredBaseUrl = config.baseUrl.replace(/\/+$/, '');
      this.currentBaseUrl = this.preferredBaseUrl;
      this.baseUrlsPromise = null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const [firstBaseUrl] = await this.getBaseUrls();
      this.currentBaseUrl = firstBaseUrl || this.currentBaseUrl;
      const client = this.createAxios(this.currentBaseUrl);
      await client.get('/json/stats', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  requiresAuthentication(): boolean {
    return false;
  }

  async search(params: RadioProviderSearchParams): Promise<ProviderRadioResult[]> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    // For the default discovery view, use the topvote route because it is
    // more reliable than the generic search endpoint and still returns a broad
    // set of stations when no filters are applied.
    if (!params.name && !params.country && !params.language && !params.tag && offset === 0) {
      const endpoint = `/json/stations/topvote/${limit}`;
      this.logger.debug(`Radio Browser top stations: ${endpoint}`);

      const stations = await this.requestWithFallback<any[]>(endpoint);
      return stations.map((s) => this.normalize(s));
    }

    const queryParams: any = {
      limit,
      offset,
      order: 'votes',
      reverse: 'true',
    };

    // Only add filters if they are provided
    if (params.name) queryParams.name = params.name;
    if (params.country) queryParams.country = params.country;
    if (params.language) queryParams.language = params.language;
    if (params.tag) queryParams.tag = params.tag;

    const endpoint = '/json/stations/search';
    this.logger.debug(`Radio Browser search: ${endpoint}`, queryParams);

    const stations = await this.requestWithFallback<any[]>(endpoint, queryParams);
    return stations.map((s) => this.normalize(s));
  }

  async fetchCountries(): Promise<any[]> {
    const endpoint = '/json/countries';
    const data = await this.requestWithFallback<any[]>(endpoint);
    return data.filter((c: any) => c.stationcount > 0);
  }

  async fetchTags(): Promise<any[]> {
    const endpoint = '/json/tags';
    const data = await this.requestWithFallback<any[]>(endpoint, {
      limit: 200,
      order: 'stationcount',
      reverse: 'true',
    });
    return data.filter((t: any) => t.stationcount > 0);
  }

  private createAxios(baseURL: string): AxiosInstance {
    return axios.create({
      baseURL,
      timeout: this.config?.timeoutMs || 10000,
      headers: {
        'User-Agent': 'RadioPlatform/1.0',
      },
    });
  }

  private getBaseUrls(): Promise<string[]> {
    if (!this.baseUrlsPromise) {
      this.baseUrlsPromise = resolveRadioBrowserBaseUrls(this.preferredBaseUrl || undefined);
    }

    return this.baseUrlsPromise;
  }

  private async requestWithFallback<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const errors: Array<string> = [];
    const baseUrls = await this.getBaseUrls();

    for (const base of baseUrls) {
      try {
        const client = this.createAxios(base);
        const response = await client.get<T>(endpoint, { params });
        if (this.currentBaseUrl !== base) {
          this.logger.warn(`Switching Radio Browser base to ${base}`);
          this.currentBaseUrl = base;
        }
        return response.data as T;
      } catch (error) {
        const message = (error as any)?.message || 'Unknown error';
        errors.push(`${base}${endpoint}: ${message}`);
        this.logger.warn(`Radio Browser host failed ${base}${endpoint}: ${message}`);
        continue;
      }
    }

    this.logger.error('All Radio Browser hosts failed', errors.join(' | '));
    throw new Error('Failed to fetch from Radio Browser');
  }

  private normalize(raw: any): ProviderRadioResult {
    return {
      id: raw.stationuuid,
      name: raw.name,
      streamUrl: raw.url_resolved || raw.url,
      country: raw.country,
      countryCode: raw.countrycode,
      state: raw.state,
      city: raw.state,
      language: raw.language,
      tags: raw.tags ? raw.tags.split(',').map((t: string) => t.trim()) : [],
      bitrate: raw.bitrate,
      codec: raw.codec,
      homepage: raw.homepage,
      favicon: raw.favicon,
      votes: raw.votes,
      clickCount: raw.clickcount,
      source: this.name,
      sourceProviders: [this.name],
      lastUpdated: raw.lastchangetime,
    };
  }
}
