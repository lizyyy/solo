import { CheckCircle2, AlertTriangle, Ban, HelpCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParamStatus, ResultStatus } from "@/engine/types";

type Tone = "pass" | "warn" | "block" | "muted" | "confirm";

const TONE: Record<Tone, { text: string; ring: string; bg: string; dot: string }> = {
  pass: { text: "text-pass", ring: "border-pass/40", bg: "bg-pass/10", dot: "bg-pass" },
  warn: { text: "text-warn", ring: "border-warn/40", bg: "bg-warn/10", dot: "bg-warn" },
  block: { text: "text-block", ring: "border-block/40", bg: "bg-block/10", dot: "bg-block" },
  muted: { text: "text-ash", ring: "border-line", bg: "bg-carbon-800/50", dot: "bg-ash" },
  confirm: { text: "text-amber", ring: "border-amber/40", bg: "bg-amber/10", dot: "bg-amber" },
};

const RESULT_TONE: Record<ResultStatus, Tone> = {
  pass: "pass",
  warn: "warn",
  blocked: "block",
};

const PARAM_TONE: Record<ParamStatus, Tone> = {
  ok: "pass",
  unit_missing: "block",
  blocked: "block",
  out_of_range: "warn",
};

const RESULT_LABEL: Record<ResultStatus, string> = {
  pass: "通过",
  warn: "越界警告",
  blocked: "已拦截",
};

const PARAM_LABEL: Record<ParamStatus, string> = {
  ok: "正常",
  unit_missing: "单位缺失",
  blocked: "拦截",
  out_of_range: "越界",
};

function Icon({ tone }: { tone: Tone }) {
  const cls = "h-3.5 w-3.5";
  if (tone === "pass") return <CheckCircle2 className={cls} />;
  if (tone === "warn") return <AlertTriangle className={cls} />;
  if (tone === "block") return <Ban className={cls} />;
  if (tone === "confirm") return <ShieldCheck className={cls} />;
  return <HelpCircle className={cls} />;
}

interface Props {
  kind: "result" | "param" | "plain";
  status?: ResultStatus | ParamStatus | "confirm";
  label?: string;
  className?: string;
}

export function StatusBadge({ kind, status, label, className }: Props) {
  let tone: Tone = "muted";
  let text = label ?? "";

  if (kind === "result" && status) {
    const s = status as ResultStatus;
    tone = RESULT_TONE[s];
    text = label ?? RESULT_LABEL[s];
  } else if (kind === "param" && status) {
    const s = status as ParamStatus;
    tone = PARAM_TONE[s];
    text = label ?? PARAM_LABEL[s];
  } else if (status === "confirm") {
    tone = "confirm";
    text = label ?? "已人工确认";
  }

  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] tracking-wide",
        t.text,
        t.ring,
        t.bg,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      <Icon tone={tone} />
      {text}
    </span>
  );
}
