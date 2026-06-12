import type { SelfCheckResult } from '../types';
import StatusBadge from './StatusBadge';

interface SelfCheckCardProps {
  result: SelfCheckResult;
  onFix?: () => void;
}

const typeLabels: Record<string, string> = {
  duplicate: '重复导入检测',
  rework: '返工原因检测',
  recalculate: '补录重算检测',
  export: '导出一致性检测',
};

const typeIcons: Record<string, string> = {
  duplicate: '🔄',
  rework: '⚠️',
  recalculate: '🔁',
  export: '📊',
};

export default function SelfCheckCard({ result, onFix }: SelfCheckCardProps) {
  return (
    <div className={`card-studio p-5 ${
      result.passed ? 'border-l-4 border-status-new' : 'border-l-4 border-studio-red'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{typeIcons[result.check_type]}</span>
            <h3 className="text-lg font-display text-white">
              {typeLabels[result.check_type]}
            </h3>
            <StatusBadge status={result.passed ? 'completed' : 'rework'}>
              {result.passed ? '通过' : '发现问题'}
            </StatusBadge>
          </div>
          <p className="text-sm text-studio-silver">
            {result.passed ? '检测通过，数据一致' : `发现 ${result.issue_count} 个问题需要处理`}
          </p>
        </div>
      </div>

      {result.details && result.details.length > 0 && (
        <div className="space-y-2 mb-4">
          {result.details.map((detail, idx) => (
            <div key={idx} className="bg-studio-darker rounded p-3">
              <p className="text-sm text-white">{detail.description}</p>
              {detail.location && (
                <p className="text-xs text-studio-silver font-mono mt-1">
                  位置: {detail.location}
                </p>
              )}
              {detail.action && (
                <p className="text-xs text-studio-gold mt-1">
                  建议: {detail.action}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-studio-silver font-mono">
          检测时间: {result.checked_at}
        </p>
        {!result.passed && onFix && (
          <button onClick={onFix} className="btn-studio text-sm px-4 py-1.5">
            一键修复
          </button>
        )}
      </div>
    </div>
  );
}
