import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Power, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSceneStore, getFilteredLights, getLightGroups } from '../../store/useSceneStore';
import { isLightInCollision } from '../../services/collision';

export default function LightPanel() {
  const {
    lights,
    filters,
    setFilters,
    selectedLightId,
    setSelectedLight,
    updateLight,
    collisionWarnings,
    leftPanelOpen,
    toggleLeftPanel
  } = useSceneStore();

  const [expandedLights, setExpandedLights] = useState<Set<string>>(new Set());

  const groups = getLightGroups(lights);
  const filteredLights = getFilteredLights(lights, filters);

  const toggleLightExpand = (id: string) => {
    setExpandedLights((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleLightClick = (id: string) => {
    setSelectedLight(selectedLightId === id ? null : id);
  };

  const getLightCollisionClass = (lightId: string) => {
    const warnings = collisionWarnings.filter((w) => w.lightId === lightId);
    if (warnings.some((w) => w.severity === 'danger')) return 'danger';
    if (warnings.some((w) => w.severity === 'warning')) return 'warning';
    return '';
  };

  if (!leftPanelOpen) {
    return (
      <button
        className="collapse-btn left-0"
        onClick={toggleLeftPanel}
      >
        <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ width: 280 }}
      animate={{ width: 280 }}
      className="h-full glass-panel border-r border-white/5 flex flex-col relative"
    >
      <button
        className="collapse-btn -right-5"
        onClick={toggleLeftPanel}
      >
        <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />
      </button>

      <div className="p-3 border-b border-white/5">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <Lightbulb size={16} className="text-stage-blue" />
          灯具列表
        </h2>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索灯具..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="w-full pl-8 pr-3 py-2 bg-stage-gray-light border border-white/5 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-stage-blue/50"
          />
        </div>

        <select
          value={filters.group}
          onChange={(e) => setFilters({ group: e.target.value })}
          className="w-full px-3 py-2 bg-stage-gray-light border border-white/5 rounded-md text-sm text-white focus:outline-none focus:border-stage-blue/50"
        >
          <option value="">所有分组</option>
          {groups.map((group) => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredLights.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            没有找到匹配的灯具
          </div>
        ) : (
          filteredLights.map((light) => {
            const isExpanded = expandedLights.has(light.id);
            const isSelected = selectedLightId === light.id;
            const collisionClass = getLightCollisionClass(light.id);
            const hasCollision = isLightInCollision(light.id, collisionWarnings);

            return (
              <div
                key={light.id}
                className={`light-item mb-2 ${isSelected ? 'selected' : ''} ${collisionClass}`}
                onClick={() => handleLightClick(light.id)}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: light.color,
                    opacity: light.enabled ? 1 : 0.3,
                    boxShadow: light.enabled ? `0 0 8px ${light.color}` : 'none'
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white truncate">
                      {light.name}
                    </span>
                    {hasCollision && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        collisionClass === 'danger' ? 'bg-stage-red/20 text-stage-red' : 'bg-stage-orange/20 text-stage-orange'
                      }`}>
                        !
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {light.group} · {light.type}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLight(light.id, { enabled: !light.enabled });
                  }}
                  className={`p-1 rounded ${
                    light.enabled ? 'text-stage-green' : 'text-gray-600'
                  }`}
                >
                  <Power size={14} />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLightExpand(light.id);
                  }}
                  className="p-1 rounded text-gray-400 hover:text-white"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-white/5 text-xs text-gray-500">
        共 {filteredLights.length} / {lights.length} 个灯具
      </div>
    </motion.div>
  );
}
