import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { LiveTvProviderConfig, LiveTvProviderSearchParams, ProviderLiveTvResult } from '../types/live-tv-search.types';

interface IptvOrgChannel {
  id: string;
  name: string;
  alt_names?: string[];
  network?: string;
  owners?: string[];
  country?: string;
  categories?: string[];
  website?: string;
  is_nsfw?: boolean;
}

interface IptvOrgFeed {
  channel: string;
  id: string;
  name: string;
  languages?: string[];
  broadcast_area?: string[];
}

interface IptvOrgStream {
  channel: string | null;
  feed: string | null;
  title: string;
  url: string;
  referrer?: string;
  user_agent?: string;
  quality?: string;
  label?: string;
}

interface IptvOrgLogo {
  channel: string;
  feed?: string | null;
  url: string;
}

@Injectable()
export class IptvOrgApiProvider {
  name = 'iptv_org_api' as const;
  private readonly logger = new Logger(IptvOrgApiProvider.name);
  private config: LiveTvProviderConfig;

  configure(config: LiveTvProviderConfig) {
    this.config = config;
  }

  async search(params: LiveTvProviderSearchParams): Promise<ProviderLiveTvResult[]> {
    const baseUrl = this.config?.baseUrl || 'https://iptv-org.github.io/api';
    const [channelsResponse, streamsResponse, feedsResponse, logosResponse] = await Promise.all([
      axios.get<IptvOrgChannel[]>(`${baseUrl}/channels.json`, { timeout: this.config?.timeoutMs || 8000 }),
      axios.get<IptvOrgStream[]>(`${baseUrl}/streams.json`, { timeout: this.config?.timeoutMs || 8000 }),
      axios.get<IptvOrgFeed[]>(`${baseUrl}/feeds.json`, { timeout: this.config?.timeoutMs || 8000 }),
      axios.get<IptvOrgLogo[]>(`${baseUrl}/logos.json`, { timeout: this.config?.timeoutMs || 8000 }),
    ]);

    const query = this.normalize(params.name);
    const country = this.normalize(params.country);
    const language = this.normalize(params.language);
    const category = this.normalize(params.category);

    const channelsById = new Map(channelsResponse.data.map((channel) => [channel.id, channel]));
    const feedsByKey = new Map(feedsResponse.data.map((feed) => [`${feed.channel}:${feed.id}`, feed]));
    const logosByKey = new Map(logosResponse.data.map((logo) => [`${logo.channel}:${logo.feed || ''}`, logo.url]));

    const results: ProviderLiveTvResult[] = [];

    for (const stream of streamsResponse.data) {
      if (!stream.channel || !stream.url) continue;

      const channel = channelsById.get(stream.channel);
      if (!channel || channel.is_nsfw) continue;

      const feed = stream.feed ? feedsByKey.get(`${stream.channel}:${stream.feed}`) : undefined;
      const logoUrl = logosByKey.get(`${stream.channel}:${stream.feed || ''}`)
        || logosByKey.get(`${stream.channel}:`);

      if (!this.matchesQuery(channel, stream, query)) continue;
      if (country && !this.matchesCountry(channel.country, country)) continue;
      if (language && !this.matchesLanguage(feed?.languages, language)) continue;
      if (category && !this.matchesCategory(channel.categories, category)) continue;

      results.push({
        id: `${channel.id}:${stream.feed || 'main'}:${this.normalizeUrl(stream.url)}`,
        name: stream.title || channel.name,
        streamUrl: stream.url,
        country: channel.country,
        countryCode: channel.country,
        language: feed?.languages?.[0],
        category: channel.categories?.[0],
        logoUrl,
        websiteUrl: channel.website,
        groupTitle: channel.categories?.join(', '),
        referrer: stream.referrer,
        userAgent: stream.user_agent,
        quality: stream.quality || stream.label,
        source: this.name,
      });
    }

    this.logger.debug(`iptv_org_api returned ${results.length} channels`);
    return results.slice(params.offset || 0, (params.offset || 0) + params.limit);
  }

  private normalize(value?: string): string {
    return value?.trim().toLowerCase() || '';
  }

  private matchesQuery(channel: IptvOrgChannel, stream: IptvOrgStream, query: string): boolean {
    if (!query) return true;

    const haystack = [
      channel.name,
      ...(channel.alt_names || []),
      channel.network,
      ...(channel.owners || []),
      stream.title,
      stream.label,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  }

  private matchesCountry(countryValue: string | undefined, country: string): boolean {
    return this.normalize(countryValue).includes(country);
  }

  private matchesLanguage(languages: string[] | undefined, language: string): boolean {
    return (languages || []).some((item) => this.normalize(item).includes(language));
  }

  private matchesCategory(categories: string[] | undefined, category: string): boolean {
    return (categories || []).some((item) => this.normalize(item).includes(category));
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.host}${parsed.pathname}`.toLowerCase().replace(/\/+$/, '');
    } catch {
      return url.toLowerCase();
    }
  }
}
