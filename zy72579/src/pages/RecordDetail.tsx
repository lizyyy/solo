import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, BarChart3, BookOpen, GitBranch, History, Play } from 'lucide-react';
import { StepFlow } from '@/components/StepFlow';
import { LogChart } from '@/components/LogChart';
import { VersionTable } from '@/components/VersionTable';
import { ConflictPanel } from '@/components/ConflictPanel';
import { EvidenceBlock } from '@/components/EvidenceBlock';
import { StatusBadge, TypeBadge } from '@/components/StatusBadge';
import { useRecordStore } from '@/store/recordStore';

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecordById, resolveConflict, advanceStep } = useRecordStore();

  const record = getRecordById(id || '');

  if (!record) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">未找到该记录</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 border-2 border-teal-700 hover:bg-teal-700 transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const hasUnresolvedConflicts = record.conflicts.some((c) => c.resolution === null);
  const isBlocked = record.steps.some((s) => s.status === 'blocked');
  const canAdvance = !isBlocked && !hasUnresolvedConflicts && record.currentStep !== 'update_version';

  const handleResolveConflict = (conflictId: string, resolution: 'confirmed' | 'rejected') => {
    resolveConflict(record.id, conflictId, resolution);
  };

  const handleAdvanceStep = () => {
    advanceStep(record.id);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-slate-900 font-serif truncate">{record.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <StatusBadge status={record.status} />
                <TypeBadge type={record.type} />
                <span className="text-xs text-slate-500 font-mono">批次: {record.batchId}</span>
              </div>
            </div>
            {canAdvance && (
              <button
                onClick={handleAdvanceStep}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 border-2 border-teal-700 hover:bg-teal-700 transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                推进到下一步
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <StepFlow steps={record.steps} />

        {record.conflicts.length > 0 && (
          <ConflictPanel conflicts={record.conflicts} onResolve={handleResolveConflict} />
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <EvidenceBlock
            title="训练日志曲线"
            icon={<BarChart3 className="w-4 h-4 text-teal-600" />}
          >
            <LogChart trainingLog={record.trainingLog} />
          </EvidenceBlock>

          <EvidenceBlock
            title="阈值调参笔记"
            icon={<BookOpen className="w-4 h-4 text-amber-600" />}
            variant={record.thresholdNote.isOldCaliber ? 'warning' : 'default'}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">版本:</span>
                <code className="bg-slate-100 px-2 py-1 text-xs font-mono">{record.thresholdNote.version}</code>
                {record.thresholdNote.isOldCaliber && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                    旧口径
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">操作人:</span>
                <span className="text-sm text-slate-700">{record.thresholdNote.operator}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">更新时间:</span>
                <span className="text-sm text-slate-700">{record.thresholdNote.updateTime}</span>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">笔记内容:</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 border border-slate-200 font-mono text-xs leading-relaxed">
                  {record.thresholdNote.content}
                </p>
              </div>
            </div>
          </EvidenceBlock>
        </div>

        <EvidenceBlock
          title="特征版本表"
          icon={<GitBranch className="w-4 h-4 text-slate-600" />}
        >
          <VersionTable versions={record.featureVersions} />
        </EvidenceBlock>

        <EvidenceBlock
          title="审核历史记录"
          icon={<History className="w-4 h-4 text-slate-600" />}
        >
          <div className="space-y-3">
            {record.reviewHistory.map((item, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-teal-600' : 'bg-slate-300'}`} />
                  {index < record.reviewHistory.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1" />}
                </div>
                <div className="pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{item.action}</span>
                    <span className="text-xs text-slate-500">by {item.operator}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{item.time}</p>
                  {item.remark && <p className="text-sm text-slate-600 mt-1">{item.remark}</p>}
                </div>
              </div>
            ))}
          </div>
        </EvidenceBlock>

        <EvidenceBlock
          title="基本信息"
          icon={<FileText className="w-4 h-4 text-slate-600" />}
          defaultOpen={false}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">记录ID</p>
              <p className="text-sm font-mono text-slate-700 mt-1">{record.id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">特征名称</p>
              <p className="text-sm font-mono text-slate-700 mt-1">{record.featureName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">创建时间</p>
              <p className="text-sm text-slate-700 mt-1">{record.createTime}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">更新时间</p>
              <p className="text-sm text-slate-700 mt-1">{record.updateTime}</p>
            </div>
          </div>
        </EvidenceBlock>
      </main>
    </div>
  );
}
