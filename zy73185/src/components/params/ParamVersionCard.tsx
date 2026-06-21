import { useState } from "react";
import { Layers, Plus, X, Check, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { formatTime } from "@/utils/export";

export default function ParamVersionCard() {
  const {
    paramVersions,
    activeParamVersionId,
    setActiveParamVersion,
    createParamVersion,
    loading,
  } = useAppStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [tolerance, setTolerance] = useState(0.05);
  const [sigFigs, setSigFigs] = useState(3);
  const [roundingRule, setRoundingRule] = useState<
    "round" | "floor" | "ceil"
  >("round");
  const [submitting, setSubmitting] = useState(false);

  const submitNew = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    await createParamVersion({
      name: name.trim(),
      tolerance,
      roundingRule,
      sigFigs,
      isActive: true,
    });
    setAdding(false);
    setName("");
    setTolerance(0.05);
    setSigFigs(3);
    setRoundingRule("round");
    setSubmitting(false);
  };

  const ruleLabel = (r: string) =>
    r === "round" ? "四舍五入" : r === "floor" ? "向下" : "向上";

  return (
    <div className="card p-4 w-[340px] shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <Layers size={18} className="text-ink-500" />
        <h3 className="section-title !text-base">参数版本</h3>
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto text-xs text-ink-500 hover:text-ink-700 inline-flex items-center gap-1"
        >
          {adding ? <X size={14} /> : <Plus size={14} />}
          {adding ? "取消" : "新建"}
        </button>
      </div>

      {adding && (
        <div className="space-y-2 p-3 rounded-lg border border-fog-200 bg-fog-100 mb-3 animate-fade-in-up">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="版本名称，如 v3-期末标准"
            className="w-full p-2 text-sm rounded border border-fog-300 bg-white focus:outline-none focus:border-ink-300"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="label mb-1">容忍阈值</p>
              <input
                type="number"
                step={0.01}
                value={tolerance}
                onChange={(e) => setTolerance(parseFloat(e.target.value))}
                className="w-full p-1.5 text-xs rounded border border-fog-300 bg-white font-mono"
              />
            </div>
            <div>
              <p className="label mb-1">有效数字</p>
              <input
                type="number"
                min={1}
                max={8}
                value={sigFigs}
                onChange={(e) => setSigFigs(parseInt(e.target.value))}
                className="w-full p-1.5 text-xs rounded border border-fog-300 bg-white font-mono"
              />
            </div>
          </div>
          <div>
            <p className="label mb-1">舍入规则</p>
            <select
              value={roundingRule}
              onChange={(e) =>
                setRoundingRule(e.target.value as "round" | "floor" | "ceil")
              }
              className="w-full p-1.5 text-xs rounded border border-fog-300 bg-white"
            >
              <option value="round">四舍五入</option>
              <option value="floor">向下取整</option>
              <option value="ceil">向上取整</option>
            </select>
          </div>
          <button
            onClick={submitNew}
            disabled={submitting || !name.trim()}
            className="btn-primary w-full disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            保存新版本
          </button>
        </div>
      )}

      {paramVersions.length === 0 ? (
        <p className="text-xs text-ink-400 text-center py-3">
          暂无参数版本，点击"新建"创建
        </p>
      ) : (
        <ul className="space-y-2 max-h-[200px] overflow-y-auto scroll-thin pr-1">
          {paramVersions.map((pv) => {
            const active = pv.id === activeParamVersionId;
            return (
              <button
                key={pv.id}
                onClick={() => setActiveParamVersion(pv.id)}
                disabled={loading}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  active
                    ? "border-ink-300 bg-ink-50 shadow-card animate-flip-y"
                    : "border-fog-200 bg-fog-50 hover:bg-white hover:border-ink-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-serif font-semibold ${
                      active ? "text-ink-600" : "text-ink-500"
                    }`}
                  >
                    {pv.name}
                  </span>
                  {active && (
                    <span className="chip bg-moss-100 text-moss-600">
                      当前激活
                    </span>
                  )}
                </div>
                <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-ink-400 font-mono">
                  <span>容忍 {pv.tolerance}</span>
                  <span>有效 {pv.sigFigs}位</span>
                  <span>舍入 {ruleLabel(pv.roundingRule)}</span>
                </div>
                <p className="mt-1 text-[10px] text-ink-400">
                  建档 {formatTime(pv.createdAt)}
                </p>
              </button>
            );
          })}
        </ul>
      )}
    </div>
  );
}
