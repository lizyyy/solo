import { useState } from 'react';
import { Search, X, Target, Zap, CircleDot, Layers, AlertTriangle } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { SceneObject, SceneObjectType } from '../../types';

const typeIcons: Record<SceneObjectType, any> = {
  coil: Zap,
  projectile: CircleDot,
  track: Layers,
  sensor: Target,
};

const typeLabels: Record<SceneObjectType, string> = {
  coil: '线圈',
  projectile: '弹丸',
  track: '轨道',
  sensor: '传感器',
};

interface ObjectItemProps {
  object: SceneObject;
  onFocus: (id: string) => void;
  isFocused: boolean;
}

function ObjectItem({ object, onFocus, isFocused }: ObjectItemProps) {
  const Icon = typeIcons[object.type];

  return (
    <button
      onClick={() => onFocus(object.id)}
      className={`w-full p-2 rounded-lg flex items-center gap-3 transition-all duration-200 ${
        isFocused
          ? 'bg-cyber-500/30 border border-cyber-500'
          : 'bg-space-700/50 hover:bg-space-600/50 border border-transparent'
      } ${object.hasAnomaly ? 'ring-1 ring-danger-500' : ''}`}
    >
      <div className={`p-1.5 rounded ${
        object.hasAnomaly ? 'bg-danger-500/20' : 'bg-cyber-500/20'
      }`}>
        <Icon size={16} className={object.hasAnomaly ? 'text-danger-500' : 'text-cyber-500'} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="text-sm text-white font-jetbrains truncate">{object.name}</div>
        <div className="text-xs text-gray-400">{typeLabels[object.type]}</div>
      </div>
      {object.hasAnomaly && (
        <AlertTriangle size={14} className="text-danger-500 flex-shrink-0" />
      )}
      {isFocused && (
        <Target size={14} className="text-cyber-500 flex-shrink-0 animate-pulse" />
      )}
    </button>
  );
}

export function SearchPanel() {
  const { objects, focusedObjectId, actions } = useSimulationStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<SceneObjectType | 'all'>('all');
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);

  const filteredObjects = objects.filter((obj) => {
    const matchesSearch = obj.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || obj.type === filterType;
    const matchesAnomaly = !showAnomaliesOnly || obj.hasAnomaly;
    return matchesSearch && matchesType && matchesAnomaly;
  });

  const anomalyObjects = objects.filter((o) => o.hasAnomaly);

  return (
    <div className="absolute top-4 right-4 z-10">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="p-3 bg-space-800/90 backdrop-blur-md rounded-lg border border-cyber-500/30 hover:border-cyber-500 transition-all duration-200 hover:shadow-cyber-glow"
        >
          <Search size={20} className="text-cyber-500" />
        </button>
      ) : (
        <div className="w-80 bg-space-800/95 backdrop-blur-md rounded-lg border border-cyber-500/30 shadow-xl">
          <div className="p-3 border-b border-cyber-500/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-orbitron text-cyber-500 text-lg tracking-wider">对象搜索</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索对象名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-space-700/50 border border-cyber-500/20 rounded-lg text-white text-sm font-jetbrains focus:outline-none focus:border-cyber-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-2 py-1 bg-space-700/50 border border-cyber-500/20 rounded text-xs text-gray-300 font-jetbrains focus:outline-none focus:border-cyber-500"
              >
                <option value="all">全部类型</option>
                <option value="coil">线圈</option>
                <option value="projectile">弹丸</option>
                <option value="track">轨道</option>
                <option value="sensor">传感器</option>
              </select>

              <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAnomaliesOnly}
                  onChange={(e) => setShowAnomaliesOnly(e.target.checked)}
                  className="accent-danger-500"
                />
                仅显示异常
              </label>
            </div>
          </div>

          {anomalyObjects.length > 0 && (
            <div className="p-3 border-b border-danger-500/20 bg-danger-500/5">
              <div className="text-xs text-danger-500 font-jetbrains mb-2 flex items-center gap-1">
                <AlertTriangle size={14} />
                异常对象 ({anomalyObjects.length})
              </div>
              <div className="space-y-2">
                {anomalyObjects.map((obj) => (
                  <ObjectItem
                    key={obj.id}
                    object={obj}
                    onFocus={actions.focusObject}
                    isFocused={focusedObjectId === obj.id}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="p-3 max-h-64 overflow-y-auto">
            <div className="text-xs text-gray-400 font-jetbrains mb-2">
              所有对象 ({filteredObjects.length})
            </div>
            <div className="space-y-2">
              {filteredObjects.map((obj) => (
                <ObjectItem
                  key={obj.id}
                  object={obj}
                  onFocus={actions.focusObject}
                  isFocused={focusedObjectId === obj.id}
                />
              ))}
            </div>
            {filteredObjects.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-4">
                未找到匹配的对象
              </div>
            )}
          </div>

          {focusedObjectId && (
            <div className="p-3 border-t border-cyber-500/20">
              <button
                onClick={() => actions.focusObject(null)}
                className="w-full py-2 text-xs text-gray-400 hover:text-cyber-500 font-jetbrains transition-colors"
              >
                取消聚焦
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
