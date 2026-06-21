import { useState, useMemo } from 'react';
import {
  History,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  Filter,
  ArrowRight,
  MessageSquare,
  GitCommit,
} from 'lucide-react';
import { useWorkbenchStore } from '@/store';
import { ConclusionDisplay, type HistoryVersion, type Conclusion } from '@/shared/types';
import { CONCLUSION_COLORS } from './TopBar';

function ConclusionBadge({ conclusion }: { conclusion: Conclusion }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs text-white inline-flex items-center gap-1 ${
        CONCLUSION_COLORS[conclusion]
      }`}
    >
      {ConclusionDisplay[conclusion]}
    </span>
  );
}

function VersionNode({
  version,
  isLatest,
}: {
  version: HistoryVersion;
  isLatest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      <div
        className={`absolute left-2 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          isLatest
            ? 'bg-blue-500 border-blue-400 shadow-lg shadow-blue-500/30'
            : 'bg-slate-800 border-slate-500'
        }`}
      >
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            isLatest ? 'bg-white' : 'bg-slate-500'
          }`}
        />
      </div>

      <div
        className={`bg-slate-800/50 rounded-lg border transition-all hover:border-slate-500 cursor-pointer ${
          expanded
            ? 'border-blue-500/50 shadow-lg shadow-blue-500/5'
            : 'border-slate-700'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <GitCommit size={14} className="text-blue-400" />
                <span className="font-mono text-sm text-blue-400 font-bold">
                  v{version.version_no}
                </span>
              </div>
              {isLatest && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
                  最新版本
                </span>
              )}
              <span className="font-mono text-[10px] text-slate-500">
                {version.version_id}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              {expanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
            <span className="flex items-center gap-1">
              <User size={12} />
              <span className="text-slate-300">{version.operator}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {new Date(version.operated_at).toLocaleString('zh-CN')}
            </span>
          </div>

          {(version.old_conclusion || version.new_conclusion) && (
            <div className="flex items-center gap-3 flex-wrap mb-3 p-2.5 bg-slate-900/50 rounded-md border border-slate-700/50">
              {version.old_conclusion && (
                <ConclusionBadge conclusion={version.old_conclusion} />
              )}
              <ArrowRight
                size={16}
                className="text-slate-500 flex-shrink-0"
              />
              {version.new_conclusion && (
                <ConclusionBadge conclusion={version.new_conclusion} />
              )}
            </div>
          )}

          <div className="mb-3">
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
              改判原因
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              {version.revise_reason || '无'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MessageSquare size={12} className="text-blue-400" />
              <span className="text-blue-400">
                +{version.new_remarks.length} 备注
              </span>
            </span>
            {version.affected_conclusion_ids.length > 0 && (
              <span>
                牵动 {version.affected_conclusion_ids.length} 条结论
              </span>
            )}
          </div>
        </div>

        {expanded && version.snapshot_material && (
          <div className="border-t border-slate-700/50 p-4 bg-slate-900/30">
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">
              版本快照
            </div>
            <pre className="text-[10px] text-slate-400 font-mono bg-slate-950/60 rounded p-3 overflow-x-auto max-h-60 custom-scrollbar">
              {JSON.stringify(version.snapshot_material, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryTab() {
  const record = useWorkbenchStore((s) => s.record);
  const [filterOperator, setFilterOperator] = useState<string>('all');

  const operators = useMemo(() => {
    if (!record) return [];
    const set = new Set<string>();
    record.history_chain.forEach((v) => set.add(v.operator));
    return ['all', ...Array.from(set)];
  }, [record]);

  const filtered = useMemo(() => {
    if (!record) return [];
    let list = [...record.history_chain].sort(
      (a, b) => b.version_no - a.version_no
    );
    if (filterOperator !== 'all') {
      list = list.filter((v) => v.operator === filterOperator);
    }
    return list;
  }, [record, filterOperator]);

  if (!record) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/50 flex-wrap gap-2">
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <History size={12} />
          共 {record.history_chain.length} 个历史版本，
          <span className="text-slate-500">
            当前显示 {filtered.length} 条
          </span>
        </span>
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-slate-500" />
          <select
            value={filterOperator}
            onChange={(e) => setFilterOperator(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
          >
            {operators.map((op) => (
              <option key={op} value={op}>
                {op === 'all' ? '全部操作人' : op}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <History size={48} className="mb-3 opacity-30" />
            <p className="text-slate-400">暂无历史记录</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[14px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-500 via-slate-600 to-slate-700" />
            {filtered.map((v, i) => (
              <VersionNode
                key={v.version_id}
                version={v}
                isLatest={i === 0 && v.version_no === record.current_version}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
