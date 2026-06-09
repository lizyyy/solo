import { useReviewStore } from '@/store/reviewStore';
import { SOURCE_COLORS, SOURCE_LABELS, type MaterialSource } from '@/types';
import { FileDigit, FilePlus2, MessageSquareText, Funnel, type LucideIcon } from 'lucide-react';

const SOURCE_META: Record<MaterialSource, { icon: LucideIcon; key: MaterialSource }> = {
  cad_old: { icon: FileDigit, key: 'cad_old' },
  note_added: { icon: FilePlus2, key: 'note_added' },
  note_oral: { icon: MessageSquareText, key: 'note_oral' },
};

export default function SourceFilter() {
  const { sourceFilter, toggleSource, summary } = useReviewStore();

  return (
    <div className="eng-panel p-3 w-full">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-eng-border">
        <Funnel size={14} className="text-eng-line" />
        <span className="text-sm font-medium">材料来源筛选</span>
      </div>

      <div className="space-y-2">
        {(Object.keys(SOURCE_META) as MaterialSource[]).map((k) => {
          const meta = SOURCE_META[k];
          const Icon = meta.icon;
          const on = sourceFilter[k];
          const count = summary.keyInfluencingMaterials.find((m) => m.source === k)?.count ?? 0;

          return (
            <label
              key={k}
              className={`flex items-center gap-3 px-3 py-2 border cursor-pointer transition-all ${
                on ? 'bg-eng-panel2 border-eng-border' : 'border-transparent hover:bg-eng-panel2/40'
              }`}
              style={{ borderLeftWidth: 3, borderLeftColor: on ? SOURCE_COLORS[k] : 'transparent' }}
            >
              <Icon size={16} style={{ color: on ? SOURCE_COLORS[k] : '#64748B' }} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${on ? 'text-eng-text' : 'text-eng-muted'}`}>{SOURCE_LABELS[k]}</div>
                <div className="text-[10px] font-mono text-eng-muted">
                  影响结论的材料：<span className="text-eng-dim">{count}</span> 条
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleSource(k);
                }}
                className={`relative w-10 h-5 rounded transition-colors ${
                  on ? 'bg-eng-line' : 'bg-eng-panel2'
                } border border-eng-border`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white transition-all ${
                    on ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </label>
          );
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-eng-border text-[10px] text-eng-muted leading-relaxed">
        <div>关闭某类来源后：</div>
        <div>· 3D 对象仅显示保留来源关联的分区</div>
        <div>· 无匹配材料的分区进入"未复核"状态</div>
        <div>· 页面摘要自动重新计算</div>
      </div>
    </div>
  );
}
