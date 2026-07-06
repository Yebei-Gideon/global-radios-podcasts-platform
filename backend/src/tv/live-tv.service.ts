import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { PaginationDto, SearchQueryDto } from '../common/dto/pagination.dto';
import { LiveTvChannelDto, PaginatedResponseDto } from './dto/live-tv.dto';
import { LiveTvSearchManager } from './live-tv-search.manager';
import { ProviderLiveTvResult } from './types/live-tv-search.types';

@Injectable()
export class LiveTvService {
  private readonly logger = new Logger(LiveTvService.name);

  constructor(
    @Inject(LiveTvSearchManager)
    private readonly liveTvSearchManager: LiveTvSearchManager,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) { }

  async getChannels(paginationDto: PaginationDto): Promise<PaginatedResponseDto<LiveTvChannelDto>> {
    const { page = 1, limit = 24 } = paginationDto;
    const providerResults = await this.liveTvSearchManager.search({ page, limit });

    const response: PaginatedResponseDto<LiveTvChannelDto> = {
      data: providerResults.map((result) => this.toDto(result)),
      meta: {
        total: Math.max(providerResults.length, 100000),
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(Math.max(providerResults.length, 100000) / limit)),
      },
    };

    return response;
  }

  async searchChannels(searchDto: SearchQueryDto): Promise<PaginatedResponseDto<LiveTvChannelDto>> {
    const { page = 1, limit = 24 } = searchDto;
    const channels = await this.liveTvSearchManager.search(searchDto);

    const response: PaginatedResponseDto<LiveTvChannelDto> = {
      data: channels.map((channel) => this.toDto(channel)),
      meta: {
        total: channels.length,
        page,
        limit,
        totalPages: channels.length === limit ? page + 1 : page,
      },
    };

    return response;
  }

  private toDto(channel: ProviderLiveTvResult): LiveTvChannelDto {
    return {
      id: channel.id || `${channel.source}-${Date.now()}-${Math.random()}`,
      name: channel.name,
      streamUrl: channel.streamUrl,
      country: channel.country,
      countryCode: channel.countryCode,
      language: channel.language,
      category: channel.category,
      logoUrl: channel.logoUrl,
      websiteUrl: channel.websiteUrl,
      groupTitle: channel.groupTitle,
      referrer: channel.referrer,
      userAgent: channel.userAgent,
      quality: channel.quality,
      source: channel.source,
      sourceProviders: channel.sourceProviders,
      lastUpdated: channel.lastUpdated,
    };
  }
}
