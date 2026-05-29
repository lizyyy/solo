import { Plus, Copy, Trash2, GitCompare, Check, Clock, FileText } from 'lucide-react';
import type { Experiment, DataStatus } from '../../types';

interface ExperimentListProps {
  experiments: Experiment[];
  currentId: string | null;
  comparisonIds: string[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleComparison: (id: string) => void;
}

export function ExperimentList({
  experiments,
  currentId,
  comparisonIds,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onToggleComparison,
}: ExperimentListProps) {
  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-4 border-b border-dark-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-dark-100">实验记录</span>
          <span className="text-xs text-dark-400">({experiments.length})</span>
        </div>
        <button
          onClick={onAdd}
          className="p-1.5 rounded bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors"
          title="新建实验"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {experiments.length === 0 ? (
          <div className="p-8 text-center text-dark-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无实验记录</p>
            <button
              onClick={onAdd}
              className="mt-3 text-xs text-primary-400 hover:text-primary-300"
            >
              创建第一个实验
            </button>
          </div>
        ) : (
          experiments.map((experiment) => (
            <ExperimentItem
              key={experiment.id}
              experiment={experiment}
              isSelected={currentId === experiment.id}
              isInComparison={comparisonIds.includes(experiment.id)}
              onSelect={() => onSelect(experiment.id)}
              onDuplicate={() => onDuplicate(experiment.id)}
              onDelete={() => onDelete(experiment.id)}
              onToggleComparison={() => onToggleComparison(experiment.id)}
            />
          ))
        )}
      </div>

      {comparisonIds.length > 0 && (
        <div className="p-3 border-t border-dark-600 bg-purple-500/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-300">
              已选择 {comparisonIds.length} 个实验进行对比
            </span>
            <span className="text-purple-400">点击对比按钮查看</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExperimentItemProps {
  experiment: Experiment;
  isSelected: boolean;
  isInComparison: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleComparison: () => void;
}

function ExperimentItem({
  experiment,
  isSelected,
  isInComparison,
  onSelect,
  onDuplicate,
  onDelete,
  onToggleComparison,
}: ExperimentItemProps) {
  return (
    <div
      className={`p-3 border-b border-dark-600/50 last:border-b-0 transition-colors cursor-pointer ${
        isSelected ? 'bg-primary-500/10' : 'hover:bg-dark-700/30'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-dark-100 truncate">
              {experiment.name}
            </span>
            <StatusBadge status={experiment.status} />
            {experiment.parentId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                v{experiment.version}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-dark-400">
            <span className="font-mono">{experiment.tuningFork.frequency} Hz</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(experiment.updatedAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleComparison}
            className={`p-1.5 rounded transition-colors ${
              isInComparison
                ? 'bg-purple-500/30 text-purple-300'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-600'
            }`}
            title="添加到对比"
          >
            <GitCompare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1.5 rounded text-dark-400 hover:text-dark-200 hover:bg-dark-600 transition-colors"
            title="复制实验"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-dark-400 hover:text-status-noise hover:bg-status-noise/10 transition-colors"
            title="删除实验"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DataStatus }) {
  return status === 'confirmed' ? (
    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-status-confirmed/20 text-status-confirmed">
      <Check className="w-3 h-3" />
      已确认
    </span>
  ) : (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-status-tentative/20 text-status-tentative">
      临时
    </span>
  );
}
