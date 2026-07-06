import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseLiveTvProvider } from './providers/base-tv-provider';
import { IptvOrgApiProvider } from './providers/iptv-org-api.provider';
import { IptvOrgPlaylistProvider } from './providers/iptv-org-playlist.provider';
import { LiveTvProviderConfig, LiveTvProviderName, LiveTvProviderStatus } from './types/live-tv-search.types';

@Injectable()
export class LiveTvProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(LiveTvProviderRegistry.name);
  private providerConfigs: Record<LiveTvProviderName, LiveTvProviderConfig>;
  private providerInstances: Map<LiveTvProviderName, BaseLiveTvProvider> = new Map();

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(IptvOrgApiProvider)
    private readonly iptvOrgApiProvider: IptvOrgApiProvider,
    @Inject(IptvOrgPlaylistProvider)
    private readonly iptvOrgPlaylistProvider: IptvOrgPlaylistProvider,
  ) { }

  onModuleInit() {
    const providersConfig = this.configService.get('liveTvProviders.providers');
    this.providerConfigs = providersConfig || this.getDefaultConfig();

    this.registerProvider('iptv_org_api', this.iptvOrgApiProvider);
    this.registerProvider('iptv_org_playlist', this.iptvOrgPlaylistProvider);

    this.logger.log(`Initialized ${this.providerInstances.size} live TV providers`);
  }

  getEnabledProviders(requested?: string[]): BaseLiveTvProvider[] {
    const requestedSet = requested?.length ? new Set(requested.map((provider) => provider as LiveTvProviderName)) : null;

    return Array.from(this.providerInstances.entries())
      .filter(([name]) => {
        const config = this.providerConfigs[name];
        if (!config?.enabled) return false;
        if (requestedSet && !requestedSet.has(name)) return false;
        return true;
      })
      .sort((a, b) => (this.providerConfigs[a[0]].priority || 99) - (this.providerConfigs[b[0]].priority || 99))
      .map(([, instance]) => instance);
  }

  getStatuses(): LiveTvProviderStatus[] {
    return Array.from(this.providerInstances.keys()).map((name) => {
      const cfg = this.providerConfigs[name];
      return {
        name,
        enabled: cfg?.enabled ?? false,
        available: cfg?.enabled ?? false,
        priority: cfg?.priority ?? 99,
        rateLimit: cfg?.rateLimit ?? null,
        remaining: null,
      };
    });
  }

  private registerProvider(name: LiveTvProviderName, provider: BaseLiveTvProvider) {
    const cfg = this.providerConfigs?.[name];
    if (!cfg) {
      this.logger.warn(`No configuration found for provider ${name}; using defaults.`);
    }

    if (typeof (provider as any).configure === 'function') {
      (provider as any).configure(cfg || { enabled: true, priority: 99, timeoutMs: 10000, cacheTtlMs: 3600000 });
    }

    this.providerInstances.set(name, provider);
    this.logger.debug(`Registered live TV provider: ${name}`);
  }

  private getDefaultConfig(): Record<LiveTvProviderName, LiveTvProviderConfig> {
    return {
      iptv_org_api: {
        enabled: true,
        priority: 1,
        timeoutMs: 8000,
        cacheTtlMs: 3600000,
        baseUrl: 'https://iptv-org.github.io/api',
      },
      iptv_org_playlist: {
        enabled: true,
        priority: 2,
        timeoutMs: 10000,
        cacheTtlMs: 3600000,
        playlistUrl: 'https://iptv-org.github.io/iptv/index.m3u',
      },
    };
  }
}
