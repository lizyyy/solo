import { useState } from 'react';
import { FileText, Calculator, MessageSquare, CheckCircle, ChevronDown, ChevronRight, User, Clock } from 'lucide-react';
import type { Clue } from '@/types';
import { highlightKeywords } from '@/utils/clueGenerator';
import { cn } from '@/lib/utils';

interface ClueTimelineProps {
  clues: Clue[];
}

const iconMap = {
  score: FileText,
  calculation: Calculator,
  supplement: MessageSquare,
  conclusion: CheckCircle,
};

const colorMap = {
  score: 'bg-blue-500',
  calculation: 'bg-purple-500',
  supplement: 'bg-amber-500',
  conclusion: 'bg-emerald-500',
};

const bgColorMap = {
  score: 'bg-blue-50 border-blue-200',
  calculation: 'bg-purple-50 border-purple-200',
  supplement: 'bg-amber-50 border-amber-200',
  conclusion: 'bg-emerald-50 border-emerald-200',
};

export function ClueTimeline({ clues }: ClueTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>(clues.map((c) => c.id));

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">完整线索链</h4>
          <span className="text-xs text-slate-500">共 {clues.length} 条线索</span>
        </div>
        <p className="text-xs text-slate-500">
          从评分录入到结论确认的完整操作轨迹，每一步都留有记录，方便交班追溯。
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" />

        <div className="space-y-3">
          {clues.map((clue, index) => {
            const Icon = iconMap[clue.type];
            const isExpanded = expandedIds.includes(clue.id);
            const isLast = index === clues.length - 1;

            return (
              <div key={clue.id} className="relative pl-10">
                <div
                  className={cn(
                    'absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow',
                    colorMap[clue.type]
                  )}
                >
                  <Icon size={14} />
                </div>

                <div
                  className={cn(
                    'rounded-xl border p-3 transition-all',
                    bgColorMap[clue.type]
                  )}
                >
                  <button
                    onClick={() => toggleExpand(clue.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {clue.title}
                      </span>
                      {isLast && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          最新
                        </span>
                      )}
                    </div>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <User size={10} />
                      <span>{clue.operator}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={10} />
                      <span>{clue.timestamp}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                      <p
                        className="text-sm leading-relaxed text-slate-700"
                        dangerouslySetInnerHTML={{
                          __html: highlightKeywords(clue.content),
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h5 className="mb-2 text-xs font-semibold text-slate-700">图例说明</h5>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <LegendItem icon={FileText} color="bg-blue-500" label="评分录入" />
          <LegendItem icon={Calculator} color="bg-purple-500" label="验算完成" />
          <LegendItem icon={MessageSquare} color="bg-amber-500" label="补充说明" />
          <LegendItem icon={CheckCircle} color="bg-emerald-500" label="结论确认" />
        </div>
      </div>
    </div>
  );
}

interface LegendItemProps {
  icon: React.ElementType;
  color: string;
  label: string;
}

function LegendItem({ icon: Icon, color, label }: LegendItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-5 w-5 items-center justify-center rounded-full ${color} text-white`}>
        <Icon size={10} />
      </div>
      <span className="text-slate-600">{label}</span>
    </div>
  );
}
