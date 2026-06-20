import { formatNum } from "@/lib/utils";
import type { ReviewRun, Step } from "@/lib/types";

function statusLabel(s: Step): { text: string; cls: string } {
  switch (s.status) {
    case "initial":
      return { text: "初始", cls: "text-inkMute" };
    case "ok":
      return { text: "正常", cls: "text-moss" };
    case "divzero":
      return { text: "除零 ×", cls: "text-vermilion" };
  }
}

export function StepperTable({
  run,
  caption,
}: {
  run: ReviewRun;
  caption?: string;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-rule bg-paper">
      {caption && (
        <div className="flex items-center justify-between border-b border-rule bg-paperDeep/60 px-3 py-1.5">
          <span className="font-mono text-xs text-inkSoft">{caption}</span>
          <span className="font-mono text-[11px] text-inkMute">
            {run.label}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-rule text-[11px] uppercase tracking-wide text-inkMute">
              <th className="px-3 py-2 font-medium">n</th>
              <th className="px-3 py-2 font-medium">a_n</th>
              <th className="px-3 py-2 font-medium">计算式</th>
              <th className="px-3 py-2 font-medium">分母值</th>
              <th className="px-3 py-2 font-medium">状态</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {run.result.map((s) => {
              const st = statusLabel(s);
              const isDiv = s.status === "divzero";
              const den = s.denIsBin ? `(${s.denStr})` : s.denStr;
              return (
                <tr
                  key={s.n}
                  className={`border-b border-rule/60 ${
                    isDiv ? "bg-vermilion/10" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-inkSoft">{s.n}</td>
                  <td className="px-3 py-2 font-semibold text-ink">
                    {formatNum(s.value)}
                  </td>
                  <td className="px-3 py-2 text-inkSoft">
                    {s.status === "initial"
                      ? "（给定边界）"
                      : `${s.numStr} ÷ ${den}`}
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      isDiv ? "font-bold text-vermilion" : "text-inkSoft"
                    }`}
                  >
                    {formatNum(s.denomValue)}
                  </td>
                  <td className={`px-3 py-2 ${st.cls}`}>{st.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
