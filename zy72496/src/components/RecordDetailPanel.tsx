import { useState } from 'react';
import { CanopyRecord, RecordStatus, OperatorRole } from '@/types';
import { StatusBadge } from './StatusBadge';
import { useRecordsStore } from '@/store/useRecordsStore';
import {
  FileText,
  MapPin,
  Camera,
  Bus,
  Edit3,
  Save,
  X,
  History,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface RecordDetailPanelProps {
  record: CanopyRecord;
}

export function RecordDetailPanel({ record }: RecordDetailPanelProps) {
  const { updateRecordField, updateRecordStatus, currentOperator, records } = useRecordsStore();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const matchedRecords = record.suspectedMatchedRecordIds
    ?.map((id) => records.find((r) => r.id === id))
    .filter(Boolean) as CanopyRecord[];

  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = (fieldName: keyof CanopyRecord) => {
    updateRecordField(record.id, fieldName, editValue, '字段编辑');
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleStatusChange = (newStatus: RecordStatus) => {
    updateRecordStatus(record.id, newStatus, '状态变更');
  };

  const FieldRow = ({
    label,
    icon,
    field,
    value,
    editable = false,
    multiline = false,
  }: {
    label: string;
    icon: React.ReactNode;
    field: keyof CanopyRecord;
    value: string | undefined;
    editable?: boolean;
    multiline?: boolean;
  }) => {
    const isEditing = editingField === field;

    return (
      <div className="py-3 border-b border-slate-100 last:border-b-0">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-start gap-2">
          {isEditing ? (
            <div className="flex-1">
              {multiline ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  rows={3}
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  autoFocus
                />
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => saveEdit(field)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  <Save className="w-3 h-3" />
                  保存
                </button>
                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-700 rounded text-xs hover:bg-slate-300"
                >
                  <X className="w-3 h-3" />
                  取消
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 text-sm text-slate-800">{value || <span className="text-slate-400">未填写</span>}</div>
              {editable && (
                <button
                  onClick={() => startEdit(field, value || '')}
                  className="flex-shrink-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold text-slate-900">{record.communityName}</h2>
          <StatusBadge status={record.status} />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MapPin className="w-4 h-4" />
          {record.stationName}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {record.isSuspectedDuplicateName && (
          <div className="m-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">疑似同一小区新旧名称</p>
                <p className="text-xs text-amber-600 mt-1">
                  系统检测到可能为同一小区的不同名称，请市政巡检员复核确认
                </p>
                {matchedRecords && matchedRecords.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-amber-700">可能匹配的记录：</p>
                    {matchedRecords.map((r) => (
                      <div key={r.id} className="text-xs text-amber-700 pl-2">
                        • {r.communityName}（{r.stationName}）
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="px-5">
          <FieldRow
            label="原始行号"
            icon={<FileText className="w-3.5 h-3.5" />}
            field="originalRowNumber"
            value={String(record.originalRowNumber)}
          />
          <FieldRow
            label="导入文件"
            icon={<FileText className="w-3.5 h-3.5" />}
            field="importFileName"
            value={record.importFileName}
          />
          <FieldRow
            label="路口照片描述"
            icon={<Camera className="w-3.5 h-3.5" />}
            field="photoDescription"
            value={record.photoDescription}
            editable
            multiline
          />
          <FieldRow
            label="公交刷卡时段"
            icon={<Bus className="w-3.5 h-3.5" />}
            field="busSwipeTime"
            value={record.busSwipeTime}
            editable
          />
          <FieldRow
            label="规划员备注/保留理由"
            icon={<Users className="w-3.5 h-3.5" />}
            field="plannerRemark"
            value={record.plannerRemark}
            editable={currentOperator === OperatorRole.PLANNER}
            multiline
          />
          <FieldRow
            label="巡检员备注"
            icon={<Users className="w-3.5 h-3.5" />}
            field="inspectorRemark"
            value={record.inspectorRemark}
            editable={currentOperator === OperatorRole.INSPECTOR}
            multiline
          />
        </div>

        <div className="px-5 py-4 border-t border-slate-100 mt-2">
          <p className="text-xs text-slate-500 mb-3">状态操作</p>
          <div className="flex flex-wrap gap-2">
            {[
              RecordStatus.PENDING,
              RecordStatus.REVIEWING,
              RecordStatus.PLANNER_DONE,
              RecordStatus.INSPECTOR_DONE,
              RecordStatus.NORMAL,
              RecordStatus.PROBLEM,
            ].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={record.status === status}
                className={`px-3 py-1.5 text-xs rounded-md border transition-all ${
                  record.status === status
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-slate-50'
                }`}
              >
                <StatusBadge status={status} size="sm" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200">
        <Link
          to={`/history/${record.id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          <History className="w-4 h-4" />
          查看变更历史 / 回滚
        </Link>
      </div>
    </div>
  );
}
