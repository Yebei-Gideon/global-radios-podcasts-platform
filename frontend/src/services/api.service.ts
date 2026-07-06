import type { Podcast, PodcastEpisode, PodcastSearchParams, ProviderStatus } from '@/modules/podcast/types/podcast.types';
import type {
  LiveTvChannel,
  LiveTvProviderStatus,
  LiveTvSearchParams,
} from '@/modules/tv/types/live-tv.types';
import type {
  Country,
  PaginatedResponse,
  RadioStation,
  SearchParams,
  Tag,
} from '@/modules/radio/types/radio.types';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

/**
 * API Service for communicating with backend
 * All endpoints use the /api/v1 prefix
 *
 * Supports multi-provider podcast search with intelligent deduplication
 */
class ApiService {
  private axiosInstance: AxiosInstance;
  private baseURL: string;

  constructor() {
    // Use the full API URL from VITE_API_URL (include any path/prefix like /api/v1).
    // Fall back to same-origin /api/v1 when unset or clearly invalid for production.
    const envURL = import.meta.env.VITE_API_URL as string | undefined;
    const isBadProdURL = import.meta.env.PROD && !!envURL && (
      envURL.includes('localhost') ||
      envURL.includes('127.0.0.1') ||
      envURL.includes('/_/')
    );
    const apiURL = !envURL || isBadProdURL ? `${window.location.origin}/api/v1` : envURL;
    this.baseURL = apiURL;

    // Log the API URL being used (helpful for debugging)
    console.log('[API Service] Using API URL:', this.baseURL);
    console.log('[API Service] Development mode:', import.meta.env.DEV);

    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.log(`[API Service] Success: ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
        return response;
      },
      (error) => {
        console.error('[API Service] Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get paginated list of radio stations from all providers
   */
  async getStations(page = 1, limit = 100): Promise<PaginatedResponse<RadioStation>> {
    console.log(`[API Service] Fetching stations: page=${page}, limit=${limit}`);
    const response = await this.axiosInstance.get<PaginatedResponse<RadioStation>>(
      '/radio/stations',
      { params: { page, limit } }
    );
    console.log(`[API Service] Stations response:`, response.data);
    return response.data;
  }

  /**
   * Search radio stations with filters across multiple providers
   */
  async searchStations(params: SearchParams): Promise<PaginatedResponse<RadioStation>> {
    console.log(`[API Service] Searching stations with params:`, params);

    // Convert providers array to comma-separated string if provided
    const requestParams = {
      ...params,
      limit: params.limit || 100, // Increase default limit for multi-provider
      providers: params.providers?.length ? params.providers.join(',') : undefined,
    };

    const response = await this.axiosInstance.get<PaginatedResponse<RadioStation>>(
      '/radio/search',
      { params: requestParams }
    );
    console.log(`[API Service] Search response:`, response.data);
    return response.data;
  }

  /**
   * Get radio provider statuses
   */
  async getRadioProviders(): Promise<ProviderStatus[]> {
    const response = await this.axiosInstance.get<ProviderStatus[]>('/radio/providers');
    return response.data;
  }

  /**
   * Get list of countries
   */
  async getCountries(): Promise<Country[]> {
    const response = await this.axiosInstance.get<Country[]>('/radio/countries');
    return response.data;
  }

  /**
   * Get list of tags (genres)
   */
  async getTags(): Promise<Tag[]> {
    const response = await this.axiosInstance.get<Tag[]>('/radio/tags');
    return response.data;
  }

  // ============ Podcast APIs ============

  /**
   * Search podcasts across multiple providers
   * Supports filtering by specific providers, language, and result limit
   * Results are automatically deduplicated and sorted by provider priority
   */
  async searchPodcasts(params: PodcastSearchParams): Promise<Podcast[]> {
    try {
      // Convert providers array to comma-separated string for backend compatibility
      const requestParams = {
        ...params,
        providers: params.providers?.length ? params.providers.join(',') : undefined,
      };

      console.log('[API Service] Podcast search params:', requestParams);

      const response = await this.axiosInstance.get<Podcast[]>(
        '/podcasts/search',
        { params: requestParams }
      );
      return response.data;
    } catch (error) {
      console.error('Podcast search failed:', error);
      // Return empty array on error for graceful degradation
      return [];
    }
  }

  /**
   * Get provider usage statistics
   * Shows quota information for rate-limited providers
   */
  async getPodcastProviderStatus(): Promise<Record<string, ProviderStatus>> {
    try {
      const response = await this.axiosInstance.get<Record<string, ProviderStatus>>(
        '/podcasts/search/status'
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get provider status:', error);
      return {};
    }
  }

  /**
   * Get podcast by ID
   */
  async getPodcast(id: string): Promise<Podcast> {
    const response = await this.axiosInstance.get<Podcast>(`/podcasts/${id}`);
    return response.data;
  }

  /**
   * Get podcast episodes
   */
  async getPodcastEpisodes(podcastId: string, page = 1, limit = 20): Promise<PaginatedResponse<PodcastEpisode>> {
    const response = await this.axiosInstance.get<PaginatedResponse<PodcastEpisode>>(
      `/podcasts/${podcastId}/episodes`,
      { params: { page, limit } }
    );
    return response.data;
  }

  /**
   * Get podcast episodes by RSS feed URL (no persistence)
   */
  async getPodcastEpisodesByFeed(rssUrl: string, page = 1, limit = 20): Promise<PaginatedResponse<PodcastEpisode>> {
    const response = await this.axiosInstance.get<PaginatedResponse<PodcastEpisode>>(
      `/podcasts/episodes/by-feed`,
      { params: { rssUrl, page, limit } }
    );
    return response.data;
  }

  /**
   * Get podcast categories
   */
  async getPodcastCategories(): Promise<string[]> {
    const response = await this.axiosInstance.get<string[]>('/podcasts/categories');
    return response.data;
  }

  /**
   * Get popular/trending podcasts
   */
  async getPopularPodcasts(limit = 12): Promise<Podcast[]> {
    try {
      const response = await this.axiosInstance.get<PaginatedResponse<Podcast>>('/podcasts/trending', {
        params: { limit, page: 1 }
      });
      return response.data.data || [];
    } catch (error) {
      // Fallback: return empty array if endpoint not available
      console.warn('Podcast trending endpoint not available:', error);
      return [];
    }
  }

  // ============ Live TV APIs ============

  /**
   * Get paginated live TV channels from all enabled providers
   */
  async getLiveTvChannels(page = 1, limit = 24): Promise<PaginatedResponse<LiveTvChannel>> {
    const response = await this.axiosInstance.get<PaginatedResponse<LiveTvChannel>>('/tv/channels', {
      params: { page, limit },
    });
    return response.data;
  }

  /**
   * Search live TV channels across multiple providers
   */
  async searchLiveTv(params: LiveTvSearchParams): Promise<PaginatedResponse<LiveTvChannel>> {
    const requestParams = {
      ...params,
      providers: params.providers?.length ? params.providers.join(',') : undefined,
    };

    const response = await this.axiosInstance.get<PaginatedResponse<LiveTvChannel>>('/tv/search', {
      params: requestParams,
    });
    return response.data;
  }

  /**
   * Get live TV provider statuses
   */
  async getLiveTvProviders(): Promise<Record<string, LiveTvProviderStatus>> {
    const response = await this.axiosInstance.get<Record<string, LiveTvProviderStatus>>('/tv/providers');
    return response.data;
  }
}

export const apiService = new ApiService();
