import { X, MapPin, Calendar, Layers, Tag, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getTypeLabel } from '../../utils/filterEngine';

export const InfoPanel = () => {
  const selectedArtifact = useStore((state) => state.selectedArtifact);
  const excavationData = useStore((state) => state.excavationData);
  const selectArtifact = useStore((state) => state.selectArtifact);
  const hoveredArtifactId = useStore((state) => state.hoveredArtifactId);
  const validationErrors = useStore((state) => state.validationErrors);

  const hoveredArtifact = hoveredArtifactId
    ? excavationData?.artifacts.find((a) => a.id === hoveredArtifactId)
    : null;

  const displayArtifact = selectedArtifact || hoveredArtifact;

  if (!displayArtifact) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-stone-900/90 backdrop-blur px-4 py-2 rounded-lg text-xs text-stone-400">
        鼠标悬停或点击出土物查看详情 | 左键旋转 | 滚轮缩放 | 右键平移
      </div>
    );
  }

  const layer = excavationData?.layers.find(
    (l) => l.id === displayArtifact.layerId
  );

  const artifactErrors = validationErrors.filter(
    (e) => e.artifactId === displayArtifact.artifactId
  );

  return (
    <div className="absolute top-4 right-4 w-72 bg-stone-900/95 backdrop-blur border border-stone-700 rounded-xl shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-stone-700 flex items-center justify-between">
        <h3 className="font-semibold text-stone-200">出土物详情</h3>
        {selectedArtifact && (
          <button
            onClick={() => selectArtifact(null)}
            className="p-1 hover:bg-stone-700 rounded transition-colors"
          >
            <X size={16} className="text-stone-400" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag size={14} className="text-amber-500" />
            <span className="text-xs text-stone-400">编号</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono text-amber-400">
              {displayArtifact.artifactId}
            </span>
            {artifactErrors.length > 0 && (
              <AlertTriangle size={16} className="text-red-400" />
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-stone-400">名称</span>
          </div>
          <p className="text-stone-200 font-medium">{displayArtifact.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-stone-400">类型</span>
            <p className="text-stone-200">
              {getTypeLabel(displayArtifact.type)}
            </p>
          </div>
          <div>
            <span className="text-xs text-stone-400">年代</span>
            <p className="text-stone-200">{displayArtifact.period}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={14} className="text-amber-500" />
            <span className="text-xs text-stone-400">坐标位置</span>
          </div>
          <p className="text-stone-200 font-mono text-sm">
            X: {displayArtifact.position.x} | Y: {displayArtifact.position.y} |
            Z: {displayArtifact.position.z}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers size={14} className="text-amber-500" />
            <span className="text-xs text-stone-400">所属层位</span>
          </div>
          <div className="flex items-center gap-2">
            {layer && (
              <div
                className="w-4 h-4 rounded border border-stone-600"
                style={{ backgroundColor: layer.color }}
              />
            )}
            <p className="text-stone-200">{layer?.name || '未知'}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-amber-500" />
            <span className="text-xs text-stone-400">描述</span>
          </div>
          <p className="text-stone-300 text-sm leading-relaxed">
            {displayArtifact.description}
          </p>
        </div>

        {artifactErrors.length > 0 && (
          <div className="bg-red-950/50 border border-red-900 rounded-lg p-3">
            <p className="text-xs text-red-400 font-medium mb-2">数据问题</p>
            {artifactErrors.map((error, index) => (
              <p key={index} className="text-xs text-red-300">
                • {error.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
