const fs = require('fs');

const CONTENT = String.raw`import { useState } from 'react';
import { CanopyRecord, RecordStatus, OperatorRole, HistoryRecord, STATUS_LABELS } from '@/types';
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
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface RecordDetailPanelProps {
  record: CanopyRecord;
}

const FIELD_CN_LABELS: Record<string, string> = {
  status: '状态',
  busSwipeTime: '公交刷卡时段',
  photoDescription: '路口照片描述',
  plannerRemark: '规划员备注',
  inspectorRemark: '巡检员备注',
  communityName: '小区名称',
  stationName: '轨交站',
};

function formatFieldValue(fieldName: string, value: string): React.ReactNode {
  if (fieldName === 'status' && value in STATUS_LABELS) {
    return <StatusBadge status={value as any} size="sm" />;
  }
  return value || <span className="text-slate-400">（空）</span>;
}

export function RecordDetailPanel({ record }: RecordDetailPanelProps) {
  const {
    updateRecordField,
    updateRecordStatus,
    currentOperator,
    records,
    getFieldHistory,
    rollbackToHistory,
  } = useRecordsStore();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedHistoryField, setExpandedHistoryField] = useState<string | null>(null);

  const matchedRecords = record.suspectedMatchedRecordIds
    ?.map((id) => records.find((r) => r.id === id))
    .filter(Boolean) as CanopyRecord[];

  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
    setExpandedHistoryField(null);
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

  const handleRollback = (historyEntry: HistoryRecord) => {
    if (
      confirm(
        \`确定回滚「\${FIELD_CN_LABELS[historyEntry.fieldName] || historyEntry.fieldName}」吗？\n将从「\${historyEntry.newValue}」还原为「\${historyEntry.oldValue}」\`
      )
    ) {
      rollbackToHistory(historyEntry.id);
    }
  };

  const FieldHistoryInline = ({ field }: { field: string }) => {
    const history = getFieldHistory(record.id, field);
    if (history.length === 0) return null;
    const isExpanded = expandedHistoryField === field;
    const latest = history[0];
    const currentValue = String(record[field as keyof CanopyRecord] ?? '');

    return (
      <div className="mt-2 border-t border-dashed border-slate-200 pt-2">
        <button
          onClick={() => setExpandedHistoryField(isExpanded ? null : field)}
          className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-blue-600 transition-colors"
        >
          <span className="flex items-center gap-1">
            <History className="w-3.5 h-3.5" />
            变更 {history.length} 次 · 最近操作：{latest.operatorName} ·{' '}
            {new Date(latest.timestamp).toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
            {history.map((h) => {
              const canRollback = currentValue === h.newValue && h.oldValue !== h.newValue;
              const isCurrentEffective = currentValue === h.newValue;
              return (
                <div
                  key={h.id}
                  className={\`p-2 rounded border \${
                    isCurrentEffective
                      ? 'bg-green-50 border-green-200'
                      : 'bg-slate-50 border-slate-200'
                  }\`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">
                      {h.operatorName} ·{' '}
                      {new Date(h.timestamp).toLocaleString('zh-CN')}
                      {isCurrentEffective && (
                        <span className="ml-2 text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                          当前生效
                        </span>
                      )}
                    </span>
                    {canRollback && (
                      <button
                        onClick={() => handleRollback(h)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-amber-700 bg-amber-50 rounded border border-amber-200 hover:bg-amber-100 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        回滚到此版本
                      </button>
                    )}
                  </div>
                  {h.changeReason && (
                    <p className="text-xs text-blue-600 mb-1">原因：{h.changeReason}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-1.5 py-0.5 rounded line-through text-slate-500 bg-slate-200">
                      {formatFieldValue(h.fieldName, h.oldValue)}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="px-1.5 py-0.5 rounded text-green-700 bg-green-100 border border-green-200">
                      {formatFieldValue(h.fieldName, h.newValue)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
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
              <div className="flex-1 text-sm text-slate-800">
                {value || <span className="text-slate-400">未填写</span>}
                {editable && !isEditing && (
                  <FieldHistoryInline field={field as string} />
                )}
              </div>
              {editable && !isEditing && (
                <button
                  onClick={() => startEdit(field, value || '')}
                  className="flex-shrink-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="编辑"
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
                  系统检测到可能为同一小区的不同名称，需市政巡检员复核确认，
                  <span className="font-semibold">不自动归为正常</span>
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
          <p className="text-xs text-slate-500 mb-3">状态操作（所有变更自动记录历史）</p>
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
                className={\`px-3 py-1.5 text-xs rounded-md border transition-all \${
                  record.status === status
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-slate-50'
                }\`}
              >
                <StatusBadge status={status} size="sm" />
              </button>
            ))}
          </div>
          <FieldHistoryInline field="status" />
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-2">
        <Link
          to={\`/history/\${record.id}\`}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <History className="w-4 h-4" />
          查看完整变更历史 / 回滚
        </Link>
        <p className="text-xs text-slate-400 text-center">
          💡 修改备注后，每个字段下方会出现「变更 X 次」，展开即可直接回滚
        </p>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/RecordDetailPanel.tsx', CONTENT);
console.log('RecordDetailPanel.tsx 写入完成');
console.log('字节数:', CONTENT.length);
console.log('行数:', CONTENT.split('\n').length);
