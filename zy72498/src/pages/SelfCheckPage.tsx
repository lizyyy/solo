import { useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Copy,
  FileJson
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { SelfCheckReport } from '@/types';
import { downloadJSON } from '@/utils/common';

const CHECK_ITEMS = [
  {
    key: 'duplicateImport',
    title: '重复导入检测',
    description: '检查是否有重复导入的照片和公交数据',
    icon: Copy
  },
  {
    key: 'communityName',
    title: '小区新旧名称检测',
    description: '通过文本相似度检测疑似同一小区的新旧名称',
    icon: FileJson
  },
  {
    key: 'recalculate',
    title: '补录后重算校验',
    description: '检查补录数据后汇总结果是否发生预期变化',
    icon: RefreshCw
  },
  {
    key: 'exportConsistency',
    title: '导出一致性校验',
    description: '验证数据导出再导入后是否保持一致',
    icon: FileJson
  }
] as const;

export default function SelfCheckPage() {
  const { selfCheckReports, runSelfCheck, currentUser } = useAppStore();
  const [isRunning, setIsRunning] = useState(false);
  const [latestReport, setLatestReport] = useState<SelfCheckReport | null>(
    selfCheckReports[selfCheckReports.length - 1] || null
  );

  const handleRunCheck = async () => {
    setIsRunning(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    const report = runSelfCheck();
    setLatestReport(report);
    setIsRunning(false);
  };

  const handleExportReport = () => {
    if (latestReport) {
      downloadJSON(latestReport, `自检报告_${latestReport.runTime.replace(/[:\s]/g, '-')}.json`);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">自检中心</h2>
          <p className="text-slate-500 mt-1">运行四项核心自检，确保数据质量和一致性</p>
        </div>
        <div className="flex gap-3">
          {latestReport && (
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              <FileJson size={18} />
              导出报告
            </button>
          )}
          <button
            onClick={handleRunCheck}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Play size={18} />
            )}
            {isRunning ? '运行中...' : '运行自检'}
          </button>
        </div>
      </div>

      {latestReport && (
        <div className={`mb-6 p-4 rounded-lg ${
          latestReport.overallPassed
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-amber-50 border border-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            {latestReport.overallPassed ? (
              <CheckCircle size={24} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={24} className="text-amber-600" />
            )}
            <div>
              <div className={`font-medium ${
                latestReport.overallPassed ? 'text-emerald-800' : 'text-amber-800'
              }`}>
                {latestReport.overallPassed ? '所有自检项目通过' : '部分自检项目发现问题'}
              </div>
              <div className={`text-sm ${
                latestReport.overallPassed ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                运行时间：{latestReport.runTime} | 操作人：{currentUser}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        {CHECK_ITEMS.map((item) => {
          const result = latestReport?.items[item.key];
          const passed = result?.passed ?? null;
          const issueCount = result?.issues.length ?? 0;
          const Icon = item.icon;

          return (
            <div
              key={item.key}
              className={`bg-white rounded-lg border p-5 transition-all ${
                passed === true
                  ? 'border-emerald-200'
                  : passed === false
                  ? 'border-amber-300 bg-amber-50/30'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      passed === true
                        ? 'bg-emerald-100 text-emerald-600'
                        : passed === false
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-800">{item.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                  </div>
                </div>
                <div>
                  {passed === true ? (
                    <span className="flex items-center gap-1 text-sm text-emerald-600">
                      <CheckCircle size={16} />
                      通过
                    </span>
                  ) : passed === false ? (
                    <span className="flex items-center gap-1 text-sm text-amber-600">
                      <AlertTriangle size={16} />
                      {issueCount} 个问题
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">未运行</span>
                  )}
                </div>
              </div>

              {result && result.issues.length > 0 && (
                <div className="mt-4 space-y-2">
                  {result.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-amber-50 border border-amber-200 rounded-lg"
                    >
                      <div className="flex items-start gap-2">
                        <XCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-amber-800">
                          {issue.description}
                          {'similarity' in issue && issue.similarity > 0 && (
                            <span className="block text-xs text-amber-600 mt-1">
                              相似度：{(issue.similarity * 100).toFixed(1)}%
                            </span>
                          )}
                          {'oldValue' in issue && (
                            <span className="block text-xs text-amber-600 mt-1">
                              {issue.field}: {issue.oldValue} → {issue.newValue}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selfCheckReports.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-medium text-slate-800">历史自检记录</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {selfCheckReports.slice().reverse().slice(0, 10).map((report) => (
              <div
                key={report.id}
                className="p-4 flex items-center justify-between hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  {report.overallPassed ? (
                    <CheckCircle size={18} className="text-emerald-500" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-500" />
                  )}
                  <div>
                    <div className="text-sm text-slate-800">
                      {report.overallPassed ? '全部通过' : '存在问题'}
                    </div>
                    <div className="text-xs text-slate-500">{report.runTime}</div>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>重复导入: {report.items.duplicateImport.issues.length}</span>
                  <span>名称问题: {report.items.communityName.issues.length}</span>
                  <span>重算问题: {report.items.recalculate.issues.length}</span>
                  <span>导出问题: {report.items.exportConsistency.issues.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!latestReport && selfCheckReports.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <ClipboardCheck size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600 text-lg">还没有运行过自检</p>
          <p className="text-slate-400 text-sm mt-2">点击「运行自检」按钮开始四项数据质量检查</p>
        </div>
      )}
    </div>
  );
}
