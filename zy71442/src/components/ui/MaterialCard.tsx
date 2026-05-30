import { Download, Trash2, Eye, EyeOff, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DataMaterial } from '../../types/surface';

interface MaterialCardProps {
  material: DataMaterial;
  selected?: boolean;
  visible?: boolean;
  onSelect?: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onExport?: (material: DataMaterial) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function MaterialCard({
  material,
  selected = false,
  visible = true,
  onSelect,
  onToggleVisibility,
  onExport,
  onDelete,
  className,
}: MaterialCardProps) {
  const statusColors = {
    raw: 'border-blue-500 bg-blue-500/10',
    processed: 'border-emerald-500 bg-emerald-500/10',
  };

  const statusBadgeColors = {
    raw: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    processed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  const statusLabels = {
    raw: '原始',
    processed: '处理',
  };

  const typeIcons = {
    surface: Layers,
    boundary: Layers,
    sample: Layers,
  };

  const typeLabels = {
    surface: '曲面',
    boundary: '边界',
    sample: '采样',
  };

  const sourceLabels = {
    imported: '导入',
    generated: '生成',
    edited: '编辑',
  };

  const TypeIcon = typeIcons[material.type];

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={cn(
        'relative rounded-lg border p-3 transition-all duration-200 cursor-pointer',
        statusColors[material.status],
        selected ? 'ring-2 ring-slate-400 ring-offset-1 ring-offset-slate-900' : '',
        !visible ? 'opacity-50' : '',
        className
      )}
      onClick={() => onSelect?.(material.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div
            className={cn(
              'w-8 h-8 rounded flex items-center justify-center flex-shrink-0',
              material.status === 'raw' ? 'bg-blue-500/30' : 'bg-emerald-500/30'
            )}
          >
            <TypeIcon className="w-4 h-4 text-slate-200" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-medium text-slate-100 truncate">
                {material.name}
              </h4>
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs rounded border',
                  statusBadgeColors[material.status]
                )}
              >
                {statusLabels[material.status]}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {typeLabels[material.type]}
              </span>
              <span>{sourceLabels[material.source]}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {formatDate(material.importedAt)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility?.(material.id);
            }}
            title={visible ? '隐藏' : '显示'}
          >
            {visible ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>
          <button
            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onExport?.(material);
            }}
            title="导出"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(material.id);
            }}
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {material.equation && (
        <div className="mt-2 px-2 py-1 rounded bg-slate-800/50 text-xs font-mono text-slate-400 truncate">
          {material.equation}
        </div>
      )}
      {material.points && (
        <div className="mt-1 text-xs text-slate-500">
          {material.points.length} 个点
        </div>
      )}
    </div>
  );
}
