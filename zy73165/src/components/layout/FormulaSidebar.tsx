import { ChevronDown, ChevronRight, Info, Sigma } from "lucide-react";
import { useState } from "react";
import KatexBlock from "@/components/common/KatexBlock";
import { useFittingStore } from "@/stores/fittingStore";
import { FORMULA_LABELS } from "@/engine/curveFitting";

export default function FormulaSidebar() {
  const s = useFittingStore();
  const param = s.paramVersions.find((p) => p.id === s.currentParamId)!;
  const fitting = s.fitting;
  const [open, setOpen] = useState({ formula: true, unit: true, boundary: true, version: true });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <aside className="no-print w-[300px] shrink-0 bg-white border-r border-ink-100 overflow-y-auto h-full">
      <div className="p-4 space-y-4">
        <Section title="拟合公式" icon={<Sigma className="w-4 h-4" />} open={open.formula} onToggle={() => toggle("formula")}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="label-base !mb-0">公式类型</label>
            </div>
            <div className="space-y-1.5">
              {s.paramVersions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => s.setCurrentParam(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-sm2 border transition-all ${
                    p.id === s.currentParamId
                      ? "bg-ink-800 text-white border-ink-800 shadow-card"
                      : "bg-white text-ink-800 border-ink-200 hover:border-ink-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm">{p.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${
                      p.id === s.currentParamId ? "bg-white/15" : "bg-ink-100 text-ink-600"
                    }`}>
                      {FORMULA_LABELS[p.formula].short}
                    </span>
                  </div>
                  <div className={`text-xs mt-1 ${p.id === s.currentParamId ? "text-ink-200" : "text-ink-500"}`}>
                    {p.note}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 bg-paper rounded-sm2 border border-slate2-200">
              <div className="text-[11px] text-ink-500 mb-2">当前公式（代入系数）</div>
              {fitting && (
                <div className="font-serif text-ink-900">
                  <KatexBlock
                    tex={(() => {
                      const c = fitting.coefficients;
                      const a = c.a.toFixed(2);
                      const b = c.b.toFixed(3);
                      if (c.formula === "linear") return `y = ${a}x + ${b}`;
                      if (c.formula === "quadratic") {
                        const c2 = (c.c ?? 0).toFixed(3);
                        return `y = ${a}x^2 + ${b}x + ${c2}`;
                      }
                      return `y = ${a} \\cdot e^{${b}x}`;
                    })()}
                    display
                  />
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="变量与单位对照表" open={open.unit} onToggle={() => toggle("unit")}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-500 border-b border-ink-100">
                <th className="text-left py-1.5 font-medium">变量</th>
                <th className="text-left py-1.5 font-medium">含义</th>
                <th className="text-left py-1.5 font-medium">符号</th>
                <th className="text-left py-1.5 font-medium">SI 单位</th>
              </tr>
            </thead>
            <tbody>
              {param.unitTable.map((u) => (
                <tr key={u.variable} className="border-b border-ink-50">
                  <td className="py-2 font-mono font-semibold text-ink-800">{u.variable}</td>
                  <td className="py-2 text-ink-700">{u.name}</td>
                  <td className="py-2"><KatexBlock tex={u.symbol} /></td>
                  <td className="py-2 font-mono text-ember-600">{u.si}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-ink-500 mt-2 flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            单位缺失的行将暂停参与拟合，待人工确认并补录单位后继续。
          </p>
        </Section>

        <Section title="边界阈值表" open={open.boundary} onToggle={() => toggle("boundary")}>
          <div className="space-y-3">
            {param.boundaryTable.map((b) => (
              <div key={b.variable} className="p-3 rounded-sm2 border border-ember-100 bg-ember-50/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-sm font-semibold text-ink-800">{b.variable}</span>
                  <span className="chip-warn">±{b.tolerancePct}% 容差</span>
                </div>
                <div className="text-xs text-ink-700 font-mono">
                  范围：[{b.min}, {b.max}]
                </div>
                {b.note && (
                  <div className="text-[11px] text-ink-500 mt-1.5">{b.note}</div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="参数版本变更日志" open={open.version} onToggle={() => toggle("version")}>
          <ol className="relative border-l border-ink-100 ml-2 space-y-3">
            {[...s.paramVersions].reverse().map((p, i) => {
              const active = p.id === s.currentParamId;
              return (
                <li key={p.id} className="ml-4">
                  <span
                    className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      active ? "bg-ember-500 shadow-[0_0_0_2px_#e07b3930]" : "bg-ink-300"
                    }`}
                  />
                  <div className={`text-sm font-medium ${active ? "text-ink-900" : "text-ink-600"}`}>
                    {p.name}
                    {active && <span className="chip-pass ml-2">当前</span>}
                  </div>
                  <div className="text-[11px] text-ink-500">{p.createdBy} · {p.createdAt}</div>
                  <div className="text-xs text-ink-600 mt-0.5">{p.note}</div>
                  {i === 0 && (
                    <button
                      onClick={() => s.setCurrentParam(p.id)}
                      className="btn-ghost mt-1 !py-0.5 !text-xs"
                      disabled={active}
                    >
                      切换到此版本
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </Section>
      </div>
    </aside>
  );
}

function Section({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full card-header !py-2.5 !px-3 hover:bg-ink-50/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-ink-600">{icon}</span>}
          <span className="card-title !text-sm">{title}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-ink-400" /> : <ChevronRight className="w-4 h-4 text-ink-400" />}
      </button>
      {open && <div className="p-3 pt-1 border-t border-ink-50">{children}</div>}
    </section>
  );
}
