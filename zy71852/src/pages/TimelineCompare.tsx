import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GitCompare, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useExperiments } from '@/hooks/useExperiments';
import { useDiff } from '@/hooks/useDiff';
import { useTimeline } from '@/hooks/useTimeline';
import { SourceTag } from '@/components/SourceTag';
import { StepStatusBadge } from '@/components/StatusBadge';
import { formatDateTime, calculateTimeGap } from '@/utils/date';
import type { StepDiff } from '@/utils/diff';

const statusConfig: Record<StepDiff['status'], { label: string; color: string; icon: typeof AlertCircle }> = {
  match: { label: '一致', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle },
  mismatch: { label: '内容不一致', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertCircle },
  missing_in_student: { label: '学生记录缺失', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
  missing_in_score: { label: '评分表缺失', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
  status_mismatch: { label: '状态不一致', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertCircle },
};

export function TimelineCompare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getExperimentById, getStepRecordsByExperimentId } = useExperiments();

  const experiment = id ? getExperimentById(id) : undefined;
  const stepRecords = id ? getStepRecordsByExperimentId(id) : [];

  const { studentRecords, scoreRecords } = useTimeline(stepRecords);
  const { stepDiffs, mismatchedSteps } = useDiff(studentRecords, scoreRecords);

  if (!experiment) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p>实验不存在</p>
        <button onClick={() => navigate('/experiments')} className="mt-4 text-primary hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/experiments/${id}`)}
          className="flex items-center gap-1 text-neutral-600 hover:text-primary transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">返回详情</span>
        </button>
        <h2 className="text-lg font-mono font-semibold text-neutral-900">
          时序对比 - {experiment.studentName}
        </h2>
        <GitCompare size={20} className="text-primary" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <SourceTag source="student" size="md" />
            <span className="text-sm font-medium text-neutral-700">学生误操作记录</span>
          </div>
          <div className="text-xs text-neutral-500">
            到达时间：{formatDateTime(experiment.studentRecordArrivedAt)}
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            共 <span className="font-mono font-semibold text-blue-600">{studentRecords.length}</span> 条记录
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <SourceTag source="score_sheet" size="md" />
            <span className="text-sm font-medium text-neutral-700">评分表</span>
          </div>
          <div className="text-xs text-neutral-500">
            到达时间：{experiment.scoreSheetArrivedAt ? formatDateTime(experiment.scoreSheetArrivedAt) : '未到达'}
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            共 <span className="font-mono font-semibold text-green-600">{scoreRecords.length}</span> 条记录
          </div>
          {experiment.studentRecordArrivedAt && experiment.scoreSheetArrivedAt && (
            <div className="mt-2 text-xs">
              <span className="text-neutral-500">时间差：</span>
              <span className="font-mono text-orange-600 font-medium">
                {calculateTimeGap(experiment.studentRecordArrivedAt, experiment.scoreSheetArrivedAt)}
              </span>
            </div>
          )}
        </div>
      </div>

      {mismatchedSteps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={18} className="text-red-600" />
            <span className="font-medium text-red-800">发现 {mismatchedSteps.length} 处不一致</span>
          </div>
          <div className="space-y-1 text-sm text-red-700">
            {mismatchedSteps.map((diff) => (
              <div key={diff.stepNumber} className="flex items-center gap-2">
                <span className="font-mono">步骤 {diff.stepNumber}</span>
                <span>{statusConfig[diff.status].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg">
        <div className="grid grid-cols-12 border-b border-neutral-200 bg-neutral-50">
          <div className="col-span-1 px-4 py-3 text-xs font-medium text-neutral-600">步骤</div>
          <div className="col-span-5 px-4 py-3 text-xs font-medium text-blue-700 border-r border-neutral-200">
            学生记录
          </div>
          <div className="col-span-1 px-4 py-3 text-xs font-medium text-neutral-600 text-center">状态</div>
          <div className="col-span-5 px-4 py-3 text-xs font-medium text-green-700">
            评分表
          </div>
        </div>

        {stepDiffs.map((diff) => {
          const StatusIcon = statusConfig[diff.status].icon;
          return (
            <div
              key={diff.stepNumber}
              className={`grid grid-cols-12 border-b border-neutral-100 ${
                diff.status !== 'match' ? 'bg-red-50/30' : ''
              }`}
            >
              <div className="col-span-1 px-4 py-3">
                <span className="font-mono text-sm font-semibold text-primary">
                  {diff.stepNumber}
                </span>
              </div>

              <div className="col-span-5 px-4 py-3 border-r border-neutral-100">
                {diff.studentRecord ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{diff.studentRecord.stepName}</span>
                      <SourceTag source="student" isSupplementary={diff.studentRecord.isSupplementary} />
                    </div>
                    <p className={`text-sm text-neutral-700 ${
                      diff.studentRecord.status === 'skipped' ? 'line-through text-neutral-500' : ''
                    } ${diff.studentRecord.isSupplementary ? 'italic text-neutral-600' : ''}`}>
                      {diff.studentRecord.content}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDateTime(diff.studentRecord.actualOccurredAt)}
                      </div>
                      <StepStatusBadge
                        status={diff.studentRecord.status}
                        skipReason={diff.studentRecord.skipReason}
                        skipSource={diff.studentRecord.skipSource}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-red-600 italic">学生记录缺失此步骤</div>
                )}
              </div>

              <div className="col-span-1 px-4 py-3 flex items-center justify-center">
                <div
                  className={`flex flex-col items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${statusConfig[diff.status].color}`}
                  title={statusConfig[diff.status].label}
                >
                  <StatusIcon size={14} />
                  <span className="whitespace-nowrap">{statusConfig[diff.status].label}</span>
                </div>
              </div>

              <div className="col-span-5 px-4 py-3">
                {diff.scoreRecord ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{diff.scoreRecord.stepName}</span>
                      <SourceTag source="score_sheet" isSupplementary={diff.scoreRecord.isSupplementary} />
                    </div>
                    <p className={`text-sm text-neutral-700 ${
                      diff.scoreRecord.status === 'skipped' ? 'line-through text-neutral-500' : ''
                    } ${diff.scoreRecord.isSupplementary ? 'italic text-neutral-600' : ''}`}>
                      {diff.scoreRecord.content}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDateTime(diff.scoreRecord.actualOccurredAt)}
                      </div>
                      <StepStatusBadge
                        status={diff.scoreRecord.status}
                        skipReason={diff.scoreRecord.skipReason}
                        skipSource={diff.scoreRecord.skipSource}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-red-600 italic">评分表缺失此步骤</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="text-sm font-medium text-neutral-700 mb-3">图例说明</div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 font-medium">[学生记录]</span>
            <span className="text-neutral-600">学生实验过程中实时记录的数据</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-medium">[评分表]</span>
            <span className="text-neutral-600">教师课后录入的评分数据</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 italic font-medium">[补录]</span>
            <span className="text-neutral-600">事后补充的数据</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="line-through text-neutral-500">删除线</span>
            <span className="text-neutral-600">表示该步骤被跳过</span>
          </div>
        </div>
      </div>
    </div>
  );
}
