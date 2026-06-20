import { Layers } from "lucide-react";
import { useStore } from "@/store/useStore";
import { SAMPLES } from "@/engine/samples";
import FormulaPanel from "@/components/FormulaPanel";
import { ParamSetCard } from "@/components/ParamSetCard";
import { CalcStepList } from "@/components/CalcStepList";
import { ConclusionCard } from "@/components/ConclusionCard";
import { ReportDrawer } from "@/components/ReportDrawer";

const SAMPLE_LABEL: Record<string, string> = {
  normal: "正常对照",
  unit_missing: "单位缺失拦截",
  out_of_range: "越界警告",
};

export default function Workbench() {
  const setA = useStore((s) => s.setA);
  const setB = useStore((s) => s.setB);
  const result = useStore((s) => s.result);
  const loadSample = useStore((s) => s.loadSample);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-ash">
            attribution · workbench
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tightest text-bone">
            归因工作台
          </h1>
          <p className="mt-1 text-[12px] text-ash">
            公式 · 单位 · 边界值全程摆明；单位换算与中间计算不藏；A/B 两组对照，可逐行核对。
          </p>
        </div>
        <label className="flex items-center gap-2 border border-line bg-carbon-900/50 px-3 py-2">
          <Layers className="h-4 w-4 text-amber" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-ash">速载样例</span>
          <select
            defaultValue=""
            onChange={(e) => {
              const s = SAMPLES.find((x) => x.id === e.target.value);
              if (s) loadSample(s.setA, s.setB);
              e.target.value = "";
            }}
            className="border border-line bg-carbon-950/60 px-2 py-1 font-mono text-[12px] text-bone outline-none focus:border-amber/60"
          >
            <option value="">选择样例…</option>
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {SAMPLE_LABEL[s.id] ?? s.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="space-y-4">
        <FormulaPanel />

        <div className="grid gap-4 lg:grid-cols-2">
          <ParamSetCard set={setA} />
          <ParamSetCard set={setB} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CalcStepList group={result.groups.A} />
          <CalcStepList group={result.groups.B} />
        </div>

        <ConclusionCard />
      </div>

      <ReportDrawer />
    </div>
  );
}
