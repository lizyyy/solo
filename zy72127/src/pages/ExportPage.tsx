import { useState } from 'react';
import { Download, FileText, FileJson, Table, GitCompare, ArrowRight, Check, Eye } from 'lucide-react';
import { usePresetStore } from '@/store/presetStore';
import { exportComparison, formatMarkdown, formatJSON, formatCSV } from '@/utils/exportFormatter';
import { getDifferenceStats } from '@/utils/diffComparator';
import { formatTimestamp } from '@/utils/versionParser';

export function ExportPage() {
  const { presets, comparisons, annotations } = usePresetStore();
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);
  const [previewFormat, setPreviewFormat] = useState<'markdown' | 'json' | 'csv'>('markdown');
  const [showPreview, setShowPreview] = useState(false);

  const selectedComparison = comparisons.find(c => c.id === selectedComparisonId);
  const basePreset = selectedComparison ? presets.find(p => p.id === selectedComparison.basePresetId) : undefined;
  const targetPreset = selectedComparison ? presets.find(p => p.id === selectedComparison.targetPresetId) : undefined;
  const comparisonAnnotations = selectedComparison 
    ? annotations.filter(a => a.comparisonId === selectedComparison.id) 
    : [];

  const getPreviewContent = (): string => {
    if (!selectedComparison) return '';
    
    const data = {
      comparison: selectedComparison,
      basePreset,
      targetPreset,
      annotations: comparisonAnnotations,
    };

    switch (previewFormat) {
      case 'markdown':
        return formatMarkdown(data);
      case 'json':
        return formatJSON(data);
      case 'csv':
        return formatCSV(data);
      default:
        return '';
    }
  };

  const handleExport = (format: 'markdown' | 'json' | 'csv') => {
    if (!selectedComparison) return;
    
    const data = {
      comparison: selectedComparison,
      basePreset,
      targetPreset,
      annotations: comparisonAnnotations,
    };
    
    exportComparison(format, data);
  };

  const formatOptions = [
    { id: 'markdown' as const, label: 'Markdown', icon: FileText, desc: '适合交接文档' },
    { id: 'json' as const, label: 'JSON', icon: FileJson, desc: '适合程序读取' },
    { id: 'csv' as const, label: 'CSV', icon: Table, desc: '适合表格分析' },
  ];

  return (
    <div className="min-h-screen bg-grid">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-slide-down">
          <h1 className="text-2xl font-bold text-synth-text mb-2">导出中心</h1>
          <p className="text-synth-muted">导出差异比对报告，包含比对原因和人工批注</p>
        </div>

        {comparisons.length === 0 ? (
          <div className="p-12 text-center bg-synth-card rounded-xl border border-synth-border animate-slide-up">
            <Download className="w-16 h-16 text-synth-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-synth-text mb-2">暂无可导出的比对记录</h3>
            <p className="text-synth-muted mb-4">
              请先创建比对记录
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-4 animate-slide-up">
              <h2 className="text-lg font-bold text-synth-text flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-accent-neon" />
                选择比对记录
              </h2>
              
              <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
                {comparisons.slice().reverse().map((comp) => {
                  const base = presets.find(p => p.id === comp.basePresetId);
                  const target = presets.find(p => p.id === comp.targetPresetId);
                  const stats = getDifferenceStats(comp.differences);
                  const anns = annotations.filter(a => a.comparisonId === comp.id);
                  
                  return (
                    <div
                      key={comp.id}
                      onClick={() => setSelectedComparisonId(comp.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedComparisonId === comp.id
                          ? 'border-accent-neon bg-accent-neon/10 shadow-neon'
                          : 'border-synth-border bg-synth-card hover:border-accent-neon/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-synth-text text-sm">{comp.reason}</div>
                          <div className="text-xs text-synth-muted">
                            {base?.name} v{base?.version} → {target?.name} v{target?.version}
                          </div>
                        </div>
                        {selectedComparisonId === comp.id && (
                          <div className="p-1 bg-accent-neon rounded-full">
                            <Check className="w-3 h-3 text-synth-bg" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-accent-coral">{stats.high} 严重</span>
                        <span className="text-accent-amber">{stats.medium} 中等</span>
                        <span className="text-accent-neon">{stats.low} 轻微</span>
                        <span className="text-primary-400">{anns.length} 批注</span>
                      </div>
                      
                      <div className="mt-2 pt-2 border-t border-synth-border flex items-center justify-between text-xs text-synth-muted">
                        <span>{comp.operator}</span>
                        <span>{formatTimestamp(comp.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              {!selectedComparison ? (
                <div className="p-12 text-center bg-synth-card rounded-xl border border-synth-border h-full flex flex-col items-center justify-center">
                  <div className="text-6xl mb-4">📄</div>
                  <h3 className="text-lg font-medium text-synth-text mb-2">选择比对记录</h3>
                  <p className="text-synth-muted">
                    从左侧选择需要导出的比对记录
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 bg-synth-card rounded-xl border border-synth-border">
                    <h3 className="text-lg font-bold text-synth-text mb-4">导出格式</h3>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {formatOptions.map((format) => (
                        <button
                          key={format.id}
                          onClick={() => setPreviewFormat(format.id)}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${
                            previewFormat === format.id
                              ? 'border-accent-neon bg-accent-neon/10'
                              : 'border-synth-border hover:border-accent-neon/50'
                          }`}
                        >
                          <format.icon className={`w-6 h-6 mb-2 ${
                            previewFormat === format.id ? 'text-accent-neon' : 'text-synth-muted'
                          }`} />
                          <div className={`font-medium text-sm ${
                            previewFormat === format.id ? 'text-accent-neon' : 'text-synth-text'
                          }`}>
                            {format.label}
                          </div>
                          <div className="text-xs text-synth-muted mt-1">{format.desc}</div>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center gap-2 px-4 py-2 bg-synth-surface text-synth-text rounded-lg hover:bg-synth-border transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        {showPreview ? '隐藏预览' : '预览内容'}
                      </button>
                      
                      <div className="flex-1" />
                      
                      <button
                        onClick={() => handleExport(previewFormat)}
                        className="flex items-center gap-2 px-6 py-2 bg-accent-neon text-synth-bg rounded-lg font-medium hover:bg-accent-neon/90 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        导出 {formatOptions.find(f => f.id === previewFormat)?.label}
                      </button>
                    </div>
                  </div>

                  {showPreview && (
                    <div className="p-6 bg-synth-card rounded-xl border border-synth-border">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-synth-text">预览</h3>
                        <span className="text-xs text-synth-muted">
                          {formatOptions.find(f => f.id === previewFormat)?.label} 格式
                        </span>
                      </div>
                      <div className="max-h-96 overflow-auto">
                        <pre className="p-4 bg-synth-bg rounded-lg text-xs text-synth-text font-mono whitespace-pre-wrap">
                          {getPreviewContent()}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="p-6 bg-synth-card rounded-xl border border-synth-border">
                    <h3 className="font-bold text-synth-text mb-4">快速导出全部格式</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {formatOptions.map((format) => (
                        <button
                          key={format.id}
                          onClick={() => handleExport(format.id)}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          {format.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-accent-neon/10 border border-accent-neon/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-accent-neon/20 text-accent-neon rounded-lg">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-accent-neon text-sm">导出内容包含</div>
                        <ul className="text-xs text-synth-muted mt-1 space-y-1">
                          <li>✓ 比对原因和操作人信息</li>
                          <li>✓ 完整差异列表（含严重程度）</li>
                          <li>✓ 所有人工批注和补录差异</li>
                          <li>✓ 版本信息和时间戳</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
