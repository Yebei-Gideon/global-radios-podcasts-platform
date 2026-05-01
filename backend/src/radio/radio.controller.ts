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
import {
  CountryDto,
  PaginatedResponseDto,
  RadioStationDto,
  TagDto,
} from './dto/radio-station.dto';
import { RadioSearchManager } from './radio-search.manager';
import { RadioService } from './radio.service';

/**
 * Radio Controller - handles all radio station related endpoints
 * All endpoints are read-only (no mutations in Phase 1)
 *
 * Important: This API only serves metadata. Audio streams are
 * accessed directly by the client using the streamUrl field.
 *
 * Now supports multi-provider search for better station coverage!
 */
@Controller('radio')
export class RadioController {
  private readonly logger = new Logger(RadioController.name);

  constructor(
    @Inject(RadioService)
    private readonly radioService: RadioService,
    @Inject(RadioSearchManager)
    private readonly radioSearchManager: RadioSearchManager,
  ) {}

/**
 * GET /api/v1/radio/health
 * Health check endpoint
 */
 @Get('health')
 healthCheck() {
   this.logger.log('GET /radio/health - Service is healthy');
    return {
     status: 'ok',
     timestamp: new Date().toISOString(),
     // TODO: add provider status to health check
      // providers: this.radioSearchManager.getProviderStatuses()
   };
  }


  /**
   * GET /api/v1/radio/stations
   * Get paginated list of radio stations
   *
   * Query params:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 20, max: 100)
   */
  @Get('stations')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getStations(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<RadioStationDto>> {
    this.logger.log(`GET /radio/stations - page: ${paginationDto.page}, limit: ${paginationDto.limit}`);
    return this.radioService.getStations(paginationDto);
  }

  /**
   * GET /api/v1/radio/search
   * Search stations with filters
   *
   * Query params:
   * - query: Station name search
   * - country: Filter by country name
   * - language: Filter by language
   * - tag: Filter by genre/tag
   * - page: Page number
   * - limit: Items per page
   */
  @Get('search')
  @UsePipes(new ValidationPipe({ transform: true }))
  async searchStations(
    @Query() searchDto: SearchQueryDto,
  ): Promise<PaginatedResponseDto<RadioStationDto>> {
    this.logger.log(`GET /radio/search - query: ${searchDto.query}, filters: ${JSON.stringify(searchDto)}`);
    return this.radioService.searchStations(searchDto);
  }

  /**
   * GET /api/v1/radio/countries
   * Get list of available countries with station counts
   * Used for filter dropdowns
   */
  @Get('countries')
  async getCountries(): Promise<CountryDto[]> {
    this.logger.log('GET /radio/countries');
    return this.radioService.getCountries();
  }

  /**
   * GET /api/v1/radio/tags
   * Get list of available tags (genres) with station counts
   * Used for filter dropdowns
   */
  @Get('tags')
  async getTags(): Promise<TagDto[]> {
    this.logger.log('GET /radio/tags');
    return this.radioService.getTags();
  }

  /**
   * GET /api/v1/radio/providers
   * Get status of all radio providers
   * Shows which providers are enabled and their priorities
   */
  @Get('providers')
  async getProviders(): Promise<any[]> {
    this.logger.log('GET /radio/providers');
    return this.radioSearchManager.getProviderStatuses();
  }
}
