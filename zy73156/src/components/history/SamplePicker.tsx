import { RECORD_KIND_META } from "@/data/types";
import { cn } from "@/lib/utils";
import { useOceanStore } from "@/store/useOceanStore";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function SamplePicker({ selectedId, onSelect }: Props) {
  const samples = useOceanStore((s) => s.samples);

  return (
    <div className="flex flex-wrap gap-2">
      {samples.map((s) => {
        const active = s.id === selectedId;
        const meta = RECORD_KIND_META[s.kind];
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              "group flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition",
              active
                ? "border-glow-cyan/50 bg-glow-cyan/10 shadow-glow"
                : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", meta.color.replace("text-", "bg-"))} />
            <div>
              <div
                className={cn(
                  "font-mono text-[11px] font-semibold",
                  active ? "text-glow-cyan" : "text-slate-200",
                )}
              >
                {s.code}
              </div>
              <div className="font-mono text-[9px] text-slate-500">
                {s.label} · {meta.label}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
