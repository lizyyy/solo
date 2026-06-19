import { useMemo } from "react";
import {
  Calculator,
  BarChart3,
  Target,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { useFittingStore } from "@/stores/fittingStore";
import { FORMULA_LABELS } from "@/engine/curveFitting";
import KatexBlock from "@/components/common/KatexBlock";
import { clsx } from "clsx";

export default function ResultPanel() {
  const s = useFittingStore();
  const fitting = s.fitting;
  const param = s.paramVersions.find((p) => p.id === s.currentParamId)!;
  if (!fitting) return null;

  const chartData = useMemo(() => {
    const points = fitting.scatter.map((p) => ({ x: Number(p.x.toFixed(4)), y: Number(p.y.toFixed(3)), fitted: Number(p.fitted.toFixed(3)), label: p.label }));
    const xs = points.map(p => p.x);
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);
    const linePts: typeof points = [];
    for (let i = 0; i <= 20; i++) {
      const xv = xmin + ((xmax - xmin) * i) / 20;
      const c = fitting.coefficients;
      let yv = 0;
      if (c.formula === "linear") yv = c.a * xv + c.b;
      else if (c.formula === "quadratic") yv = c.a * xv * xv + c.b * xv + (c.c ?? 0);
      else yv = c.a * Math.exp(c.b * xv);
      linePts.push({ x: Number(xv.toFixed(5)), y: undefined, fitted: Number(yv.toFixed(4)), label: "curve" });
    }
    return [...points, ...linePts];
  }, [fitting]);

  return (
    <div className="space-y-4">
      <Section
        title="① 中间计算过程"
        icon={<Calculator className="w-4 h-4" />}
        openKey="intermediate"
      >
        <div className="space-y-2">
          <p className="text-[11px] text-ink-500">
            以下为最小二乘法求解过程中的关键累加值，供复核与交接时追溯。
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Stat k="有效样本数 n" v={fitting.intermediate.n} />
            <Stat k="Σx" v={fitting.intermediate.sumX.toFixed(5)} />
            <Stat k="Σy" v={fitting.intermediate.sumY.toFixed(5)} />
            <Stat k="Σxy" v={fitting.intermediate.sumXY.toFixed(5)} />
            <Stat k="Σx²" v={fitting.intermediate.sumX2.toFixed(6)} />
            {fitting.intermediate.sumX3 !== undefined && (
              <Stat k="Σx³" v={fitting.intermediate.sumX3.toFixed(7)} />
            )}
            {fitting.intermediate.sumX4 !== undefined && (
              <Stat k="Σx⁴" v={fitting.intermediate.sumX4.toFixed(8)} />
            )}
            {fitting.intermediate.sumX2Y !== undefined && (
              <Stat k="Σx²y" v={fitting.intermediate.sumX2Y.toFixed(6)} />
            )}
            <Stat k="行列式 det(A)" v={fitting.intermediate.determinant?.toFixed(8) ?? "—"} />
          </div>
          {fitting.intermediate.usedLinearized && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-sm2 text-[11px] text-amber-900">
              ⚠ 本模型采用 <b>对数线性化</b> 方式求解（对 y 取 ln 后做线性拟合），RMSE 为原始尺度下的值。
            </div>
          )}
        </div>
      </Section>

      <Section
        title="② 最终系数与公式"
        icon={<TrendingUp className="w-4 h-4" />}
        openKey="final"
        defaultOpen
      >
        <div className="space-y-3">
          <div className="p-3 bg-paper rounded-sm2 border border-slate2-200">
            <div className="text-[11px] text-ink-500 mb-1.5">模型类型</div>
            <div className="flex items-center justify-between">
              <span className="font-serif text-sm text-ink-800">{FORMULA_LABELS[fitting.coefficients.formula].short}</span>
              <span className="chip-neutral">{param.name}</span>
            </div>
            <div className="mt-3">
              <KatexBlock
                tex={(() => {
                  const c = fitting.coefficients;
                  if (c.formula === "linear") return `y = ${c.a.toFixed(2)}x + ${c.b.toFixed(3)}`;
                  if (c.formula === "quadratic") return `y = ${c.a.toFixed(2)}x^2 + ${c.b.toFixed(3)}x + ${(c.c ?? 0).toFixed(3)}`;
                  return `y = ${c.a.toFixed(3)} \\cdot e^{${c.b.toFixed(2)}x}`;
                })()}
                display
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat k="系数 a" v={fitting.coefficients.a.toFixed(4)} highlight />
            <Stat k="系数 b" v={fitting.coefficients.b.toFixed(4)} highlight />
            {fitting.coefficients.c !== undefined && (
              <Stat k="系数 c" v={fitting.coefficients.c.toFixed(4)} highlight />
            )}
          </div>
          <p className="text-[11px] text-ink-500">
            系数解释（结合单位）：a 反映敏感率（N/m 即 N·m⁻¹），b 反映截距项（系统误差）。
          </p>
        </div>
      </Section>

      <Section
        title="③ 拟合质量评估"
        icon={<Target className="w-4 h-4" />}
        openKey="quality"
        defaultOpen
      >
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-sm2 bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] text-emerald-700 uppercase tracking-wide">R² 决定系数</div>
              <div className="font-mono text-lg font-semibold text-verdict-pass mt-0.5">
                {fitting.quality.rSquared.toFixed(4)}
              </div>
            </div>
            <div className="p-2.5 rounded-sm2 bg-ink-50 border border-ink-200">
              <div className="text-[10px] text-ink-600 uppercase tracking-wide">RMSE 均方根</div>
              <div className="font-mono text-lg font-semibold text-ink-800 mt-0.5">
                {fitting.quality.rmse.toFixed(4)}
              </div>
            </div>
            <div className="p-2.5 rounded-sm2 bg-ember-50 border border-ember-200">
              <div className="text-[10px] text-ember-700 uppercase tracking-wide">最大偏差 %</div>
              <div className={clsx(
                "font-mono text-lg font-semibold mt-0.5",
                fitting.quality.maxDeviationPct > 5 ? "text-verdict-fail" : "text-ember-700",
              )}>
                {fitting.quality.maxDeviationPct.toFixed(2)}%
              </div>
            </div>
            <div className="p-2.5 rounded-sm2 bg-ink-50 border border-ink-200">
              <div className="text-[10px] text-ink-600 uppercase tracking-wide">残差均值</div>
              <div className="font-mono text-lg font-semibold text-ink-800 mt-0.5">
                {fitting.quality.meanResidual.toFixed(5)}
              </div>
            </div>
          </div>
          <ExplainButton k="quality_exp">
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-ink-600">
              <li>R² ∈ [0, 1]，越接近 1 表示拟合越好；一般 ≥0.99 为优秀，&lt;0.95 需关注。</li>
              <li>RMSE 量纲与 y 相同（此处为 N），越小越好，用于比较不同模型。</li>
              <li>最大偏差若超过 5%，说明存在个别点偏离较大，建议在复核视图查看具体样本。</li>
              <li>残差均值接近 0 表示整体无系统性偏差（正负抵消）。</li>
            </ul>
          </ExplainButton>
        </div>
      </Section>

      <Section
        title="④ 散点与拟合曲线图"
        icon={<BarChart3 className="w-4 h-4" />}
        openKey="chart"
        defaultOpen
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf3" />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 10, fill: "#5a6b7c" }}
                stroke="#c9d4e2"
                label={{ value: "x (伸长量 m)", position: "bottom", offset: 5, style: { fontSize: 10, fill: "#5a6b7c" } }}
                type="number"
                domain={["auto", "auto"]}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#5a6b7c" }}
                stroke="#c9d4e2"
                label={{ value: "y (拉力 N)", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#5a6b7c" } }}
                type="number"
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 3, border: "1px solid #c9d4e2" }}
                formatter={(value: any, name: string) => {
                  if (value === undefined) return [];
                  if (name === "y") return [Number(value).toFixed(3) + " N", "实测 y"];
                  if (name === "fitted") return [Number(value).toFixed(3) + " N", "拟合 ŷ"];
                  return [value, name];
                }}
              />
              <Line
                type="monotone"
                dataKey="fitted"
                stroke="#1e3a5f"
                strokeWidth={2}
                dot={false}
                connectNulls
                name="拟合曲线"
              />
              <Scatter dataKey="y" fill="#e07b39" name="实测散点">
                {chartData.filter(d => d.y !== undefined).map((d, i) => (
                  <circle key={i} cx={0} cy={0} r={4} />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  openKey,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  openKey: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const s = useFittingStore();
  const open = s.explainOpen[openKey] ?? defaultOpen;
  return (
    <section className="card overflow-hidden">
      <button
        onClick={() => s.toggleExplain(openKey)}
        className="w-full card-header !py-2.5 hover:bg-ink-50/60"
      >
        <div className="flex items-center gap-2">
          <span className="text-ember-500">{icon}</span>
          <span className="card-title !text-sm">{title}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-ink-400" /> : <ChevronRight className="w-4 h-4 text-ink-400" />}
      </button>
      {open && <div className="p-3 pt-2 border-t border-ink-50">{children}</div>}
    </section>
  );
}

function Stat({ k, v, highlight }: { k: string; v: string | number; highlight?: boolean }) {
  return (
    <div className={clsx(
      "px-2.5 py-2 rounded-sm2 border",
      highlight ? "bg-ink-800 text-white border-ink-800" : "bg-ink-50 border-ink-100",
    )}>
      <div className={clsx("text-[10px] uppercase tracking-wide", highlight ? "text-ink-200" : "text-ink-500")}>{k}</div>
      <div className={clsx("font-mono mt-0.5 text-sm", highlight ? "text-amber-200" : "text-ink-800")}>{v}</div>
    </div>
  );
}

function ExplainButton({ k, children }: { k: string; children: React.ReactNode }) {
  const s = useFittingStore();
  const open = !!s.explainOpen[k];
  return (
    <div className="mt-1">
      <button onClick={() => s.toggleExplain(k)} className="btn-ghost !py-0.5 !text-[11px]">
        <HelpCircle className="w-3.5 h-3.5 text-ink-400" />
        为什么看这些指标？
      </button>
      {open && (
        <div className="mt-2 p-2.5 bg-paper border border-slate2-200 rounded-sm2">
          {children}
        </div>
      )}
    </div>
  );
}
