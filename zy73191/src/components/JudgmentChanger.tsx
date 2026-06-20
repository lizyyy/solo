import { useState } from "react";
import { useReviewStore, boundarySafetyFactKey } from "@/store/useReviewStore";

const SUGGESTIONS = [
  "边界安全（未见异常）",
  "边界有除零风险（n=3）",
  "按后补备注修正，边界安全",
];

export function JudgmentChanger() {
  const judgments = useReviewStore((s) => s.judgments);
  const record = useReviewStore((s) => s.recordJudgment);
  const current =
    judgments.find((j) => j.factKey === boundarySafetyFactKey)?.value ??
    "—（未复核）";

  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [actor, setActor] = useState("小岑");
  const [done, setDone] = useState(false);

  const canSubmit = value.trim().length > 0 && reason.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    record({
      factKey: boundarySafetyFactKey,
      nextValue: value.trim(),
      reason: reason.trim(),
      actor: actor.trim() || "匿名",
    });
    setValue("");
    setReason("");
    setDone(true);
    window.setTimeout(() => setDone(false), 2600);
  };

  return (
    <section className="rounded-sm border border-rule bg-paper p-5 shadow-dossier">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-serif text-lg font-bold text-ink">临时改判断</h3>
        <span className="text-[11px] text-inkMute">
          当前：<span className="font-mono text-inkSoft">{current}</span>
        </span>
      </div>
      <p className="mt-1 text-xs text-inkMute">
        改判断会强制写入原因，留痕到「判断历史」，下一班看到的是变更链而非仅最终值。
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] text-inkMute">新判断值</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="如：边界有除零风险（n=3）"
            className="mt-1 w-full rounded-sm border border-rule bg-paperDeep/40 px-3 py-2 font-mono text-sm text-ink outline-none focus:border-vermilion"
          />
          <span className="mt-1 flex flex-wrap gap-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue(s)}
                className="rounded-sm border border-rule px-1.5 py-0.5 text-[11px] text-inkSoft hover:bg-paperDeep"
              >
                {s}
              </button>
            ))}
          </span>
        </label>
        <label className="block">
          <span className="text-[11px] text-inkMute">操作人</span>
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="mt-1 w-full rounded-sm border border-rule bg-paperDeep/40 px-3 py-2 font-mono text-sm text-ink outline-none focus:border-vermilion"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-[11px] text-inkMute">改判断的原因（必填）</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="如：补算 n=3，分母 a_{n-2}-3 在 a_1=3 时为 0，源自历史答案 v1（旧版）。"
          className="mt-1 w-full rounded-sm border border-rule bg-paperDeep/40 px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
        />
      </label>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-sm bg-vermilion px-4 py-2 text-sm font-medium text-paper transition hover:bg-vermilion-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          提交并留痕
        </button>
        {done && (
          <span className="text-xs text-moss">
            已写入判断历史，下一班可在「判断历史」查看原因。
          </span>
        )}
      </div>
    </section>
  );
}
