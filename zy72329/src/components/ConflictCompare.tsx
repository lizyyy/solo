import { FileText, ListChecks, Swords, Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConflictRecord, TeacherNote, SamplingList, ConflictResolution } from '../../shared/types';

interface ConflictCompareProps {
  conflict?: ConflictRecord;
  teacherNote?: TeacherNote | null;
  samplingList?: SamplingList | null;
  onResolve?: (resolution: ConflictResolution, note?: string) => void;
  disabled?: boolean;
}



export default function ConflictCompare({
  conflict,
  teacherNote,
  samplingList,
  onResolve,
  disabled = false,
}: ConflictCompareProps) {
  if (!conflict || !teacherNote || !samplingList) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>请选择一条冲突记录查看详情</p>
        </div>
      </div>
    );
  }

  const conflictingFieldNames = conflict.conflictingFields.map((f) => f.field);

  const commonFields = [
    { key: 'date', label: '日期', teacherValue: teacherNote.date, samplingValue: samplingList.date },
    { key: 'teacherName', label: '老师姓名', teacherValue: teacherNote.teacherName, samplingValue: samplingList.teacherName },
    { key: 'amount', label: '金额', teacherValue: `¥${teacherNote.amount.toFixed(2)}`, samplingValue: `¥${samplingList.amount.toFixed(2)}` },
    { key: 'itemType', label: '项目类型', teacherValue: teacherNote.itemType, samplingValue: samplingList.itemType },
  ];

  const renderFieldRow = (field: { key: string; label: string; teacherValue: string; samplingValue: string }) => {
    const isConflict = conflictingFieldNames.includes(field.key);

    return (
      <div key={field.key} className="flex items-stretch">
        <div
          className={cn(
            'flex-1 p-3 text-sm',
            isConflict && 'bg-red-50 border-2 border-red-300 rounded-l-lg'
          )}
        >
          <div className="text-xs text-gray-500 mb-1">{field.label}</div>
          <div className={cn(
            'font-medium',
            isConflict ? 'text-red-700 font-mono' : 'text-gray-800'
          )}>
            {field.teacherValue}
          </div>
          {isConflict && (
            <div className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <X className="w-3 h-3" />
              存在矛盾
            </div>
          )}
        </div>

        <div className="flex items-center justify-center px-4 bg-gray-100 border-x border-gray-200">
          {isConflict ? (
            <div className="flex flex-col items-center">
              <Swords className="w-5 h-5 text-red-500" />
              <span className="text-[10px] text-red-500 font-bold mt-1">VS</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-[10px] text-green-500 font-bold mt-1">=</span>
            </div>
          )}
        </div>

        <div
          className={cn(
            'flex-1 p-3 text-sm text-right',
            isConflict && 'bg-red-50 border-2 border-red-300 rounded-r-lg'
          )}
        >
          <div className="text-xs text-gray-500 mb-1">{field.label}</div>
          <div className={cn(
            'font-medium',
            isConflict ? 'text-red-700 font-mono' : 'text-gray-800'
          )}>
            {field.samplingValue}
          </div>
          {isConflict && (
            <div className="mt-1 text-xs text-red-500 flex items-center gap-1 justify-end">
              存在矛盾
              <X className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-800">老师批注数据</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">批注内容</span>
              <span className={cn(
                'max-w-[60%] text-right',
                conflictingFieldNames.includes('annotation') && 'text-red-600 font-medium'
              )}>
                {teacherNote.annotation}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">导入批次</span>
              <span className="font-mono text-xs">{teacherNote.importBatchId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">导入人</span>
              <span>{teacherNote.importedBy}</span>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 justify-end">
            <span className="font-semibold text-green-800">抽样名单数据</span>
            <ListChecks className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">场景描述</span>
              <span className={cn(
                'max-w-[60%] text-right',
                conflictingFieldNames.includes('sceneDescription') && 'text-red-600 font-medium'
              )}>
                {samplingList.sceneDescription}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">导入批次</span>
              <span className="font-mono text-xs">{samplingList.importBatchId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">导入人</span>
              <span>{samplingList.importedBy}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            字段对比
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {commonFields.map(renderFieldRow)}
        </div>
      </div>

      {!disabled && onResolve && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h4 className="font-medium text-gray-800 mb-3">冲突处理</h4>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onResolve('teacher_note')}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              以老师批注为准
            </button>
            <button
              onClick={() => onResolve('sampling_list')}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <ListChecks className="w-4 h-4" />
              以抽样名单为准
            </button>
            <button
              onClick={() => onResolve('rejected')}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              标记为异常
            </button>
          </div>
        </div>
      )}

      {conflict.resolution && (
        <div className={cn(
          'border rounded-xl p-4',
          conflict.resolution === 'teacher_note' && 'bg-blue-50 border-blue-200',
          conflict.resolution === 'sampling_list' && 'bg-green-50 border-green-200',
          conflict.resolution === 'rejected' && 'bg-gray-50 border-gray-200'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="font-medium text-gray-800">已处理</span>
          </div>
          <p className="text-sm text-gray-600">
            处理结果：
            {conflict.resolution === 'teacher_note' && '采纳老师批注数据'}
            {conflict.resolution === 'sampling_list' && '采纳抽样名单数据'}
            {conflict.resolution === 'rejected' && '标记为异常数据'}
          </p>
          {conflict.resolutionNote && (
            <p className="text-sm text-gray-600 mt-1">
              处理备注：{conflict.resolutionNote}
            </p>
          )}
          {conflict.resolvedBy && (
            <p className="text-xs text-gray-400 mt-2">
              处理人：{conflict.resolvedBy} · {conflict.resolvedAt}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
