import { Link } from "react-router-dom";
import {
  FileSpreadsheet,
  AlertTriangle,
  BookmarkMinus,
  Tag,
  ClipboardCheck,
  Share2,
  Eye,
  RotateCcw,
} from "lucide-react";
import { useFittingStore } from "@/stores/fittingStore";
import { clsx } from "clsx";
import { summaryToPlainText, copyToClipboard } from "@/utils/export";
import { useState } from "react";

export default function TopSummaryBar() {
  const s = useFittingStore();
  const summary = s.summary;
  const [copied, setCopied] = useState(false);

  if (!summary) return null;

  const verdictColor =
    summary.verdictLevel === "pass"
      ? "text-emerald-200"
      : summary.verdictLevel === "warn"
        ? "text-amber-200"
        : "text-red-200";

  const verdictBg =
    summary.verdictLevel === "pass"
      ? "bg-emerald-500/15 border border-emerald-400/30"
      : summary.verdictLevel === "warn"
        ? "bg-amber-500/15 border border-amber-400/30"
        : "bg-red-500/15 border border-red-400/30";

  const onCopy = async () => {
    const ok = await copyToClipboard(summaryToPlainText(summary));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="no-print sticky top-0 z-30 bg-ink-800 text-white shadow-pop border-b border-ink-900/50">
      <div className="px-6 py-3 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2 min-w-[220px]">
          <FileSpreadsheet className="w-5 h-5 text-ember-300 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] uppercase tracking-wider text-ink-300">
              曲线拟合批量验算
            </span>
            <span className="font-serif text-sm text-white/95 truncate">
              {s.session.title}
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-ink-700 hidden md:block" />

        <Metric icon={<AlertTriangle className="w-3.5 h-3.5" />} label="异常数" value={summary.withdrawnRows + summary.missingUnitRows + summary.highDeviationRows} />
        <Metric icon={<BookmarkMinus className="w-3.5 h-3.5" />} label="边界样本" value={summary.boundaryRows} accent />
        <Metric icon={<Tag className="w-3.5 h-3.5" />} label="参数版本" value={summary.paramVersionName} />

        <div className="h-8 w-px bg-ink-700 hidden md:block" />

        <div className={clsx("px-3 py-1.5 rounded-sm2 flex items-center gap-2 min-w-[260px]", verdictBg)}>
          <ClipboardCheck className={clsx("w-4 h-4", verdictColor)} />
          <span className="text-xs text-ink-200">判断结论：</span>
          <span className={clsx("text-sm font-medium", verdictColor)}>{summary.verdictText}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/review" className="btn-secondary !bg-ink-700 !text-white !border-ink-600 hover:!bg-ink-600">
            <RotateCcw className="w-4 h-4" /> 复核视图
          </Link>
          <Link to="/summary" className="btn-secondary !bg-ink-700 !text-white !border-ink-600 hover:!bg-ink-600">
            <Eye className="w-4 h-4" /> 沟通摘要
          </Link>
          <button
            onClick={onCopy}
            className="btn-primary !bg-ember-500 hover:!bg-ember-600"
            title="复制摘要文本到剪贴板"
          >
            <Share2 className="w-4 h-4" />
            {copied ? "已复制" : "复制摘要"}
          </button>
        </div>
      </div>

      <div className="px-6 py-1.5 bg-ink-900/60 text-[11px] text-ink-400 flex items-center gap-4 flex-wrap border-t border-ink-950/50">
        <span>样本总数 <b className="text-ink-200 mx-1">{summary.totalRows}</b></span>
        <span>·</span>
        <span>有效参与拟合 <b className="text-ink-200 mx-1">{summary.validRows}</b></span>
        <span>·</span>
        <span>撤回 <b className="text-ink-200 mx-1">{summary.withdrawnRows}</b></span>
        <span>·</span>
        {summary.missingUnitRows > 0 ? (
          <span>单位 <b className="text-red-300 mx-1">待处理 {summary.missingUnitRows}</b>{summary.confirmedUnitRows > 0 && <> / 已确认 <b className="text-emerald-300 mx-1">{summary.confirmedUnitRows}</b></>}</span>
        ) : summary.confirmedUnitRows > 0 ? (
          <span>单位 <b className="text-emerald-300 mx-1">已确认 {summary.confirmedUnitRows}</b></span>
        ) : (
          <span>单位 <b className="text-ink-200 mx-1">齐全</b></span>
        )}
        <span>·</span>
        <span>R² <b className="text-ink-200 mx-1 font-mono">{summary.rSquared.toFixed(4)}</b></span>
        <span>·</span>
        <span>RMSE <b className="text-ink-200 mx-1 font-mono">{summary.rmse.toFixed(4)}</b></span>
        <span className="ml-auto">校验码 <span className="font-mono text-ember-300">{summary.hash}</span></span>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className={clsx("w-6 h-6 rounded-sm2 flex items-center justify-center",
        accent ? "bg-ember-500/20 text-ember-300" : "bg-ink-700 text-ink-300",
      )}>
        {icon}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider text-ink-400">{label}</span>
        <span className={clsx("text-sm font-medium", accent ? "text-ember-300" : "text-white/95")}>{value}</span>
      </div>
    </div>
  );
}
