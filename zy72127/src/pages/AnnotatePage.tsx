import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, GitCompare, ArrowLeft, FileEdit, Check, Clock, User } from 'lucide-react';
import { usePresetStore, useActiveComparison } from '@/store/presetStore';
import { DiffItem } from '@/components/DiffItem';
import { AnnotationCard } from '@/components/AnnotationCard';
import { groupDifferencesByType } from '@/utils/diffComparator';
import { formatTimestamp } from '@/utils/versionParser';
import { DIFFERENCE_TYPE_LABELS } from '@/types';

export function AnnotatePage() {
  const navigate = useNavigate();
  const { comparisons, setActiveComparison, addAnnotation, currentOperator, updateComparison } = usePresetStore();
  const { comparison, basePreset, targetPreset, annotations } = useActiveComparison();
  
  const [newNote, setNewNote] = useState('');
  const [newManualDiff, setNewManualDiff] = useState({ field: '', content: '' });
  const [showManualDiffForm, setShowManualDiffForm] = useState(false);

  const handleSelectComparison = (id: string) => {
    setActiveComparison(id);
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !comparison) return;
    
    addAnnotation({
      comparisonId: comparison.id,
      content: newNote.trim(),
      operator: currentOperator,
      type: 'note',
    });
    setNewNote('');
  };

  const handleAddManualDiff = () => {
    if (!newManualDiff.content.trim() || !comparison) return;
    
    addAnnotation({
      comparisonId: comparison.id,
      field: newManualDiff.field || undefined,
      content: newManualDiff.content.trim(),
      operator: currentOperator,
      type: 'manual-diff',
    });
    setNewManualDiff({ field: '', content: '' });
    setShowManualDiffForm(false);
  };

  const handleStatusChange = (status: 'pending' | 'reviewed' | 'approved') => {
    if (!comparison) return;
    updateComparison(comparison.id, { status });
  };

  if (!comparison) {
    return (
      <div className="min-h-screen bg-grid">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 animate-slide-down">
            <h1 className="text-2xl font-bold text-synth-text mb-2">批注管理</h1>
            <p className="text-synth-muted">选择比对记录添加人工批注</p>
          </div>

          {comparisons.length === 0 ? (
            <div className="p-12 text-center bg-synth-card rounded-xl border border-synth-border animate-slide-up">
              <MessageSquare className="w-16 h-16 text-synth-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-synth-text mb-2">暂无比对记录</h3>
              <p className="text-synth-muted mb-4">
                请先创建比对记录
              </p>
              <button
                onClick={() => navigate('/compare')}
                className="px-4 py-2 bg-accent-neon text-synth-bg rounded-lg font-medium hover:bg-accent-neon/90 transition-colors"
              >
                前往差异比对
              </button>
            </div>
          ) : (
            <div className="space-y-3 animate-slide-up">
              <h2 className="text-lg font-bold text-synth-text mb-4">选择比对记录</h2>
              {comparisons.map((comp) => {
                const base = basePreset || comparisons.find(c => c.id === comp.id);
                return (
                  <div
                    key={comp.id}
                    onClick={() => handleSelectComparison(comp.id)}
                    className="p-4 bg-synth-card rounded-xl border border-synth-border hover:border-accent-neon/30 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-accent-neon/20 text-accent-neon rounded-lg">
                          <GitCompare className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-medium text-synth-text">{comp.reason}</div>
                          <div className="text-xs text-synth-muted">
                            {comp.operator} · {formatTimestamp(comp.createdAt)} · {comp.differences.length} 项差异
                          </div>
                        </div>
                      </div>
                      <div className="text-accent-neon">选择 →</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const groupedDiffs = groupDifferencesByType(comparison.differences);

  const statusConfig = {
    pending: { label: '待审核', color: 'text-accent-amber', bg: 'bg-accent-amber/20' },
    reviewed: { label: '已审核', color: 'text-accent-neon', bg: 'bg-accent-neon/20' },
    approved: { label: '已批准', color: 'text-primary-400', bg: 'bg-primary-500/20' },
  };

  return (
    <div className="min-h-screen bg-grid">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 animate-slide-down">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveComparison(null)}
              className="p-2 text-synth-muted hover:text-synth-text hover:bg-synth-card rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-synth-text mb-1">批注管理</h1>
              <p className="text-synth-muted">
                {basePreset?.name} v{basePreset?.version} → {targetPreset?.name} v{targetPreset?.version}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-synth-muted">状态:</span>
              <div className={`px-3 py-1 rounded-full text-sm ${statusConfig[comparison.status].bg} ${statusConfig[comparison.status].color}`}>
                {statusConfig[comparison.status].label}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(['pending', 'reviewed', 'approved'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    comparison.status === status
                      ? statusConfig[status].bg + ' ' + statusConfig[status].color
                      : 'bg-synth-card text-synth-muted hover:text-synth-text'
                  }`}
                >
                  {statusConfig[status].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="animate-slide-up">
            <h2 className="text-lg font-bold text-synth-text mb-4 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-accent-neon" />
              差异列表 ({comparison.differences.length})
            </h2>

            <div className="space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
              {Object.entries(groupedDiffs).map(([type, diffs]) => {
                if (diffs.length === 0) return null;
                return (
                  <div key={type}>
                    <h3 className="text-sm font-medium text-synth-muted mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent-neon" />
                      {DIFFERENCE_TYPE_LABELS[type as keyof typeof DIFFERENCE_TYPE_LABELS]} ({diffs.length})
                    </h3>
                    <div className="space-y-2">
                      {diffs.map((diff, idx) => (
                        <DiffItem key={idx} difference={diff} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-lg font-bold text-synth-text mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-accent-neon" />
              人工批注 ({annotations.length})
            </h2>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-synth-card rounded-xl border border-synth-border">
                <div className="flex items-center gap-2 mb-3">
                  <Plus className="w-4 h-4 text-accent-neon" />
                  <span className="text-sm font-medium text-synth-text">添加备注</span>
                </div>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full p-3 bg-synth-bg border border-synth-border rounded-lg text-sm text-synth-text resize-none focus:border-accent-neon focus:outline-none mb-3"
                  rows={3}
                  placeholder="输入备注内容..."
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-neon text-synth-bg rounded-lg text-sm font-medium hover:bg-accent-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  添加备注
                </button>
              </div>

              {!showManualDiffForm ? (
                <button
                  onClick={() => setShowManualDiffForm(true)}
                  className="w-full p-4 bg-synth-card rounded-xl border border-dashed border-accent-amber/50 text-accent-amber hover:bg-accent-amber/5 transition-colors flex items-center justify-center gap-2"
                >
                  <FileEdit className="w-4 h-4" />
                  补录差异说明
                </button>
              ) : (
                <div className="p-4 bg-synth-card rounded-xl border border-accent-amber/30">
                  <div className="flex items-center gap-2 mb-3">
                    <FileEdit className="w-4 h-4 text-accent-amber" />
                    <span className="text-sm font-medium text-synth-text">补录差异</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-synth-muted mb-1 block">关联字段 (可选)</label>
                      <input
                        type="text"
                        value={newManualDiff.field}
                        onChange={(e) => setNewManualDiff({ ...newManualDiff, field: e.target.value })}
                        className="w-full px-3 py-2 bg-synth-bg border border-synth-border rounded-lg text-sm text-synth-text focus:border-accent-neon focus:outline-none"
                        placeholder="例如: oscillators[0].level"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-synth-muted mb-1 block">差异说明</label>
                      <textarea
                        value={newManualDiff.content}
                        onChange={(e) => setNewManualDiff({ ...newManualDiff, content: e.target.value })}
                        className="w-full p-3 bg-synth-bg border border-synth-border rounded-lg text-sm text-synth-text resize-none focus:border-accent-neon focus:outline-none"
                        rows={3}
                        placeholder="描述未被自动识别的差异..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowManualDiffForm(false)}
                        className="flex-1 px-4 py-2 bg-synth-surface text-synth-muted rounded-lg text-sm hover:text-synth-text transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleAddManualDiff}
                        disabled={!newManualDiff.content.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent-amber text-synth-bg rounded-lg text-sm font-medium hover:bg-accent-amber/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="w-4 h-4" />
                        补录
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-[calc(100vh-520px)] overflow-y-auto pr-2">
              {annotations.length === 0 ? (
                <div className="p-8 text-center bg-synth-card/50 rounded-xl border border-synth-border">
                  <MessageSquare className="w-10 h-10 text-synth-muted mx-auto mb-3" />
                  <p className="text-sm text-synth-muted">暂无批注</p>
                </div>
              ) : (
                annotations.map((annotation) => (
                  <AnnotationCard key={annotation.id} annotation={annotation} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
