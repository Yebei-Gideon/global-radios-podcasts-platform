export interface LiveTvChannel {
  id: string;
  name: string;
  streamUrl: string;
  country?: string;
  countryCode?: string;
  language?: string;
  category?: string;
  logoUrl?: string;
  websiteUrl?: string;
  groupTitle?: string;
  referrer?: string;
  userAgent?: string;
  quality?: string;
  source: string;
  sourceProviders?: string[];
  lastUpdated?: string;
}

export interface LiveTvSearchParams {
  query?: string;
  country?: string;
  language?: string;
  tag?: string;
  page?: number;
  limit?: number;
  providers?: string[];
}

export interface LiveTvProviderStatus {
  name: string;
  enabled: boolean;
  available: boolean;
  priority: number;
  rateLimit?: number | null;
  remaining?: number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
