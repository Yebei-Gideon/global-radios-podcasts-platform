import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import type { RadioStation } from '../types/radio.types';
import { useGlobalAudioManager } from '@/modules/shared/context/GlobalAudioManager';
import { useAudioEqualizer, type EqualizerController } from '@/modules/shared/lib/audio-equalizer';

interface AudioContextType {
  currentStation: RadioStation | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
  equalizer: EqualizerController;
  playStation: (station: RadioStation) => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

/**
 * Global Audio Player Context
 * Manages the audio playback state across the entire app
 * Important: Audio connects DIRECTLY to stream URLs, no proxying
 */
export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const globalAudioManager = useGlobalAudioManager();
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const eventListenersRef = useRef<Array<{ event: string; handler: EventListener }>>([]);
  const equalizer = useAudioEqualizer(audioElement, 'radio');

  // Build an ordered list of candidate stream URLs, preferring HTTPS when available
  const buildStreamCandidates = (station: RadioStation): string[] => {
    const candidates: string[] = [];

    const addCandidate = (url?: string) => {
      if (url && !candidates.includes(url)) {
        candidates.push(url);
      }
    };

    const toHttpsIfSupported = (url?: string) => {
      if (!url) return undefined;
      if (url.startsWith('https://')) return url;
      if (station.ssl && url.startsWith('http://')) {
        return url.replace(/^http:/i, 'https:');
      }
      return url;
    };

    const primary = toHttpsIfSupported(station.streamUrl);
    addCandidate(primary);
    // Keep the original stream URL as a fallback if we upgraded to HTTPS
    if (primary && station.streamUrl && primary !== station.streamUrl) {
      addCandidate(station.streamUrl);
    }

    // Some stations have a secondary URL field that may work when the primary fails
    addCandidate(toHttpsIfSupported(station.url));

    return candidates;
  };

  // Register pause function with global audio manager
  const pause = useCallback(() => {
    console.log('[AudioContext] Pause called, current station:', currentStation?.name);
    if (audioRef.current) {
      console.log('[AudioContext] Pausing audio element');
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentStation?.name]);

  useEffect(() => {
    // Register this player with the global audio manager
    globalAudioManager.registerPlayer('radio', pause);
  }, [globalAudioManager, pause]);

  useEffect(() => {
    // Create audio element only once
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      setAudioElement(audioRef.current);

      const handlers = {
        loadstart: () => {
          setIsLoading(true);
          setError(null);
        },
        canplay: () => {
          setIsLoading(false);
          setError(null);
        },
        playing: () => {
          setIsPlaying(true);
          setIsLoading(false);
          // Notify global manager that radio is playing
          globalAudioManager.notifyPlayback('radio');
        },
        ended: () => {
          setIsPlaying(false);
        },
        pause: () => {
          setIsPlaying(false);
        },
        error: (e: Event) => {
          const audio = e.target as HTMLAudioElement;
          let errorMessage = 'Failed to load stream';

          if (audio.error) {
            switch (audio.error.code) {
              case audio.error.MEDIA_ERR_ABORTED:
                errorMessage = 'Stream loading aborted';
                break;
              case audio.error.MEDIA_ERR_NETWORK:
                errorMessage = 'Network error - check stream URL or CORS';
                break;
              case audio.error.MEDIA_ERR_DECODE:
                errorMessage = 'Unable to decode audio stream';
                break;
              case audio.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Stream format not supported';
                break;
            }
          }

          console.error('Audio playback error:', errorMessage, audio.error);
          setError(errorMessage);
          setIsLoading(false);
          setIsPlaying(false);
        },
      };

      // Add all event listeners
      Object.entries(handlers).forEach(([eventType, handler]) => {
        audioRef.current?.addEventListener(eventType, handler as EventListener);
        eventListenersRef.current.push({ event: eventType, handler: handler as EventListener });
      });
    }

    return () => {
      // Cleanup event listeners on unmount
      if (audioRef.current) {
        eventListenersRef.current.forEach(({ event, handler }) => {
          audioRef.current?.removeEventListener(event, handler);
        });
        eventListenersRef.current = [];

        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
        setAudioElement(null);
      }
    };
  }, []);

  const playStation = (station: RadioStation) => {
    if (!audioRef.current) return;

    // If same station, just toggle play/pause
    if (currentStation?.id === station.id && isPlaying) {
      togglePlay();
      return;
    }

    const candidates = buildStreamCandidates(station);

    if (candidates.length === 0) {
      setError('No stream URL available for this station');
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    // Stop current playback before loading new station
    audioRef.current.pause();
    audioRef.current.src = '';

    setCurrentStation(station);
    setError(null);
    setIsLoading(true);

    void equalizer.resumeContext();

    let lastError: string | null = null;

    const tryPlayCandidate = (index: number) => {
      if (!audioRef.current) return;

      if (index >= candidates.length) {
        setError(lastError || 'Failed to play station');
        setIsPlaying(false);
        setIsLoading(false);
        return;
      }

      const url = candidates[index];
      audioRef.current.pause();
      audioRef.current.src = url;

      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch((error) => {
            lastError = error?.message || 'Playback failed';
            console.error(`Failed to play stream candidate (${index + 1}/${candidates.length}):`, url, error);
            tryPlayCandidate(index + 1);
          });
      }
    };

    tryPlayCandidate(0);
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentStation) return;

    if (isPlaying) {
      pause();
    } else {
      void equalizer.resumeContext();
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((error) => console.error('Play error:', error));
    }
  };

  const setVolume = (newVolume: number) => {
    equalizer.setVolume(newVolume);
  };

  const toggleMute = () => {
    equalizer.toggleMute();
  };

  return (
    <AudioContext.Provider
      value={{
        currentStation,
        isPlaying,
        volume: equalizer.volume,
        isMuted: equalizer.isMuted,
        isLoading,
        error,
        equalizer,
        playStation,
        pause,
        togglePlay,
        setVolume,
        toggleMute,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
