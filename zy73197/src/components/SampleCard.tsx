import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import type { Sample, SampleTag } from "@/engine/types";

const TAG_META: Record<SampleTag, { label: string; cls: string }> = {
  normal: { label: "正常", cls: "text-pass border-pass/40 bg-pass/10" },
  unit_missing: { label: "单位缺失", cls: "text-block border-block/40 bg-block/10" },
  out_of_range: { label: "越界", cls: "text-warn border-warn/40 bg-warn/10" },
};

export function SampleCard({ sample }: { sample: Sample }) {
  const loadSample = useStore((s) => s.loadSample);
  const navigate = useNavigate();
  const tag = TAG_META[sample.tag];

  return (
    <div className="group flex flex-col border border-line bg-carbon-900/50 p-4 transition-colors hover:border-amber/40">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-display text-base font-bold tracking-tight text-bone">{sample.name}</h3>
        <span className={cn("ml-auto border px-2 py-0.5 font-mono text-[10px]", tag.cls)}>
          {tag.label}
        </span>
      </div>
      <p className="mb-4 flex-1 text-[12px] leading-relaxed text-ash">{sample.description}</p>
      <button
        onClick={() => {
          loadSample(sample.setA, sample.setB);
          navigate("/");
        }}
        className="inline-flex items-center justify-center gap-1.5 border border-amber/60 bg-amber/10 px-3 py-1.5 font-mono text-[12px] text-amber transition-colors hover:bg-amber/20"
      >
        载入工作台 <ArrowUpRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
