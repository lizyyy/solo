import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { User, DollarSign, Calendar, Clock, FileText } from 'lucide-react';
import { useRecordStore } from '../store/recordStore';
import StatusBadge from '../components/layout/StatusBadge';
import MaterialTimeline from '../components/detail/MaterialTimeline';
import SuggestionPanel from '../components/detail/SuggestionPanel';
import OperationHistory from '../components/detail/OperationHistory';
import ActionBar from '../components/detail/ActionBar';
import { formatCurrency } from '../utils/exportUtil';

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const { loadRecords, records } = useRecordStore();

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const record = records.find(r => r.id === id);

  if (!record) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{record.investorName}</h2>
              <StatusBadge status={record.status} />
            </div>
            <p className="text-gray-500">记录 ID: {record.id}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary-700">
              {formatCurrency(record.amount)}
            </div>
            <p className="text-sm text-gray-500">投资金额</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">处理人</div>
              <div className="text-sm font-medium text-gray-900">{record.handler}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">材料数量</div>
              <div className="text-sm font-medium text-gray-900">{record.materials.length} 份</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">创建时间</div>
              <div className="text-sm font-medium text-gray-900">{record.createdAt}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">最后更新</div>
              <div className="text-sm font-medium text-gray-900">{record.updatedAt}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MaterialTimeline materials={record.materials} />
          <OperationHistory logs={record.operationLogs} />
          
          {record.notes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">手工备注</h3>
              <div className="space-y-3">
                {record.notes.map((note) => (
                  <div key={note.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      {note.author} · {note.createdAt}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <SuggestionPanel suggestion={record.suggestion} editable />
          <ActionBar record={record} />
        </div>
      </div>
    </div>
  );
}
