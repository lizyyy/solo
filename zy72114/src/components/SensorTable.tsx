import { SensorRecord } from '@/types';
import { cn } from '@/lib/utils';
import { formatValue } from '@/utils/units';

interface SensorTableProps {
  records: SensorRecord[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  highlightIds?: string[];
}

export default function SensorTable({
  records,
  onEdit,
  onDelete,
  highlightIds = [],
}: SensorTableProps) {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusBadge = (source: string) => {
    const config = {
      sensor: { label: '传感器', className: 'eng-badge-safe' },
      manual: { label: '手动录入', className: 'eng-badge-info' },
      imported: { label: '导入', className: 'eng-badge-warning' },
    };
    const status = config[source as keyof typeof config] || config.sensor;
    return (
      <span className={cn('eng-badge', status.className)}>
        {status.label}
      </span>
    );
  };

  const formatNumericValue = (
    value: number | null,
    unit: string
  ): string => {
      if (value === null) return '-';
      return formatValue(value, unit, 4);
    };

  return (
    <div className="eng-card overflow-x-auto">
      <table className="w-full border-collapse font-mono text-sm">
        <thead>
          <tr className="bg-ink-100 border-2 border-ink-300">
            <th className="px-4 py-3 text-left font-bold text-ink-800 border border-ink-300">
              时间戳
            </th>
            <th className="px-4 py-3 text-left font-bold text-ink-800 border border-ink-300">
              角度
            </th>
            <th className="px-4 py-3 text-left font-bold text-ink-800 border border-ink-300">
              速度
            </th>
            <th className="px-4 py-3 text-left font-bold text-ink-800 border border-ink-300">
              加速度
            </th>
            <th className="px-4 py-3 text-left font-bold text-ink-800 border border-ink-300">
              方向
            </th>
            <th className="px-4 py-3 text-left font-bold text-ink-800 border border-ink-300">
              采样间隔
            </th>
            <th className="px-4 py-3 text-left font-bold text-ink-800 border border-ink-300">
              状态
            </th>
            {(onEdit || onDelete) && (
              <th className="px-4 py-3 text-left font-bold text-ink-800 border border-ink-300">
                操作
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const isHighlighted = highlightIds.includes(record.id);
            const isDirty = record.isDirty;

            return (
              <tr
                key={record.id}
                className={cn('border border-ink-200', {
                  'bg-danger-50': isHighlighted,
                  'bg-warning-50': isDirty && !isHighlighted,
                  'hover:bg-ink-50': !isDirty && !isHighlighted,
                })}
              >
                <td className="px-4 py-3 border border-ink-200 font-mono">
                  {formatTimestamp(record.timestamp)}
                </td>
                <td className="px-4 py-3 border border-ink-200 font-mono">
                  {formatNumericValue(record.angle, record.angleUnit)}
                </td>
                <td className="px-4 py-3 border border-ink-200 font-mono">
                  {formatNumericValue(record.velocity, record.velocityUnit)}
                </td>
                <td className="px-4 py-3 border border-ink-200 font-mono">
                  {formatNumericValue(
                    record.acceleration,
                    record.accelerationUnit
                  )}
                </td>
                <td className="px-4 py-3 border border-ink-200">
                  {record.direction || '-'}
                </td>
                <td className="px-4 py-3 border border-ink-200 font-mono">
                  {formatNumericValue(
                    record.timeInterval,
                    record.timeIntervalUnit
                  )}
                </td>
                <td className="px-4 py-3 border border-ink-200">
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(record.source)}
                    {isDirty && record.dirtyReason && (
                      <span className="text-xs text-warning-700 font-mono">
                        ⚠ {record.dirtyReason}
                      </span>
                    )}
                  </div>
                </td>
                {(onEdit || onDelete) && (
                  <td className="px-4 py-3 border border-ink-200">
                    <div className="flex gap-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(record.id)}
                          className="eng-btn eng-btn-sm"
                        >
                          编辑
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(record.id)}
                          className="eng-btn eng-btn-sm eng-btn-danger"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
