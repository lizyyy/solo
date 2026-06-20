import type { Material } from '../types';
import { StatusBadge, SourceTypeBadge } from './StatusBadge';

interface MaterialListProps {
  materials: Material[];
  selectedId: string | null;
  onSelect: (material: Material) => void;
  onCalculate: (material: Material) => void;
  isCalculating: boolean;
}

export function MaterialList({
  materials,
  selectedId,
  onSelect,
  onCalculate,
  isCalculating
}: MaterialListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">材料列表</h2>
        <span className="text-sm text-gray-500">共 {materials.length} 份材料</span>
      </div>
      
      <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
        {materials.map((material) => (
          <MaterialCard
            key={material.id}
            material={material}
            isSelected={selectedId === material.id}
            onSelect={() => onSelect(material)}
            onCalculate={onCalculate}
            isCalculating={isCalculating && selectedId === material.id}
          />
        ))}
      </div>
    </div>
  );
}

interface MaterialCardProps {
  material: Material;
  isSelected: boolean;
  onSelect: () => void;
  onCalculate: (material: Material) => void;
  isCalculating: boolean;
}

function MaterialCard({
  material,
  isSelected,
  onSelect,
  onCalculate,
  isCalculating
}: MaterialCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCaliberTag = () => {
    if (material.caliberVersionId === 'cal-v2') {
      return <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">当前口径 v2.0</span>;
    }
    return <span className="px-2 py-0.5 text-xs rounded bg-orange-100 text-orange-700">旧口径 v1.0</span>;
  };

  return (
    <div
      className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-blue-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-medium text-gray-800 truncate">{material.title}</h3>
            {getCaliberTag()}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2 flex-wrap">
            <span>{formatDate(material.createdAt)}</span>
            <span>•</span>
            <span>{material.items.length} 项数据</span>
            <span>•</span>
            <span>{material.materials.length} 份材料</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {material.materials.map((m, idx) => (
              <SourceTypeBadge key={idx} type={m.type} />
            ))}
          </div>

          {material.scoreRemark && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">
              💡 {material.scoreRemark}
            </p>
          )}

          {material.oralNote && (
            <p className="mt-1 text-sm text-purple-600 line-clamp-1">
              💬 {material.oralNote}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={material.status} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
              onCalculate(material);
            }}
            disabled={isCalculating}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isCalculating ? '计算中...' : '开始复核'}
          </button>
        </div>
      </div>
    </div>
  );
}
