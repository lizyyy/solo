import { useState } from 'react';
import { SensorRecord } from '@/types';
import { cn } from '@/lib/utils';
import { formatValue } from '@/utils/units';
import { Pencil, Check, X, Trash2 } from 'lucide-react';

interface SensorTableProps {
  records: SensorRecord[];
  onEdit?: (id: string, updates: Partial<SensorRecord>) => void;
  onDelete?: (id: string) => void;
  highlightIds?: string[];
}

const DIRECTION_OPTIONS = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
const VELOCITY_UNITS = ['m/s', 'km/h', 'ft/s', 'mph'];
const ANGLE_UNITS = ['deg', 'rad'];
const TIME_UNITS = ['s', 'ms'];

export default function SensorTable({
  records,
  onEdit,
  onDelete,
  highlightIds = [],
}: SensorTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<SensorRecord>>({});

  const startEdit = (record: SensorRecord) => {
    setEditingId(record.id);
    setEditDraft({
      angle: record.angle,
      angleUnit: record.angleUnit,
      velocity: record.velocity,
      velocityUnit: record.velocityUnit,
      acceleration: record.acceleration,
      accelerationUnit: record.accelerationUnit,
      direction: record.direction,
      timeInterval: record.timeInterval,
      timeIntervalUnit: record.timeIntervalUnit,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const commitEdit = () => {
    if (editingId && onEdit) {
      onEdit(editingId, editDraft);
    }
    setEditingId(null);
    setEditDraft({});
  };

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

  const formatNumericValue = (value: number | null, unit: string): string => {
    if (value === null) return '-';
    return formatValue(value, unit, 4);
  };

  const isEditing = (id: string) => editingId === id;

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse font-mono text-sm">
        <thead>
          <tr className="bg-ink-100 border-2 border-ink-300">
            <th className="px-3 py-3 text-left font-bold text-ink-800 border border-ink-300">时间戳</th>
            <th className="px-3 py-3 text-left font-bold text-ink-800 border border-ink-300">角度</th>
            <th className="px-3 py-3 text-left font-bold text-ink-800 border border-ink-300">速度</th>
            <th className="px-3 py-3 text-left font-bold text-ink-800 border border-ink-300">加速度</th>
            <th className="px-3 py-3 text-left font-bold text-ink-800 border border-ink-300">方向</th>
            <th className="px-3 py-3 text-left font-bold text-ink-800 border border-ink-300">采样间隔</th>
            <th className="px-3 py-3 text-left font-bold text-ink-800 border border-ink-300">状态</th>
            {(onEdit || onDelete) && (
              <th className="px-3 py-3 text-left font-bold text-ink-800 border border-ink-300">操作</th>
            )}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const isHighlighted = highlightIds.includes(record.id);
            const isDirty = record.isDirty;
            const editing = isEditing(record.id);

            return (
              <tr
                key={record.id}
                className={cn('border border-ink-200', {
                  'bg-blueprint-50': editing,
                  'bg-danger-50': isHighlighted && !editing,
                  'bg-warning-50': isDirty && !isHighlighted && !editing,
                  'hover:bg-ink-50': !isDirty && !isHighlighted && !editing,
                })}
              >
                <td className="px-3 py-2 border border-ink-200 font-mono text-xs">
                  {formatTimestamp(record.timestamp)}
                </td>

                <td className="px-3 py-2 border border-ink-200 font-mono">
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={editDraft.angle ?? ''}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            angle: e.target.value === '' ? null : parseFloat(e.target.value),
                          }))
                        }
                        className="eng-input w-20 py-1 text-xs"
                        placeholder="角度"
                      />
                      <select
                        value={editDraft.angleUnit || 'deg'}
                        onChange={(e) => setEditDraft((d) => ({ ...d, angleUnit: e.target.value }))}
                        className="eng-input w-16 py-1 text-xs"
                      >
                        {ANGLE_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    formatNumericValue(record.angle, record.angleUnit)
                  )}
                </td>

                <td className="px-3 py-2 border border-ink-200 font-mono">
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={editDraft.velocity ?? ''}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            velocity: e.target.value === '' ? null : parseFloat(e.target.value),
                          }))
                        }
                        className="eng-input w-20 py-1 text-xs"
                        placeholder="速度"
                      />
                      <select
                        value={editDraft.velocityUnit || 'm/s'}
                        onChange={(e) => setEditDraft((d) => ({ ...d, velocityUnit: e.target.value }))}
                        className="eng-input w-16 py-1 text-xs"
                      >
                        {VELOCITY_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    formatNumericValue(record.velocity, record.velocityUnit)
                  )}
                </td>

                <td className="px-3 py-2 border border-ink-200 font-mono">
                  {editing ? (
                    <input
                      type="number"
                      step="0.1"
                      value={editDraft.acceleration ?? ''}
                      onChange={(e) =>
                        setEditDraft((d) => ({
                          ...d,
                          acceleration: e.target.value === '' ? null : parseFloat(e.target.value),
                        }))
                      }
                      className="eng-input w-24 py-1 text-xs"
                      placeholder="加速度"
                    />
                  ) : (
                    formatNumericValue(record.acceleration, record.accelerationUnit)
                  )}
                </td>

                <td className="px-3 py-2 border border-ink-200">
                  {editing ? (
                    <select
                      value={editDraft.direction || ''}
                      onChange={(e) => setEditDraft((d) => ({ ...d, direction: e.target.value }))}
                      className="eng-input w-16 py-1 text-xs"
                    >
                      <option value="">-</option>
                      {DIRECTION_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  ) : (
                    record.direction || '-'
                  )}
                </td>

                <td className="px-3 py-2 border border-ink-200 font-mono">
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.001"
                        value={editDraft.timeInterval ?? ''}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            timeInterval: e.target.value === '' ? null : parseFloat(e.target.value),
                          }))
                        }
                        className="eng-input w-16 py-1 text-xs"
                        placeholder="间隔"
                      />
                      <select
                        value={editDraft.timeIntervalUnit || 's'}
                        onChange={(e) => setEditDraft((d) => ({ ...d, timeIntervalUnit: e.target.value }))}
                        className="eng-input w-14 py-1 text-xs"
                      >
                        {TIME_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    formatNumericValue(record.timeInterval, record.timeIntervalUnit)
                  )}
                </td>

                <td className="px-3 py-2 border border-ink-200">
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
                  <td className="px-3 py-2 border border-ink-200">
                    {editing ? (
                      <div className="flex gap-1">
                        <button
                          onClick={commitEdit}
                          className="eng-btn eng-btn-safe eng-btn-sm p-1"
                          title="确认"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="eng-btn eng-btn-danger eng-btn-sm p-1"
                          title="取消"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        {onEdit && (
                          <button
                            onClick={() => startEdit(record)}
                            className="eng-btn eng-btn-sm p-1"
                            title="编辑"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(record.id)}
                            className="eng-btn eng-btn-sm eng-btn-danger p-1"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {records.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-8 text-ink-500 border border-ink-200">
                暂无传感器记录，点击"添加记录"开始
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
