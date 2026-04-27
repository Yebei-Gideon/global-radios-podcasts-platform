import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import radioConfig from '../config/radio.config';
import { RadioStation } from './entities/radio-station.entity';
import { RadioBrowserProvider } from './providers/radio-browser.provider';
import { RadioNetProvider } from './providers/radionet.provider';
import { RadioplayerProvider } from './providers/radioplayer.provider';
import { ShoutcastProvider } from './providers/shoutcast.provider';
import { RadioBrowserService } from './radio-browser.service';
import { RadioProviderRegistry } from './radio-provider.registry';
import { RadioSearchManager } from './radio-search.manager';
import { RadioController } from './radio.controller';
import { RadioService } from './radio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RadioStation]),
    ConfigModule.forFeature(radioConfig),
  ],
  controllers: [RadioController],
  providers: [
    RadioService,
    RadioBrowserService, // Keep for backward compatibility
    RadioSearchManager,
    RadioProviderRegistry,
    RadioBrowserProvider,
    RadioNetProvider,
    ShoutcastProvider,
    RadioplayerProvider,
  ],
  exports: [RadioService, RadioSearchManager], // Export for future modules
})
export class RadioModule { }
