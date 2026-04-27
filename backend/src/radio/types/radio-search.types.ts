export type RadioProviderName = 'radio_browser' | 'radionet' | 'shoutcast' | 'radioplayer';

export interface RadioProviderConfig {
  enabled: boolean;
  priority: number;
  timeoutMs: number;
  cacheTtlMs: number;
  rateLimit?: number | null;
  rateLimitPeriodSeconds?: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface ProviderRadioResult {
  id?: string;
  name: string;
  streamUrl: string;
  country?: string;
  countryCode?: string;
  state?: string;
  city?: string;
  language?: string;
  tags?: string[];
  bitrate?: number;
  codec?: string;
  homepage?: string;
  favicon?: string;
  votes?: number;
  clickCount?: number;
  source: RadioProviderName;
  sourceProviders?: RadioProviderName[];
  lastUpdated?: string;
}

export interface RadioProviderSearchParams {
  name?: string;
  country?: string;
  language?: string;
  tag?: string;
  limit: number;
  offset?: number;
}

export interface RadioProviderStatus {
  name: RadioProviderName;
  enabled: boolean;
  available: boolean;
  priority: number;
  rateLimit?: number | null;
  remaining?: number | null;
}
