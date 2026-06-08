import type { DogRecord } from '@/types';
import { GitBranch, ArrowRight, CheckCheck, FileText } from 'lucide-react';

interface Props { record: DogRecord; }

const conclusionBadge = (c: string) => {
  const cls =
    c === '疫苗合格 可寄养' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
    c === '待审核' ? 'bg-anomaly-100 text-anomaly-700 border-anomaly-200' :
    'bg-verdict-100 text-verdict-700 border-verdict-200';
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{c}</span>;
};

export default function VerdictChain({ record }: Props) {
  const chain = record.verdictChain;
  if (!chain || chain.length === 0) {
    return (
      <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-5 text-sm text-brand-500 text-center">
        <GitBranch className="w-6 h-6 mx-auto mb-2 text-brand-400" />
        本报告无结论改判，结论在 v1 即为「{record.currentConclusion}」。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-verdict-500" />
        <h4 className="font-serif font-bold text-brand-800">结论改判链路</h4>
        <span className="chip chip-verdict">{chain.length} 次改判</span>
      </div>

      <div className="relative pl-6">
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-verdict-300 via-anomaly-300 to-emerald-300" />
        <div className="space-y-4">
          {chain.map((c, i) => (
            <div key={i} className="relative rounded-2xl border-2 border-verdict-100 bg-gradient-to-br from-pink-50 to-cream-50 p-4 overflow-hidden">
              <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-gradient-to-br from-verdict-200/40 to-transparent blur-sm" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="chip chip-verdict">节点 #{i + 1}</span>
                  <span className="chip chip-normal">对应版本 v{c.version}</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  {conclusionBadge(c.fromConclusion)}
                  <ArrowRight className="w-4 h-4 text-verdict-500" />
                  {conclusionBadge(c.toConclusion)}
                </div>
                <div className="text-sm text-brand-800 mb-3 leading-relaxed bg-white/75 rounded-lg px-3 py-2 border border-white">
                  <span className="font-semibold text-brand-700 mr-1">改判原因：</span>{c.reason}
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.materials.map((m, j) => (
                    <span key={j} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand-50 border border-brand-100 text-xs text-brand-700">
                      <FileText className="w-3 h-3" /> {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 pt-2">
            <CheckCheck className="w-4 h-4" /> 最终结论：<span className="font-semibold">{record.currentConclusion}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
