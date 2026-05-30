import { useState } from 'react';
import { Check, Square, X, Search } from 'lucide-react';
import type { FittingRecord } from '@/types';

interface RecordSelectorProps {
  records: FittingRecord[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function RecordSelector({ records, selectedIds, onSelectionChange }: RecordSelectorProps) {
  const [search, setSearch] = useState('');

  const filtered = records.filter((r) =>
    r.instrumentLabel.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      if (selectedIds.length >= 5) return;
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    const ids = filtered.slice(0, 5).map((r) => r.id);
    onSelectionChange(ids);
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="rounded-xl border border-synth-border bg-synth-card overflow-hidden">
      <div className="px-4 py-3 border-b border-synth-border">
        <h3 className="text-sm font-mono font-semibold text-synth-green tracking-wide">
          选择记录
        </h3>
        <p className="text-xs text-synth-muted mt-1">最多选择 5 条记录进行对比</p>
      </div>

      <div className="px-4 py-2 border-b border-synth-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-synth-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索乐器标签..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-synth-bg border border-synth-border text-xs text-gray-300 placeholder:text-synth-muted focus:outline-none focus:border-synth-green/40"
          />
        </div>
      </div>

      <div className="px-4 py-2 border-b border-synth-border flex gap-2">
        <button
          onClick={selectAll}
          className="px-2 py-1 rounded text-xs text-synth-muted hover:text-synth-green transition-colors"
        >
          全选
        </button>
        <button
          onClick={clearAll}
          className="px-2 py-1 rounded text-xs text-synth-muted hover:text-synth-amber transition-colors"
        >
          清空
        </button>
        <span className="ml-auto text-xs text-synth-muted font-mono">
          {selectedIds.length}/5
        </span>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-synth-muted">
            暂无记录
          </div>
        ) : (
          filtered.map((record) => {
            const isSelected = selectedIds.includes(record.id);
            return (
              <button
                key={record.id}
                onClick={() => toggle(record.id)}
                className={`w-full flex items-start gap-3 px-4 py-2.5 border-b border-synth-border/50 text-left transition-colors ${
                  isSelected ? 'bg-synth-green/5' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isSelected ? (
                    <Check className="w-4 h-4 text-synth-green" />
                  ) : (
                    <Square className="w-4 h-4 text-synth-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-300">
                      {record.instrumentLabel || '未标记'}
                    </span>
                    {record.anomalies.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400">
                        {record.anomalies.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-synth-muted font-mono">
                    {new Date(record.createdAt).toLocaleDateString('zh-CN')}
                    {' · '}
                    A:{record.conclusion.attack.toFixed(1)}ms
                    {' '}
                    D:{record.conclusion.decay.toFixed(1)}ms
                    {' '}
                    S:{(record.conclusion.sustain * 100).toFixed(0)}%
                    {' '}
                    R:{record.conclusion.release.toFixed(1)}ms
                  </div>
                </div>
                {!isSelected && selectedIds.length >= 5 && (
                  <X className="w-3 h-3 text-synth-muted mt-1" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
