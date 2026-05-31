import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Sparkles, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import FileUpload from '@/components/FileUpload';
import FilterBar from '@/components/FilterBar';
import IssueCard from '@/components/IssueCard';
import ChangeCard from '@/components/ChangeCard';

export default function Workbench() {
  const {
    currentTask,
    runProofread,
    filters,
    setScreenRange,
    loadSampleData,
    tasks,
  } = useAppStore();

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tasks.length === 0) {
      loadSampleData();
    }
  }, [tasks.length, loadSampleData]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        setScreenRange({
          scrollTop,
          scrollHeight,
          visibleStart: scrollTop,
          visibleEnd: scrollTop + clientHeight,
          timestamp: Date.now(),
        });
      }
    };

    const container = containerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [setScreenRange]);

  const filteredChanges = currentTask?.changes.filter((change) => {
    if (filters.searchText && !change.description.includes(filters.searchText)) {
      return false;
    }
    if (filters.changeTypes.length > 0 && !filters.changeTypes.includes(change.type)) {
      return false;
    }
    if (filters.severities.length > 0 && !filters.severities.includes(change.severity)) {
      return false;
    }
    return true;
  }) || [];

  const filteredIssues = currentTask?.issues.filter((issue) => {
    if (filters.searchText && !issue.title.includes(filters.searchText)) {
      return false;
    }
    if (filters.resolvedStatus === 'pending' && issue.resolved) {
      return false;
    }
    if (filters.resolvedStatus === 'resolved' && !issue.resolved) {
      return false;
    }
    return true;
  }) || [];

  const isProcessing = currentTask?.status === 'processing';

  return (
    <div ref={containerRef} className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">校对工作台</h2>
            <p className="text-slate-500">上传素材，自动识别变更，生成人性化提示</p>
          </div>
          <button
            onClick={runProofread}
            disabled={isProcessing || !currentTask?.files.length}
            className="flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 text-white rounded-xl font-medium transition-all shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 disabled:shadow-none"
          >
            {isProcessing ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Play size={20} />
            )}
            {isProcessing ? '校对中...' : '开始校对'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {currentTask && currentTask.status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-4 gap-4"
            >
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500 mb-1">总变更</p>
                <p className="text-3xl font-bold text-slate-800">{currentTask.changes.length}</p>
              </div>
              <div className="bg-material-light rounded-xl border border-material/30 p-4">
                <p className="text-sm text-material-dark mb-1">补材料</p>
                <p className="text-3xl font-bold text-material-dark">
                  {currentTask.changes.filter((c) => c.type === 'material').length}
                </p>
              </div>
              <div className="bg-conclusion-light rounded-xl border border-conclusion/30 p-4">
                <p className="text-sm text-conclusion-dark mb-1">结论变更</p>
                <p className="text-3xl font-bold text-conclusion-dark">
                  {currentTask.changes.filter((c) => c.type === 'conclusion').length}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500 mb-1">待处理问题</p>
                <p className="text-3xl font-bold text-slate-800">
                  {currentTask.issues.filter((i) => !i.resolved).length}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <FileUpload />

        {currentTask && currentTask.status === 'completed' && (
          <>
            <FilterBar />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-amber-500" />
                <h3 className="text-lg font-semibold text-slate-800">发现的问题</h3>
                <span className="text-sm text-slate-500">({filteredIssues.length} 项)</span>
              </div>
              <div className="grid gap-4">
                {filteredIssues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800">变更记录</h3>
              <div className="grid gap-4">
                {filteredChanges.map((change) => (
                  <ChangeCard key={change.id} change={change} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
