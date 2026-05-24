import { Layers, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { useStore } from '../../store/useStore';

export const LayerPanel = () => {
  const excavationData = useStore((state) => state.excavationData);
  const visibleLayerIds = useStore((state) => state.visibleLayerIds);
  const toggleLayerVisibility = useStore((state) => state.toggleLayerVisibility);
  const showAllLayers = useStore((state) => state.showAllLayers);
  const hideAllLayers = useStore((state) => state.hideAllLayers);
  const depthRange = useStore((state) => state.depthRange);
  const setDepthRange = useStore((state) => state.setDepthRange);
  const setFilterDepthRange = useStore((state) => state.setFilterDepthRange);

  if (!excavationData) return null;

  const handleDepthChange = (value: number, index: number) => {
    const newRange: [number, number] = [...depthRange] as [number, number];
    newRange[index] = value;
    if (index === 0 && value > newRange[1]) {
      newRange[1] = value;
    }
    if (index === 1 && value < newRange[0]) {
      newRange[0] = value;
    }
    setDepthRange(newRange);
    setFilterDepthRange(newRange);
  };

  return (
    <div className="w-64 bg-stone-900 border-r border-stone-700 flex flex-col h-full">
      <div className="p-4 border-b border-stone-700">
        <h2 className="text-lg font-semibold text-stone-200 flex items-center gap-2">
          <Layers size={20} className="text-amber-500" />
          层位控制
        </h2>
      </div>

      <div className="p-4 border-b border-stone-700">
        <div className="flex gap-2 mb-3">
          <button
            onClick={showAllLayers}
            className="flex-1 px-3 py-1.5 bg-stone-700 hover:bg-stone-600 rounded text-xs text-stone-200 transition-colors"
          >
            全部显示
          </button>
          <button
            onClick={hideAllLayers}
            className="flex-1 px-3 py-1.5 bg-stone-700 hover:bg-stone-600 rounded text-xs text-stone-200 transition-colors"
          >
            全部隐藏
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-stone-400">
            深度筛选: {depthRange[0]} - {depthRange[1]} {excavationData.unit}
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ChevronUp size={14} className="text-stone-500" />
              <input
                type="range"
                min={0}
                max={excavationData.gridSize.z}
                value={depthRange[0]}
                onChange={(e) => handleDepthChange(Number(e.target.value), 0)}
                className="flex-1 h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <ChevronDown size={14} className="text-stone-500" />
              <input
                type="range"
                min={0}
                max={excavationData.gridSize.z}
                value={depthRange[1]}
                onChange={(e) => handleDepthChange(Number(e.target.value), 1)}
                className="flex-1 h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {[...excavationData.layers].reverse().map((layer) => {
            const isVisible = visibleLayerIds.includes(layer.id);
            const artifactCount = excavationData.artifacts.filter(
              (a) => a.layerId === layer.id
            ).length;

            return (
              <div
                key={layer.id}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isVisible
                    ? 'bg-stone-800 border-stone-600'
                    : 'bg-stone-900 border-stone-800 opacity-60'
                }`}
                onClick={() => toggleLayerVisibility(layer.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border border-stone-600"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="text-sm font-medium text-stone-200">
                      {layer.name}
                    </span>
                  </div>
                  {isVisible ? (
                    <Eye size={14} className="text-amber-400" />
                  ) : (
                    <EyeOff size={14} className="text-stone-500" />
                  )}
                </div>
                <div className="mt-2 text-xs text-stone-400">
                  <span className="block">
                    深度: {layer.depthTop} - {layer.depthBottom}{' '}
                    {excavationData.unit}
                  </span>
                  <span className="block">年代: {layer.period}</span>
                  <span className="block text-amber-400">
                    出土物: {artifactCount} 件
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
