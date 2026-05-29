import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type EqualizerBandDefinition = {
  label: string;
  frequency: number;
};

export type EqualizerPreset = {
  id: string;
  name: string;
  description: string;
  gains: number[];
  recommended?: boolean;
  custom?: boolean;
};

export type EqualizerCustomPreset = {
  id: string;
  name: string;
  gains: number[];
  createdAt: string;
};

export type EqualizerController = {
  supported: boolean;
  enabled: boolean;
  volume: number;
  isMuted: boolean;
  activePresetId: string;
  bands: number[];
  presets: EqualizerPreset[];
  customPresets: EqualizerCustomPreset[];
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setBandGain: (index: number, gain: number) => void;
  applyPreset: (presetId: string) => void;
  saveCustomPreset: (name: string) => boolean;
  deleteCustomPreset: (presetId: string) => void;
  reset: () => void;
  resumeContext: () => Promise<void>;
};

export const EQUALIZER_BANDS: EqualizerBandDefinition[] = [
  { label: '60 Hz', frequency: 60 },
  { label: '230 Hz', frequency: 230 },
  { label: '910 Hz', frequency: 910 },
  { label: '3.6 kHz', frequency: 3600 },
  { label: '14 kHz', frequency: 14000 },
];

export const RECOMMENDED_EQUALIZER_PRESETS: EqualizerPreset[] = [
  {
    id: 'flat',
    name: 'Flat',
    description: 'Balanced and neutral.',
    gains: [0, 0, 0, 0, 0],
    recommended: true,
  },
  {
    id: 'bass-boost',
    name: 'Bass Boost',
    description: 'Adds weight and depth.',
    gains: [6, 4, 1, -2, -4],
    recommended: true,
  },
  {
    id: 'vocal',
    name: 'Vocal',
    description: 'Pulls voices forward.',
    gains: [-3, -1, 5, 4, -1],
    recommended: true,
  },
  {
    id: 'treble-boost',
    name: 'Treble Boost',
    description: 'Adds clarity and sparkle.',
    gains: [-4, -2, 0, 4, 6],
    recommended: true,
  },
  {
    id: 'podcast-voice',
    name: 'Podcast Voice',
    description: 'Tuned for speech and narration.',
    gains: [-5, -1, 6, 4, -1],
    recommended: true,
  },
  {
    id: 'night-drive',
    name: 'Night Drive',
    description: 'Warm lows with softened highs.',
    gains: [4, 3, 0, -2, -4],
    recommended: true,
  },
];

const DEFAULT_BANDS = RECOMMENDED_EQUALIZER_PRESETS[0].gains;
const DEFAULT_VOLUME: number = 0.7;
const MIN_GAIN = -12;
const MAX_GAIN = 12;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeBands = (bands: number[] | undefined) => {
  const nextBands = [...DEFAULT_BANDS];

  bands?.forEach((gain, index) => {
    if (index < nextBands.length) {
      nextBands[index] = clamp(gain, MIN_GAIN, MAX_GAIN);
    }
  });

  return nextBands;
};

const readStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
};

const writeStorage = <T,>(key: string, value: T) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
};

const getCustomPresetKey = (storageKey: string) => `${storageKey}:equalizer-custom-presets`;
const getEnabledKey = (storageKey: string) => `${storageKey}:equalizer-enabled`;
const getPresetKey = (storageKey: string) => `${storageKey}:equalizer-preset`;
const getVolumeKey = (storageKey: string) => `${storageKey}:equalizer-volume`;

export const useAudioEqualizer = (
  audioElement: HTMLAudioElement | null,
  storageKey: string,
): EqualizerController => {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabledState] = useState(() => readStorage(getEnabledKey(storageKey), true));
  const [volume, setVolumeState] = useState(() => {
    const storedVolume = readStorage<number>(getVolumeKey(storageKey), DEFAULT_VOLUME);
    return clamp(storedVolume, 0, 1);
  });
  const [isMuted, setIsMuted] = useState(() => readStorage(getVolumeKey(storageKey), DEFAULT_VOLUME) === 0);
  const [activePresetId, setActivePresetId] = useState(() => readStorage(getPresetKey(storageKey), 'flat'));
  const [bands, setBands] = useState<number[]>(() => {
    const storedPresetId = readStorage<string>(getPresetKey(storageKey), 'flat');
    const storedCustomPresets = readStorage<EqualizerCustomPreset[]>(getCustomPresetKey(storageKey), []);
    const preset = [...RECOMMENDED_EQUALIZER_PRESETS, ...storedCustomPresets].find((entry) => entry.id === storedPresetId);
    return normalizeBands(preset?.gains);
  });
  const [customPresets, setCustomPresets] = useState<EqualizerCustomPreset[]>(() => {
    const storedPresets = readStorage<EqualizerCustomPreset[]>(getCustomPresetKey(storageKey), []);
    return storedPresets.map((preset) => ({
      ...preset,
      gains: normalizeBands(preset.gains),
    }));
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filterNodesRef = useRef<BiquadFilterNode[]>([]);
  const masterGainRef = useRef<GainNode | null>(null);
  const previousVolumeRef = useRef(volume);

  const presets = useMemo(() => {
    return [
      ...RECOMMENDED_EQUALIZER_PRESETS,
      ...customPresets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        description: 'Custom preset',
        gains: preset.gains,
        custom: true,
      })),
    ];
  }, [customPresets]);

  useEffect(() => {
    writeStorage(getEnabledKey(storageKey), enabled);
  }, [enabled, storageKey]);

  useEffect(() => {
    writeStorage(getVolumeKey(storageKey), volume);
  }, [storageKey, volume]);

  useEffect(() => {
    writeStorage(getPresetKey(storageKey), activePresetId);
  }, [activePresetId, storageKey]);

  useEffect(() => {
    writeStorage(getCustomPresetKey(storageKey), customPresets);
  }, [customPresets, storageKey]);

  useEffect(() => {
    previousVolumeRef.current = volume > 0 ? volume : previousVolumeRef.current;
  }, [volume]);

  useEffect(() => {
    if (!audioElement) {
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      setSupported(false);
      return;
    }

    let disposed = false;

    const setup = async () => {
      try {
        const context = new AudioContextCtor();
        const source = context.createMediaElementSource(audioElement);
        const filters = EQUALIZER_BANDS.map((band) => {
          const filter = context.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = band.frequency;
          filter.Q.value = 1;
          filter.gain.value = 0;
          return filter;
        });
        const gainNode = context.createGain();

        source.connect(filters[0]);
        for (let index = 0; index < filters.length - 1; index += 1) {
          filters[index].connect(filters[index + 1]);
        }
        filters[filters.length - 1].connect(gainNode);
        gainNode.connect(context.destination);

        if (disposed) {
          await context.close();
          return;
        }

        audioContextRef.current = context;
        sourceNodeRef.current = source;
        filterNodesRef.current = filters;
        masterGainRef.current = gainNode;
        setSupported(true);

        audioElement.volume = 1;
        audioElement.muted = false;
      } catch (error) {
        console.warn('[Equalizer] Falling back to native volume control:', error);
        setSupported(false);
      }
    };

    void setup();

    return () => {
      disposed = true;
      filterNodesRef.current = [];
      sourceNodeRef.current = null;
      masterGainRef.current = null;

      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [audioElement]);

  useEffect(() => {
    const filterGains = enabled ? bands : DEFAULT_BANDS;

    filterNodesRef.current.forEach((filterNode, index) => {
      const gain = filterGains[index] ?? 0;
      filterNode.gain.value = clamp(gain, MIN_GAIN, MAX_GAIN);
    });
  }, [bands, enabled]);

  useEffect(() => {
    if (!audioElement) {
      return;
    }

    if (supported && masterGainRef.current) {
      audioElement.volume = 1;
      audioElement.muted = false;
      masterGainRef.current.gain.value = isMuted ? 0 : volume;
    } else {
      audioElement.volume = isMuted ? 0 : volume;
      audioElement.muted = false;
    }
  }, [audioElement, isMuted, supported, volume]);

  const resumeContext = useCallback(async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  const setEnabled = useCallback((nextEnabled: boolean) => {
    setEnabledState(nextEnabled);
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    const clampedVolume = clamp(nextVolume, 0, 1);
    setVolumeState(clampedVolume);
    if (clampedVolume > 0) {
      previousVolumeRef.current = clampedVolume;
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted || volume === 0) {
      const restoredVolume = previousVolumeRef.current > 0 ? previousVolumeRef.current : DEFAULT_VOLUME;
      setVolumeState(restoredVolume);
      setIsMuted(false);
      return;
    }

    previousVolumeRef.current = volume;
    setIsMuted(true);
  }, [isMuted, volume]);

  const setBandGain = useCallback((index: number, gain: number) => {
    setEnabledState(true);
    setActivePresetId('custom');
    setBands((currentBands) => {
      const nextBands = [...currentBands];
      if (index >= 0 && index < nextBands.length) {
        nextBands[index] = clamp(gain, MIN_GAIN, MAX_GAIN);
      }
      return nextBands;
    });
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = presets.find((entry) => entry.id === presetId);

    if (!preset) {
      return;
    }

    setEnabledState(true);
    setActivePresetId(preset.id);
    setBands(normalizeBands(preset.gains));
  }, [presets]);

  const saveCustomPreset = useCallback((name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return false;
    }

    let presetId = '';

    setCustomPresets((currentPresets) => {
      const matchingPreset = currentPresets.find((preset) => preset.name.toLowerCase() === trimmedName.toLowerCase());

      if (matchingPreset) {
        presetId = matchingPreset.id;
        return currentPresets.map((preset) => (
          preset.id === matchingPreset.id
            ? {
                ...preset,
                gains: [...bands],
                createdAt: new Date().toISOString(),
              }
            : preset
        ));
      }

      presetId = `custom-${Date.now()}`;
      return [
        ...currentPresets,
        {
          id: presetId,
          name: trimmedName,
          gains: [...bands],
          createdAt: new Date().toISOString(),
        },
      ];
    });

    if (presetId) {
      setEnabledState(true);
      setActivePresetId(presetId);
      return true;
    }

    return false;
  }, [bands]);

  const deleteCustomPreset = useCallback((presetId: string) => {
    setCustomPresets((currentPresets) => currentPresets.filter((preset) => preset.id !== presetId));

    if (activePresetId === presetId) {
      setActivePresetId('flat');
      setBands(DEFAULT_BANDS);
      setEnabledState(true);
    }
  }, [activePresetId]);

  const reset = useCallback(() => {
    setEnabledState(true);
    setActivePresetId('flat');
    setBands(DEFAULT_BANDS);
  }, []);

  return {
    supported,
    enabled,
    volume,
    isMuted,
    activePresetId,
    bands,
    presets,
    customPresets,
    setEnabled,
    setVolume,
    toggleMute,
    setBandGain,
    applyPreset,
    saveCustomPreset,
    deleteCustomPreset,
    reset,
    resumeContext,
  };
};
