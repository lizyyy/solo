import { useState } from 'react';
import { Music, Box, Mic, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import type { Experiment, DataStatus } from '../../types';
import { frequencyPresets, boxSizePresets, sampleRatePresets } from '../../utils/mockData';

interface ControlPanelProps {
  experiment: Experiment;
  onUpdate: (updates: Partial<Experiment>) => void;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  status: DataStatus;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, icon, status, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-dark-600 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-dark-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-primary-400">{icon}</span>
          <span className="text-sm font-medium text-dark-100">{title}</span>
          <span
            className={`status-badge text-xs ${
              status === 'confirmed' ? 'status-confirmed' : 'status-tentative'
            }`}
          >
            {status === 'confirmed' ? '已确认' : '临时'}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-dark-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-dark-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

export function ControlPanel({ experiment, onUpdate }: ControlPanelProps) {
  const handleFrequencyChange = (frequency: number) => {
    onUpdate({
      tuningFork: { ...experiment.tuningFork, frequency, status: 'tentative' },
    });
  };

  const handleBoxSizeChange = (length: number, width: number, height: number) => {
    onUpdate({
      resonanceBox: { ...experiment.resonanceBox, length, width, height, status: 'tentative' },
    });
  };

  const handleSampleRateChange = (sampleRate: number) => {
    onUpdate({
      sampling: { ...experiment.sampling, sampleRate, status: 'tentative' },
    });
  };

  const handleMicrophoneChange = (axis: 'x' | 'y' | 'z', value: number) => {
    onUpdate({
      microphone: { ...experiment.microphone, [axis]: value, status: 'tentative' },
    });
  };

  return (
    <div className="glass rounded-lg overflow-hidden">
      <Section
        title="音叉参数"
        icon={<Music className="w-4 h-4" />}
        status={experiment.tuningFork.status}
      >
        <div>
          <label className="text-xs text-dark-300 mb-1 block">频率 (Hz)</label>
          <div className="flex flex-wrap gap-2">
            {frequencyPresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleFrequencyChange(preset.frequency)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  Math.abs(experiment.tuningFork.frequency - preset.frequency) < 1
                    ? 'bg-primary-500 text-dark-900'
                    : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <input
              type="range"
              min="100"
              max="2000"
              value={experiment.tuningFork.frequency}
              onChange={(e) => handleFrequencyChange(Number(e.target.value))}
              className="slider"
            />
            <div className="text-xs text-dark-400 text-center mt-1">
              {experiment.tuningFork.frequency.toFixed(0)} Hz
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="共鸣箱"
        icon={<Box className="w-4 h-4" />}
        status={experiment.resonanceBox.status}
      >
        <div>
          <label className="text-xs text-dark-300 mb-2 block">箱体尺寸</label>
          <div className="flex flex-wrap gap-2">
            {boxSizePresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleBoxSizeChange(preset.length, preset.width, preset.height)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  experiment.resonanceBox.length === preset.length
                    ? 'bg-purple-500 text-white'
                    : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="麦克风位置"
        icon={<Mic className="w-4 h-4" />}
        status={experiment.microphone.status}
      >
        <div className="space-y-3">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={axis}>
              <div className="flex justify-between text-xs text-dark-300 mb-1">
                <span>{axis.toUpperCase()} 轴</span>
                <span>{experiment.microphone[axis].toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.1"
                value={experiment.microphone[axis]}
                onChange={(e) => handleMicrophoneChange(axis, Number(e.target.value))}
                className="slider"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="采样设置"
        icon={<Settings className="w-4 h-4" />}
        status={experiment.sampling.status}
      >
        <div>
          <label className="text-xs text-dark-300 mb-2 block">采样率</label>
          <div className="space-y-2">
            {sampleRatePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleSampleRateChange(preset.value)}
                className={`w-full px-3 py-2 rounded text-xs font-medium text-left transition-all ${
                  experiment.sampling.sampleRate === preset.value
                    ? 'bg-accent-500 text-dark-900'
                    : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
