import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Podcast } from './podcast.entity';

/**
 * PodcastEpisode entity - stores individual podcast episodes
 * Links to parent podcast via many-to-one relationship
 */
@Entity('podcast_episodes')
export class PodcastEpisode {
  @PrimaryColumn({ type: 'uuid' })
  id: string; // Generated UUID (unique per episode)

  @Column({ type: 'uuid' })
  podcastId: string; // Foreign key to Podcast

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text' })
  audioUrl: string; // Direct link to audio file

  @Column({ type: 'int', nullable: true })
  duration: number; // Duration in seconds

  @Column({ type: 'varchar', nullable: true })
  guid: string; // RSS guid (episode unique identifier)

  @Column({ type: 'text', nullable: true })
  imageUrl: string; // Episode-specific artwork

  @Column({ type: 'timestamp' })
  publishDate: Date;

  @Column({ type: 'int', default: 0 })
  playCount: number; // Track popularity

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationship back to podcast
  @ManyToOne(() => Podcast, (podcast) => podcast.episodes)
  podcast: Podcast;
}
