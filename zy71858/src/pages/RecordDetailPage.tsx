import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Edit } from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SourceInfo } from '@/components/RecordDetail/SourceInfo';
import { StatusTimeline } from '@/components/RecordDetail/StatusTimeline';
import { StatusForm } from '@/components/RecordDetail/StatusForm';
import { formatDate } from '@/utils/statusUtils';

export function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showStatusForm, setShowStatusForm] = useState(false);
  
  const records = useRecordStore((state) => state.records);
  const getRecordHistories = useRecordStore((state) => state.getRecordHistories);
  
  const record = records.find((r) => r.id === id);
  const histories = id ? getRecordHistories(id) : [];

  if (!record) {
    return (
      <div className="p-8">
        <div className="text-center py-16">
          <p className="text-slate-500 mb-4">记录不存在</p>
          <button
            onClick={() => navigate('/records')}
            className="text-primary-600 hover:underline"
          >
            返回记录列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/records')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回记录列表
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-8 h-8 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-800">
                  {record.buildingName} {record.floor}层{record.roomNumber}
                </h1>
                <p className="text-slate-500">
                  来源: {record.source} | 处理人: {record.currentHandler}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={record.status} className="text-base px-3 py-1" />
            <button
              onClick={() => setShowStatusForm(!showStatusForm)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              变更状态
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <SourceInfo record={record} />

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">当前状态</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-slate-500">当前状态</div>
                <StatusBadge status={record.status} className="text-sm" />
              </div>
              <div className="space-y-1">
                <div className="text-sm text-slate-500">当前处理人</div>
                <div className="font-medium text-slate-800">{record.currentHandler}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-slate-500">最后修改时间</div>
                <div className="font-medium text-slate-800">
                  {formatDate(record.lastModified)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-slate-500">最后修改人</div>
                <div className="font-medium text-slate-800">{record.lastModifier}</div>
              </div>
            </div>
            {record.pendingReason && (
              <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                <div className="text-sm text-amber-700 font-medium mb-1">待处理原因</div>
                <div className="text-amber-600">{record.pendingReason}</div>
              </div>
            )}
          </div>

          {showStatusForm && (
            <StatusForm
              recordId={record.id}
              currentStatus={record.status}
              onClose={() => setShowStatusForm(false)}
            />
          )}
        </div>

        <div>
          <StatusTimeline histories={histories} />
        </div>
      </div>
    </div>
  );
}
