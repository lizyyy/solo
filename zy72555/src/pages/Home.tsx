import { useAppStore } from '@/store/useAppStore';
import { StepIndicator } from '@/components/StepIndicator';
import { StatusBadge } from '@/components/StatusBadge';
import type { WorkflowStep } from '@/types';
import { FileInput, BookOpen, RefreshCw, AlertTriangle, CheckCircle, ArrowRight, FileText, BookMarked, History, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const navigate = useNavigate();
  const { workflowStep, setWorkflowStep, trainingLogs, thresholdNotes } = useAppStore();

  const boundaryLogs = trainingLogs.filter((l) => l.isBoundaryCase);
  const pendingLogs = trainingLogs.filter((l) => l.status === 'pending');
  const reviewingLogs = trainingLogs.filter((l) => l.status === 'reviewing');
  const lateNotes = thresholdNotes.filter((n) => n.isLateArrival);

  const stepActions: Record<WorkflowStep, { title: string; description: string; action: () => void; actionLabel: string; Icon: any }> = {
    import: {
      title: '训练日志曲线第一次导入',
      description: '导入强化学习仓储调度的训练日志，系统自动记录原始行号、去重校验，并触发边界规则检测。',
      action: () => navigate('/training-logs'),
      actionLabel: '去导入训练日志',
      Icon: FileInput,
    },
    review: {
      title: '评测运营小孟补看阈值调参笔记',
      description: '阈值调参笔记可能晚到，补录时只刷新关联明细，不覆盖已确认内容。少数类样本异常自动拦截。',
      action: () => navigate('/threshold-notes'),
      actionLabel: '去管理阈值笔记',
      Icon: BookOpen,
    },
    replay: {
      title: '阈值回放更新',
      description: '算法工程师复核边界案例后，执行阈值回放更新。所有操作留痕，支持回滚。',
      action: () => navigate('/training-logs'),
      actionLabel: '去复核并更新',
      Icon: RefreshCw,
    },
  };

  const currentAction = stepActions[workflowStep];
  const CurrentIcon = currentAction.Icon;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">强化学习仓储调度</h1>
        <p className="text-slate-400 mt-2">评测追踪系统 · 证据链完整 · 边界规则明确 · 变更可回溯</p>
      </div>

      <div className="py-6">
        <StepIndicator currentStep={workflowStep} onStepClick={setWorkflowStep} />
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-600/20 rounded-xl">
            <CurrentIcon size={28} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white">{currentAction.title}</h2>
            <p className="text-slate-400 mt-2">{currentAction.description}</p>
            <button
              onClick={currentAction.action}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              {currentAction.actionLabel}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700/50 rounded-lg">
              <FileText size={18} className="text-slate-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{trainingLogs.length}</div>
              <div className="text-xs text-slate-400">训练日志总数</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg border border-amber-700/50 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-900/30 rounded-lg">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">{boundaryLogs.length}</div>
              <div className="text-xs text-slate-400">边界案例待复核</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700/50 rounded-lg">
              <BookMarked size={18} className="text-slate-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{lateNotes.length}</div>
              <div className="text-xs text-slate-400">晚到材料笔记</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg border border-emerald-700/50 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-900/30 rounded-lg">
              <CheckCircle size={18} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">
                {trainingLogs.filter((l) => l.status === 'confirmed').length}
              </div>
              <div className="text-xs text-slate-400">已确认日志</div>
            </div>
          </div>
        </div>
      </div>

      {boundaryLogs.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-300">
                有 {boundaryLogs.length} 条边界案例等待算法工程师复核
              </h3>
              <p className="text-xs text-amber-200/80 mt-1">
                这些训练日志触发了"少数类样本被总指标盖住"规则，不急着归为正常，请人工复核后再确认。
              </p>
              <div className="mt-3 space-y-2">
                {boundaryLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-sm">
                    <code className="text-xs font-mono text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">
                      L{log.originalLineNumber}
                    </code>
                    <span className="text-slate-300">Epoch {log.epoch}</span>
                    <span className="text-slate-500">总指标 {(log.overallMetric * 100).toFixed(1)}%</span>
                    <span className="text-red-400">少数类 {(log.minorityMetric * 100).toFixed(1)}%</span>
                    <StatusBadge status={log.status} isBoundaryCase={log.isBoundaryCase} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/training-logs')}
          className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800 transition-all text-left group"
        >
          <FileText size={20} className="text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-medium text-white">训练日志管理</div>
          <div className="text-xs text-slate-500 mt-1">导入、查看、复核</div>
        </button>
        <button
          onClick={() => navigate('/threshold-notes')}
          className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-amber-500/50 hover:bg-slate-800 transition-all text-left group"
        >
          <BookOpen size={20} className="text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-medium text-white">阈值调参笔记</div>
          <div className="text-xs text-slate-500 mt-1">晚到材料补录</div>
        </button>
        <button
          onClick={() => navigate('/change-history')}
          className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-purple-500/50 hover:bg-slate-800 transition-all text-left group"
        >
          <History size={20} className="text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-medium text-white">变更历史</div>
          <div className="text-xs text-slate-500 mt-1">改前改后对比</div>
        </button>
        <button
          onClick={() => navigate('/boundary-rules')}
          className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-red-500/50 hover:bg-slate-800 transition-all text-left group"
        >
          <ShieldAlert size={20} className="text-red-400 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-medium text-white">边界规则中心</div>
          <div className="text-xs text-slate-500 mt-1">规则与回滚流程</div>
        </button>
      </div>
    </div>
  );
}
