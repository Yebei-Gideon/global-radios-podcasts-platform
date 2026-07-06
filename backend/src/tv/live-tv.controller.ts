import {
  Controller,
  Get,
  Inject,
  Logger,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PaginationDto, SearchQueryDto } from '../common/dto/pagination.dto';
import { LiveTvChannelDto, PaginatedResponseDto } from './dto/live-tv.dto';
import { LiveTvSearchManager } from './live-tv-search.manager';
import { LiveTvService } from './live-tv.service';

@Controller('tv')
export class LiveTvController {
  private readonly logger = new Logger(LiveTvController.name);

  constructor(
    @Inject(LiveTvService)
    private readonly liveTvService: LiveTvService,
    @Inject(LiveTvSearchManager)
    private readonly liveTvSearchManager: LiveTvSearchManager,
  ) { }

  @Get('health')
  healthCheck() {
    this.logger.log('GET /tv/health - Service is healthy');
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('channels')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getChannels(@Query() paginationDto: PaginationDto): Promise<PaginatedResponseDto<LiveTvChannelDto>> {
    this.logger.log(`GET /tv/channels - page: ${paginationDto.page}, limit: ${paginationDto.limit}`);
    return this.liveTvService.getChannels(paginationDto);
  }

  @Get('search')
  @UsePipes(new ValidationPipe({ transform: true }))
  async searchChannels(@Query() searchDto: SearchQueryDto): Promise<PaginatedResponseDto<LiveTvChannelDto>> {
    this.logger.log(`GET /tv/search - query: ${searchDto.query}, filters: ${JSON.stringify(searchDto)}`);
    return this.liveTvService.searchChannels(searchDto);
  }

  @Get('providers')
  async getProviders() {
    this.logger.log('GET /tv/providers');
    return this.liveTvSearchManager.getProviderStatuses();
  }
}
