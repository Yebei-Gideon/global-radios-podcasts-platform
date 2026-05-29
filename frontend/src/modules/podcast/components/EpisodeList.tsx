import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, Calendar, Volume2 } from 'lucide-react';
import type { Podcast, PodcastEpisode } from '../types/podcast.types';
import { usePodcastPlayer } from '../context/PodcastPlayerContext';
import { apiService } from '@/services/api.service';
import { Button, Card } from '@/modules/shared/components/ui';
import { cleanDescription } from '@/modules/shared/lib/sanitize';

interface EpisodeListProps {
  podcast: Podcast;
}

/**
 * Episode List Component
 * Displays all episodes for a podcast with playback controls
 */
export const EpisodeList: React.FC<EpisodeListProps> = ({ podcast }) => {
  const [search, setSearch] = useState('');
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentPodcast, currentEpisode, isPlaying, playPodcast, setQueue } = usePodcastPlayer();

  // When the current episode changes, try to scroll it into view in the sidebar
  useEffect(() => {
    if (!currentEpisode) return;
    const id = String(currentEpisode.id);
    // Find the card element and scroll into view
    const el = document.querySelector(`[data-episode-id="${id}"]`);
    if (el && 'scrollIntoView' in el) {
      try {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        // ignore
      }
    }
  }, [currentEpisode]);

  // Filtered episodes based on search (must be after episodes is declared)
  const filteredEpisodes = episodes.filter((episode, idx) => {
    const searchLower = search.trim().toLowerCase();
    if (!searchLower) return true;
    // Match by episode number (1-based)
    if ((idx + 1).toString() === searchLower) return true;
    // Match by title
    if (episode.title?.toLowerCase().includes(searchLower)) return true;
    return false;
  });

  // ...existing code...

  useEffect(() => {
    loadEpisodes();
  }, [podcast?.id, podcast?.rssUrl, podcast?.feedUrl]);

  // Fetch all paginated episodes and append to the sidebar
  const loadEpisodes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const allEpisodes: PodcastEpisode[] = [];
      let page = 1;
      const limit = 50; // Fetch in larger chunks for efficiency
      let hasMore = true;
      const rssUrl = podcast.rssUrl || podcast.feedUrl;
      if (rssUrl) {
        while (hasMore) {
          const response = await apiService.getPodcastEpisodesByFeed(rssUrl, page, limit);
          const episodesData = response.data ?? [];
          allEpisodes.push(...episodesData);
          hasMore = episodesData.length === limit;
          page++;
        }
        setEpisodes(allEpisodes);
      } else if (podcast.id) {
        page = 1;
        hasMore = true;
        while (hasMore) {
          const response = await apiService.getPodcastEpisodes(podcast.id, page, limit);
          const episodesData = response.data ?? [];
          allEpisodes.push(...episodesData);
          hasMore = episodesData.length === limit;
          page++;
        }
        setEpisodes(allEpisodes);
      } else {
        setEpisodes([]);
        setError('Podcast does not have a feed URL');
      }
    } catch (err) {
      setError('Failed to load episodes');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayEpisode = (episode: PodcastEpisode) => {
    playPodcast(podcast, episode);
  };

  const handlePlayAll = () => {
    if (episodes.length > 0) {
      // Ensure Play All starts from episode 1 (oldest) and queues in ascending order
      const ordered = [...episodes].slice().sort((a, b) => {
        const ta = a.publishDate ? new Date(a.publishDate).getTime() : 0;
        const tb = b.publishDate ? new Date(b.publishDate).getTime() : 0;
        return ta - tb;
      });

      // Ensure current podcast is set before queueing so global player can appear
      playPodcast(podcast, ordered[0]);
      setQueue(ordered, 0);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (seconds?: number) => {
    const total = Number(seconds);
    if (!Number.isFinite(total) || total <= 0) return '–';
    if (total < 60) return `${Math.max(Math.round(total), 1)}s`;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Search episodes by number or title..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Episodes</h3>
        {episodes.length > 0 && (
          <Button
            onClick={handlePlayAll}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Play className="w-4 h-4 mr-2" />
            Play All
          </Button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Card className="p-4 bg-red-900/20 border-red-700">
          <p className="text-red-300">{error}</p>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Episodes List */}
      {!isLoading && filteredEpisodes.length > 0 && (
        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.05 },
            },
          }}
        >
            {filteredEpisodes.map((episode) => {
            // Find the original index for episode number display
            const origIndex = episodes.findIndex(e => e.id === episode.id);
            const isCurrentEpisode = Boolean(
              currentEpisode &&
                episode.id &&
                currentEpisode.id === episode.id &&
                currentPodcast &&
                currentPodcast.id === podcast.id
            );
            const key = episode.id ? String(episode.id) : `episode-${origIndex}`;

            return (
              <motion.div
                key={key}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 },
                }}
              >
                    <Card
                      data-episode-id={episode.id}
                      aria-current={isCurrentEpisode ? 'true' : undefined}
                      className={`p-4 cursor-pointer transition-all ${
                        isCurrentEpisode
                          ? 'bg-purple-900/30 border-purple-600 ring-2 ring-purple-500'
                          : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                      }`}
                      onClick={() => handlePlayEpisode(episode)}
                    >
                  <div className="flex items-start gap-4">
                    {/* Play Button / Now Playing Indicator */}
                    <div className="flex-shrink-0 mt-1">
                      {isCurrentEpisode && isPlaying ? (
                        <div className="w-10 h-10 flex items-center justify-center">
                          <div className="animate-pulse">
                            <Volume2 className="w-5 h-5 text-purple-400" />
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayEpisode(episode);
                          }}
                        >
                          <Play className="w-4 h-4 ml-0.5" />
                        </Button>
                      )}
                    </div>

                    {/* Episode Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className={`font-semibold truncate ${
                          isCurrentEpisode
                            ? 'text-purple-300'
                            : 'text-white'
                        }`}>
                          {origIndex + 1}. {episode.title}
                        </h4>
                        {isCurrentEpisode && (
                          <span className="text-xs text-purple-100 bg-purple-700/40 px-2 py-0.5 rounded-full">
                            Now playing
                          </span>
                        )}
                      </div>
                      {episode.description && (
                        <p className="text-sm text-slate-400 line-clamp-2 mb-2">
                          {cleanDescription(episode.description, 180)}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(episode.publishDate)}
                        </div>
                        {episode.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(episode.duration)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Duration Badge */}
                    {episode.duration && (
                      <div className="flex-shrink-0 text-right">
                        <span className="text-sm font-medium text-slate-400">
                          {formatDuration(episode.duration)}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Empty State */}
      {!isLoading && filteredEpisodes.length === 0 && (
        <Card className="p-12 text-center bg-slate-800 border-slate-700">
          <Volume2 className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h4 className="text-lg font-semibold text-white mb-2">No episodes found</h4>
          <p className="text-slate-400">No episodes match your search.</p>
        </Card>
      )}
    </div>
  );
};
