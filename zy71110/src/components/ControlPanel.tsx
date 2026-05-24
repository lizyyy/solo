import { useStore } from '../store/useStore';
import { presetScenarios } from '../utils/presets';
import { ViewMode } from '../types';
import {
  Droplets, Wind, Mountain, Eye, Play, Pause, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  icon?: React.ReactNode;
}

function Slider({ label, value, min, max, step = 1, unit = '', onChange, icon }: SliderProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          {icon}
          {label}
        </label>
        <span className="text-sm text-gray-500">
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
      />
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 pb-4 mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left font-semibold text-gray-800 mb-2"
      >
        <span>{title}</span>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {isOpen && children}
    </div>
  );
}

export function ControlPanel() {
  const environment = useStore((state) => state.environment);
  const updateEnvironment = useStore((state) => state.updateEnvironment);
  const loadPreset = useStore((state) => state.loadPreset);
  const currentPresetId = useStore((state) => state.currentPresetId);
  const viewMode = useStore((state) => state.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);
  const showHeatmap = useStore((state) => state.showHeatmap);
  const setShowHeatmap = useStore((state) => state.setShowHeatmap);
  const showMissedZones = useStore((state) => state.showMissedZones);
  const setShowMissedZones = useStore((state) => state.setShowMissedZones);
  const showSprinklerRanges = useStore((state) => state.showSprinklerRanges);
  const setShowSprinklerRanges = useStore((state) => state.setShowSprinklerRanges);
  const isPlaying = useStore((state) => state.isPlaying);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const resetState = useStore((state) => state.resetState);
  const addSprinkler = useStore((state) => state.addSprinkler);
  const sprinklers = useStore((state) => state.sprinklers);
  const selectedSprinkler = useStore((state) => state.selectedSprinkler);
  const updateSprinkler = useStore((state) => state.updateSprinkler);
  const removeSprinkler = useStore((state) => state.removeSprinkler);

  const viewModes: { value: ViewMode; label: string }[] = [
    { value: 'perspective', label: '透视' },
    { value: 'top', label: '俯视' },
    { value: 'front', label: '正视' },
    { value: 'side', label: '侧视' },
  ];

  const handleAddSprinkler = () => {
    const newId = `s${Date.now()}`;
    addSprinkler({
      id: newId,
      x: (Math.random() - 0.5) * 20,
      z: (Math.random() - 0.5) * 15,
      radius: 10,
      flowRate: 100,
      pressure: 1.0,
      angle: 45,
    });
  };

  const selectedSprinklerData = sprinklers.find((s) => s.id === selectedSprinkler);

  return (
    <div className="w-80 bg-white shadow-lg overflow-y-auto h-full">
      <div className="p-4 bg-gradient-to-r from-green-700 to-green-600 text-white">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Droplets size={24} />
          农田喷灌模拟
        </h1>
        <p className="text-sm text-green-100 mt-1">可视化喷灌覆盖分析工具</p>
      </div>

      <div className="p-4">
        <Section title="场景样例">
          <select
            value={currentPresetId}
            onChange={(e) => {
              const preset = presetScenarios.find((p) => p.id === e.target.value);
              if (preset) loadPreset(preset);
            }}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {presetScenarios.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            {presetScenarios.find((p) => p.id === currentPresetId)?.description}
          </p>
        </Section>

        <Section title="环境参数">
          <Slider
            label="坡度"
            value={environment.slope}
            min={0}
            max={45}
            unit="°"
            icon={<Mountain size={16} className="text-green-600" />}
            onChange={(v) => updateEnvironment({ slope: v })}
          />
          <Slider
            label="坡向"
            value={environment.slopeDirection}
            min={0}
            max={360}
            unit="°"
            onChange={(v) => updateEnvironment({ slopeDirection: v })}
          />
          <Slider
            label="风速"
            value={environment.windSpeed}
            min={0}
            max={10}
            step={0.5}
            unit=" m/s"
            icon={<Wind size={16} className="text-blue-600" />}
            onChange={(v) => updateEnvironment({ windSpeed: v })}
          />
          <Slider
            label="风向"
            value={environment.windDirection}
            min={0}
            max={360}
            unit="°"
            onChange={(v) => updateEnvironment({ windDirection: v })}
          />
          <Slider
            label="水压系数"
            value={environment.globalPressure}
            min={0.3}
            max={1.5}
            step={0.1}
            icon={<Droplets size={16} className="text-blue-500" />}
            onChange={(v) => updateEnvironment({ globalPressure: v })}
          />
        </Section>

        <Section title="视角控制">
          <div className="flex items-center gap-2 mb-3">
            <Eye size={16} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">视角模式</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {viewModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  viewMode === mode.value
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="显示选项">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">显示覆盖热力图</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showMissedZones}
                onChange={(e) => setShowMissedZones(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">标记漏浇区域</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showSprinklerRanges}
                onChange={(e) => setShowSprinklerRanges(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">显示喷头范围</span>
            </label>
          </div>
        </Section>

        <Section title="喷头管理">
          <button
            onClick={handleAddSprinkler}
            className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium mb-3"
          >
            + 添加喷头
          </button>

          {selectedSprinklerData && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-2">
                选中喷头: {selectedSprinklerData.id}
              </p>
              <Slider
                label="喷射半径"
                value={selectedSprinklerData.radius}
                min={5}
                max={20}
                unit=" m"
                onChange={(v) => updateSprinkler(selectedSprinklerData.id, { radius: v })}
              />
              <Slider
                label="水压"
                value={selectedSprinklerData.pressure}
                min={0.3}
                max={1.5}
                step={0.1}
                onChange={(v) => updateSprinkler(selectedSprinklerData.id, { pressure: v })}
              />
              <button
                onClick={() => removeSprinkler(selectedSprinklerData.id)}
                className="w-full py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
              >
                删除喷头
              </button>
            </div>
          )}

          <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
            {sprinklers.map((s, i) => (
              <div
                key={s.id}
                className={`text-xs p-2 rounded cursor-pointer transition-colors ${selectedSprinkler === s.id ? 'bg-blue-100 text-blue-800' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                onClick={() => useStore.getState().setSelectedSprinkler(s.id)}
              >
                喷头 {i + 1}: ({s.x.toFixed(1)}, {s.z.toFixed(1)})
              </div>
            ))}
          </div>
        </Section>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {isPlaying ? '暂停' : '播放'}
          </button>
          <button
            onClick={resetState}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            title="重置状态"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
