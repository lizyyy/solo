import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitCompare, ArrowRight, Play, AlertTriangle, Copy, CircleDot, Plus, Minus } from 'lucide-react';
import { usePresetStore } from '@/store/presetStore';
import { PresetCard } from '@/components/PresetCard';
import { DiffItem } from '@/components/DiffItem';
import { getDifferenceStats } from '@/utils/diffComparator';

export function ComparePage() {
  const navigate = useNavigate();
  const { presets, createComparison, comparisons, setActiveComparison, deleteComparison } = usePresetStore();
  const [basePresetId, setBasePresetId] = useState<string | null>(null);
  const [targetPresetId, setTargetPresetId] = useState<string | null>(null);
  const [reason, setReason] = useState('演出彩排版本核对');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateComparison = () => {
    if (!basePresetId || !targetPresetId) return;
    
    setIsCreating(true);
    try {
      const comparison = createComparison(basePresetId, targetPresetId, reason);
      setIsCreating(false);
    } catch (err) {
      console.error('Failed to create comparison:', err);
      setIsCreating(false);
    }
  };

  const handleSelectComparison = (id: string) => {
    setActiveComparison(id);
    navigate('/annotate');
  };

  const stats = comparisons.length > 0 
    ? comparisons.map(c => ({
        ...c,
        stats: getDifferenceStats(c.differences),
      }))
    : [];

  return (
    <div className="min-h-screen bg-grid">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-down">
          <h1 className="text-2xl font-bold text-synth-text mb-2">差异比对</h1>
          <p className="text-synth-muted">选择两个预设版本进行差异比对</p>
        </div>

        {presets.length < 2 ? (
          <div className="p-12 text-center bg-synth-card rounded-xl border border-synth-border animate-slide-up">
            <GitCompare className="w-16 h-16 text-synth-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-synth-text mb-2">预设数量不足</h3>
            <p className="text-synth-muted mb-4">
              至少需要导入 2 个预设才能进行比对
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-accent-neon text-synth-bg rounded-lg font-medium hover:bg-accent-neon/90 transition-colors"
            >
              前往导入预设
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-slide-up">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-accent-neon flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-neon" />
                  基准版本 (Base)
                </h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {presets.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      selected={basePresetId === preset.id}
                      onClick={() => setBasePresetId(preset.id)}
                      showSelect
                      variant={basePresetId === preset.id ? 'base' : 'default'}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="p-4 bg-synth-card rounded-xl border border-synth-border mb-4">
                  <ArrowRight className="w-8 h-8 text-accent-neon" />
                </div>
                <div className="space-y-4 w-full max-w-xs">
                  <div>
                    <label className="text-xs text-synth-muted mb-1 block">比对原因</label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-2 bg-synth-card border border-synth-border rounded-lg text-sm text-synth-text focus:border-accent-neon focus:outline-none"
                      placeholder="说明比对原因..."
                    />
                  </div>
                  <button
                    onClick={handleCreateComparison}
                    disabled={!basePresetId || !targetPresetId || isCreating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-neon text-synth-bg rounded-lg font-medium hover:bg-accent-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    {isCreating ? '比对中...' : '开始比对'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-primary-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary-400" />
                  目标版本 (Target)
                </h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {presets.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      selected={targetPresetId === preset.id}
                      onClick={() => setTargetPresetId(preset.id)}
                      showSelect
                      variant={targetPresetId === preset.id ? 'target' : 'default'}
                    />
                  ))}
                </div>
              </div>
            </div>

            {comparisons.length > 0 && (
              <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <h2 className="text-lg font-bold text-synth-text mb-4">比对历史</h2>
                <div className="space-y-3">
                  {stats.slice().reverse().map((comp) => {
                    const basePreset = presets.find(p => p.id === comp.basePresetId);
                    const targetPreset = presets.find(p => p.id === comp.targetPresetId);
                    
                    return (
                      <div
                        key={comp.id}
                        className="p-4 bg-synth-card rounded-xl border border-synth-border hover:border-accent-neon/30 transition-all cursor-pointer group"
                        onClick={() => handleSelectComparison(comp.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-accent-neon/20 text-accent-neon rounded-lg">
                              <GitCompare className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-accent-neon">
                                  {basePreset?.name} v{basePreset?.version}
                                </span>
                                <ArrowRight className="w-4 h-4 text-synth-muted" />
                                <span className="font-medium text-primary-400">
                                  {targetPreset?.name} v{targetPreset?.version}
                                </span>
                              </div>
                              <div className="text-xs text-synth-muted mt-1">
                                {comp.reason} · {comp.operator}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                              {comp.stats.high > 0 && (
                                <div className="flex items-center gap-1 text-accent-coral text-sm">
                                  <AlertTriangle className="w-4 h-4" />
                                  {comp.stats.high} 严重
                                </div>
                              )}
                              {comp.stats.medium > 0 && (
                                <div className="flex items-center gap-1 text-accent-amber text-sm">
                                  <CircleDot className="w-4 h-4" />
                                  {comp.stats.medium} 中等
                                </div>
                              )}
                              {comp.stats.low > 0 && (
                                <div className="flex items-center gap-1 text-accent-neon text-sm">
                                  <Minus className="w-4 h-4" />
                                  {comp.stats.low} 轻微
                                </div>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteComparison(comp.id);
                              }}
                              className="p-2 text-synth-muted hover:text-accent-coral opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              删除
                            </button>
                          </div>
                        </div>

                        {comp.differences.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-synth-border">
                            <div className="text-xs text-synth-muted mb-2">前 3 项差异预览：</div>
                            <div className="space-y-2">
                              {comp.differences.slice(0, 3).map((diff, idx) => (
                                <DiffItem key={idx} difference={diff} />
                              ))}
                            </div>
                            {comp.differences.length > 3 && (
                              <div className="mt-2 text-xs text-accent-neon cursor-pointer hover:underline">
                                点击查看全部 {comp.differences.length} 项差异 →
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
