import React from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Heart,
  Share2,
  Settings,
  ChevronDown,
  Radio,
  Mic,
  Clock,
  MapPin,
  Globe,
  Wifi,
  List as ListIcon,
  Repeat,
} from 'lucide-react';
import { useAudio } from '@/modules/radio/context/AudioContext';
import { usePodcastPlayer } from '@/modules/podcast/context/PodcastPlayerContext';
import { Button } from '@/modules/shared/components/ui';
import { EqualizerPanel } from '@/modules/shared/components/EqualizerPanel';

interface PlayerPageProps {
  onClose?: () => void;
}

/**
 * Modern Unified Player Page
 * Handles both Radio and Podcasts with a single, beautiful interface
 * Future-proof for live TV and other media types
 */
export const PlayerPage: React.FC<PlayerPageProps> = ({ onClose }) => {
  const { currentStation, isPlaying, volume, isMuted, togglePlay, setVolume, toggleMute, equalizer: radioEqualizer } =
    useAudio();
  const {
    currentPodcast,
    currentEpisode,
    isPlaying: podcastPlaying,
    duration,
    currentTime,
    volume: podcastVolume,
    isMuted: podcastMuted,
    togglePlayPause: podcastTogglePlay,
    setVolume: setPodcastVolume,
    toggleMute: podcastToggleMute,
    equalizer: podcastEqualizer,
    seek,
    nextEpisode,
    previousEpisode,
    queue,
    queueIndex,
    playEpisode,
    playbackRate,
    setPlaybackRate,
    isLooping,
    toggleLoop,
  } = usePodcastPlayer();

  // Determine which player is active
  const isRadioActive = !!currentStation && !currentPodcast;
  const isPodcastActive = !!currentPodcast && !!currentEpisode;
  const activeType = isRadioActive ? 'radio' : isPodcastActive ? 'podcast' : null;
  const activeLabel = isRadioActive ? 'Live radio' : isPodcastActive ? 'Podcast episode' : 'Player';
  const activeDescription = isRadioActive
    ? currentStation?.description || currentStation?.country || 'Streaming live audio'
    : currentPodcast?.title || 'Select something to play';
  const activeSurfaceClass = isRadioActive
    ? 'from-sky-950 via-slate-950 to-slate-900'
    : isPodcastActive
      ? 'from-fuchsia-950 via-slate-950 to-slate-900'
      : 'from-slate-950 via-slate-950 to-slate-900';

  const activeVolume = isRadioActive ? volume : podcastVolume;
  const activeIsMuted = isRadioActive ? isMuted : podcastMuted;
  const activeIsPlaying = isRadioActive ? isPlaying : podcastPlaying;
  const activeEqualizer = isRadioActive ? radioEqualizer : podcastEqualizer;

  const handleTogglePlay = () => {
    if (isRadioActive) {
      togglePlay?.();
    } else if (isPodcastActive) {
      podcastTogglePlay();
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (isRadioActive) {
      setVolume?.(newVolume);
    } else if (isPodcastActive) {
      setPodcastVolume(newVolume);
    }
  };

  const handleToggleMute = () => {
    if (isRadioActive) {
      toggleMute?.();
    } else if (isPodcastActive) {
      podcastToggleMute();
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 bg-gradient-to-br ${activeSurfaceClass} backdrop-blur-xl z-50 overflow-y-auto`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-24 left-0 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-black/70 via-black/30 to-transparent p-4 md:p-6 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                isRadioActive
                  ? 'bg-blue-500/20'
                  : isPodcastActive
                    ? 'bg-purple-500/20'
                    : 'bg-slate-500/20'
              }`}
            >
              {isRadioActive ? (
                <Radio className="w-5 h-5 text-blue-400" />
              ) : (
                <Mic className="w-5 h-5 text-purple-400" />
              )}
            </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {activeLabel}
                </span>
                <p className="text-sm text-slate-200 line-clamp-1">{activeDescription}</p>
              </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
              className="hover:bg-white/10 text-white/90"
          >
            <ChevronDown className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Content */}
        <div className="relative max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-10">
        {/* Artwork/Cover */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
            <div className="relative aspect-square bg-gradient-to-br from-slate-800/90 to-slate-950 rounded-3xl shadow-2xl flex items-center justify-center overflow-hidden max-w-md mx-auto border border-white/10">
            {isRadioActive && currentStation?.favicon ? (
              <img
                src={currentStation.favicon}
                alt={currentStation.name}
                className="w-full h-full object-cover"
              />
            ) : isPodcastActive && currentPodcast?.imageUrl ? (
              <img
                src={currentPodcast.imageUrl}
                alt={currentPodcast.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-6xl opacity-20">
                {isRadioActive ? <Radio /> : <Mic />}
              </div>
            )}

            {/* Live Indicator for Radio */}
            {isRadioActive && (
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white px-3 py-2 rounded-full text-sm font-bold"
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Title and Info */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8 space-y-4"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
            <span className={`h-2 w-2 rounded-full ${isRadioActive ? 'bg-red-400' : isPodcastActive ? 'bg-fuchsia-400' : 'bg-slate-400'}`} />
            {activeType === 'radio' ? 'Live broadcast' : activeType === 'podcast' ? 'On demand' : 'Ready to play'}
          </div>

          <h1 className="text-3xl md:text-5xl font-bold text-white line-clamp-2 leading-tight">
            {isRadioActive ? currentStation?.name : currentEpisode?.title}
          </h1>

          {isRadioActive ? (
            <div className="flex items-center justify-center gap-3 text-slate-300 text-sm flex-wrap">
              {currentStation?.country && (
                <div className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 border border-white/10">
                  <MapPin className="w-4 h-4" />
                  {currentStation.country}
                </div>
              )}
              {currentStation?.language && (
                <div className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 border border-white/10">
                  <Globe className="w-4 h-4" />
                  {currentStation.language}
                </div>
              )}
              {currentStation?.bitrate && (
                <div className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 border border-white/10">
                  <Wifi className="w-4 h-4" />
                  {currentStation.bitrate}kbps
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              {currentPodcast?.title}
            </p>
          )}
        </motion.div>

        {activeType && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {activeIsPlaying ? 'Playing' : 'Paused'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Source</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {isRadioActive ? currentStation?.country || 'Radio' : currentPodcast?.source?.replace('_', ' ') || 'Podcast'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Quality</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {isRadioActive ? `${currentStation?.bitrate || 'Unknown'} kbps` : formatTime(duration || 0)}
              </p>
            </div>
          </motion.div>
        )}

        {/* Playback Progress - Podcast Only */}
        {isPodcastActive && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            {/* Progress Bar */}
            <div
              className="bg-slate-800/90 rounded-full h-2 cursor-pointer group overflow-hidden"
              onClick={(e) => {
                if (!duration) return;
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                seek(percent * duration);
              }}
            >
              <motion.div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full"
                style={{
                  width: duration ? `${(currentTime / duration) * 100}%` : '0%',
                }}
              />
            </div>

            {/* Time Display */}
            <div className="flex justify-between text-xs text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration || 0)}</span>
            </div>
          </motion.div>
        )}

        {/* Playback Controls */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center justify-center gap-4 md:gap-6 rounded-3xl border border-white/10 bg-white/5 px-4 py-5 shadow-xl shadow-black/10 backdrop-blur-sm">
            {/* Previous/Rewind */}
            <Button
              size="icon"
              variant="ghost"
              className="w-12 h-12 hover:bg-white/10 text-white"
              disabled={isRadioActive}
              onClick={() => isPodcastActive && previousEpisode()}
            >
              <SkipBack className="w-5 h-5" />
            </Button>

            {/* Play/Pause */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleTogglePlay}
              className={`w-20 h-20 rounded-full text-white flex items-center justify-center shadow-2xl ${
                isRadioActive
                  ? 'bg-gradient-to-br from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600'
                  : 'bg-gradient-to-br from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600'
              }`}
            >
              {activeIsPlaying ? (
                <Pause className="w-8 h-8 ml-1" />
              ) : (
                <Play className="w-8 h-8 ml-1" />
              )}
            </motion.button>

            {/* Next/Forward */}
            <Button
              size="icon"
              variant="ghost"
              className="w-12 h-12 hover:bg-white/10 text-white"
              disabled={isRadioActive}
              onClick={() => isPodcastActive && nextEpisode()}
            >
              <SkipForward className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        {/* Queue / episode context for podcasts */}
        {isPodcastActive && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.32 }}
            className="mb-8 px-4 py-3 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between text-sm text-slate-300"
          >
            <div className="flex flex-col">
              <span className="font-semibold text-white line-clamp-1">{currentEpisode?.title}</span>
              <span className="text-xs text-slate-400">
                Episode {queueIndex + 1}
                {queue?.length ? ` of ${queue.length}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-300 hover:bg-white/10"
                onClick={() => isPodcastActive && previousEpisode()}
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-300 hover:bg-white/10"
                onClick={() => isPodcastActive && nextEpisode()}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Episode List / Queue */}
        {isPodcastActive && queue && queue.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.38 }}
            className="mb-10 bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-100 text-sm font-semibold">
                <ListIcon className="w-4 h-4" />
                Episodes
              </div>
              <span className="text-xs text-slate-400">{queue.length} items</span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-white/10">
              {queue.map((episode, index) => {
                const isActive = index === queueIndex;
                return (
                  <button
                    key={episode.id || `${episode.title}-${index}`}
                    onClick={() => playEpisode(episode)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-slate-200'
                    }`}
                  >
                    <div className={`mt-1 w-2 h-2 rounded-full ${isActive ? 'bg-fuchsia-400' : 'bg-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold line-clamp-2">{episode.title}</p>
                      {episode.duration && (
                        <p className="text-xs text-slate-400 mt-1">{formatTime(episode.duration)}</p>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 whitespace-nowrap">#{index + 1}</div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Secondary Controls */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8"
        >
          {/* Loop - Podcast Only */}
          {isPodcastActive ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleLoop}
              className={`h-12 hover:bg-white/10 ${
                isLooping ? 'text-fuchsia-400' : 'text-slate-400'
              }`}
              title={isLooping ? 'Loop enabled' : 'Loop disabled'}
            >
              <Repeat className="w-5 h-5" />
            </Button>
          ) : (
            <div className="h-12" />
          )}

          {/* Volume */}
          <Button
            size="icon"
            variant="ghost"
            onClick={handleToggleMute}
            className="h-12 hover:bg-white/10"
            title={activeIsMuted ? 'Unmute' : 'Mute'}
          >
            {activeIsMuted ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </Button>

          {/* Favorite */}
          <Button
            size="icon"
            variant="ghost"
            className="h-12 hover:bg-white/10"
            title="Add to favorites"
          >
            <Heart className="w-5 h-5" />
          </Button>

          {/* Share */}
          <Button
            size="icon"
            variant="ghost"
            className="h-12 hover:bg-white/10"
            title="Share"
          >
            <Share2 className="w-5 h-5" />
          </Button>

          {/* Settings/Info */}
          <Button
            size="icon"
            variant="ghost"
            className="h-12 hover:bg-white/10"
            title="More options"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Volume Control */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-3 mb-8 px-4 py-3 bg-white/5 rounded-2xl border border-white/10"
        >
          <Volume2 className="w-4 h-4 text-slate-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={activeVolume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-fuchsia-500 [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-fuchsia-500 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0"
          />
          <span className="text-xs text-slate-400 w-8 text-right">
            {Math.round(activeVolume * 100)}%
          </span>
        </motion.div>

        {activeType && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.56 }}
            className="mb-8"
          >
            <EqualizerPanel equalizer={activeEqualizer} />
          </motion.div>
        )}

        {/* Playback Speed - Podcast Only */}
        {isPodcastActive && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-2 px-4 py-3 bg-white/5 rounded-2xl border border-white/10"
          >
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300 flex-1">Speed</span>
            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className="bg-slate-700 text-white text-sm px-3 py-1 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </motion.div>
        )}

        {/* No Content State */}
        {!activeType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 rounded-3xl border border-white/10 bg-white/5"
          >
            <div className="text-6xl opacity-20 mb-4 flex justify-center">
              <Radio />
            </div>
            <p className="text-slate-400 text-lg">No media is currently playing</p>
            <p className="text-slate-500 text-sm">Start playing a radio station or podcast to see it here</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default PlayerPage;
