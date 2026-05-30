import { useState } from 'react';
import {
  Settings,
  Eye,
  EyeOff,
  Camera,
  Save,
  Trash2,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { SimulationParameters, VisibilityState, Viewpoint } from '../../types';
import { calculateSchwarzschildRadius } from '../../physics/constants';

interface ControlPanelProps {
  parameters: SimulationParameters;
  visibility: VisibilityState;
  viewpoints: Viewpoint[];
  blackHoleMass: number;
  onParameterChange: (key: keyof SimulationParameters, value: number) => void;
  onVisibilityChange: (visibility: Partial<VisibilityState>) => void;
  onSaveViewpoint: (name: string) => void;
  onRestoreViewpoint: (id: string) => void;
  onDeleteViewpoint: (id: string) => void;
  onRecalculateRays: () => void;
  onRegenerateStars: () => void;
  onRunQualityCheck: () => void;
  qualityStatus: 'pass' | 'warning' | 'error' | null;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-gray-300 font-medium">{label}</label>
        <span className="text-xs text-orange-400 font-mono">
          {value.toFixed(step < 1 ? 2 : 0)}{unit || ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
      />
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
          checked ? 'bg-orange-500' : 'bg-gray-600'
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function ControlPanel({
  parameters,
  visibility,
  viewpoints,
  blackHoleMass,
  onParameterChange,
  onVisibilityChange,
  onSaveViewpoint,
  onRestoreViewpoint,
  onDeleteViewpoint,
  onRecalculateRays,
  onRegenerateStars,
  onRunQualityCheck,
  qualityStatus,
}: ControlPanelProps) {
  const [activeTab, setActiveTab] = useState<'parameters' | 'visibility' | 'viewpoints' | 'quality'>('parameters');
  const [newViewpointName, setNewViewpointName] = useState('');

  const schwarzschildRadius = calculateSchwarzschildRadius(blackHoleMass);

  const getStatusIcon = () => {
    switch (qualityStatus) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const tabs = [
    { id: 'parameters', label: '参数', icon: Settings },
    { id: 'visibility', label: '显示', icon: Eye },
    { id: 'viewpoints', label: '视角', icon: Camera },
    { id: 'quality', label: '质检', icon: AlertTriangle },
  ] as const;

  return (
    <div className="w-72 bg-gray-900/90 backdrop-blur-md border-r border-gray-700/50 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700/50">
        <h2 className="text-lg font-bold text-orange-400 font-['Orbitron'] tracking-wider">
          控制面板
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          R<sub>s</sub> = {schwarzschildRadius.toExponential(2)} 单位
        </p>
      </div>

      <div className="flex border-b border-gray-700/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 p-2 flex flex-col items-center gap-1 transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-800/50 text-orange-400 border-b-2 border-orange-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="text-[10px]">{tab.label}</span>
            {tab.id === 'quality' && qualityStatus && (
              <span className="absolute top-1 right-1">{getStatusIcon()}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'parameters' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-3">物理参数</h3>
            <Slider
              label="黑洞质量"
              value={parameters.blackHoleMass}
              min={1}
              max={100}
              step={0.5}
              unit=" M☉"
              onChange={(v) => onParameterChange('blackHoleMass', v)}
            />
            <Slider
              label="光线数量"
              value={parameters.rayCount}
              min={5}
              max={50}
              step={1}
              onChange={(v) => onParameterChange('rayCount', v)}
            />
            <Slider
              label="观测距离"
              value={parameters.observerDistance}
              min={10}
              max={100}
              step={1}
              unit=" 单位"
              onChange={(v) => onParameterChange('observerDistance', v)}
            />
            <Slider
              label="恒星密度"
              value={parameters.starDensity}
              min={0.1}
              max={2}
              step={0.1}
              onChange={(v) => onParameterChange('starDensity', v)}
            />
            <Slider
              label="透镜强度"
              value={parameters.lensStrength}
              min={0.1}
              max={3}
              step={0.1}
              onChange={(v) => onParameterChange('lensStrength', v)}
            />

            <div className="mt-6 space-y-2">
              <button
                onClick={onRecalculateRays}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors"
              >
                <Play className="w-3 h-3" />
                重新计算光线路径
              </button>
              <button
                onClick={onRegenerateStars}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                重新生成星场
              </button>
            </div>
          </div>
        )}

        {activeTab === 'visibility' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-3">显示控制</h3>
            <Toggle
              label="黑洞"
              checked={visibility.blackHole}
              onChange={(v) => onVisibilityChange({ blackHole: v })}
            />
            <Toggle
              label="光线路径"
              checked={visibility.lightRays}
              onChange={(v) => onVisibilityChange({ lightRays: v })}
            />
            <Toggle
              label="背景星场"
              checked={visibility.starField}
              onChange={(v) => onVisibilityChange({ starField: v })}
            />

            <h3 className="text-sm font-semibold text-gray-200 mt-6 mb-3">辅助显示</h3>
            <Toggle
              label="事件视界"
              checked={parameters.showEventHorizon}
              onChange={(v) => onParameterChange('showEventHorizon', v ? 1 : 0)}
            />
            <Toggle
              label="光子球"
              checked={parameters.showPhotonSphere}
              onChange={(v) => onParameterChange('showPhotonSphere', v ? 1 : 0)}
            />
          </div>
        )}

        {activeTab === 'viewpoints' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-3">保存视角</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newViewpointName}
                onChange={(e) => setNewViewpointName(e.target.value)}
                placeholder="视角名称..."
                className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={() => {
                  if (newViewpointName.trim()) {
                    onSaveViewpoint(newViewpointName.trim());
                    setNewViewpointName('');
                  }
                }}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-white text-xs rounded transition-colors"
              >
                <Save className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {viewpoints.map((vp) => (
                <div
                  key={vp.id}
                  className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg group"
                >
                  <button
                    onClick={() => onRestoreViewpoint(vp.id)}
                    className="flex-1 text-left text-xs text-gray-200 hover:text-orange-400 transition-colors"
                  >
                    <div className="font-medium">{vp.name}</div>
                    <div className="text-[10px] text-gray-500">
                      位置: ({vp.cameraPosition.map((v) => v.toFixed(1)).join(', ')})
                    </div>
                  </button>
                  {!vp.id.startsWith('vp-') || vp.id.includes('vp-') ? (
                    <button
                      onClick={() => onDeleteViewpoint(vp.id)}
                      className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-3">质量检查</h3>
            <button
              onClick={onRunQualityCheck}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs rounded-lg transition-colors mb-4"
            >
              <AlertTriangle className="w-3 h-3" />
              运行质量检查
            </button>

            {qualityStatus && (
              <div
                className={`p-3 rounded-lg text-xs ${
                  qualityStatus === 'pass'
                    ? 'bg-green-900/30 border border-green-700/50'
                    : qualityStatus === 'warning'
                    ? 'bg-yellow-900/30 border border-yellow-700/50'
                    : 'bg-red-900/30 border border-red-700/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon()}
                  <span className="font-medium">
                    {qualityStatus === 'pass'
                      ? '检查通过'
                      : qualityStatus === 'warning'
                      ? '存在警告'
                      : '存在严重问题'}
                  </span>
                </div>
                <p className="text-gray-300">
                  点击右侧面板查看详细问题描述和受影响的对象列表。
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
