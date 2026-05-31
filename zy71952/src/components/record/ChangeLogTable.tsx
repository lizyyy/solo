import type { ChangeLog } from '../../types';
import { changeTypeConfig, cn } from '../../utils/status';

interface ChangeLogTableProps {
  logs: ChangeLog[];
}

export function ChangeLogTable({ logs }: ChangeLogTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-mono-200 bg-mono-50">
            <th className="px-3 py-2 text-left font-medium text-mono-600 w-[140px]">时间</th>
            <th className="px-3 py-2 text-left font-medium text-mono-600 w-[60px]">类型</th>
            <th className="px-3 py-2 text-left font-medium text-mono-600 w-[80px]">操作人</th>
            <th className="px-3 py-2 text-left font-medium text-mono-600 w-[80px]">字段</th>
            <th className="px-3 py-2 text-left font-medium text-mono-600">变更内容</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, idx) => {
            const typeConfig = changeTypeConfig[log.changeType];
            return (
              <tr
                key={log.id}
                className={cn(
                  'border-b border-mono-100 hover:bg-mono-50',
                  log.changeType === 'supplement' && 'bg-amber-50/50',
                  log.changeType === 'modify' && 'bg-red-50/50'
                )}
              >
                <td className="px-3 py-2 font-mono text-mono-600">{log.timestamp}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'inline-block px-1.5 py-0.5 text-[10px] font-medium',
                      typeConfig.bgColor,
                      typeConfig.color
                    )}
                  >
                    {typeConfig.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-mono-700">{log.operator}</td>
                <td className="px-3 py-2 text-mono-700">{log.field}</td>
                <td className="px-3 py-2">
                  <div className="text-mono-700">{log.description}</div>
                  {log.oldValue && (
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <span className="text-mono-400 line-through">{log.oldValue}</span>
                      <span className="text-mono-400">→</span>
                      <span className="text-mono-700 font-medium">{log.newValue}</span>
                    </div>
                  )}
                  {!log.oldValue && log.newValue && (
                    <div className="mt-1 text-[10px] text-farm-600">
                      设为：{log.newValue}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
