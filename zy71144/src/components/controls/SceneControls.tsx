import { Building2, Eye, EyeOff, Grid3X3, Layers, MapPin, RotateCcw, ArrowUpDown } from 'lucide-react';
import type { BuildingModel, SceneSettings, ViewMode } from '../../types';

interface SceneControlsProps {
  buildings: BuildingModel[];
  currentBuilding: BuildingModel | null;
  onBuildingChange: (building: BuildingModel) => void;
  settings: SceneSettings;
  onSettingsChange: (settings: Partial<SceneSettings>) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onReset: () => void;
}

export function SceneControls({
  buildings,
  currentBuilding,
  onBuildingChange,
  settings,
  onSettingsChange,
  viewMode,
  onViewModeChange,
  onReset,
}: SceneControlsProps) {
  const viewModes: { value: ViewMode; label: string; icon: any }[] = [
    { value: 'free', label: '自由视角', icon: RotateCcw },
    { value: 'top', label: '俯视视角', icon: Grid3X3 },
    { value: 'firstPerson', label: '第一人称', icon: Eye },
  ];

  const settingItems = [
    { key: 'showWalls', label: '显示墙体', icon: Layers },
    { key: 'showHydrants', label: '显示消火栓', icon: MapPin },
    { key: 'showStairs', label: '显示楼梯', icon: ArrowUpDown },
    { key: 'showGrid', label: '显示网格', icon: Grid3X3 },
  ];

  return (
    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700 space-y-4">
      <div>
        <label className="text-slate-300 text-sm font-medium mb-2 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          选择建筑场景
        </label>
        <select
          value={currentBuilding?.id || ''}
          onChange={(e) => {
            const building = buildings.find((b) => b.id === e.target.value);
            if (building) onBuildingChange(building);
          }}
          className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name} ({building.floors}层)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-slate-300 text-sm font-medium mb-2 block">视角模式</label>
        <div className="grid grid-cols-3 gap-2">
          {viewModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.value}
                onClick={() => onViewModeChange(mode.value)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
                  viewMode === mode.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span className="text-xs">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-slate-300 text-sm font-medium mb-2 block">场景元素</label>
        <div className="space-y-2">
          {settingItems.map((item) => {
            const Icon = item.icon;
            const isChecked = settings[item.key as keyof SceneSettings];
            return (
              <button
                key={item.key}
                onClick={() => onSettingsChange({ [item.key]: !isChecked })}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                  isChecked
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900/50 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </span>
                {isChecked ? (
                  <Eye className="w-4 h-4 text-green-400" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 rounded-lg py-2.5 transition-all"
      >
        <RotateCcw className="w-4 h-4" />
        重置场景
      </button>
    </div>
  );
}
