import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, X, ArrowRightLeft } from "lucide-react";
import { useFittingStore } from "@/stores/fittingStore";
import type { DraftRow } from "@/types";

export default function UnitMissingDialog() {
  const s = useFittingStore();
  const openId = s.unitDialogOpenFor;
  const row: DraftRow | undefined = s.rows.find((r) => r.id === openId);
  const param = s.paramVersions.find((p) => p.id === s.currentParamId);

  const [xUnit, setXUnit] = useState("");
  const [yUnit, setYUnit] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState("仅本行");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (row && param) {
      const xDefault = param.unitTable.find((u) => u.variable === "x")?.si ?? "";
      const yDefault = param.unitTable.find((u) => u.variable === "y")?.si ?? "";
      setXUnit(row.xUnit ?? xDefault);
      setYUnit(row.yUnit ?? yDefault);
      setReason("");
      setScope("仅本行（S-C2 第 7 行草稿补录）");
      setErrors({});
    }
  }, [openId, row, param]);

  if (!row) return null;

  const xMissing = !row.xUnit;
  const yMissing = !row.yUnit;

  const onConfirm = () => {
    const nextErrors: Record<string, string> = {};
    if (xMissing && !xUnit.trim()) nextErrors.x = "请补录自变量单位";
    if (yMissing && !yUnit.trim()) nextErrors.y = "请补录因变量单位";
    if (!reason.trim() || reason.length < 6) nextErrors.reason = "请至少填写 6 个字的人工确认理由";
    if (!scope.trim()) nextErrors.scope = "请描述影响范围";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    s.confirmUnit(
      row.id,
      { x: xMissing ? xUnit.trim() : undefined, y: yMissing ? yUnit.trim() : undefined },
      reason.trim(),
      scope.trim(),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-sm">
      <div className="card shadow-pop w-full max-w-lg overflow-hidden animate-[fadeIn_.15s_ease-out]">
        <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-sm2 bg-red-500/15 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-base text-ink-900">单位缺失·需人工确认</h3>
            <p className="text-xs text-ink-600 mt-0.5">
              第 <b>{row.seqNo}</b> 行（学生 {row.studentId}）缺少单位字段。
              请依据实验记录人工补录，理由与影响范围将永久留存于验算结果。
            </p>
          </div>
          <button onClick={s.closeUnitDialog} className="btn-ghost !p-1 text-ink-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="p-3 bg-paper rounded-sm2 border border-slate2-200 text-xs text-ink-700 flex items-center gap-3">
            <ArrowRightLeft className="w-4 h-4 text-ember-500 shrink-0" />
            <div className="flex-1">
              <span className="font-mono">x = {row.x}</span>
              {xMissing ? <span className="chip-fail ml-2">单位缺失</span> : <span className="chip-pass ml-2">{row.xUnit}</span>}
              <span className="divider-dot" />
              <span className="font-mono">y = {row.y}</span>
              {yMissing ? <span className="chip-fail ml-2">单位缺失</span> : <span className="chip-pass ml-2">{row.yUnit}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">
                自变量 x 单位（建议 SI：{param?.unitTable.find((u) => u.variable === "x")?.si}）
              </label>
              <input
                value={xUnit}
                onChange={(e) => setXUnit(e.target.value)}
                disabled={!xMissing}
                className={`input-base font-mono ${errors.x ? "!border-red-400 !ring-red-200" : ""} ${!xMissing ? "!bg-ink-50 !text-ink-500" : ""}`}
                placeholder="如 m、cm、mm"
              />
              {errors.x && <p className="text-[11px] text-red-600 mt-1">{errors.x}</p>}
            </div>
            <div>
              <label className="label-base">
                因变量 y 单位（建议 SI：{param?.unitTable.find((u) => u.variable === "y")?.si}）
              </label>
              <input
                value={yUnit}
                onChange={(e) => setYUnit(e.target.value)}
                disabled={!yMissing}
                className={`input-base font-mono ${errors.y ? "!border-red-400 !ring-red-200" : ""} ${!yMissing ? "!bg-ink-50 !text-ink-500" : ""}`}
                placeholder="如 N、kg·m/s²"
              />
              {errors.y && <p className="text-[11px] text-red-600 mt-1">{errors.y}</p>}
            </div>
          </div>

          <div>
            <label className="label-base">
              人工确认理由 <span className="text-red-500">*</span>
              <span className="text-ink-400 ml-1">（至少 6 字）</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className={`input-base ${errors.reason ? "!border-red-400 !ring-red-200" : ""}`}
              placeholder="示例：参照实验原始记录表第 3 页，伸长量单位统一使用米（m）"
            />
            {errors.reason && <p className="text-[11px] text-red-600 mt-1">{errors.reason}</p>}
          </div>

          <div>
            <label className="label-base">影响范围描述</label>
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className={`input-base ${errors.scope ? "!border-red-400 !ring-red-200" : ""}`}
              placeholder="如：仅本行 / 本列所有空值行 / S-C 小组全部草稿"
            />
            {errors.scope && <p className="text-[11px] text-red-600 mt-1">{errors.scope}</p>}
          </div>

          <div className="p-3 bg-amber-50/70 rounded-sm2 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              确认后 <b>不可修改</b>，单位补录内容、确认理由、影响范围将同步出现在：行级详情 · 右侧结果面板 · 沟通摘要卡片 · 复核视图。
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-ink-50/60 border-t border-ink-100 flex justify-end gap-2">
          <button onClick={s.closeUnitDialog} className="btn-secondary">稍后处理</button>
          <button onClick={onConfirm} className="btn-primary">
            <CheckCircle2 className="w-4 h-4" /> 提交确认并重算
          </button>
        </div>
      </div>
    </div>
  );
}
