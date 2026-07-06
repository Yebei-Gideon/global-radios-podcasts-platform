import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PaginationDto, SearchQueryDto } from '../common/dto/pagination.dto';
import {
  PaginatedEpisodeDto,
  PaginatedPodcastDto,
  PodcastDto,
  PodcastEpisodeDto,
} from './dto/podcast.dto';
import { PodcastEpisode } from './entities/podcast-episode.entity';
import { Podcast } from './entities/podcast.entity';
import { PodcastIndexService } from './podcast-index.service';

/**
 * Main Podcast Service
 * Handles podcast discovery, episode fetching, and caching
 */
@Injectable()
export class PodcastService {
  private readonly logger = new Logger(PodcastService.name);

  constructor(
    @InjectRepository(Podcast)
    private readonly podcastRepository: Repository<Podcast>,
    @InjectRepository(PodcastEpisode)
    private readonly episodeRepository: Repository<PodcastEpisode>,
    @Inject(PodcastIndexService)
    private readonly podcastIndexService: PodcastIndexService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Search podcasts with optional filters
   */
  async searchPodcasts(
    searchDto: SearchQueryDto,
  ): Promise<PaginatedPodcastDto> {
    const { page = 1, limit = 20, query, language } = searchDto;
    const cacheKey = `podcasts:search:${query}:${language}:${page}:${limit}`;

    // Try cache first
    const cached = await this.cacheManager.get<PaginatedPodcastDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Search in local database first
    let podcasts = await this.podcastRepository
      .createQueryBuilder('podcast')
      .where('podcast.title ILIKE :query', { query: `%${query}%` })
      .orWhere('podcast.description ILIKE :query', { query: `%${query}%` })
      .orWhere('podcast.authorName ILIKE :query', { query: `%${query}%` });

    if (language) {
      podcasts = podcasts.andWhere('podcast.language = :language', { language });
    }

    const [data, total] = await podcasts
      .orderBy('podcast.popularity', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const response: PaginatedPodcastDto = {
      data: data.map(this.toDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheManager.set(cacheKey, response, 1800000); // 30 minutes
    return response;
  }

  /**
   * Get podcasts by category
   */
  async getPodcastsByCategory(
    category: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedPodcastDto> {
    const { page = 1, limit = 20 } = paginationDto;
    const cacheKey = `podcasts:category:${category}:${page}:${limit}`;

    const cached = await this.cacheManager.get<PaginatedPodcastDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const [data, total] = await this.podcastRepository
      .createQueryBuilder('podcast')
      .where(':category = ANY(podcast.categories)', { category })
      .andWhere('podcast.active = :active', { active: true })
      .orderBy('podcast.popularity', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const response: PaginatedPodcastDto = {
      data: data.map(this.toDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheManager.set(cacheKey, response, 3600000); // 1 hour
    return response;
  }

  /**
   * Get trending podcasts
   */
  async getTrendingPodcasts(
    paginationDto: PaginationDto,
  ): Promise<PaginatedPodcastDto> {
    const { page = 1, limit = 20 } = paginationDto;
    const cacheKey = `podcasts:trending:${page}:${limit}`;

    const cached = await this.cacheManager.get<PaginatedPodcastDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const [data, total] = await this.podcastRepository
      .createQueryBuilder('podcast')
      .where('podcast.active = :active', { active: true })
      .orderBy('podcast.popularity', 'DESC')
      .addOrderBy('podcast.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const response: PaginatedPodcastDto = {
      data: data.map(this.toDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheManager.set(cacheKey, response, 3600000); // 1 hour
    return response;
  }

  /**
   * Get episodes for a specific podcast
   */
  async getPodcastEpisodes(
    podcastId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedEpisodeDto> {
    const { page = 1, limit = 20 } = paginationDto;
    const cacheKey = `podcast:${podcastId}:episodes:${page}:${limit}`;

    const cached = await this.cacheManager.get<PaginatedEpisodeDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Verify podcast exists
    const podcast = await this.podcastRepository.findOne({ where: { id: podcastId } });
    if (!podcast) {
      throw new Error('Podcast not found');
    }

    const [data, total] = await this.episodeRepository
      .createQueryBuilder('episode')
      .where('episode.podcastId = :podcastId', { podcastId })
      .orderBy('episode.publishDate', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const response: PaginatedEpisodeDto = {
      data: data.map(this.toEpisodeDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheManager.set(cacheKey, response, 900000); // 15 minutes
    return response;
  }

  /**
   * Add a new podcast by RSS URL
   */
  async addPodcastByRss(rssUrl: string): Promise<PodcastDto> {
    try {
      // Parse RSS feed
      const { podcast: podcastData, episodes } =
        await this.podcastIndexService.fetchAndParseRssFeed(rssUrl);

      const podcastId = uuidv4();

      // Create and save podcast
      const podcast = new Podcast();
      podcast.id = podcastId;
      podcast.title = podcastData.title;
      podcast.description = podcastData.description;
      podcast.imageUrl = podcastData.imageUrl;
      podcast.authorName = podcastData.authorName;
      podcast.language = podcastData.language;
      podcast.websiteUrl = podcastData.websiteUrl;
      podcast.rssUrl = rssUrl;
      podcast.episodeCount = episodes.length;
      podcast.active = true;
      podcast.lastFetchedAt = new Date();

      const savedPodcast = await this.podcastRepository.save(podcast);

      // Save episodes
      if (episodes.length > 0) {
        const episodeEntities = episodes.map((ep) => {
          const episode = new PodcastEpisode();
          episode.id = uuidv4();
          episode.podcastId = podcastId;
          episode.title = ep.title;
          episode.description = ep.description;
          episode.audioUrl = ep.audioUrl;
          episode.duration = ep.duration;
          episode.guid = ep.guid;
          episode.imageUrl = ep.imageUrl;
          episode.publishDate = ep.publishDate;
          episode.playCount = 0;
          return episode;
        });

        await this.episodeRepository.save(episodeEntities);
      }

      this.logger.log(`Added podcast: ${podcast.title} with ${episodes.length} episodes`);
      return this.toDto(savedPodcast);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to add podcast from RSS: ${rssUrl}`, errorMessage);
      throw error;
    }
  }

  /**
   * Get list of available categories
   */
  async getCategories(): Promise<string[]> {
    const cacheKey = 'podcasts:categories';
    const cached = await this.cacheManager.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await this.podcastIndexService.getCategories();
    await this.cacheManager.set(cacheKey, categories, 86400000); // 24 hours
    return categories;
  }

  /**
   * Convert entity to DTO
   */
  private toDto(podcast: Podcast): PodcastDto {
    return {
      id: podcast.id,
      title: podcast.title,
      description: podcast.description,
      imageUrl: podcast.imageUrl,
      authorName: podcast.authorName,
      language: podcast.language,
      categories: podcast.categories || [],
      country: podcast.country,
      episodeCount: podcast.episodeCount,
      websiteUrl: podcast.websiteUrl,
      popularity: podcast.popularity,
      active: podcast.active,
      updatedAt: podcast.updatedAt,
    };
  }

  /**
   * Convert episode entity to DTO
   */
  private toEpisodeDto(episode: PodcastEpisode): PodcastEpisodeDto {
    return {
      id: episode.id,
      podcastId: episode.podcastId,
      title: episode.title,
      description: episode.description,
      audioUrl: episode.audioUrl,
      duration: episode.duration,
      imageUrl: episode.imageUrl,
      publishDate: episode.publishDate,
      playCount: episode.playCount,
    };
  }
}
