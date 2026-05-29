import React, { useMemo, useState } from 'react';
import { Button, Card, Input } from '@/modules/shared/components/ui';
import {
  EQUALIZER_BANDS,
  type EqualizerController,
} from '@/modules/shared/lib/audio-equalizer';
import { RotateCcw, Save, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react';

interface EqualizerPanelProps {
  equalizer: EqualizerController;
  className?: string;
}

export const EqualizerPanel: React.FC<EqualizerPanelProps> = ({ equalizer, className }) => {
  const [presetName, setPresetName] = useState('');

  const recommendedPresets = useMemo(
    () => equalizer.presets.filter((preset) => preset.recommended),
    [equalizer.presets],
  );

  const activePreset = equalizer.presets.find((preset) => preset.id === equalizer.activePresetId);

  const handleSavePreset = () => {
    const saved = equalizer.saveCustomPreset(presetName);

    if (saved) {
      setPresetName('');
    }
  };

  return (
    <Card className={className || 'bg-white/5 border border-white/10 backdrop-blur-sm'}>
      <div className="p-5 space-y-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <SlidersHorizontal className="w-4 h-4 text-fuchsia-400" />
              Equalizer
            </div>
            <p className="text-sm text-slate-400">
              {activePreset ? activePreset.name : 'Custom profile'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={equalizer.enabled ? 'secondary' : 'ghost'}
              onClick={() => equalizer.setEnabled(!equalizer.enabled)}
              className={equalizer.enabled ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-600' : 'text-slate-300 hover:bg-white/10'}
            >
              {equalizer.enabled ? 'On' : 'Off'}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={equalizer.reset}
              className="hover:bg-white/10 text-slate-200"
              title="Reset equalizer"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {!equalizer.supported && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Equalizer processing is unavailable for this stream, so the preset UI is shown but the audio falls back to native volume control.
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Recommended presets
            </div>
            <span className="text-xs text-slate-400">Tap one to apply instantly</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recommendedPresets.map((preset) => {
              const isActive = equalizer.activePresetId === preset.id;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => equalizer.applyPreset(preset.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                    isActive
                      ? 'border-fuchsia-400/50 bg-fuchsia-500/15 text-white shadow-lg shadow-fuchsia-500/10'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{preset.name}</span>
                    {isActive && <span className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-300">Active</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <SlidersHorizontal className="w-4 h-4 text-fuchsia-400" />
              Custom bands
            </div>
            <span className="text-xs text-slate-400">-12 dB to +12 dB</span>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4">
            {EQUALIZER_BANDS.map((band, index) => {
              const gain = equalizer.bands[index] ?? 0;

              return (
                <div key={band.frequency} className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>{band.label}</span>
                    <span className="font-semibold text-white">{gain > 0 ? '+' : ''}{gain.toFixed(1)} dB</span>
                  </div>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={gain}
                    onChange={(event) => equalizer.setBandGain(index, parseFloat(event.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-700 accent-fuchsia-500"
                    style={{
                      background: `linear-gradient(to right, rgb(217, 70, 239) 0%, rgb(217, 70, 239) ${((gain + 12) / 24) * 100}%, rgb(51, 65, 85) ${((gain + 12) / 24) * 100}%, rgb(51, 65, 85) 100%)`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Save className="w-4 h-4 text-emerald-400" />
              Save custom preset
            </div>
            <span className="text-xs text-slate-400">Stored locally on this device</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="Warm vocals, late-night radio..."
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
            <Button
              type="button"
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="bg-fuchsia-500 text-white hover:bg-fuchsia-600"
            >
              Save preset
            </Button>
          </div>
        </div>

        {equalizer.customPresets.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-200">Your presets</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {equalizer.customPresets.map((preset) => {
                const isActive = equalizer.activePresetId === preset.id;

                return (
                  <div
                    key={preset.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      isActive ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => equalizer.applyPreset(preset.id)}
                        className="text-left"
                      >
                        <div className="font-semibold text-white">{preset.name}</div>
                        <div className="text-xs text-slate-400">Custom preset</div>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => equalizer.deleteCustomPreset(preset.id)}
                        className="h-8 w-8 hover:bg-white/10 text-slate-300"
                        title="Delete preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default EqualizerPanel;
