import { useState } from 'react';
import { usePipelineStore } from '@/store/pipelineStore';
import type { SelfCheckReport, SelfCheckIssue } from '@/types';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const CHECK_CONFIG = [
  { key: 'duplicateImport', label: '重复导入检测', icon: ShieldCheck },
  { key: 'coordinateMixed', label: '坐标混合检测', icon: ShieldCheck },
  { key: 'supplementaryRecalc', label: '补录后重算检测', icon: ShieldCheck },
  { key: 'exportConsistency', label: '导出一致性检查', icon: ShieldCheck },
] as const;

export default function SelfCheckPage() {
  const { selfCheckReports, runSelfCheck } = usePipelineStore();
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);

  const latestReport = selfCheckReports[selfCheckReports.length - 1];
  const historyReports = selfCheckReports.slice(0, -1).reverse();

  const handleRunCheck = () => {
    runSelfCheck();
  };

  const getAllIssues = (report: SelfCheckReport): (SelfCheckIssue & { checkType: string })[] => {
    const issues: (SelfCheckIssue & { checkType: string })[] = [];
    Object.entries(report.checks).forEach(([key, check]) => {
      check.issues.forEach((issue) => {
        issues.push({ ...issue, checkType: key });
      });
    });
    return issues;
  };

  const getCheckLabel = (key: string) => {
    return CHECK_CONFIG.find((c) => c.key === key)?.label || key;
  };

  const getNavigatePath = (issue: SelfCheckIssue & { checkType?: string }, checkType?: string) => {
    const ct = checkType || (issue as SelfCheckIssue & { checkType?: string }).checkType;
    const rid = issue.recordId;
    const { records } = usePipelineStore.getState();
    const record = records.find((r) => r.id === rid);
    if (ct === 'coordinateMixed' || record?.isCoordinateMixed || record?.status === 'pending_review') {
      return '/coordinates';
    }
    if (ct === 'duplicateImport') {
      if (!record?.cadLayer) return '/cad';
      return '/conflicts';
    }
    if (!record?.cadLayer) return '/cad';
    return '/instructions';
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-primary-800">自检中心</h1>
          <p className="text-sm text-industrial-gray mt-1">
            四项核心自检：重复导入、坐标混合、补录重算、导出一致
          </p>
        </div>
        <button onClick={handleRunCheck} className="btn-primary inline-flex items-center gap-2">
          <Play className="w-4 h-4" />
          执行自检
        </button>
      </div>

      {!latestReport && (
        <div className="card text-center py-16">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">暂无自检记录</p>
          <p className="text-sm text-gray-400 mt-1">点击上方"执行自检"按钮开始检测</p>
        </div>
      )}

      {latestReport && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {CHECK_CONFIG.map(({ key, label }) => {
              const check = latestReport.checks[key as keyof typeof latestReport.checks];
              return (
                <div
                  key={key}
                  className={cn(
                    'card p-4 cursor-pointer transition-all hover:shadow-md',
                    selectedCheck === key && 'ring-2 ring-primary-500'
                  )}
                  onClick={() => setSelectedCheck(selectedCheck === key ? null : key)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 font-display">{label}</span>
                    {check.passed ? (
                      <CheckCircle className="w-5 h-5 text-industrial-green" />
                    ) : (
                      <XCircle className="w-5 h-5 text-industrial-red" />
                    )}
                  </div>
                  <div className="text-3xl font-bold font-mono-data">
                    <span className={check.passed ? 'text-industrial-green' : 'text-industrial-red'}>
                      {check.issues.length}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {check.passed ? '无问题' : `发现 ${check.issues.length} 个问题`}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-gray-800">
                整体评估
              </h2>
              <span className={cn(
                'status-tag text-sm px-3 py-1',
                latestReport.overallPassed
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              )}>
                {latestReport.overallPassed ? '全部通过' : '存在问题'}
              </span>
            </div>
            <div className="text-sm text-gray-500 font-mono-data">
              检测时间: {new Date(latestReport.timestamp).toLocaleString('zh-CN')}
            </div>
          </div>

          {selectedCheck && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="font-display font-semibold text-gray-800">
                  {getCheckLabel(selectedCheck)} - 问题详情
                </h3>
                <button
                  onClick={() => setSelectedCheck(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {latestReport.checks[selectedCheck as keyof typeof latestReport.checks].issues
                  .length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-300" />
                    无问题
                  </div>
                ) : (
                  latestReport.checks[selectedCheck as keyof typeof latestReport.checks].issues
                    .map((issue, idx) => (
                      <div key={idx} className="p-4 flex items-start justify-between hover:bg-gray-50">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono-data text-sm text-primary-800">
                              {issue.photoNumber}
                            </span>
                            {issue.count && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                重复 {issue.count} 次
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{issue.detail}</p>
                        </div>
                        <Link
                          to={getNavigatePath(issue, selectedCheck)}
                          className="text-primary-600 hover:text-primary-800 inline-flex items-center gap-1 text-sm"
                        >
                          定位 <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {!selectedCheck && getAllIssues(latestReport).length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-display font-semibold text-gray-800">
                  全部问题 ({getAllIssues(latestReport).length})
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {getAllIssues(latestReport).map((issue, idx) => (
                  <div key={idx} className="p-4 flex items-start justify-between hover:bg-gray-50">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-display">
                          {getCheckLabel(issue.checkType)}
                        </span>
                        <span className="font-mono-data text-sm text-primary-800">
                          {issue.photoNumber}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{issue.detail}</p>
                    </div>
                    <Link
                      to={getNavigatePath(issue)}
                      className="text-primary-600 hover:text-primary-800 inline-flex items-center gap-1 text-sm"
                    >
                      定位 <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {historyReports.length > 0 && (
            <div>
              <button
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-3 transition-colors"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                历史自检记录 ({historyReports.length})
              </button>
              {showHistory && (
                <div className="space-y-2">
                  {historyReports.map((report) => (
                    <div key={report.id} className="card p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 font-mono-data">
                          {new Date(report.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <span className={cn(
                        'status-tag',
                        report.overallPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      )}>
                        {report.overallPassed ? '通过' : `${getAllIssues(report).length} 个问题`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
