import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppleProvider } from './providers/apple.provider';
import { BasePodcastProvider } from './providers/base-provider';
import { PodcastIndexProvider } from './providers/podcast-index.provider';
import { TaddyProvider } from './providers/taddy.provider';
import { ProviderConfig, ProviderName, ProviderStatus } from './types/podcast-search.types';

@Injectable()
export class ProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistry.name);
  private providerConfigs: Record<ProviderName, ProviderConfig>;
  private providerInstances: Map<ProviderName, BasePodcastProvider> = new Map();

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(AppleProvider)
    private readonly appleProvider: AppleProvider,
    @Inject(PodcastIndexProvider)
    private readonly podcastIndexProvider: PodcastIndexProvider,
    @Inject(TaddyProvider)
    private readonly taddyProvider: TaddyProvider,
  ) {}

  onModuleInit() {
    const providersConfig = this.configService.get('podcastProviders.providers');
    this.providerConfigs = providersConfig;

    this.registerProvider('apple', this.appleProvider);
    this.registerProvider('podcast_index', this.podcastIndexProvider);
    this.registerProvider('taddy', this.taddyProvider);
  }

  getEnabledProviders(requested?: string[]): BasePodcastProvider[] {
    const requestedSet = requested?.length ? new Set(requested.map((p) => p as ProviderName)) : null;

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

  getProviderConfig(name: ProviderName): ProviderConfig {
    return this.providerConfigs?.[name];
  }

  getStatuses(): ProviderStatus[] {
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

  private registerProvider(name: ProviderName, provider: BasePodcastProvider) {
    const cfg = this.providerConfigs?.[name];
    if (!cfg) {
      this.logger.warn(`No configuration found for provider ${name}; skipping registration.`);
      return;
    }

    // Some providers expose configure method for runtime config injection
    if (typeof (provider as any).configure === 'function') {
      (provider as any).configure(cfg);
    }

    this.providerInstances.set(name, provider);
  }
}
