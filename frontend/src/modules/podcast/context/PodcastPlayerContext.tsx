import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import type { Podcast, PodcastEpisode } from '../types/podcast.types';
import { useGlobalAudioManager } from '@/modules/shared/context/GlobalAudioManager';
import { useAudioEqualizer, type EqualizerController } from '@/modules/shared/lib/audio-equalizer';

interface PodcastPlayerContextType {
  // Current State
  currentPodcast: Podcast | null;
  currentEpisode: PodcastEpisode | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;

  // Playback Control
  duration: number;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  equalizer: EqualizerController;

  // Queue Management
  queue: PodcastEpisode[];
  queueIndex: number;
  isLooping: boolean;

  // Methods
  playPodcast: (podcast: Podcast, episode: PodcastEpisode) => void;
  playEpisode: (episode: PodcastEpisode) => void;
  pause: () => void;
  resume: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  nextEpisode: () => void;
  previousEpisode: () => void;
  setQueue: (episodes: PodcastEpisode[], startIndex?: number) => void;
  addToQueue: (episode: PodcastEpisode) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  toggleLoop: () => void;
}

const PodcastPlayerContext = createContext<PodcastPlayerContextType | undefined>(undefined);

/**
 * Podcast Player Context Provider
 * Manages podcast playback state and episode queue
 */
export const PodcastPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const globalAudioManager = useGlobalAudioManager();
  // Playback State
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time State
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Volume & Playback
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const equalizer = useAudioEqualizer(audioElement, 'podcast');

  // Queue State
  const [queue, setQueueState] = useState<PodcastEpisode[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isLooping, setIsLooping] = useState(false);

  // Audio Reference
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Register pause function with global audio manager
  const pause = useCallback(() => {
    console.log('[PodcastPlayerContext] Pause called, current episode:', currentEpisode?.title);
    if (audioRef.current) {
      console.log('[PodcastPlayerContext] Pausing audio element');
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentEpisode?.title]);

  useEffect(() => {
    // Register this player with the global audio manager
    globalAudioManager.registerPlayer('podcast', pause);
  }, [globalAudioManager, pause]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.playbackRate = playbackRate;
      setAudioElement(audioRef.current);

      const updateTime = () => setCurrentTime(audioRef.current?.currentTime || 0);
      const updateDuration = () => setDuration(audioRef.current?.duration || 0);

      const handleEnded = () => {
        nextEpisode();
      };

      const handlePlaying = () => {
        setIsPlaying(true);
        setIsLoading(false);
        // Notify global manager that podcast is playing
        globalAudioManager.notifyPlayback('podcast');
      };

      const handleError = (e: Event) => {
        const audio = e.target as HTMLAudioElement;
        let errorMessage = 'Failed to load episode';

        if (audio.error) {
          switch (audio.error.code) {
            case audio.error.MEDIA_ERR_NETWORK:
              errorMessage = 'Network error - check connection';
              break;
            case audio.error.MEDIA_ERR_DECODE:
              errorMessage = 'Unable to decode audio';
              break;
            case audio.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Audio format not supported';
              break;
          }
        }

        setError(errorMessage);
        setIsPlaying(false);
        setIsLoading(false);
      };

      audioRef.current.addEventListener('timeupdate', updateTime);
      audioRef.current.addEventListener('loadedmetadata', updateDuration);
      audioRef.current.addEventListener('ended', handleEnded);
      audioRef.current.addEventListener('playing', handlePlaying);
      audioRef.current.addEventListener('error', handleError);
      audioRef.current.addEventListener('play', () => setIsPlaying(true));
      audioRef.current.addEventListener('pause', () => setIsPlaying(false));
      audioRef.current.addEventListener('loadstart', () => setIsLoading(true));
      audioRef.current.addEventListener('canplay', () => setIsLoading(false));
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        setAudioElement(null);
      }
    };
  }, []);

  const playPodcast = (podcast: Podcast, episode: PodcastEpisode) => {
    setCurrentPodcast(podcast);
    playEpisode(episode);
  };

  const playEpisode = (episode: PodcastEpisode) => {
    if (!audioRef.current) return;

    // Stop current playback
    audioRef.current.pause();
    audioRef.current.src = '';

    // Load and play new episode
    setCurrentEpisode(episode);
    setError(null);
    setIsLoading(true);
    audioRef.current.src = episode.audioUrl;

    void equalizer.resumeContext();

    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'Failed to play episode');
          setIsPlaying(false);
          setIsLoading(false);
        });
    }
  };

  const resume = () => {
    if (audioRef.current && currentEpisode) {
      void equalizer.resumeContext();
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          setError(err.message || 'Failed to resume');
        });
      }
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolume = (newVolume: number) => {
    equalizer.setVolume(newVolume);
  };

  const toggleMute = () => {
    equalizer.toggleMute();
  };

  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const nextEpisode = () => {
    if (queue.length === 0) return;
    const nextIndex = queueIndex + 1;
    // If at end and not looping, stop
    if (nextIndex >= queue.length && !isLooping) {
      pause();
      return;
    }
    // Loop back to start if needed
    const finalIndex = nextIndex >= queue.length ? 0 : nextIndex;
    setQueueIndex(finalIndex);
    playEpisode(queue[finalIndex]);
  };

  const previousEpisode = () => {
    if (queue.length === 0) return;
    const prevIndex = queueIndex === 0 ? queue.length - 1 : queueIndex - 1;
    setQueueIndex(prevIndex);
    playEpisode(queue[prevIndex]);
  };

  const setQueue = (episodes: PodcastEpisode[], startIndex = 0) => {
    setQueueState(episodes);
    setQueueIndex(startIndex);
    if (episodes.length > startIndex) {
      playEpisode(episodes[startIndex]);
    }
  };

  const addToQueue = (episode: PodcastEpisode) => {
    setQueueState([...queue, episode]);
  };

  const removeFromQueue = (index: number) => {
    const newQueue = queue.filter((_, i) => i !== index);
    setQueueState(newQueue);
    if (index === queueIndex && currentEpisode) {
      if (index < newQueue.length) {
        playEpisode(newQueue[index]);
      } else if (newQueue.length > 0) {
        playEpisode(newQueue[newQueue.length - 1]);
      }
    }
  };

  const clearQueue = () => {
    setQueueState([]);
    setQueueIndex(0);
    pause();
  };

  const toggleLoop = () => {
    setIsLooping(!isLooping);
  };

  return (
    <PodcastPlayerContext.Provider
      value={{
        currentPodcast,
        currentEpisode,
        isPlaying,
        isLoading,
        error,
        duration,
        currentTime,
        volume: equalizer.volume,
        isMuted: equalizer.isMuted,
        playbackRate,
        equalizer,
        queue,
        queueIndex,
        isLooping,
        playPodcast,
        playEpisode,
        pause,
        resume,
        togglePlayPause,
        seek,
        setVolume,
        toggleMute,
        setPlaybackRate,
        nextEpisode,
        previousEpisode,
        setQueue,
        addToQueue,
        removeFromQueue,
        clearQueue,
        toggleLoop,
      }}
    >
      {children}
    </PodcastPlayerContext.Provider>
  );
};

export const usePodcastPlayer = () => {
  const context = useContext(PodcastPlayerContext);
  if (context === undefined) {
    throw new Error('usePodcastPlayer must be used within a PodcastPlayerProvider');
  }
  return context;
};
