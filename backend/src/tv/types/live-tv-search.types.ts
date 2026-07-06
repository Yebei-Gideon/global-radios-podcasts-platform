export type LiveTvProviderName = 'iptv_org_api' | 'iptv_org_playlist';

export interface LiveTvProviderConfig {
  enabled: boolean;
  priority: number;
  timeoutMs: number;
  cacheTtlMs: number;
  rateLimit?: number | null;
  rateLimitPeriodSeconds?: number;
  apiKey?: string;
  baseUrl?: string;
  playlistUrl?: string;
}

export interface ProviderLiveTvResult {
  id?: string;
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
  source: LiveTvProviderName;
  sourceProviders?: LiveTvProviderName[];
  lastUpdated?: string;
}

export interface LiveTvProviderSearchParams {
  name?: string;
  country?: string;
  language?: string;
  category?: string;
  limit: number;
  offset?: number;
}

export interface LiveTvProviderStatus {
  name: LiveTvProviderName;
  enabled: boolean;
  available: boolean;
  priority: number;
  rateLimit?: number | null;
  remaining?: number | null;
}
