import { useStore } from '@/store/useStore';
import { getMaterialById } from '@/data/materials';
import { formatVolume, formatWeight } from '@/utils/volume';
import { Trash2, Box, Scale, Ruler, Layers, Settings } from 'lucide-react';

export function RightPanel() {
  const {
    boundaries,
    selectedBoundaryId,
    baseHeight,
    setBaseHeight,
    updateBoundary,
    deleteBoundary,
    materials,
  } = useStore();

  const selectedBoundary = boundaries.find(b => b.id === selectedBoundaryId);

  const totalVolume = boundaries.reduce((sum, b) => sum + (b.volume || 0), 0);
  const totalWeight = boundaries.reduce((sum, b) => sum + (b.weight || 0), 0);

  return (
    <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-white font-semibold flex items-center gap-2 mb-3">
          <Settings className="w-5 h-5 text-blue-400" />
          全局设置
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-slate-400 text-xs block mb-1">
              基准面高度 (m)
            </label>
            <input
              type="number"
              step="0.1"
              value={baseHeight}
              onChange={(e) => setBaseHeight(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-blue-900/30 to-slate-800">
        <h3 className="text-white font-medium flex items-center gap-2 mb-2">
          <Box className="w-4 h-4 text-blue-400" />
          汇总统计
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="text-slate-400 text-xs">总体积</div>
            <div className="text-white font-bold text-lg mt-1">
              {formatVolume(totalVolume)}
            </div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="text-slate-400 text-xs">总重量</div>
            <div className="text-white font-bold text-lg mt-1">
              {formatWeight(totalWeight)}
            </div>
          </div>
        </div>
        <div className="text-slate-400 text-xs mt-2">
          料堆数量: {boundaries.length}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedBoundary ? (
          <div className="p-4">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-orange-400" />
              料堆详情
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs block mb-1">
                  名称
                </label>
                <input
                  type="text"
                  value={selectedBoundary.name}
                  onChange={(e) => updateBoundary(selectedBoundary.id, { name: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 text-xs block mb-1">
                  物料类型
                </label>
                <select
                  value={selectedBoundary.materialId}
                  onChange={(e) => updateBoundary(selectedBoundary.id, { materialId: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} (密度: {m.density} t/m³)
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs flex items-center gap-1">
                    <Ruler className="w-3 h-3" /> 体积
                  </span>
                  <span className="text-white font-medium">
                    {formatVolume(selectedBoundary.volume || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs flex items-center gap-1">
                    <Scale className="w-3 h-3" /> 重量
                  </span>
                  <span className="text-white font-medium">
                    {formatWeight(selectedBoundary.weight || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">表面积</span>
                  <span className="text-white">
                    {selectedBoundary.surfaceArea?.toFixed(2)} m²
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">顶点数</span>
                  <span className="text-white">
                    {selectedBoundary.vertices.length}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <div>物料颜色:
                  <span
                    className="inline-block w-4 h-4 rounded ml-2 align-middle"
                    style={{ backgroundColor: getMaterialById(selectedBoundary.materialId)?.color }}
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  if (confirm('确定删除此料堆边界吗？')) {
                    deleteBoundary(selectedBoundary.id);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                删除料堆
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-slate-400" />
              料堆列表
            </h3>

            {boundaries.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">暂无料堆边界</p>
                <p className="text-xs mt-1">使用"绘制边界"工具添加</p>
              </div>
            ) : (
              <div className="space-y-2">
                {boundaries.map(b => (
                  <BoundaryListItem key={b.id} boundary={b} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BoundaryListItem({ boundary }: { boundary: import('@/types').Boundary }) {
  const { setSelectedBoundaryId, selectedBoundaryId } = useStore();
  const material = getMaterialById(boundary.materialId);
  const isSelected = selectedBoundaryId === boundary.id;

  return (
    <div
      onClick={() => setSelectedBoundaryId(isSelected ? null : boundary.id)}
      className={`p-3 rounded-lg cursor-pointer transition-all border ${
        isSelected
          ? 'bg-blue-600/20 border-blue-500'
          : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: material?.color }}
        />
        <span className="text-white text-sm font-medium truncate flex-1">
          {boundary.name}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-400 flex justify-between">
        <span>{formatVolume(boundary.volume || 0)}</span>
        <span>{material?.name}</span>
      </div>
    </div>
  );
}
