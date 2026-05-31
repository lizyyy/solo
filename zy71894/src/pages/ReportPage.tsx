import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useScheduleStore } from '@/store/useScheduleStore';
import { downloadReport } from '@/utils/scheduling';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';
import {
  ArrowLeft,
  Download,
  FileText,
  AlertTriangle,
  CheckSquare,
  Clock,
  RefreshCw,
} from 'lucide-react';

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getScheduleById, exportReport, getMaterialBatchInfo } = useScheduleStore();
  const [handoverNotes, setHandoverNotes] = useState('');
  const [nextShiftRemarks, setNextShiftRemarks] = useState('');

  const schedule = id ? getScheduleById(id) : undefined;
  const batchInfo = schedule ? getMaterialBatchInfo(schedule.materialBatchId) : undefined;
  const report = schedule ? exportReport(schedule.id) : undefined;

  if (!schedule || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-industrial-600 mb-4">报告不存在</p>
          <button
            onClick={() => navigate('/schedule')}
            className="px-4 py-2 bg-primary-700 text-white text-sm hover:bg-primary-800"
          >
            返回排程总表
          </button>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    const updatedReport = {
      ...report,
      handoverNotes,
      nextShiftRemarks: nextShiftRemarks || report.nextShiftRemarks,
      content: report.content + '\n\n【交接备注】\n' + (handoverNotes || '无') + '\n\n【下一班备注】\n' + (nextShiftRemarks || report.nextShiftRemarks),
    };
    downloadReport(updatedReport);
  };

  const getScoreFromConclusion = () => {
    const match = schedule.conclusion.match(/综合评分: (\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const score = getScoreFromConclusion();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(`/schedule/${schedule.id}`)}
            className="flex items-center gap-2 text-industrial-600 hover:text-primary-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回排程详情
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="bg-white border border-industrial-200 p-6 shadow-industrial">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary-700" />
                  </div>
                  <div>
                    <h1 className="text-xl font-mono font-bold text-industrial-900">
                      巡检报告
                    </h1>
                    <p className="text-sm text-industrial-500">
                      {schedule.materialBatchId} - {batchInfo?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-700 hover:bg-primary-800 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载报告
                </button>
              </div>

              <div className="flex flex-wrap gap-4 mb-6">
                <StatusBadge status={schedule.status} />
                <PriorityBadge priority={schedule.priority} />
                {schedule.isReRun && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-amber-100 text-amber-700">
                    <RefreshCw className="w-3 h-3" />
                    第 {schedule.runCount} 次排程
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold bg-industrial-100 text-industrial-700">
                  评分: {score}/100
                </span>
              </div>

              <div className="bg-industrial-900 text-industrial-100 p-6 font-mono text-xs overflow-auto max-h-[500px]">
                <pre className="whitespace-pre-wrap">{report.content}</pre>
              </div>
            </div>

            <div className="bg-white border border-industrial-200 p-6 shadow-industrial">
              <h2 className="text-sm font-semibold text-industrial-900 mb-4">交接备注</h2>
              <textarea
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="输入需要向下一班交接的重要信息..."
                className="w-full h-24 px-3 py-2 border border-industrial-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <p className="text-xs text-industrial-500 mt-2">
                这些备注将被添加到导出的报告中，方便下一班次查看。
              </p>
            </div>

            <div className="bg-white border border-industrial-200 p-6 shadow-industrial">
              <h2 className="text-sm font-semibold text-industrial-900 mb-4">下一班备注</h2>
              <textarea
                value={nextShiftRemarks}
                onChange={(e) => setNextShiftRemarks(e.target.value)}
                placeholder={report.nextShiftRemarks}
                className="w-full h-24 px-3 py-2 border border-industrial-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-industrial-200 p-6 shadow-industrial">
              <h2 className="text-sm font-semibold text-industrial-900 mb-4 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary-600" />
                待办事项
              </h2>
              <div className="space-y-3">
                {report.todoItems.length === 0 ? (
                  <p className="text-sm text-industrial-500">暂无待办事项</p>
                ) : (
                  report.todoItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-industrial-50 border border-industrial-200"
                    >
                      <div className="w-5 h-5 mt-0.5 border-2 border-industrial-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-mono font-bold text-industrial-500">
                          {index + 1}
                        </span>
                      </div>
                      <p className="text-sm text-industrial-700">{item}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-industrial-200 p-6 shadow-industrial">
              <h2 className="text-sm font-semibold text-industrial-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-600" />
                报告信息
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-industrial-500">报告编号</span>
                  <span className="font-mono text-industrial-900">{report.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-industrial-500">导出时间</span>
                  <span className="text-industrial-700">
                    {new Date(report.exportedAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-industrial-500">关联排程</span>
                  <span className="font-mono text-industrial-900">{schedule.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-industrial-500">材料批次</span>
                  <span className="font-mono text-industrial-900">
                    {schedule.materialBatchId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-industrial-500">材料类型</span>
                  <span className="text-industrial-700">{schedule.materialType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-industrial-500">追溯依据</span>
                  <span className="text-industrial-700">
                    {schedule.traceLinks.length} 条
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-industrial-500">警告数量</span>
                  <span className="text-industrial-700">
                    {schedule.warnings.length} 项
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    无需翻聊天记录
                  </p>
                  <p className="text-xs text-amber-700">
                    本报告包含所有必要信息，下一班次可直接查看，无需再翻阅历史聊天记录。
                    请确保下载报告并交接给下一班。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
