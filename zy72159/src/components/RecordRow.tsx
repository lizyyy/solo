import { useState } from 'react';
import { ChevronDown, ChevronUp, Edit3, Trash2, MapPin, AlertTriangle, Clock } from 'lucide-react';
import type { BikeRecord, RecordStatus } from '@shared/types';
import { StatusBadge } from './StatusBadge';
import { ConflictCard } from './ConflictCard';
import { SourceTimeline } from './SourceTimeline';

interface RecordRowProps {
  record: BikeRecord;
  onUpdateStatus: (id: string, status: RecordStatus, notes?: string) => Promise<void>;
  onDelete?: (id: string) => void;
  showStatusSelector?: boolean;
}

const STATUS_OPTIONS: { value: RecordStatus; label: string }[] = [
  { value: 'processed', label: '✓ 已处理' },
  { value: 'verify', label: '⚠ 待核实' },
  { value: 'onsite', label: '📍 需要现场复看' },
  { value: 'pending', label: '⏳ 待处理' },
];

export function RecordRow({ record, onUpdateStatus, onDelete, showStatusSelector = true }: RecordRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<RecordStatus>(record.status);
  const [notes, setNotes] = useState(record.notes);
  const [saving, setSaving] = useState(false);

  const handleSaveStatus = async () => {
    setSaving(true);
    try {
      await onUpdateStatus(record.id, selectedStatus, notes);
      setEditingStatus(false);
    } finally {
      setSaving(false);
    }
  };

  const usagePercent = Math.round((record.bikeCount / record.capacity) * 100);
  const isOverCapacity = record.bikeCount > record.capacity;

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${record.conflicts.length > 0 ? 'bg-orange-50/30' : ''} ${record.isOldCaliber ? 'bg-yellow-50/30' : ''}`}>
        <td className="table-cell">
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-gray-200 rounded">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </td>
        <td className="table-cell">
          <div className="font-medium text-primary-900">{record.stationName}</div>
          <div className="text-xs text-gray-500">{record.exitNo}</div>
        </td>
        <td className="table-cell">
          <div className="text-sm">{record.timeSlot}</div>
        </td>
        <td className="table-cell">
          <div className="flex items-center gap-2">
            <span className={`font-mono font-semibold ${isOverCapacity ? 'text-red-600' : 'text-gray-900'}`}>
              {record.bikeCount}
            </span>
            <span className="text-gray-400">/</span>
            <span className="font-mono text-gray-500">{record.capacity}</span>
          </div>
          <div className="mt-1 w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOverCapacity ? 'bg-red-500' : usagePercent > 80 ? 'bg-orange-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </td>
        <td className="table-cell max-w-xs">
          <div className="text-sm text-gray-700 truncate">{record.reason}</div>
        </td>
        <td className="table-cell">
          <div className="flex flex-wrap gap-1">
            {record.conflicts.length > 0 ? (
              record.conflicts.slice(0, 2).map((c, i) => (
                <ConflictCard key={i} conflict={c} compact />
              ))
            ) : (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                ✓ 无异常
              </span>
            )}
            {record.conflicts.length > 2 && (
              <span className="text-xs text-gray-500">+{record.conflicts.length - 2}</span>
            )}
            {record.isOldCaliber && (
              <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">
                📜 旧口径
              </span>
            )}
            {record.mergedFrom.length > 0 && (
              <span className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                🔗 合并自{record.mergedFrom.length}条
              </span>
            )}
          </div>
        </td>
        <td className="table-cell">
          {showStatusSelector && editingStatus ? (
            <div className="space-y-2">
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value as RecordStatus)}
                className="input text-sm py-1"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="添加备注..."
                className="input text-sm py-1"
              />
              <div className="flex gap-1">
                <button
                  onClick={handleSaveStatus}
                  disabled={saving}
                  className="btn-primary text-xs py-1 flex-1"
                >
                  {saving ? '保存中...' : '确认'}
                </button>
                <button
                  onClick={() => {
                    setEditingStatus(false);
                    setSelectedStatus(record.status);
                    setNotes(record.notes);
                  }}
                  className="btn-outline text-xs py-1 flex-1"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <StatusBadge status={record.status} />
              {showStatusSelector && (
                <button
                  onClick={() => setEditingStatus(true)}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500 hover:text-primary-700"
                  title="修改状态"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </td>
        <td className="table-cell text-right">
          {onDelete && (
            <button
              onClick={() => {
                if (confirm('确定删除这条记录吗？')) onDelete(record.id);
              }}
              className="p-1.5 hover:bg-red-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="p-4 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {record.conflicts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      异常说明 ({record.conflicts.length} 条)
                    </h4>
                    {record.conflicts.map((conflict, i) => (
                      <ConflictCard key={i} conflict={conflict} />
                    ))}
                  </div>
                )}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-accent-500" />
                    位置信息
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">纬度：</span>
                      <span className="font-mono">{record.lat.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">经度：</span>
                      <span className="font-mono">{record.lng.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">停放数：</span>
                      <span className={isOverCapacity ? 'text-red-600 font-semibold' : ''}>
                        {record.bikeCount} 辆
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">设计容量：</span>
                      <span>{record.capacity} 辆</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">使用率：</span>
                      <span className={`font-semibold ${isOverCapacity ? 'text-red-600' : usagePercent > 80 ? 'text-orange-600' : 'text-green-600'}`}>
                        {usagePercent}% {isOverCapacity && '(超载)'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">疏导原因</h4>
                  <p className="text-sm text-gray-700">{record.reason}</p>
                  {record.notes && (
                    <>
                      <h4 className="text-sm font-semibold text-gray-700 mt-3 mb-2">处理备注</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{record.notes}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <SourceTimeline sources={record.sources} />
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent-500" />
                    处理时间线
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">创建时间</span>
                      <span className="font-mono">{new Date(record.createTime).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">更新时间</span>
                      <span className="font-mono">{new Date(record.updateTime).toLocaleString('zh-CN')}</span>
                    </div>
                    {record.reviewTime && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">复核时间</span>
                        <span className="font-mono text-accent-600">{new Date(record.reviewTime).toLocaleString('zh-CN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">记录ID</span>
                      <span className="font-mono text-xs text-gray-400">{record.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
