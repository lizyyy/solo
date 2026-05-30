import React from 'react';
import { OscillatorConfig, WaveformType } from '../types';
import Knob from './Knob';
import { Power, Circle, Square, Triangle, Zap } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

interface OscillatorPanelProps {
  oscillator: OscillatorConfig;
  index: number;
}

const waveformIcons: Record<WaveformType, React.ReactNode> = {
  sine: <Circle size={16} />,
  square: <Square size={16} />,
  triangle: <Triangle size={16} />,
  sawtooth: <Zap size={16} />,
};

const waveformLabels: Record<WaveformType, string> = {
  sine: '正弦',
  square: '方波',
  triangle: '三角',
  sawtooth: '锯齿',
};

const OscillatorPanel: React.FC<OscillatorPanelProps> = ({ oscillator, index }) => {
  const updateOscillator = useGameStore(state => state.updateOscillator);
  const toggleOscillator = useGameStore(state => state.toggleOscillator);

  const waveforms: WaveformType[] = ['sine', 'square', 'triangle', 'sawtooth'];

  const handleWaveformChange = (waveform: WaveformType) => {
    updateOscillator(oscillator.id, { waveform });
  };

  const handleFrequencyChange = (frequency: number) => {
    updateOscillator(oscillator.id, { frequency });
  };

  const handleVolumeChange = (volume: number) => {
    updateOscillator(oscillator.id, { volume });
  };

  const handlePhaseChange = (phase: number) => {
    updateOscillator(oscillator.id, { phase });
  };

  return (
    <div className={`p-4 rounded-lg border transition-all duration-300 ${
      oscillator.enabled 
        ? 'neon-border bg-cyber-card/50' 
        : 'border-cyber-muted/30 bg-cyber-card/20 opacity-60'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="font-orbitron text-cyber-primary text-sm font-bold">
            OSC {index + 1}
          </span>
          {oscillator.enabled && (
            <span className="w-2 h-2 rounded-full bg-cyber-success animate-pulse" />
          )}
        </div>
        <button
          onClick={() => toggleOscillator(oscillator.id)}
          className={`p-2 rounded transition-all duration-300 ${
            oscillator.enabled
              ? 'bg-cyber-primary/20 text-cyber-primary shadow-neon-cyan'
              : 'bg-cyber-muted/20 text-cyber-muted hover:text-cyber-primary'
          }`}
        >
          <Power size={16} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {waveforms.map((waveform) => (
          <button
            key={waveform}
            onClick={() => handleWaveformChange(waveform)}
            disabled={!oscillator.enabled}
            className={`flex flex-col items-center gap-1 p-2 rounded text-xs transition-all duration-200 ${
              oscillator.waveform === waveform
                ? 'bg-cyber-primary/30 text-cyber-primary neon-border'
                : 'bg-cyber-card/30 text-cyber-muted hover:text-cyber-primary hover:bg-cyber-primary/10'
            } ${!oscillator.enabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {waveformIcons[waveform]}
            <span className="text-[10px]">{waveformLabels[waveform]}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-around items-end">
        <Knob
          value={oscillator.frequency}
          min={20}
          max={2000}
          step={1}
          label="频率"
          type="frequency"
          onChange={handleFrequencyChange}
          disabled={!oscillator.enabled}
        />
        <Knob
          value={oscillator.volume}
          min={0}
          max={1}
          step={0.01}
          label="音量"
          type="volume"
          onChange={handleVolumeChange}
          disabled={!oscillator.enabled}
        />
        <Knob
          value={oscillator.phase}
          min={0}
          max={1}
          step={0.01}
          label="相位"
          type="phase"
          onChange={handlePhaseChange}
          disabled={!oscillator.enabled}
        />
      </div>
    </div>
  );
};

export default OscillatorPanel;
