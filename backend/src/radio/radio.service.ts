import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { PaginationDto, SearchQueryDto } from '../common/dto/pagination.dto';
import {
  CountryDto,
  PaginatedResponseDto,
  RadioStationDto,
  TagDto,
} from './dto/radio-station.dto';
import { RadioStation } from './entities/radio-station.entity';
import { RadioBrowserProvider } from './providers/radio-browser.provider';
import { RadioSearchManager } from './radio-search.manager';
import { ProviderRadioResult } from './types/radio-search.types';

/**
 * Main Radio Service - handles station data with multi-provider search
 * 1. Check Redis cache first
 * 2. If not cached, search across multiple providers
 * 3. Store in PostgreSQL for persistence
 * 4. Cache in Redis for fast access
 */
@Injectable()
export class RadioService {
  private readonly logger = new Logger(RadioService.name);

  constructor(
    @InjectRepository(RadioStation)
    private readonly radioRepository: Repository<RadioStation>,

    @Inject(RadioBrowserProvider)
    private readonly radioBrowserProvider: RadioBrowserProvider,

    @Inject(RadioSearchManager)
    private readonly radioSearchManager: RadioSearchManager,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * Get paginated list of radio stations using multi-provider search
   */
  async getStations(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<RadioStationDto>> {
    const { page = 1, limit = 20 } = paginationDto;

    // Use multi-provider search for all stations
    const searchDto = {
      page,
      limit,
      query: undefined,
      country: undefined,
      language: undefined,
      tag: undefined,
    };
    const providerResults = await this.radioSearchManager.search(searchDto);
    const savedStations = await this.saveProviderStations(providerResults);

    // For total, since we don't have exact total from providers, estimate or use a large number
    // In a real implementation, we'd need to aggregate totals from all providers
    const total = 50000; // Estimated total from all providers

    const response: PaginatedResponseDto<RadioStationDto> = {
      data: savedStations.map(this.toDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };

    return response;
  }

  /**
   * Search stations with filters using multi-provider search
   */
  async searchStations(
    searchDto: SearchQueryDto,
  ): Promise<PaginatedResponseDto<RadioStationDto>> {
    const { page = 1, limit = 20 } = searchDto;

    // Use multi-provider search manager
    const stations = await this.radioSearchManager.search(searchDto);

    // Convert provider results to DTOs and save to database
    const savedStations = await this.saveProviderStations(stations);

    const response: PaginatedResponseDto<RadioStationDto> = {
      data: savedStations.map(this.toDto),
      meta: {
        total: savedStations.length,
        page,
        limit,
        totalPages: savedStations.length === limit ? page + 1 : page,
      },
    };

    return response;
  }

  /**
   * Get list of ALL countries with stations
   * Sorted alphabetically for better UX
   * Includes countries with any number of stations (even local channels with 1-2 stations)
   * This ensures countries like Kenya, Nigeria, and other African nations are included
   */
  async getCountries(): Promise<CountryDto[]> {
    const cacheKey = 'countries:list';

    const cached = await this.cacheManager.get<CountryDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const countries = await this.radioBrowserProvider.fetchCountries();
    const result = countries
      .map((c) => ({
        name: c.name,
        code: c.iso_3166_1 || c.name,
        stationCount: c.stationcount,
      }))
      // Sort alphabetically by country name for better UX
      .sort((a, b) => a.name.localeCompare(b.name));

    this.logger.log(`Fetched ${result.length} countries from Radio Browser API`);
    await this.cacheManager.set(cacheKey, result, 86400000); // 24 hours
    return result;
  }

  /**
   * Get list of tags (genres)
   */
  async getTags(): Promise<TagDto[]> {
    const cacheKey = 'tags:list';

    const cached = await this.cacheManager.get<TagDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const tags = await this.radioBrowserProvider.fetchTags();
    const result = tags.map((t) => ({
      name: t.name,
      stationCount: t.stationcount,
    }));

    await this.cacheManager.set(cacheKey, result, 86400000); // 24 hours
    return result;
  }


  /**
   * Normalize Radio Browser API response to our entity format
   */
  private normalizeStation(raw: any): RadioStation {
    const station = new RadioStation();
    station.id = raw.stationuuid;
    station.name = raw.name;
    station.url = raw.homepage || raw.url;
    station.ssl = raw.ssl === 1 || raw.ssl === true;

    const resolvedStream = raw.url_resolved || raw.url || '';
    // Prefer HTTPS when the station is marked as SSL-capable to avoid mixed-content blocks
    station.streamUrl = this.ensureHttps(resolvedStream, station.ssl);
    station.country = raw.country;
    station.countrycode = raw.countrycode;
    station.state = raw.state;
    station.language = raw.language;
    station.tags = raw.tags ? raw.tags.split(',').filter((t: string) => t.trim()) : [];
    station.favicon = raw.favicon;
    station.bitrate = parseInt(raw.bitrate, 10) || 0;
    station.codec = raw.codec;
    station.votes = parseInt(raw.votes, 10) || 0;
    return station;
  }

  /**
   * Force HTTPS stream URLs when the source indicates SSL support.
   * This prevents browsers from blocking http streams on https pages.
   */
  private ensureHttps(streamUrl: string, ssl: boolean): string {
    if (!streamUrl) return streamUrl;
    if (ssl && streamUrl.startsWith('http://')) {
      return streamUrl.replace(/^http:/i, 'https:');
    }
    return streamUrl;
  }

  /**
   * Save stations from provider results to database
   */
  private async saveProviderStations(providerResults: ProviderRadioResult[]): Promise<RadioStation[]> {
    if (!providerResults.length) return [];

    const stations = providerResults.map((result) => this.providerResultToEntity(result));

    try {
      return await this.radioRepository.save(stations, { chunk: 50 });
    } catch (error) {
      this.logger.error('Failed to save provider stations to database', error);
      return stations; // Return unsaved entities to avoid breaking the flow
    }
  }

  /**
   * Convert provider result to entity
   */
  private providerResultToEntity(result: ProviderRadioResult): RadioStation {
    const station = new RadioStation();
    station.id = result.id || `${result.source}-${Date.now()}-${Math.random()}`;
    station.name = result.name;
    station.url = result.homepage || '';
    station.streamUrl = result.streamUrl;
    station.country = result.country || '';
    station.countrycode = result.countryCode || '';
    station.state = result.state || '';
    station.language = result.language || '';
    station.tags = result.tags || [];
    station.favicon = result.favicon || '';
    station.bitrate = result.bitrate || 0;
    station.codec = result.codec || '';
    station.votes = result.votes || 0;
    station.ssl = result.streamUrl?.startsWith('https://') || false;
    return station;
  }

  /**
   * Convert entity to DTO
   */
  private toDto(station: RadioStation): RadioStationDto {
    return {
      id: station.id,
      name: station.name,
      url: station.url,
      streamUrl: station.streamUrl, // CRITICAL: Client uses this to connect directly
      country: station.country,
      countrycode: station.countrycode,
      state: station.state,
      language: station.language,
      tags: station.tags,
      favicon: station.favicon,
      bitrate: station.bitrate,
      codec: station.codec,
      votes: station.votes,
      ssl: station.ssl,
    };
  }
}
