import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as xml2js from 'xml2js';
import { getErrorMessage } from '../common/utils/error-message.util';

/**
 * Podcast Index Service
 * Integrates with Podcast Index API for discovering podcasts
 * Also handles RSS feed parsing for episode data
 *
 * API Documentation: https://podcastindex-api.podarse.com/
 */
@Injectable()
export class PodcastIndexService {
  private readonly logger = new Logger(PodcastIndexService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly xmlParser: xml2js.Parser;
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.PODCAST_INDEX_API_URL || 'https://api.podcastindex.org/api/1.0';

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'User-Agent': 'RadioPodcastPlatform/1.0',
      },
    });

    this.xmlParser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
    });
  }

  /**
   * Search podcasts by query (title, author, etc.)
   * Note: Podcast Index requires API credentials (free tier available)
   */
  async searchPodcasts(params: {
    query?: string;
    category?: string;
    language?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      // TODO: Implement with Podcast Index API credentials
      // For now, return empty array
      // Credentials will be added via environment variables
      this.logger.warn('Podcast Index search not yet fully implemented - requires API credentials');
      return [];
    } catch (error) {
      this.logger.error('Failed to search podcasts', getErrorMessage(error));
      throw new HttpException(
        'Failed to search podcasts',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Get trending podcasts globally
   */
  async getTrendingPodcasts(params: {
    limit?: number;
    language?: string;
  }): Promise<any[]> {
    try {
      // TODO: Implement with Podcast Index trending endpoint
      this.logger.warn('Trending podcasts endpoint not yet fully implemented');
      return [];
    } catch (error) {
      this.logger.error('Failed to fetch trending podcasts', getErrorMessage(error));
      throw new HttpException(
        'Failed to fetch trending podcasts',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Get podcasts by category/genre
   */
  async getPodcastsByCategory(category: string): Promise<any[]> {
    try {
      // TODO: Implement category-based search
      this.logger.warn(`Fetching podcasts for category: ${category}`);
      return [];
    } catch (error) {
      this.logger.error('Failed to fetch podcasts by category', getErrorMessage(error));
      throw new HttpException(
        'Failed to fetch podcasts',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Fetch RSS feed and parse episodes
   * This is the core functionality for ingesting podcast episodes
   */
  async fetchAndParseRssFeed(rssUrl: string): Promise<{
    podcast: any;
    episodes: any[];
  }> {
    try {
      this.logger.debug(`Fetching RSS feed: ${rssUrl}`);

      const response = await this.axiosInstance.get(rssUrl, {
        timeout: 20000,
        responseType: 'text',
      });

      const feed = await this.xmlParser.parseStringPromise(response.data);
      const channel = feed.rss?.channel;

      if (!channel) {
        throw new Error('Invalid RSS feed structure');
      }

      // Extract podcast metadata
      const podcast = {
        title: channel.title,
        description: channel.description,
        imageUrl: channel.image?.url || channel['itunes:image']?.href,
        authorName: channel['itunes:author'] || channel.author,
        language: channel.language || 'unknown',
        websiteUrl: channel.link,
        rssUrl: rssUrl,
      };

      // Extract episodes
      const items = Array.isArray(channel.item) ? channel.item : [channel.item];
      const episodes = items
        .filter((item) => item && item.enclosure) // Only items with audio
        .map((item) => ({
          title: item.title,
          description: item.description || item.summary,
          guid: item.guid?._text || item.guid, // RSS guid for unique identification
          audioUrl: item.enclosure.url,
          duration: parseInt(item['itunes:duration'], 10) || null,
          imageUrl: item.image?.url || item['itunes:image']?.href || podcast.imageUrl,
          publishDate: new Date(item.pubDate),
        }));

      this.logger.debug(`Parsed ${episodes.length} episodes from RSS feed`);

      return { podcast, episodes };
    } catch (error) {
      this.logger.error(`Failed to fetch/parse RSS feed: ${rssUrl}`, getErrorMessage(error));
      throw new HttpException(
        'Failed to fetch podcast episodes',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get list of popular podcast categories
   */
  async getCategories(): Promise<string[]> {
    // Standard iTunes/Podcast categories
    return [
      'Arts',
      'Business',
      'Comedy',
      'Education',
      'Fiction',
      'Government',
      'Health & Fitness',
      'History',
      'Kids & Family',
      'Leisure',
      'Music',
      'News',
      'Religion & Spirituality',
      'Science',
      'Sports',
      'Technology',
      'True Crime',
      'TV & Film',
    ];
  }
}
