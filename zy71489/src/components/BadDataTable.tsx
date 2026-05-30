import { FileWarning, Clock, AlertTriangle } from 'lucide-react';
import type { BadDataRecord } from '@shared/types';
import { cn } from '@/lib/utils';

interface BadDataTableProps {
  records: BadDataRecord[];
}

function getErrorTypeBadge(errorType: string) {
  const configs: Record<string, { label: string; className: string }> = {
    'missing_field': {
      label: '字段缺失',
      className: 'bg-red/15 text-red border-red/30'
    },
    'invalid_format': {
      label: '格式错误',
      className: 'bg-orange/15 text-orange border-orange/30'
    },
    'invalid_duration': {
      label: '时长无效',
      className: 'bg-orange/15 text-orange border-orange/30'
    },
    'duplicate': {
      label: '重复数据',
      className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    },
    'unknown_track': {
      label: '未知曲目',
      className: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
    }
  };

  const config = configs[errorType] || {
    label: errorType,
    className: 'bg-neutral-700/50 text-neutral-400 border-neutral-600'
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
      config.className
    )}>
      {config.label}
    </span>
  );
}

export default function BadDataTable({ records }: BadDataTableProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-500">
        <FileWarning size={48} className="mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium mb-2">暂无坏数据记录</p>
        <p className="text-sm">数据导入过程中检测到的异常数据将在此处展示</p>
      </div>
    );
  }

  return (
    <div className="card-stage overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="text-left py-3 px-4 font-medium text-neutral-400 text-xs uppercase tracking-wider">
                来源文件
              </th>
              <th className="text-left py-3 px-4 font-medium text-neutral-400 text-xs uppercase tracking-wider">
                行号
              </th>
              <th className="text-left py-3 px-4 font-medium text-neutral-400 text-xs uppercase tracking-wider">
                原始内容
              </th>
              <th className="text-left py-3 px-4 font-medium text-neutral-400 text-xs uppercase tracking-wider">
                错误类型
              </th>
              <th className="text-left py-3 px-4 font-medium text-neutral-400 text-xs uppercase tracking-wider">
                检测时间
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => (
              <tr
                key={record.id}
                className={cn(
                  'border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors',
                  'animate-fade-in-up',
                  index % 2 === 0 && 'bg-neutral-900/30'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <FileWarning size={14} className="text-red shrink-0" />
                    <span className="font-mono text-xs text-neutral-300 truncate max-w-[180px]" title={record.sourceFile}>
                      {record.sourceFile}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="font-mono text-gold">第 {record.lineNumber} 行</span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className="font-mono text-xs text-neutral-400 bg-neutral-800/50 px-2 py-1 rounded inline-block max-w-[300px] truncate"
                    title={record.rawContent}
                  >
                    {record.rawContent}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {getErrorTypeBadge(record.errorType)}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 text-neutral-400">
                    <Clock size={12} />
                    <span className="text-xs font-mono">{record.detectedAt}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-neutral-900/50 border-t border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <AlertTriangle size={14} className="text-orange" />
          <span>共 <span className="font-mono text-gold">{records.length}</span> 条坏数据记录</span>
        </div>
      </div>
    </div>
  );
}
