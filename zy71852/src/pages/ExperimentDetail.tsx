import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, GitCompare, AlertTriangle, GitBranch, FileDown, Clock, User, FileText } from 'lucide-react';
import { useExperiments } from '@/hooks/useExperiments';
import { useTimeline } from '@/hooks/useTimeline';
import { Timeline } from '@/components/Timeline';
import { ExperimentStatusBadge } from '@/components/StatusBadge';
import { SourceTag } from '@/components/SourceTag';
import { formatDateTime, formatDate, calculateTimeGap } from '@/utils/date';

export function ExperimentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getExperimentById,
    getStepRecordsByExperimentId,
    getScoreSheetByExperimentId,
    getAnomaliesByExperimentId,
  } = useExperiments();

  const experiment = id ? getExperimentById(id) : undefined;
  const stepRecords = id ? getStepRecordsByExperimentId(id) : [];
  const scoreSheet = id ? getScoreSheetByExperimentId(id) : undefined;
  const anomalies = id ? getAnomaliesByExperimentId(id) : [];

  const { timelineItems, supplementaryRecords, skippedRecords } = useTimeline(stepRecords);

  if (!experiment) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p>实验不存在</p>
        <button
          onClick={() => navigate('/experiments')}
          className="mt-4 text-primary hover:underline"
        >
          返回列表
        </button>
      </div>
    );
  }

  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/experiments')}
            className="flex items-center gap-1 text-neutral-600 hover:text-primary transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">返回列表</span>
          </button>
          <h2 className="text-lg font-mono font-semibold text-neutral-900">
            实验详情 - {experiment.studentName}
          </h2>
          <ExperimentStatusBadge status={experiment.status} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/experiments/${id}/timeline`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
          >
            <GitCompare size={16} />
            时序对比
          </Link>
          <Link
            to={`/experiments/${id}/anomalies`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
          >
            <AlertTriangle size={16} />
            异常解释
            {unresolvedAnomalies.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                {unresolvedAnomalies.length}
              </span>
            )}
          </Link>
          <Link
            to={`/experiments/${id}/history`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
          >
            <GitBranch size={16} />
            历史回溯
          </Link>
          <Link
            to={`/export?id=${id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors"
          >
            <FileDown size={16} />
            导出报告
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <User size={16} className="text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">基本信息</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">班级</span>
              <span className="font-medium">{experiment.className}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">学生姓名</span>
              <span className="font-medium">{experiment.studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">学号</span>
              <span className="font-mono">{experiment.studentId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">实验日期</span>
              <span className="font-mono">{formatDate(experiment.experimentDate)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">数据到达时间</span>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <SourceTag source="student" />
                <span className="text-neutral-500 text-xs">学生记录</span>
              </div>
              <div className="font-mono text-neutral-800">
                {formatDateTime(experiment.studentRecordArrivedAt)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <SourceTag source="score_sheet" />
                <span className="text-neutral-500 text-xs">评分表</span>
              </div>
              <div className="font-mono text-neutral-800">
                {experiment.scoreSheetArrivedAt
                  ? formatDateTime(experiment.scoreSheetArrivedAt)
                  : <span className="text-orange-600">未到达</span>}
              </div>
            </div>
            {experiment.studentRecordArrivedAt && experiment.scoreSheetArrivedAt && (
              <div className="pt-2 border-t border-neutral-100">
                <span className="text-xs text-neutral-500">时间差：</span>
                <span className="ml-2 font-mono text-orange-600 font-medium">
                  {calculateTimeGap(experiment.studentRecordArrivedAt, experiment.scoreSheetArrivedAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">统计信息</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">步骤总数</span>
              <span className="font-mono font-medium">{timelineItems.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">补录数据</span>
              <span className={`font-mono font-medium ${supplementaryRecords.length > 0 ? 'text-gray-600 italic' : ''}`}>
                {supplementaryRecords.length} 条
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">跳过步骤</span>
              <span className={`font-mono font-medium ${skippedRecords.length > 0 ? 'text-red-600' : ''}`}>
                {skippedRecords.length} 条
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">未解决异常</span>
              <span className={`font-mono font-medium ${unresolvedAnomalies.length > 0 ? 'text-red-600' : ''}`}>
                {unresolvedAnomalies.length} 条
              </span>
            </div>
            {scoreSheet && (
              <div className="flex justify-between pt-2 border-t border-neutral-100">
                <span className="text-neutral-500">总分</span>
                <span className="font-mono font-bold text-primary text-lg">
                  {scoreSheet.totalScore}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {scoreSheet && (
        <div className={`bg-white border rounded-lg p-4 ${
          scoreSheet.conclusionChanged ? 'border-red-300 bg-red-50/30' : 'border-neutral-200'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className={scoreSheet.conclusionChanged ? 'text-red-500' : 'text-neutral-500'} />
            <span className={`text-sm font-medium ${scoreSheet.conclusionChanged ? 'text-red-700' : 'text-neutral-700'}`}>
              评分结论
            </span>
            {scoreSheet.conclusionChanged && (
              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 border border-red-200 rounded">
                结论已修改
              </span>
            )}
            <SourceTag source="score_sheet" />
          </div>

          {scoreSheet.conclusionChanged && scoreSheet.originalConclusion && (
            <div className="mb-3 p-3 bg-white border border-red-200 rounded">
              <div className="text-xs text-neutral-500 mb-1">原始结论：</div>
              <div className="text-sm text-neutral-600 line-through">{scoreSheet.originalConclusion}</div>
            </div>
          )}

          <div className="mb-3">
            <div className="text-xs text-neutral-500 mb-1">最终结论：</div>
            <div className={`text-sm ${scoreSheet.conclusionChanged ? 'font-medium text-red-800' : 'text-neutral-800'}`}>
              {scoreSheet.conclusion}
            </div>
          </div>

          {scoreSheet.conclusionChanged && scoreSheet.conclusionChangeReason && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded">
              <div className="text-xs font-medium text-orange-700 mb-1">修改原因：</div>
              <div className="text-sm text-orange-800">{scoreSheet.conclusionChangeReason}</div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
            <span>评分人：{scoreSheet.grader}</span>
            <span>评分时间：{formatDateTime(scoreSheet.gradedAt)}</span>
          </div>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700">完整时间轴</span>
          <div className="ml-auto flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-neutral-600">学生记录</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-neutral-600">评分表</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-neutral-600 italic">补录</span>
            </div>
          </div>
        </div>

        <Timeline items={timelineItems} />
      </div>
    </div>
  );
}
