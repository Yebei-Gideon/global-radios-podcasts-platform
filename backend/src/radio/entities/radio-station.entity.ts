import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * RadioStation entity - stores cached radio station metadata from Radio Browser API
 * Important: We do NOT store or proxy audio streams, only metadata
 */
@Entity('radio_stations')
export class RadioStation {
  @PrimaryColumn({ type: 'uuid' })
  id: string; // Using Radio Browser's stationuuid

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  url: string; // Homepage URL

  @Column({ name: 'stream_url', type: 'text' })
  streamUrl: string; // Direct stream URL - client connects to this

  @Column({ type: 'varchar', nullable: true })
  country: string;

  @Column({ type: 'varchar', nullable: true })
  countrycode: string;

  @Column({ type: 'varchar', nullable: true })
  state: string;

  @Column({ type: 'varchar', nullable: true })
  language: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[]; // Genres/categories

  @Column({ type: 'text', nullable: true })
  favicon: string; // Station logo URL

  @Column({ type: 'int', default: 0 })
  bitrate: number;

  @Column({ type: 'varchar', nullable: true })
  codec: string;

  @Column({ type: 'int', default: 0 })
  votes: number; // Popularity from Radio Browser

  @Column({ type: 'boolean', default: false })
  ssl: boolean; // HTTPS stream support

  @CreateDateColumn({ name: 'cached_at' })
  cachedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
