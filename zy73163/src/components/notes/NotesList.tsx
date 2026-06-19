import { useMemo, useState } from "react";
import { Plus, Filter } from "lucide-react";
import type { NoteSourceType } from "@/types";
import { SOURCE_META } from "@/types";
import { useExplanationStore } from "@/store/useExplanationStore";
import { NoteCard } from "./NoteCard";
import { NoteEditor } from "./NoteEditor";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type FilterKey = "all" | NoteSourceType | "influence";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "oldVersion", label: "旧版" },
  { key: "normal", label: "正常" },
  { key: "verbal", label: "口头" },
  { key: "influence", label: "仅影响结论" },
];

const ORDER: NoteSourceType[] = ["oldVersion", "normal", "verbal"];

export function NotesList() {
  const notes = useExplanationStore((s) => s.notes);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [editorOpen, setEditorOpen] = useState(false);

  const stats = useMemo(() => {
    const bySource: Record<NoteSourceType, { total: number; influence: number }> = {
      oldVersion: { total: 0, influence: 0 },
      normal: { total: 0, influence: 0 },
      verbal: { total: 0, influence: 0 },
    };
    for (const n of notes) {
      bySource[n.sourceType].total += 1;
      if (n.influencesConclusion) bySource[n.sourceType].influence += 1;
    }
    return bySource;
  }, [notes]);

  const filtered = useMemo(() => {
    if (filter === "all") return notes;
    if (filter === "influence") return notes.filter((n) => n.influencesConclusion);
    return notes.filter((n) => n.sourceType === filter);
  }, [notes, filter]);

  const grouped = useMemo(() => {
    const map: Record<NoteSourceType, typeof notes> = {
      oldVersion: [],
      normal: [],
      verbal: [],
    };
    for (const n of filtered) map[n.sourceType].push(n);
    return map;
  }, [filtered]);

  return (
    <div>
      {/* 谁影响了结论 · 来源汇总 */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ORDER.map((s) => {
          const m = SOURCE_META[s];
          const st = stats[s];
          const pct = st.total === 0 ? 0 : (st.influence / st.total) * 100;
          return (
            <div
              key={s}
              className="rounded-md border border-line bg-surface p-3"
              style={{ borderLeft: `3px solid ${m.colorVar}` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono-data text-[11px] uppercase tracking-wider" style={{ color: m.colorVar }}>
                  {m.label}
                </span>
                <span className="font-mono-data text-xs text-ink-mute">{st.total} 条</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono-data text-2xl font-semibold text-ink">{st.influence}</span>
                <span className="text-xs text-ink-mute">/ {st.total} 影响结论</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: m.colorVar }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 筛选 + 新增 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-ink-mute" />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-atlas border px-2 py-1 font-mono-data text-[11px] uppercase tracking-wider transition-colors",
                filter === f.key
                  ? "border-ink bg-ink text-bg"
                  : "border-line text-ink-soft hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditorOpen(true)}>
          新增备注
        </Button>
      </div>

      {/* 分组列表 */}
      <div className="space-y-5">
        {ORDER.map((s) => {
          const group = grouped[s];
          if (group.length === 0) return null;
          const m = SOURCE_META[s];
          return (
            <div key={s}>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.colorVar }} />
                <h4 className="font-display text-sm font-semibold text-ink">{m.label}</h4>
                <span className="font-mono-data text-[11px] text-ink-mute">{group.length} 条</span>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2">
                {group.map((n) => (
                  <NoteCard key={n.id} note={n} />
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-md border border-dashed border-line py-10 text-center text-sm text-ink-mute">
            当前筛选下没有备注
          </div>
        )}
      </div>

      <NoteEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
    </div>
  );
}
