import { useState, useEffect } from 'react';
import { Ticket, Image, Edit2, Check, X, Fingerprint, Hash } from 'lucide-react';
import type { AttendanceRecord } from '@/types';
import { getTicketTypeLabel, getTicketTypeColor, formatDateTime } from '@/utils';
import { useAppStore } from '@/stores/useAppStore';

interface AttendanceTableProps {
  records: AttendanceRecord[];
  highlightRecordId?: string | null;
}

export default function AttendanceTable({ records, highlightRecordId }: AttendanceTableProps) {
  const { currentRole, updateRecordRemark } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showTrace, setShowTrace] = useState(false);

  const handleEdit = (record: AttendanceRecord) => {
    if (currentRole !== 'copyright') return;
    setEditingId(record.id);
    setEditValue(record.remark || '');
  };

  const handleSave = (recordId: string) => {
    updateRecordRemark(recordId, editValue, currentRole);
    setEditingId(null);
    setEditValue('');
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  useEffect(() => {
    if (highlightRecordId) {
      const el = document.getElementById(`row-${highlightRecordId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightRecordId]);

  return (
    <div className="glass rounded-2xl border border-white/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-primary-100 flex items-center justify-between">
        <h3 className="font-display font-semibold text-primary-900 text-sm">签到记录</h3>
        <button
          onClick={() => setShowTrace(!showTrace)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showTrace
              ? 'bg-primary-600 text-white'
              : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
          }`}
        >
          <Fingerprint className="w-3.5 h-3.5" />
          {showTrace ? '隐藏追溯列' : '显示追溯列'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-primary-50/80">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                姓名
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                类型
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                照片位置
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                备注
              </th>
              {showTrace && (
                <>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                    记录ID / 去重Key
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                    导入会话
                  </th>
                </>
              )}
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {records.map((record) => {
              const isHighlighted = highlightRecordId === record.id;
              return (
                <tr
                  key={record.id}
                  id={`row-${record.id}`}
                  className={`hover:bg-primary-50/50 transition-colors ${
                    isHighlighted ? 'bg-accent-50 ring-2 ring-accent-300 ring-inset' : ''
                  }`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary-900 text-sm">{record.name}</span>
                      {record.createdAt !== record.updatedAt && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-400" title="备注已修改" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${getTicketTypeColor(
                        record.type
                      )}`}
                    >
                      <Ticket className="w-3 h-3" />
                      {getTicketTypeLabel(record.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary-500">
                      <Image className="w-3 h-3" />
                      {record.sourcePhotoRef}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === record.id ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full px-2 py-1 border border-primary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`text-sm ${
                          record.remark ? 'text-primary-700' : 'text-primary-300 italic'
                        }`}
                      >
                        {record.remark || '暂无备注'}
                      </span>
                    )}
                  </td>
                  {showTrace && (
                    <>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="font-mono text-[10px] text-primary-500">{record.id}</p>
                          <p className="font-mono text-[10px] text-primary-400 break-all max-w-[200px]">
                            {record.dedupKey}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] text-primary-400">
                          {record.importSessionId || '-'}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {currentRole === 'copyright' && (
                      <div className="inline-flex items-center gap-1">
                        {editingId === record.id ? (
                          <>
                            <button
                              onClick={() => handleSave(record.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleEdit(record)}
                            className="p-1 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                            title="修改备注"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
