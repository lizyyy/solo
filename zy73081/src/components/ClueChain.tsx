import { useState } from 'react';
import type { ClueNode, ClueStep } from '@/types';
import { CLUE_STEP_LABEL } from '@/types';
import { FlaskConical, Search, Eye, CheckCircle2, ChevronDown, Paperclip } from 'lucide-react';

interface Props {
  nodes: ClueNode[];
  highlightOffset?: boolean;
}

const STEP_ICON: Record<ClueStep, typeof FlaskConical> = {
  SAMPLE: FlaskConical,
  INITIAL_JUDGEMENT: Search,
  REVIEW: Eye,
  CONCLUSION: CheckCircle2,
};

const STEP_COLOR: Record<ClueStep, { ring: string; bg: string; text: string; line: string }> = {
  SAMPLE:       { ring: 'ring-sky-400',   bg: 'bg-sky-500',    text: 'text-sky-600',    line: 'bg-sky-200' },
  INITIAL_JUDGEMENT: { ring: 'ring-amber-400', bg: 'bg-amber-500',  text: 'text-amber-600',  line: 'bg-amber-200' },
  REVIEW:       { ring: 'ring-violet-400', bg: 'bg-violet-500', text: 'text-violet-600', line: 'bg-violet-200' },
  CONCLUSION:   { ring: 'ring-emerald-400', bg: 'bg-emerald-500', text: 'text-emerald-600', line: 'bg-emerald-200' },
};

export function ClueChain({ nodes, highlightOffset }: Props) {
  const [expanded, setExpanded] = useState<string | null>(nodes[nodes.length - 1]?.id || null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-slate-800">线索链 · 样本 → 结论</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            每一步都可追溯，改判时需对节点证据负责
          </p>
        </div>
        {highlightOffset && (
          <span className="text-[10px] font-bold px-2 py-1 rounded bg-status-rejected/10 text-status-rejected border border-status-rejected/30">
            ⚠ 坐标偏移需在结论中扣除偏移量判定
          </span>
        )}
      </div>

      <div className="relative">
        <div className="absolute top-[22px] left-6 right-6 h-0.5 bg-slate-200 rounded-full" aria-hidden />
        <div className="grid grid-cols-4 relative gap-2">
          {nodes.map((node, idx) => {
            const Icon = STEP_ICON[node.step];
            const color = STEP_COLOR[node.step];
            const isOpen = expanded === node.id;
            const isLast = idx === nodes.length - 1;
            return (
              <div key={node.id} className="flex flex-col items-center relative z-10">
                {!isLast && (
                  <div
                    className={`absolute top-[22px] left-1/2 w-full h-0.5 ${color.line} rounded-full -translate-y-1/2`}
                    aria-hidden
                  />
                )}
                <button
                  onClick={() => setExpanded(isOpen ? null : node.id)}
                  className={`w-11 h-11 rounded-full ${color.bg} flex items-center justify-center text-white shadow-md
                    ring-4 ${color.ring} ring-opacity-30 transition-all
                    ${isOpen ? 'scale-110 shadow-lg' : 'hover:scale-105'}`}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.3} />
                </button>
                <div className={`mt-2 text-[11px] font-bold ${color.text} uppercase tracking-wide`}>
                  {CLUE_STEP_LABEL[node.step]}
                </div>
                <div className="mt-0.5 text-[10px] tnum text-slate-400">
                  {node.timestamp.slice(0, 10)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        {nodes.map((node) => {
          const isOpen = expanded === node.id;
          const color = STEP_COLOR[node.step];
          if (!isOpen) return null;
          return (
            <div
              key={node.id}
              className={`rounded-lg border-l-4 ${color.text.replace('text-', 'border-')} bg-slate-50/60 p-4 animate-[fadeIn_.2s_ease]`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{node.title}</h4>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    操作人：<span className="font-medium text-slate-700">{node.operator}</span>
                    <span className="mx-1.5">·</span>
                    <span className="tnum">{node.timestamp.replace('T', ' ').slice(0, 16)}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 ${color.text} transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
              <p className="text-xs text-slate-700 leading-relaxed bg-white rounded border border-slate-200/70 p-3">
                {node.description}
              </p>
              {node.evidenceUrls && node.evidenceUrls.length > 0 && node.evidenceUrls[0] && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-brand-600 bg-brand-50/50 px-2.5 py-1.5 rounded border border-brand-100/60">
                  <Paperclip className="w-3 h-3" />
                  <span>关联证据：{node.evidenceUrls[0]}</span>
                </div>
              )}
            </div>
          );
        })}
        {!expanded && (
          <div className="text-center text-xs text-slate-400 py-3 border border-dashed border-slate-200 rounded-lg">
            ↑ 点击任一节点查看该步骤的详细说明与证据
          </div>
        )}
      </div>
    </div>
  );
}
