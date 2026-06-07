import { useState } from 'react';
import { Ticket, Image, Edit2, Check, X } from 'lucide-react';
import type { AttendanceRecord } from '@/types';
import { getTicketTypeLabel, getTicketTypeColor } from '@/utils';
import { useAppStore } from '@/stores/useAppStore';

interface AttendanceTableProps {
  records: AttendanceRecord[];
  showSource?: boolean;
}

export default function AttendanceTable({ records, showSource = true }: AttendanceTableProps) {
  const { currentRole, updateRecordRemark } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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

  return (
    <div className="glass rounded-2xl border border-white/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-primary-50/80">
              <th className="px-5 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                姓名
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                类型
              </th>
              {showSource && (
                <th className="px-5 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                  照片位置
                </th>
              )}
              <th className="px-5 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                备注
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-primary-700 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {records.map((record, index) => (
              <tr
                key={record.id}
                className="hover:bg-primary-50/50 transition-colors"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className="px-5 py-4 whitespace-nowrap">
                  <span className="font-medium text-primary-900">{record.name}</span>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getTicketTypeColor(
                      record.type
                    )}`}
                  >
                    <Ticket className="w-3 h-3" />
                    {getTicketTypeLabel(record.type)}
                  </span>
                </td>
                {showSource && (
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs text-primary-500">
                      <Image className="w-3.5 h-3.5" />
                      {record.sourcePhotoRef}
                    </span>
                  </td>
                )}
                <td className="px-5 py-4">
                  {editingId === record.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full px-3 py-1.5 border border-primary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                <td className="px-5 py-4 whitespace-nowrap text-right">
                  {currentRole === 'copyright' && (
                    <div className="inline-flex items-center gap-1">
                      {editingId === record.id ? (
                        <>
                          <button
                            onClick={() => handleSave(record.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEdit(record)}
                          className="p-1.5 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
