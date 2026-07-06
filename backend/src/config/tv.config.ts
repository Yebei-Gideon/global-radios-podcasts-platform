import { registerAs } from '@nestjs/config';

const toBool = (value: string | undefined, defaultValue = true) => {
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
};

const toNumber = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export default registerAs('liveTvProviders', () => ({
  search: {
    defaultLimit: toNumber(process.env.LIVE_TV_SEARCH_DEFAULT_LIMIT, 24),
    maxLimit: toNumber(process.env.LIVE_TV_SEARCH_MAX_LIMIT, 100),
    cacheTtlMs: toNumber(process.env.LIVE_TV_SEARCH_CACHE_TTL_MS, 3600_000),
  },
  providers: {
    iptv_org_api: {
      enabled: toBool(process.env.LIVE_TV_IPTV_ORG_API_ENABLED, true),
      priority: toNumber(process.env.LIVE_TV_IPTV_ORG_API_PRIORITY, 1),
      timeoutMs: toNumber(process.env.LIVE_TV_IPTV_ORG_API_TIMEOUT_MS, 8000),
      cacheTtlMs: toNumber(process.env.LIVE_TV_IPTV_ORG_API_CACHE_MS, 3600_000),
      baseUrl: process.env.LIVE_TV_IPTV_ORG_API_BASE_URL || 'https://iptv-org.github.io/api',
    },
    iptv_org_playlist: {
      enabled: toBool(process.env.LIVE_TV_IPTV_ORG_PLAYLIST_ENABLED, true),
      priority: toNumber(process.env.LIVE_TV_IPTV_ORG_PLAYLIST_PRIORITY, 2),
      timeoutMs: toNumber(process.env.LIVE_TV_IPTV_ORG_PLAYLIST_TIMEOUT_MS, 10000),
      cacheTtlMs: toNumber(process.env.LIVE_TV_IPTV_ORG_PLAYLIST_CACHE_MS, 3600_000),
      playlistUrl: process.env.LIVE_TV_IPTV_ORG_PLAYLIST_URL || 'https://iptv-org.github.io/iptv/index.m3u',
    },
  },
}));
