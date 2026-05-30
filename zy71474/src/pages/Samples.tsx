import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { parseJsonFile, parseCsvFile, formatTimestamp } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import type { Experiment, ImportBatch } from '@/types';

const COLLISION_LABEL: Record<string, string> = {
  elastic: '弹性',
  inelastic: '非弹性',
  perfectly_inelastic: '完全非弹性',
};

const STATUS_LABEL: Record<string, string> = { new: '新增', updated: '更新', duplicate: '重复' };
const STATUS_BG: Record<string, string> = { new: 'bg-brand-green', updated: 'bg-brand-orange', duplicate: 'bg-brand-muted' };

export default function Samples() {
  const navigate = useNavigate();
  const { experiments, sampleGroups, importBatches, importExperiments, loadFromStorage } = useStore();
  const [parsing, setParsing] = useState(false);
  const [lastBatch, setLastBatch] = useState<ImportBatch | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  const handleFiles = useCallback(async (files: FileList) => {
    setParsing(true);
    try {
      const all: Experiment[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'json') {
          const data = await parseJsonFile(file);
          all.push(...(data as Experiment[]));
        } else if (ext === 'csv') {
          const data = await parseCsvFile(file);
          all.push(...(data as unknown as Experiment[]));
        }
      }
      if (all.length > 0) {
        const batch = importExperiments(all);
        setLastBatch(batch);
      }
    } finally {
      setParsing(false);
    }
  }, [importExperiments]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
  }, [handleFiles]);

  const latestBatch = lastBatch ?? (importBatches.length > 0 ? importBatches[importBatches.length - 1] : null);

  return (
    <div className="min-h-screen bg-brand-bg p-6 font-body space-y-8">
      <div
        className={cn(
          'border border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
          dragOver ? 'border-brand-cyan bg-brand-surface' : 'border-brand-border',
          parsing && 'scan-line-overlay',
        )}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="mx-auto mb-3 text-brand-muted" size={32} />
        <p className="text-brand-text">拖拽或点击导入 JSON/CSV 样例文件</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {latestBatch && (
        <div className="bg-brand-card rounded-xl p-4 border border-brand-border animate-fade-in">
          <h3 className="font-display text-brand-cyan text-sm mb-3">导入结果</h3>
          <div className="space-y-2">
            {latestBatch.items.map((item, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg bg-brand-surface',
                  item.status === 'duplicate' && 'opacity-50',
                )}
              >
                <span className={cn('text-xs px-2 py-0.5 rounded-full text-brand-bg font-medium', STATUS_BG[item.status])}>
                  {STATUS_LABEL[item.status]}
                </span>
                <span className="text-brand-text text-sm font-mono">{item.experimentId.slice(0, 8)}</span>
                {item.status === 'updated' && item.changedFields && item.changedFields.length > 0 && (
                  <span className="text-brand-orange text-xs">
                    变更: {item.changedFields.join(', ')}
                  </span>
                )}
                {item.status === 'duplicate' && (
                  <span className="text-brand-muted text-xs">与已有记录重复</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display text-brand-text text-lg mb-4">样例分组</h2>
        {sampleGroups.length === 0 ? (
          <p className="text-brand-muted text-sm">暂无样例数据，请先导入文件</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sampleGroups.map(group => {
              const groupExps = experiments.filter(e => group.experimentIds.includes(e.id));
              const isExpanded = expandedGroup === group.id;
              return (
                <div key={group.id} className="bg-brand-card rounded-xl border border-brand-border overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-brand-surface/50 transition-colors"
                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-surface text-brand-cyan border border-brand-border">
                        {group.massRange}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-surface text-brand-orange border border-brand-border">
                        {group.velocityRange}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-surface text-brand-green border border-brand-border">
                        {COLLISION_LABEL[group.collisionType] ?? group.collisionType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-brand-muted text-sm">{groupExps.length} 次实验</span>
                      {isExpanded
                        ? <ChevronDown size={16} className="text-brand-muted" />
                        : <ChevronRight size={16} className="text-brand-muted" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-brand-border divide-y divide-brand-border">
                      {groupExps.map(exp => (
                        <div
                          key={exp.id}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-brand-surface transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-brand-text text-sm">{exp.name}</span>
                            <span className="text-brand-muted text-xs">v{exp.version}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-brand-muted text-xs">{formatTimestamp(exp.updatedAt)}</span>
                            <button
                              onClick={() => navigate(`/detail/${exp.id}`)}
                              className="text-brand-cyan text-xs hover:underline"
                            >
                              查看明细
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
