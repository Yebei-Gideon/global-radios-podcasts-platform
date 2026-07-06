import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as redisStore from 'cache-manager-redis-store';
import databaseConfig from './config/database.config';
import podcastConfig from './config/podcast.config';
import radioConfig from './config/radio.config';
import redisConfig from './config/redis.config';
import tvConfig from './config/tv.config';
import { PodcastModule } from './podcast/podcast.module';
import { RadioModule } from './radio/radio.module';
import { LiveTvModule } from './tv/live-tv.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, podcastConfig, radioConfig, tvConfig],
    }),

    // Database connection (PostgreSQL) — single root connection, migrations enabled
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('database.url');
        const ssl = configService.get('database.ssl');
        // If url is present, use url/ssl (Neon, DATABASE_URL), else use legacy fields
        if (url) {
          return {
            type: 'postgres',
            url,
            ssl,
            entities: configService.get('database.entities'),
            // Disable synchronize - use migrations
            synchronize: false,
            // Run migrations on startup in development only (controlled in config)
            migrations: configService.get('database.migrations'),
            migrationsRun: configService.get('database.migrationsRun'),
            migrationsTableName: configService.get('database.migrationsTableName') || 'migrations',
            logging: configService.get('database.logging'),
            retryAttempts: configService.get('database.retryAttempts') || 5,
            retryDelay: configService.get('database.retryDelay') || 3000,
          };
        }
        return {
          type: 'postgres',
          host: configService.get('database.host'),
          port: configService.get('database.port'),
          username: configService.get('database.username'),
          password: configService.get('database.password'),
          database: configService.get('database.database'),
          entities: configService.get('database.entities'),
          // Disable synchronize - use migrations
          synchronize: false,
          migrations: configService.get('database.migrations'),
          migrationsRun: configService.get('database.migrationsRun'),
          migrationsTableName: configService.get('database.migrationsTableName') || 'migrations',
          logging: configService.get('database.logging'),
          retryAttempts: configService.get('database.retryAttempts') || 5,
          retryDelay: configService.get('database.retryDelay') || 3000,
        };
      },
    }),

    // Redis cache
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        // Support a full URL (host:port with optional auth) or fallback to host/port
        url: configService.get('redis.url') || undefined,
        host: configService.get('redis.host'),
        port: configService.get('redis.port'),
        ttl: configService.get('redis.ttl'),
        password: configService.get('redis.password') || undefined,
      }),
    }),

    // Feature modules
    RadioModule,
    PodcastModule,
    LiveTvModule,
    // TODO Phase 2: Add UserModule (auth, favorites)
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule { }
