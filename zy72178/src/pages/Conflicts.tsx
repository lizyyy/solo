import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  AlertTriangle,
  Filter,
  Search,
  Edit3,
  Clock,
  User,
  Check,
  AlertCircle,
  GitBranch,
} from 'lucide-react';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { JudgmentBadge } from '../components/JudgmentBadge';
import { useCheckupStore } from '../store/checkupStore';
import { useSampleStore } from '../store/sampleStore';
import { useAppStore } from '../store/appStore';
import { useNavigate } from 'react-router-dom';
import { getAllConflicts } from '../services/comparisonEngine';
import { formatDateTime } from '../utils/date';
import { cn } from '../lib/utils';
import type { ConflictItem } from '../types';

export default function Conflicts() {
  const navigate = useNavigate();
  const { runs, fetchRuns, currentRun, loadRun } = useCheckupStore();
  const { samples, fetchSamples } = useSampleStore();
  const { sidebarOpen } = useAppStore();
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyShowUnresolved, setOnlyShowUnresolved] = useState(false);

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchRuns(),
        fetchSamples(),
      ]);
    };
    init();
  }, []);

  useEffect(() => {
    const loadConflicts = async () => {
      setLoading(true);
      try {
        const data = await getAllConflicts();
        setConflicts(data);
      } finally {
        setLoading(false);
      }
    };
    if (runs.length >= 2) {
      loadConflicts();
    }
  }, [runs]);

  const filteredConflicts = useMemo(() => {
    return conflicts.filter(c => {
      const sample = samples.find(s => s.id === c.sampleId);
      const matchesType = filterType === 'all' || c.type === filterType;
      const matchesSearch = !sample || sample.question.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUnresolved = !onlyShowUnresolved || !c.resolved;
      return matchesType && matchesSearch && matchesUnresolved;
    });
  }, [conflicts, filterType, searchQuery, onlyShowUnresolved, samples]);

  const conflictTypes = Array.from(new Set(conflicts.map(c => c.type)));

  const stats = useMemo(() => ({
    total: conflicts.length,
    unresolved: conflicts.filter(c => !c.resolved).length,
    judgmentChange: conflicts.filter(c => c.type === 'judgment_change').length,
    newSample: conflicts.filter(c => c.type === 'new_sample').length,
  }), [conflicts]);

  if (runs.length < 2) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <div className={cn(
          "transition-all duration-300 min-h-screen",
          sidebarOpen ? "ml-[260px]" : "ml-[72px]"
        )}>
          <Header
            title="冲突清单"
            subtitle="查看所有人工改判和版本间的判定差异"
          />
          <main className="p-6">
            <div className="card p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">
                至少需要两次体检记录
              </h3>
              <p className="text-sm text-slate-500">
                请先运行至少两次体检，以便生成冲突对比清单
              </p>
              <button
                onClick={() => navigate('/')}
                className="btn btn-primary gap-2 mt-4"
              >
                返回总览
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className={cn(
        "transition-all duration-300 min-h-screen",
        sidebarOpen ? "ml-[260px]" : "ml-[72px]"
      )}>
        <Header
          title="冲突清单"
          subtitle="查看所有人工改判和版本间的判定差异"
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500">冲突总数</span>
                  <AlertTriangle className="w-5 h-5 text-accent-amber-500" />
                </div>
                <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500">待处理</span>
                  <AlertCircle className="w-5 h-5 text-accent-rose-500" />
                </div>
                <p className="text-3xl font-bold text-slate-800">{stats.unresolved}</p>
              </div>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500">判定变化</span>
                  <GitBranch className="w-5 h-5 text-primary-500" />
                </div>
                <p className="text-3xl font-bold text-slate-800">{stats.judgmentChange}</p>
              </div>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500">新增样本</span>
                  <Check className="w-5 h-5 text-accent-emerald-500" />
                </div>
                <p className="text-3xl font-bold text-slate-800">{stats.newSample}</p>
              </div>
            </div>

            <div className="card p-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-64 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    className="input pl-10"
                    placeholder="搜索问题..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    className="input w-40"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="all">全部类型</option>
                    {conflictTypes.map(t => (
                      <option key={t} value={t}>
                        {t === 'judgment_change' ? '判定变化' : t === 'new_sample' ? '新增样本' : t}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyShowUnresolved}
                    onChange={(e) => setOnlyShowUnresolved(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-600">仅显示待处理</span>
                </label>
              </div>
            </div>

            <div className="card overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-slate-500">
                  <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3" />
                  加载冲突清单中...
                </div>
              ) : filteredConflicts.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Check className="w-12 h-12 mx-auto mb-3 text-accent-emerald-400" />
                  <p>暂无匹配的冲突记录</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredConflicts.map((conflict, idx) => {
                    const sample = samples.find(s => s.id === conflict.sampleId);
                    const run1 = runs.find(r => r.id === conflict.runId1);
                    const run2 = runs.find(r => r.id === conflict.runId2);

                    return (
                      <motion.div
                        key={`${conflict.runId1}-${conflict.runId2}-${conflict.sampleId}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="p-4 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn(
                                "badge text-xs",
                                conflict.type === 'judgment_change' ? 'badge-amber' :
                                conflict.type === 'new_sample' ? 'badge-emerald' : 'badge-primary'
                              )}>
                                {conflict.type === 'judgment_change' ? '判定变化' :
                                 conflict.type === 'new_sample' ? '新增样本' : conflict.type}
                              </span>
                              {conflict.resolved ? (
                                <span className="badge badge-emerald text-xs">已处理</span>
                              ) : (
                                <span className="badge badge-rose text-xs">待处理</span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-slate-800 line-clamp-2">
                              {sample?.question || '未知问题'}
                            </p>
                            {conflict.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                {conflict.description}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {run1 && run2 && (
                              <div className="text-xs text-slate-500">
                                <p>v{run1.version} → v{run2.version}</p>
                                <p className="text-slate-400">{formatDateTime(run2.startedAt)}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {conflict.type === 'judgment_change' && (
                          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-3">
                            <div>
                              <p className="text-xs text-slate-500 mb-1">版本 {run1?.version}</p>
                              <JudgmentBadge judgment={conflict.judgment1 as any} size="sm" />
                              {conflict.confidence1 !== undefined && (
                                <p className="text-xs text-slate-500 mt-1">
                                  置信度: {(conflict.confidence1 * 100).toFixed(1)}%
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">版本 {run2?.version}</p>
                              <JudgmentBadge judgment={conflict.judgment2 as any} size="sm" />
                              {conflict.confidence2 !== undefined && (
                                <p className="text-xs text-slate-500 mt-1">
                                  置信度: {(conflict.confidence2 * 100).toFixed(1)}%
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {conflict.resolved && conflict.resolvedBy && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                            <User className="w-3.5 h-3.5" />
                            {conflict.resolvedBy} 于 {formatDateTime(conflict.resolvedAt!)} 处理
                            {conflict.resolvedNote && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="text-slate-600">{conflict.resolvedNote}</span>
                              </>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => {
                              if (run2?.id) {
                                loadRun(run2.id);
                                navigate(`/checkup/${run2.id}`);
                              }
                            }}
                            className="btn btn-secondary gap-1 text-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            查看详情
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
