import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { resolveRadioBrowserBaseUrls } from './providers/radio-browser-hosts';

/**
 * Service to interact with Radio Browser API
 * Radio Browser API is a community-driven open database of radio stations
 * API Documentation: https://api.radio-browser.info/
 */
@Injectable()
export class RadioBrowserService {
  private readonly logger = new Logger(RadioBrowserService.name);
  private readonly preferredBaseUrl: string;
  private baseUrlsPromise: Promise<string[]> | null = null;
  private currentBaseUrl: string;

  constructor() {
    const envBase = process.env.RADIO_BROWSER_API_URL;
    this.preferredBaseUrl = envBase?.replace(/\/+$/, '') || '';
    this.currentBaseUrl = this.preferredBaseUrl || 'https://de1.api.radio-browser.info';
  }

  private getBaseUrls(): Promise<string[]> {
    if (!this.baseUrlsPromise) {
      this.baseUrlsPromise = resolveRadioBrowserBaseUrls(this.preferredBaseUrl || undefined);
    }

    return this.baseUrlsPromise;
  }

  private createAxios(baseURL: string): AxiosInstance {
    return axios.create({
      baseURL,
      timeout: 20000,
      headers: {
        'User-Agent': 'RadioPlatform/1.0', // Required by Radio Browser API
      },
    });
  }

  /**
   * Try multiple Radio Browser hosts to avoid outages/geo issues.
   */
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
    throw new HttpException(
      'Failed to fetch radio data from Radio Browser',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Fetch stations with optional filters
   * Returns raw data from Radio Browser API
   */
  async fetchStations(params: {
    limit?: number;
    offset?: number;
    name?: string;
    country?: string;
    language?: string;
    tag?: string;
    order?: string;
  }): Promise<any[]> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    // If no filters and offset is 0, use the topvote endpoint for better performance
    if (!params.name && !params.country && !params.language && !params.tag && offset === 0) {
      const endpoint = `/json/stations/topvote/${limit}`;
      this.logger.debug(`Fetching top stations from Radio Browser: ${endpoint}`);
      return this.requestWithFallback<any[]>(endpoint);
    }

    // Otherwise, use search endpoint
    const queryParams: any = {
      limit,
      offset,
      order: params.order || 'votes', // Sort by popularity by default
      reverse: 'true', // Most popular first
    };

    // Add optional filters
    if (params.name) queryParams.name = params.name;
    if (params.country) queryParams.country = params.country;
    if (params.language) queryParams.language = params.language;
    if (params.tag) queryParams.tag = params.tag;

    const endpoint = '/json/stations/search';
    this.logger.debug(`Fetching stations from Radio Browser: ${endpoint}`, queryParams);

    return this.requestWithFallback<any[]>(endpoint, queryParams);
  }

  /**
   * Get list of ALL countries with at least one station
   * Radio Browser API returns the complete list of countries with stations
   * This includes all countries worldwide, including Kenya, Nigeria, etc.
   */
  async fetchCountries(): Promise<any[]> {
    const endpoint = '/json/countries';
    const data = await this.requestWithFallback<any[]>(endpoint);
    // Filter only countries with at least 1 station
    const filteredCountries = data.filter((c: any) => c.stationcount > 0);
    this.logger.debug(`Fetched ${filteredCountries.length} countries from Radio Browser API`);
    return filteredCountries;
  }

  /**
   * Get list of tags (genres) with station counts
   * Returns top genres, sorted by station count (most popular first)
   */
  async fetchTags(): Promise<any[]> {
    const endpoint = '/json/tags';
    const data = await this.requestWithFallback<any[]>(endpoint, {
      limit: 200,
      order: 'stationcount',
      reverse: 'true',
    });
    return data.filter((t: any) => t.stationcount > 0);
  }

  /**
   * Get station by UUID
   */
  async fetchStationById(uuid: string): Promise<any> {
    const endpoint = `/json/stations/byuuid/${uuid}`;
    const data = await this.requestWithFallback<any[]>(endpoint);
    return data[0];
  }

  /**
   * Get statistics about the Radio Browser database
   */
  async fetchStats(): Promise<any> {
    const endpoint = '/json/stats';
    return this.requestWithFallback<any>(endpoint);
  }
}
