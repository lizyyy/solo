import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye
} from 'lucide-react';
import { useAppStore } from '@/store';
import {
  generateReport,
  downloadReportPDF,
  downloadReportExcel,
  getReportSummary
} from '@/services/reportService';
import { checkExportConsistency } from '@/services/selfCheckService';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import MarkTable from '@/components/features/MarkTable';
import OriginalNoteDisplay from '@/components/ui/OriginalNoteDisplay';
import type { ReportData } from '@/types';

export default function ReportExport() {
  const currentTask = useAppStore((state) => state.getCurrentTask());
  const setIsLoading = useAppStore((state) => state.setIsLoading);
  const selectMark = useAppStore((state) => state.selectMark);
  const selectedMarkId = useAppStore((state) => state.selectedMarkId);
  const addSelfCheckReport = useAppStore((state) => state.addSelfCheckReport);

  const [includeRawData, setIncludeRawData] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');

  const handleGenerateReport = async () => {
    if (!currentTask) return;

    setIsLoading(true);

    try {
      const consistencyCheck = await checkExportConsistency(currentTask);
      addSelfCheckReport(currentTask.id, consistencyCheck);

      if (consistencyCheck.result === 'fail') {
        alert('导出一致性检查失败，请检查数据后重试');
        return;
      }

      const data = await generateReport(currentTask, includeRawData);
      setReportData(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (format: 'pdf' | 'excel') => {
    if (!reportData) return;

    setIsLoading(true);
    try {
      if (format === 'pdf') {
        await downloadReportPDF(reportData);
      } else {
        await downloadReportExcel(reportData);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentTask) {
    return (
      <div className="space-y-6">
        <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">报告导出</h1>
        <Card className="text-center py-12">
          <FileText size={64} className="mx-auto text-primary-500 mb-4" />
          <p className="text-primary-300 mb-6">请先选择或创建一个巡检任务</p>
          <Link to="/">
            <Button variant="primary">返回首页</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const summary = reportData ? getReportSummary(reportData) : getReportSummary({
    task: currentTask,
    marks: currentTask.marks,
    conflicts: currentTask.conflicts,
    abnormalities: currentTask.abnormalities,
    selfCheckReports: currentTask.selfCheckReports,
    includeRawData,
    generatedAt: new Date().toISOString()
  });

  const hasAllChecksPassed = currentTask.selfCheckReports
    .filter(r => ['duplicate_import', 'z_axis_check', 'recalculation', 'export_consistency'].includes(r.checkType))
    .every(r => r.result === 'pass');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">报告导出</h1>
          <p className="font-mono text-sm text-primary-400 mt-1">
            生成包含所有原始备注和复核记录的完整巡检报告
          </p>
        </div>
        <Badge variant="default">
          {currentTask.taskNo} - {currentTask.projectName}
        </Badge>
      </div>

      {!hasAllChecksPassed && (
        <div className="bg-accent-warning/10 border-2 border-accent-warning/30 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-accent-warning flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-accent-warning font-semibold mb-1">自检未全部通过</p>
              <p className="text-sm text-primary-300">
                建议先完成所有四大自检项并确保通过后再导出报告。
                <Link to="/self-check" className="text-primary-300 underline ml-1">前往自检中心</Link>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">巡检标记</p>
          <p className="font-mono text-2xl font-bold text-primary-200">{summary.totalMarks}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">障碍物</p>
          <p className="font-mono text-2xl font-bold text-accent-warning">{summary.obstacleCount}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">冲突记录</p>
          <p className={`font-mono text-2xl font-bold ${summary.pendingConflictCount > 0 ? 'text-accent-warning' : 'text-accent-success'}`}>
            {summary.conflictCount}
            {summary.pendingConflictCount > 0 && <span className="text-sm">({summary.pendingConflictCount}待处理)</span>}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono text-xs text-primary-400 mb-1">自检通过</p>
          <p className="font-mono text-2xl font-bold text-accent-success">{summary.checkPassCount}/{summary.checkTotalCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="报告选项">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="includeRawData"
                  checked={includeRawData}
                  onChange={(e) => setIncludeRawData(e.target.checked)}
                  className="w-5 h-5 accent-primary-500"
                />
                <label htmlFor="includeRawData" className="text-sm text-primary-200">
                  包含原始备注数据
                </label>
                <Badge variant="info" className="ml-2">推荐</Badge>
              </div>
              <p className="text-xs text-primary-400 ml-8">
                勾选后，报告将包含所有原始备注的完整内容，包括手写备注、照片记录、存疑备注等。
                楼层剖面草图的备注经常比正式表还重要，建议勾选保留。
              </p>
            </div>
          </Card>

          <Card title="报告内容概览">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-primary-800/30 border border-primary-700">
                <div className="flex items-center gap-3">
                  <FileCheck size={18} className="text-primary-400" />
                  <span className="text-primary-200">巡检标记数据</span>
                </div>
                <Badge variant="default">{summary.totalMarks} 条</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-primary-800/30 border border-primary-700">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-accent-warning" />
                  <span className="text-primary-200">冲突处理记录</span>
                </div>
                <Badge variant={summary.pendingConflictCount > 0 ? 'warning' : 'success'}>
                  {summary.conflictCount} 条
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-primary-800/30 border border-primary-700">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-accent-warning" />
                  <span className="text-primary-200">Z轴异常复核记录</span>
                </div>
                <Badge variant={summary.pendingAbnormalCount > 0 ? 'warning' : 'success'}>
                  {summary.abnormalCount} 条
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-primary-800/30 border border-primary-700">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-accent-success" />
                  <span className="text-primary-200">自检报告</span>
                </div>
                <Badge variant="default">{summary.checkTotalCount} 份</Badge>
              </div>
              {includeRawData && (
                <div className="flex items-center justify-between p-3 bg-accent-success/10 border border-accent-success/30">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-accent-success" />
                    <span className="text-primary-200">原始备注数据</span>
                  </div>
                  <Badge variant="success">已包含</Badge>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="导出格式">
            <div className="space-y-4">
              <div
                onClick={() => setExportFormat('pdf')}
                className={`p-4 border-2 cursor-pointer transition-all ${
                  exportFormat === 'pdf'
                    ? 'border-primary-400 bg-primary-700/30 shadow-glow'
                    : 'border-primary-700 hover:border-primary-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText size={24} className={exportFormat === 'pdf' ? 'text-primary-300' : 'text-primary-500'} />
                  <div>
                    <p className="font-mono text-sm font-semibold text-primary-200">PDF 格式</p>
                    <p className="text-xs text-primary-400">适合打印和存档</p>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setExportFormat('excel')}
                className={`p-4 border-2 cursor-pointer transition-all ${
                  exportFormat === 'excel'
                    ? 'border-primary-400 bg-primary-700/30 shadow-glow'
                    : 'border-primary-700 hover:border-primary-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={24} className={exportFormat === 'excel' ? 'text-primary-300' : 'text-primary-500'} />
                  <div>
                    <p className="font-mono text-sm font-semibold text-primary-200">Excel 格式</p>
                    <p className="text-xs text-primary-400">适合数据分析和处理</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="操作">
            <div className="space-y-3">
              <Button
                variant="secondary"
                className="w-full justify-center"
                onClick={handleGenerateReport}
                disabled={currentTask.marks.length === 0}
              >
                <Eye size={16} className="mr-2" />
                生成报告预览
              </Button>
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={() => handleDownload(exportFormat)}
                disabled={!reportData || currentTask.marks.length === 0}
              >
                <Download size={16} className="mr-2" />
                下载 {exportFormat.toUpperCase()} 报告
              </Button>
            </div>
            {!reportData && (
              <p className="text-xs text-primary-400 text-center mt-2">
                请先点击"生成报告预览"再下载
              </p>
            )}
          </Card>

          {currentTask.marks.length === 0 && (
            <Card className="text-center py-6">
              <FileText size={32} className="mx-auto text-primary-500 mb-2" />
              <p className="text-sm text-primary-300 mb-4">暂无数据可导出</p>
              <Link to="/import">
                <Button variant="primary" className="text-xs">
                  前往导入
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </div>

      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="报告预览"
        className="max-w-4xl"
      >
        {reportData && (
          <div className="space-y-6">
            <div className="text-center pb-4 border-b border-primary-600">
              <h3 className="font-mono text-xl font-bold text-primary-100">水下管线巡检标记报告</h3>
              <p className="font-mono text-sm text-primary-400 mt-1">
                {reportData.task.taskNo} - {reportData.task.projectName}
              </p>
              <p className="font-mono text-xs text-primary-500 mt-1">
                生成时间: {new Date(reportData.generatedAt).toLocaleString('zh-CN')}
              </p>
            </div>

            <div>
              <h4 className="font-mono text-sm font-semibold text-primary-300 mb-3">一、巡检标记数据</h4>
              <MarkTable
                marks={reportData.marks.slice(0, 5)}
                selectedMarkId={selectedMarkId}
                onSelectMark={selectMark}
                showNotes={false}
              />
              {reportData.marks.length > 5 && (
                <p className="text-sm text-primary-400 text-center mt-2">
                  还有 {reportData.marks.length - 5} 条记录未显示...
                </p>
              )}
            </div>

            {reportData.includeRawData && (
              <div>
                <h4 className="font-mono text-sm font-semibold text-primary-300 mb-3">二、原始备注示例</h4>
                {reportData.marks.filter(m => m.originalNotes.length > 0).slice(0, 3).map(mark => (
                  <div key={mark.id} className="mb-4">
                    <p className="font-mono text-xs text-primary-400 mb-1">标记 #{mark.sequenceNo}</p>
                    <OriginalNoteDisplay notes={mark.originalNotes} showSource={true} />
                  </div>
                ))}
              </div>
            )}

            <div className="text-center pt-4 border-t border-primary-600">
              <p className="text-sm text-primary-400">
                这是预览，完整报告请点击下载
              </p>
            </div>
          </div>
        )}
      </Modal>

      {reportData && (
        <div className="flex justify-between mt-6">
          <Button variant="secondary" onClick={() => setShowPreview(true)}>
            <Eye size={16} className="mr-2" />
            预览报告
          </Button>
          <Link to="/sample">
            <Button variant="secondary">
              查看样例演示 <ArrowRight size={16} className="ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
