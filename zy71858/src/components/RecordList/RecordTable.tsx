import { useState } from 'react';
import { Eye, CheckCircle, Clock, AlertTriangle, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SunshineRecord, RecordStatus } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate } from '@/utils/statusUtils';
import { useRecordStore } from '@/store/useRecordStore';

interface RecordTableProps {
  records: SunshineRecord[];
}

export function RecordTable({ records }: RecordTableProps) {
  const navigate = useNavigate();
  const updateRecordStatus = useRecordStore((state) => state.updateRecordStatus);
  const [showQuickAction, setShowQuickAction] = useState<string | null>(null);

  const handleQuickStatusChange = (
    recordId: string,
    newStatus: RecordStatus,
    reason: string
  ) => {
    updateRecordStatus(recordId, newStatus, reason);
    setShowQuickAction(null);
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-50 rounded-xl">
        <Clock className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">暂无记录</p>
        <p className="text-sm text-slate-400 mt-1">导入数据或手动添加记录开始使用</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">建筑</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">楼层/房间</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">来源</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">状态</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">处理人</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">最后修改</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record) => (
            <tr
              key={record.id}
              className="hover:bg-slate-50 transition-colors group"
            >
              <td className="px-4 py-3">
                <span className="font-medium text-slate-800">
                  {record.buildingName}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {record.floor}层 {record.roomNumber}
              </td>
              <td className="px-4 py-3">
                <span className="text-slate-500 max-w-32 truncate block">
                  {record.source}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={record.status} />
              </td>
              <td className="px-4 py-3 text-slate-600">
                {record.currentHandler}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {formatDate(record.lastModified)}
              </td>
              <td className="px-4 py-3">
                <div className="relative">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/records/${record.id}`)}
                      className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setShowQuickAction(showQuickAction === record.id ? null : record.id)
                      }
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="快速操作"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  {showQuickAction === record.id && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border p-2 z-10 min-w-40">
                      <button
                        onClick={() =>
                          handleQuickStatusChange(record.id, 'confirmed', '快速复核通过')
                        }
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-green-50 rounded text-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                        标记已确认
                      </button>
                      <button
                        onClick={() =>
                          handleQuickStatusChange(record.id, 'to_supplement', '需要补充信息')
                        }
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-50 rounded text-amber-700"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        标记待补充
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
