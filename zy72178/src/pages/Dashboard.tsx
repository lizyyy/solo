import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  Crosshair,
  Search,
  Gauge,
  AlertTriangle,
  FileText,
  BarChart3,
  Users,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { MetricCard } from '../components/MetricCard';
import { Timeline } from '../components/Timeline';
import { useCheckupStore } from '../store/checkupStore';
import { useSampleStore } from '../store/sampleStore';
import { useModelVersionStore } from '../store/modelVersionStore';
import { useAppStore } from '../store/appStore';
import { getMetricsTrend } from '../services/comparisonEngine';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

interface TrendData {
  name: string;
  准确率: number;
  精确率: number;
  召回率: number;
  F1分数: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { runs, currentRun, fetchRuns, loadRun } = useCheckupStore();
  const { samples, fetchSamples, selectedSampleIds, selectAllSamples } = useSampleStore();
  const { versions, fetchVersions, activeVersionId } = useModelVersionStore();
  const { sidebarOpen, isLoading } = useAppStore();
  const [trendData, setTrendData] = useState<TrendData[]>([]);

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
    const loadTrend = async () => {
      const trend = await getMetricsTrend(5);
      const data: TrendData[] = trend.runs.map((run, idx) => ({
        name: run.version,
        准确率: trend.metrics[0].values[idx] * 100,
        精确率: trend.metrics[1].values[idx] * 100,
        召回率: trend.metrics[2].values[idx] * 100,
        F1分数: trend.metrics[3].values[idx] * 100,
      }));
      setTrendData(data);
    };
    if (runs.length > 0) {
      loadTrend();
    }
  }, [runs]);

  useEffect(() => {
    if (runs.length > 0 && !currentRun) {
      loadRun(runs[0].id);
    }
  }, [runs, currentRun, loadRun]);

  const getChangeValue = (key: keyof typeof currentRun.metrics) => {
    if (runs.length < 2) return undefined;
    const currentIdx = runs.findIndex(r => r.id === currentRun?.id);
    if (currentIdx === -1 || currentIdx >= runs.length - 1) return undefined;
    const current = currentRun?.metrics[key] as number;
    const previous = runs[currentIdx + 1].metrics[key] as number;
    return current - previous;
  };

  const quickActions = [
    {
      icon: FileText,
      label: '上传样本',
      description: '导入JSONL格式的样本数据',
      onClick: () => navigate('/samples'),
      color: 'primary' as const,
    },
    {
      icon: Target,
      label: '运行体检',
      description: selectedSampleIds.length > 0
        ? `对 ${selectedSampleIds.length} 条样本运行体检`
        : '先选择样本再运行',
      onClick: () => {
        if (selectedSampleIds.length === 0) {
          navigate('/samples');
        }
      },
      color: 'emerald' as const,
      disabled: selectedSampleIds.length === 0 || !activeVersionId,
    },
    {
      icon: BarChart3,
      label: '版本对比',
      description: '对比多个版本的指标差异',
      onClick: () => navigate('/compare'),
      color: 'amber' as const,
    },
    {
      icon: AlertTriangle,
      label: '冲突清单',
      description: currentRun?.metrics.conflictCount
        ? `${currentRun.metrics.conflictCount} 处待处理冲突`
        : '查看所有人工改判记录',
      onClick: () => navigate('/conflicts'),
      color: 'rose' as const,
      highlight: currentRun && currentRun.metrics.conflictCount > 0,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className={cn(
        "transition-all duration-300 min-h-screen",
        sidebarOpen ? "ml-[260px]" : "ml-[72px]"
      )}>
        <Header
          title="RAG知识库引用体检"
          subtitle="版本化的引用质量评估，让每一次判断都有迹可循"
        />

        <main className="p-6">
          {currentRun && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="准确率"
                  value={currentRun.metrics.accuracy}
                  change={getChangeValue('accuracy')}
                  icon={<Target className="w-6 h-6" />}
                  color="primary"
                  delay={0}
                />
                <MetricCard
                  title="精确率"
                  value={currentRun.metrics.precision}
                  change={getChangeValue('precision')}
                  icon={<Crosshair className="w-6 h-6" />}
                  color="emerald"
                  delay={0.1}
                />
                <MetricCard
                  title="召回率"
                  value={currentRun.metrics.recall}
                  change={getChangeValue('recall')}
                  icon={<Search className="w-6 h-6" />}
                  color="amber"
                  delay={0.2}
                />
                <MetricCard
                  title="F1分数"
                  value={currentRun.metrics.f1}
                  change={getChangeValue('f1')}
                  icon={<Gauge className="w-6 h-6" />}
                  color="slate"
                  delay={0.3}
                />
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="lg:col-span-2"
            >
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-serif font-bold text-slate-800">
                    指标趋势
                  </h2>
                  <span className="text-xs text-slate-500">最近5个版本</span>
                </div>
                {trendData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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
                          formatter={(value: number) => `${value.toFixed(1)}%`}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Line
                          type="monotone"
                          dataKey="准确率"
                          stroke="#1E3A5F"
                          strokeWidth={2.5}
                          dot={{ fill: '#1E3A5F', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="精确率"
                          stroke="#10B981"
                          strokeWidth={2}
                          dot={{ fill: '#10B981', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="召回率"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          dot={{ fill: '#F59E0B', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="F1分数"
                          stroke="#64748B"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ fill: '#64748B', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    暂无足够数据展示趋势图
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="card p-6 h-full">
                <h2 className="text-lg font-serif font-bold text-slate-800 mb-4">
                  快速操作
                </h2>
                <div className="space-y-3">
                  {quickActions.map((action, idx) => {
                    const Icon = action.icon;
                    const colorClasses = {
                      primary: 'bg-primary-100 text-primary-600',
                      emerald: 'bg-accent-emerald-100 text-accent-emerald-600',
                      amber: 'bg-accent-amber-100 text-accent-amber-600',
                      rose: 'bg-accent-rose-100 text-accent-rose-600',
                    };
                    return (
                      <button
                        key={idx}
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className={cn(
                          "w-full p-4 rounded-lg border text-left transition-all duration-200",
                          "flex items-start gap-3",
                          action.highlight
                            ? "border-accent-rose-300 bg-accent-rose-50 hover:bg-accent-rose-100"
                            : "border-slate-200 hover:border-primary-200 hover:bg-primary-50/50",
                          action.disabled && "opacity-50 cursor-not-allowed hover:bg-white"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          colorClasses[action.color]
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800">{action.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {action.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-slate-800">{samples.length}</p>
                      <p className="text-xs text-slate-500 mt-0.5">样本总数</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-slate-800">{runs.length}</p>
                      <p className="text-xs text-slate-500 mt-0.5">体检次数</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-slate-800">{versions.length}</p>
                      <p className="text-xs text-slate-500 mt-0.5">模型版本</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-slate-800">
                        {currentRun?.metrics.conflictCount || 0}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">待处理冲突</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6"
          >
            <div className="card p-6">
              <h2 className="text-lg font-serif font-bold text-slate-800 mb-4">
                体检历史
              </h2>
              <Timeline
                runs={runs}
                activeRunId={currentRun?.id}
                onSelect={(run) => loadRun(run.id)}
              />
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
