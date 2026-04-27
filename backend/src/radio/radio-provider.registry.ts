import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseRadioProvider } from './providers/base-radio-provider';
import { RadioBrowserProvider } from './providers/radio-browser.provider';
import { RadioNetProvider } from './providers/radionet.provider';
import { RadioplayerProvider } from './providers/radioplayer.provider';
import { ShoutcastProvider } from './providers/shoutcast.provider';
import { RadioProviderConfig, RadioProviderName, RadioProviderStatus } from './types/radio-search.types';

@Injectable()
export class RadioProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(RadioProviderRegistry.name);
  private providerConfigs: Record<RadioProviderName, RadioProviderConfig>;
  private providerInstances: Map<RadioProviderName, BaseRadioProvider> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly radioBrowserProvider: RadioBrowserProvider,
    private readonly radioNetProvider: RadioNetProvider,
    private readonly shoutcastProvider: ShoutcastProvider,
    private readonly radioplayerProvider: RadioplayerProvider,
  ) { }

  onModuleInit() {
    const providersConfig = this.configService.get('radioProviders.providers');
    this.providerConfigs = providersConfig || this.getDefaultConfig();

    this.registerProvider('radio_browser', this.radioBrowserProvider);
    this.registerProvider('radionet', this.radioNetProvider);
    this.registerProvider('shoutcast', this.shoutcastProvider);
    this.registerProvider('radioplayer', this.radioplayerProvider);

    this.logger.log(`Initialized ${this.providerInstances.size} radio providers`);
  }

  getEnabledProviders(requested?: string[]): BaseRadioProvider[] {
    const requestedSet = requested?.length
      ? new Set(requested.map((p) => p as RadioProviderName))
      : null;

    return Array.from(this.providerInstances.entries())
      .filter(([name]) => {
        const config = this.providerConfigs[name];
        if (!config?.enabled) return false;
        if (requestedSet && !requestedSet.has(name)) return false;
        return true;
      })
      .sort((a, b) =>
        (this.providerConfigs[a[0]].priority || 99) - (this.providerConfigs[b[0]].priority || 99)
      )
      .map(([, instance]) => instance);
  }

  getProviderConfig(name: RadioProviderName): RadioProviderConfig {
    return this.providerConfigs?.[name];
  }

  getStatuses(): RadioProviderStatus[] {
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

  private registerProvider(name: RadioProviderName, provider: BaseRadioProvider) {
    const cfg = this.providerConfigs?.[name];
    if (!cfg) {
      this.logger.warn(`No configuration found for provider ${name}; using defaults.`);
    }

    // Configure provider with settings
    if (typeof (provider as any).configure === 'function') {
      (provider as any).configure(cfg || { enabled: true, priority: 99, timeoutMs: 10000, cacheTtlMs: 3600000 });
    }

    this.providerInstances.set(name, provider);
    this.logger.debug(`Registered radio provider: ${name}`);
  }

  private getDefaultConfig(): Record<RadioProviderName, RadioProviderConfig> {
    return {
      radio_browser: {
        enabled: true,
        priority: 1,
        timeoutMs: 10000,
        cacheTtlMs: 3600000,
      },
      radionet: {
        enabled: true,
        priority: 2,
        timeoutMs: 10000,
        cacheTtlMs: 3600000,
      },
      shoutcast: {
        enabled: true,
        priority: 3,
        timeoutMs: 10000,
        cacheTtlMs: 3600000,
      },
      radioplayer: {
        enabled: true,
        priority: 4,
        timeoutMs: 10000,
        cacheTtlMs: 3600000,
      },
    };
  }
}
