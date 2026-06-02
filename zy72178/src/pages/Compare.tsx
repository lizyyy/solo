import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  GitBranch,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Check,
  X,
  AlertCircle,
  FileText,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { JudgmentBadge } from '../components/JudgmentBadge';
import { useCheckupStore } from '../store/checkupStore';
import { useSampleStore } from '../store/sampleStore';
import { useModelVersionStore } from '../store/modelVersionStore';
import { useAppStore } from '../store/appStore';
import { useNavigate } from 'react-router-dom';
import { compareRuns, getConflicts } from '../services/comparisonEngine';
import { generateComparisonReport } from '../services/reportGenerator';
import { downloadFile } from '../utils/export';
import { formatDateTime } from '../utils/date';
import { cn } from '../lib/utils';
import type { CheckupRun, SampleResult, ConflictItem } from '../types';

export default function Compare() {
  const navigate = useNavigate();
  const { runs, fetchRuns } = useCheckupStore();
  const { samples, fetchSamples } = useSampleStore();
  const { versions, fetchVersions } = useModelVersionStore();
  const { sidebarOpen } = useAppStore();
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchRuns(),
        fetchSamples(),
        fetchVersions(),
      ]);
    };
    init();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (selectedRunIds.length >= 2) {
        setLoadingComparison(true);
        try {
          const [compData, conflictData] = await Promise.all([
            compareRuns(selectedRunIds[0], selectedRunIds[1], runs),
            getConflicts(selectedRunIds[0], selectedRunIds[1]),
          ]);
          setComparison(compData);
          setConflicts(conflictData);
        } finally {
          setLoadingComparison(false);
        }
      } else {
        setComparison(null);
        setConflicts([]);
      }
    };
    loadData();
  }, [selectedRunIds, runs]);

  const toggleRunSelection = (runId: string) => {
    setSelectedRunIds(prev => {
      if (prev.includes(runId)) {
        return prev.filter(id => id !== runId);
      }
      if (prev.length >= 2) {
        return [prev[1], runId];
      }
      return [...prev, runId];
    });
  };

  const getChangeIcon = (change: number) => {
    if (change > 0.01) return <ArrowUp className="w-4 h-4 text-accent-emerald-600" />;
    if (change < -0.01) return <ArrowDown className="w-4 h-4 text-accent-rose-600" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getChangeClass = (change: number) => {
    if (change > 0.01) return 'text-accent-emerald-600 bg-accent-emerald-50';
    if (change < -0.01) return 'text-accent-rose-600 bg-accent-rose-50';
    return 'text-slate-600 bg-slate-50';
  };

  const handleExportReport = async () => {
    if (!comparison) return;
    const report = await generateComparisonReport(comparison, 'markdown');
    const run1 = runs.find(r => r.id === selectedRunIds[0]);
    const run2 = runs.find(r => r.id === selectedRunIds[1]);
    downloadFile(
      report,
      `对比报告_${run1?.version}_vs_${run2?.version}_${Date.now()}.md`,
      'text/markdown'
    );
  };

  const metricNames = [
    { key: 'accuracy', label: '准确率' },
    { key: 'precision', label: '精确率' },
    { key: 'recall', label: '召回率' },
    { key: 'f1', label: 'F1分数' },
  ];

  const barChartData = useMemo(() => {
    if (!comparison) return [];
    return metricNames.map(m => ({
      name: m.label,
      版本A: ((comparison.run1.metrics[m.key as keyof typeof comparison.run1.metrics] as number) * 100),
      版本B: ((comparison.run2.metrics[m.key as keyof typeof comparison.run2.metrics] as number) * 100),
    }));
  }, [comparison]);

  const selectedRuns = selectedRunIds.map(id => runs.find(r => r.id === id)).filter(Boolean) as CheckupRun[];

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className={cn(
        "transition-all duration-300 min-h-screen",
        sidebarOpen ? "ml-[260px]" : "ml-[72px]"
      )}>
        <Header
          title="版本对比"
          subtitle="对比不同模型版本的体检结果，发现指标变化和样本差异"
        />

        <main className="p-6">
          <div className="mb-4">
            <button
              onClick={() => navigate('/')}
              className="btn btn-secondary gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              返回总览
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="card p-6 mb-6">
              <h2 className="text-lg font-serif font-bold text-slate-800 mb-4">
                选择体检版本进行对比
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                请选择两个版本进行对比（当前已选择 {selectedRunIds.length}/2）
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {runs.map((run, idx) => {
                  const isSelected = selectedRunIds.includes(run.id);
                  const canSelect = selectedRunIds.length < 2 || isSelected;
                  return (
                    <button
                      key={run.id}
                      onClick={() => canSelect && toggleRunSelection(run.id)}
                      disabled={!canSelect}
                      className={cn(
                        "p-4 rounded-lg border text-left transition-all",
                        isSelected
                          ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200"
                          : canSelect
                          ? "border-slate-200 hover:border-primary-300 hover:bg-slate-50"
                          : "border-slate-200 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-primary-500" />
                          <span className="font-medium text-slate-800">{run.version}</span>
                        </div>
                        {isSelected && (
                          <span className="badge badge-primary text-xs">
                            已选 {selectedRunIds.indexOf(run.id) + 1}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-1">{run.batchName}</p>
                      <p className="text-xs text-slate-500 mt-1">{formatDateTime(run.startedAt)}</p>
                      <div className="flex items-center gap-1.5 mt-2 text-xs">
                        <span className="text-slate-500">准确率:</span>
                        <span className="font-medium text-slate-700">
                          {(run.metrics.accuracy * 100).toFixed(1)}%
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">
                          {run.metrics.totalCount} 条
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {comparison && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-serif font-bold text-slate-800">
                    对比结果
                  </h2>
                  <button
                    onClick={handleExportReport}
                    className="btn btn-primary gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    导出对比报告
                  </button>
                </div>

                <div className="card p-6 mb-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-primary-500" />
                        <span className="font-medium text-slate-800">
                          {comparison.run1.modelName} v{comparison.run1.version}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(comparison.run1.startedAt)}
                      </p>
                    </div>
                    <div className="px-3 py-1 bg-slate-100 rounded-full">
                      <span className="text-sm font-medium text-slate-600">VS</span>
                    </div>
                    <div className="flex-1 text-right">
                      <div className="flex items-center gap-2 justify-end mb-1">
                        <span className="font-medium text-slate-800">
                          {comparison.run2.modelName} v{comparison.run2.version}
                        </span>
                        <span className="w-3 h-3 rounded-full bg-accent-amber-500" />
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(comparison.run2.startedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                            指标
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                            版本 A
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                            版本 B
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                            变化
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {metricNames.map((m, idx) => {
                          const v1 = comparison.run1.metrics[m.key as keyof typeof comparison.run1.metrics] as number;
                          const v2 = comparison.run2.metrics[m.key as keyof typeof comparison.run2.metrics] as number;
                          const change = comparison.metricChanges[m.key as keyof typeof comparison.metricChanges] as number;
                          return (
                            <tr key={m.key} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                {m.label}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-700 font-mono">
                                {(v1 * 100).toFixed(2)}%
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-700 font-mono">
                                {(v2 * 100).toFixed(2)}%
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                  getChangeClass(change)
                                )}>
                                  {getChangeIcon(change)}
                                  {(change * 100).toFixed(2)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">
                            样本数量
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-700 font-mono">
                            {comparison.run1.metrics.totalCount}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-700 font-mono">
                            {comparison.run2.metrics.totalCount}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600">
                            {comparison.run2.metrics.totalCount - comparison.run1.metrics.totalCount > 0 ? '+' : ''}
                            {comparison.run2.metrics.totalCount - comparison.run1.metrics.totalCount}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card p-6 mb-6">
                  <h3 className="text-base font-serif font-bold text-slate-800 mb-4">
                    指标对比图
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                        <YAxis stroke="#64748B" fontSize={12} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #E2E8F0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => `${value.toFixed(2)}%`}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="版本A" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="版本B" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-serif font-bold text-slate-800">
                      样本差异
                    </h3>
                    <button
                      onClick={() => setShowConflicts(!showConflicts)}
                      className="btn btn-secondary gap-2 text-sm"
                    >
                      {showConflicts ? '隐藏' : '查看'} {conflicts.length} 处差异
                    </button>
                  </div>

                  {showConflicts && (
                    <div className="space-y-3">
                      {conflicts.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                          <Check className="w-12 h-12 mx-auto mb-3 text-accent-emerald-400" />
                          <p>两个版本的样本判定完全一致</p>
                        </div>
                      ) : (
                        conflicts.map((conflict, idx) => {
                          const sample = samples.find(s => s.id === conflict.sampleId);
                          return (
                            <motion.div
                              key={conflict.sampleId}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.02 }}
                              className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50/50"
                            >
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <p className="text-sm font-medium text-slate-800 flex-1">
                                  {sample?.question || '未知问题'}
                                </p>
                                <span className="badge badge-amber text-xs flex-shrink-0">
                                  {conflict.type}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 mt-3">
                                <div className="bg-primary-50 rounded p-2">
                                  <p className="text-xs text-primary-600 mb-1">版本 A</p>
                                  <JudgmentBadge judgment={conflict.judgment1 as any} size="sm" />
                                  {conflict.confidence1 !== undefined && (
                                    <p className="text-xs text-slate-500 mt-1">
                                      置信度: {(conflict.confidence1 * 100).toFixed(1)}%
                                    </p>
                                  )}
                                </div>
                                <div className="bg-accent-amber-50 rounded p-2">
                                  <p className="text-xs text-accent-amber-600 mb-1">版本 B</p>
                                  <JudgmentBadge judgment={conflict.judgment2 as any} size="sm" />
                                  {conflict.confidence2 !== undefined && (
                                    <p className="text-xs text-slate-500 mt-1">
                                      置信度: {(conflict.confidence2 * 100).toFixed(1)}%
                                    </p>
                                  )}
                                </div>
                              </div>
                              {conflict.description && (
                                <p className="text-xs text-slate-500 mt-2">
                                  {conflict.description}
                                </p>
                              )}
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {!comparison && (
              <div className="card p-12 text-center">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">
                  请选择两个版本进行对比
                </h3>
                <p className="text-sm text-slate-500">
                  点击上方卡片选择两个体检版本，即可查看详细对比结果
                </p>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
