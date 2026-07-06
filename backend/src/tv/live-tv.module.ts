import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import tvConfig from '../config/tv.config';
import { IptvOrgApiProvider } from './providers/iptv-org-api.provider';
import { IptvOrgPlaylistProvider } from './providers/iptv-org-playlist.provider';
import { LiveTvController } from './live-tv.controller';
import { LiveTvProviderRegistry } from './live-tv-provider.registry';
import { LiveTvSearchManager } from './live-tv-search.manager';
import { LiveTvService } from './live-tv.service';

@Module({
  imports: [ConfigModule.forFeature(tvConfig)],
  controllers: [LiveTvController],
  providers: [
    LiveTvService,
    LiveTvSearchManager,
    LiveTvProviderRegistry,
    IptvOrgApiProvider,
    IptvOrgPlaylistProvider,
  ],
  exports: [LiveTvService, LiveTvSearchManager],
})
export class LiveTvModule { }
