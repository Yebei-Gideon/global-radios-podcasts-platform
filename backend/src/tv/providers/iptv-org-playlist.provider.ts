import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { LiveTvProviderConfig, LiveTvProviderSearchParams, ProviderLiveTvResult } from '../types/live-tv-search.types';

interface PlaylistEntry {
  name: string;
  streamUrl: string;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  tvgCountry?: string;
  tvgLanguage?: string;
  groupTitle?: string;
  referrer?: string;
  userAgent?: string;
}

@Injectable()
export class IptvOrgPlaylistProvider {
  name = 'iptv_org_playlist' as const;
  private readonly logger = new Logger(IptvOrgPlaylistProvider.name);
  private config: LiveTvProviderConfig;

  configure(config: LiveTvProviderConfig) {
    this.config = config;
  }

  async search(params: LiveTvProviderSearchParams): Promise<ProviderLiveTvResult[]> {
    const playlistUrl = this.config?.playlistUrl || 'https://iptv-org.github.io/iptv/index.m3u';
    const response = await axios.get<string>(playlistUrl, {
      timeout: this.config?.timeoutMs || 10000,
      responseType: 'text',
    });

    const entries = this.parsePlaylist(response.data);
    const query = this.normalize(params.name);
    const country = this.normalize(params.country);
    const language = this.normalize(params.language);
    const category = this.normalize(params.category);

    const filtered = entries.filter((entry) => {
      if (query && !this.matchesQuery(entry, query)) return false;
      if (country && !this.normalize(entry.tvgCountry).includes(country)) return false;
      if (language && !this.normalize(entry.tvgLanguage).includes(language)) return false;
      if (category && !this.normalize(entry.groupTitle).includes(category)) return false;
      return true;
    });

    const mapped = filtered.map((entry, index) => ({
      id: `${entry.tvgId || entry.name}-${index}`,
      name: entry.tvgName || entry.name,
      streamUrl: entry.streamUrl,
      country: entry.tvgCountry,
      countryCode: entry.tvgCountry,
      language: entry.tvgLanguage,
      category: entry.groupTitle,
      logoUrl: entry.tvgLogo,
      groupTitle: entry.groupTitle,
      referrer: entry.referrer,
      userAgent: entry.userAgent,
      source: this.name,
    } satisfies ProviderLiveTvResult));

    this.logger.debug(`iptv_org_playlist returned ${mapped.length} channels`);
    return mapped.slice(params.offset || 0, (params.offset || 0) + params.limit);
  }

  private parsePlaylist(content: string): PlaylistEntry[] {
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const entries: PlaylistEntry[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.startsWith('#EXTINF:')) continue;

      const nextLine = lines[index + 1];
      if (!nextLine || nextLine.startsWith('#')) continue;

      const metadata = this.parseExtInf(line);
      entries.push({
        ...metadata,
        streamUrl: nextLine,
      });
    }

    return entries;
  }

  private parseExtInf(line: string): Omit<PlaylistEntry, 'streamUrl'> {
    const metadata = {
      tvgId: this.readAttribute(line, 'tvg-id'),
      tvgName: this.readAttribute(line, 'tvg-name'),
      tvgLogo: this.readAttribute(line, 'tvg-logo'),
      tvgCountry: this.readAttribute(line, 'tvg-country'),
      tvgLanguage: this.readAttribute(line, 'tvg-language'),
      groupTitle: this.readAttribute(line, 'group-title'),
    };

    const name = line.includes(',') ? line.slice(line.lastIndexOf(',') + 1).trim() : metadata.tvgName || metadata.tvgId || 'Live channel';
    return {
      name,
      ...metadata,
    };
  }

  private readAttribute(line: string, attribute: string): string | undefined {
    const match = line.match(new RegExp(`${attribute}="([^"]*)"`, 'i'));
    return match?.[1]?.trim() || undefined;
  }

  private normalize(value?: string): string {
    return value?.trim().toLowerCase() || '';
  }

  private matchesQuery(entry: PlaylistEntry, query: string): boolean {
    const haystack = [entry.name, entry.tvgName, entry.tvgId, entry.groupTitle]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  }
}
