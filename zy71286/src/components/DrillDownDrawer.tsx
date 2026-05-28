import { X, Download, Check, Pencil } from 'lucide-react';
import { useState } from 'react';
import type { WeeklyRecord, ProductStatus, ConfirmationStatus } from '@/types';
import { STATUS_LABELS } from '@/types';
import StatusBadge from './StatusBadge';
import ConfirmationBadge from './ConfirmationBadge';

interface DrillDownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  fromStatus: ProductStatus;
  toStatus: ProductStatus;
  records: WeeklyRecord[];
  onUpdateConfirmation?: (recordId: string, status: ConfirmationStatus, notes?: string) => void;
}

export default function DrillDownDrawer({
  isOpen,
  onClose,
  fromStatus,
  toStatus,
  records,
  onUpdateConfirmation,
}: DrillDownDrawerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');

  if (!isOpen) return null;

  const handleSave = (recordId: string, status: ConfirmationStatus) => {
    onUpdateConfirmation?.(recordId, status, editNotes || undefined);
    setEditingId(null);
    setEditNotes('');
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="sticky top-0 bg-white border-b border-navy-100 px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-xl font-semibold text-navy-900">原始记录钻取</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-navy-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-navy-500" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-navy-500">状态跳转：</span>
            <StatusBadge status={fromStatus} size="sm" />
            <span className="text-navy-400">→</span>
            <StatusBadge status={toStatus} size="sm" />
            <span className="ml-auto text-navy-500 font-mono">
              共 {records.length} 条记录
            </span>
          </div>
        </div>

        <div className="p-6">
          {records.length === 0 ? (
            <div className="text-center py-12 text-navy-500">
              <p>暂无该跳转路径的历史记录</p>
              <p className="text-sm mt-2">转移概率由拉普拉斯平滑估算</p>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="bg-white border-2 border-navy-100 rounded-lg p-4 hover:border-navy-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-navy-900">{record.productName}</div>
                      <div className="text-xs text-navy-500 font-mono mt-1">
                        {record.sku} · {record.category} · 第{record.weekNum}周
                      </div>
                    </div>
                    <ConfirmationBadge status={record.confirmationStatus} />
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-navy-50 rounded-lg p-2 text-center">
                      <div className="font-mono text-lg font-bold text-navy-900">{record.salesVolume}</div>
                      <div className="text-xs text-navy-500">周销量</div>
                    </div>
                    <div className="bg-navy-50 rounded-lg p-2 text-center">
                      <div className="font-mono text-lg font-bold text-navy-900">{record.inventory}</div>
                      <div className="text-xs text-navy-500">库存量</div>
                    </div>
                    <div className="bg-navy-50 rounded-lg p-2 text-center">
                      <div className="font-mono text-lg font-bold text-navy-900">{record.turnoverDays}</div>
                      <div className="text-xs text-navy-500">周转天数</div>
                    </div>
                  </div>

                  {record.isPromotion && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-700 text-xs rounded-md mb-3">
                      <Download className="w-3 h-3" />
                      促销期
                    </div>
                  )}

                  {record.notes && (
                    <div className="text-xs text-navy-600 bg-brand-50/50 border-l-2 border-brand-300 pl-3 py-1 mb-3">
                      📝 {record.notes}
                    </div>
                  )}

                  {editingId === record.id ? (
                    <div className="mt-3 p-3 bg-navy-50 rounded-lg">
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="添加备注说明..."
                        className="w-full px-3 py-2 border-2 border-navy-200 rounded-lg text-sm resize-none h-20 focus:outline-none focus:border-navy-500"
                      />
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 text-sm text-navy-600 hover:bg-navy-100 rounded transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => handleSave(record.id, 'TEMPORARY')}
                          className="px-3 py-1 text-sm text-brand-700 bg-brand-50 hover:bg-brand-100 rounded transition-colors flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          设为临时
                        </button>
                        <button
                          onClick={() => handleSave(record.id, 'CONFIRMED')}
                          className="px-3 py-1 text-sm text-success-700 bg-success-50 hover:bg-success-100 rounded transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          确认
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(record.id);
                        setEditNotes(record.notes || '');
                      }}
                      className="mt-2 text-xs text-navy-500 hover:text-navy-700 transition-colors"
                    >
                      编辑确认状态 →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
