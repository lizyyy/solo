import { useState } from "react";
import {
  ClipboardCheck,
  User2,
  Calendar,
  Tag,
  BookmarkMinus,
  AlertTriangle,
  ArrowRightLeft,
  Printer,
  Copy,
  Link2,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import { useFittingStore } from "@/stores/fittingStore";
import { verifySummary, formatDateTime } from "@/utils/consistency";
import { summaryToPlainText, copyToClipboard, triggerPrint } from "@/utils/export";
import { Link } from "react-router-dom";
import { clsx } from "clsx";

export default function SummaryCard() {
  const s = useFittingStore();
  const summary = s.summary;
  const [copied, setCopied] = useState(false);
  const [verify, setVerify] = useState<{ ok: boolean; actual: string } | null>(null);

  if (!summary) return null;

  const v = verify ?? verifySummary(summary);
  const verdictBg =
    summary.verdictLevel === "pass" ? "bg-emerald-50 border-emerald-200 text-verdict-pass" :
    summary.verdictLevel === "warn" ? "bg-amber-50 border-amber-200 text-verdict-warn" :
    "bg-red-50 border-red-200 text-verdict-fail";

  const onCopy = async () => {
    const ok = await copyToClipboard(summaryToPlainText(summary));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="no-print flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-ink-600">
          <Link to="/" className="btn-secondary !py-1.5">
            <ChevronRight className="w-4 h-4 rotate-180" /> 返回验算主页
          </Link>
          <span className="divider-dot" />
          <Link to="/review" className="btn-ghost">查看复核视图</Link>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setVerify(verifySummary(summary))} className="btn-secondary !py-1.5">
            {v.ok ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-red-600" />}
            校验一致性
          </button>
          <button onClick={triggerPrint} className="btn-secondary !py-1.5">
            <Printer className="w-4 h-4" /> 打印
          </button>
          <button onClick={onCopy} className="btn-primary !py-1.5">
            <Copy className="w-4 h-4" /> {copied ? "已复制文本" : "复制文本"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-ink-200 shadow-card overflow-hidden">
        <div className="bg-gradient-to-r from-ink-800 to-ink-700 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-ink-300">Curve Fitting Audit · 沟通摘要</div>
              <h1 className="font-serif text-2xl mt-1.5">{s.session.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-200">
                <span className="flex items-center gap-1.5"><User2 className="w-3.5 h-3.5" /> 教练：{summary.coachName}</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> 验算时间：{formatDateTime(summary.auditedAt)}</span>
                <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> 参数版本：{summary.paramVersionName}</span>
                <span className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> 会话 ID：<span className="font-mono">{summary.sessionId}</span></span>
              </div>
            </div>
            <div className="shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-ink-300 mb-1">判断结论</div>
              <div className={clsx("px-4 py-2 rounded-sm2 border inline-flex items-center gap-2", verdictBg)}>
                <ClipboardCheck className="w-4 h-4" />
                <span className="font-medium">{summary.verdictText}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-6 divide-x divide-ink-100 border-b border-ink-100 bg-ink-50/40">
          <Stat k="样本总数" v={summary.totalRows} />
          <Stat k="有效拟合" v={summary.validRows} accent />
          <Stat k="撤回记录" v={summary.withdrawnRows} />
          <Stat k="边界样本" v={summary.boundaryRows} warn />
          <Stat k="单位缺失" v={summary.missingUnitRows} alert={summary.missingUnitRows > 0} />
          <Stat k="偏差>5%" v={summary.highDeviationRows} alert={summary.highDeviationRows > 0} />
        </div>

        <div className="px-6 py-5 space-y-4">
          <section>
            <SecTitle>拟合计要</SecTitle>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-sm2 border border-ink-100 bg-paper">
                <div className="text-[11px] text-ink-500 uppercase tracking-wide">公式模型</div>
                <div className="font-serif text-ink-800 mt-1 font-medium">{summary.formulaLabel}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-sm2 border border-emerald-200 bg-emerald-50/60">
                  <div className="text-[11px] text-emerald-700 uppercase tracking-wide">R² 决定系数</div>
                  <div className="font-mono text-lg font-semibold text-verdict-pass mt-0.5">{summary.rSquared.toFixed(4)}</div>
                </div>
                <div className="p-3 rounded-sm2 border border-ink-200 bg-ink-50">
                  <div className="text-[11px] text-ink-600 uppercase tracking-wide">RMSE</div>
                  <div className="font-mono text-lg font-semibold text-ink-800 mt-0.5">{summary.rmse.toFixed(4)}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <NoteCard icon={<BookmarkMinus className="w-4 h-4 text-ember-500" />} title="边界样本处理" body={summary.boundaryNote} />
            <NoteCard icon={<ArrowRightLeft className="w-4 h-4 text-ink-600" />} title="单位确认摘要" body={summary.unitNote} />
            <NoteCard icon={<AlertTriangle className="w-4 h-4 text-amber-600" />} title="异常处理摘要" body={summary.exceptionNote} />
          </section>

          <section>
            <SecTitle>交接备注（接手教练快速理解清单）</SecTitle>
            <ol className="space-y-2">
              {summary.handoffNotes.map((n, i) => (
                <li key={i} className="flex items-start gap-3 p-2.5 rounded-sm2 border border-ink-100 bg-paper/60 text-sm">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-ink-800 text-white text-xs flex items-center justify-center font-serif">
                    {i + 1}
                  </span>
                  <span className="text-ink-700 leading-relaxed">{n}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="px-6 py-3 bg-ink-50/60 border-t border-ink-100 flex items-center justify-between flex-wrap gap-3 text-[11px] text-ink-500">
          <div className="flex items-center gap-2">
            {v.ok ? (
              <span className="flex items-center gap-1 text-emerald-700"><ShieldCheck className="w-3.5 h-3.5" /> 摘要一致性校验通过</span>
            ) : (
              <span className="flex items-center gap-1 text-red-700"><ShieldAlert className="w-3.5 h-3.5" /> 校验失败：摘要内容可能被篡改</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>内容哈希：<code className="font-mono text-ember-700">{summary.hash}</code></span>
            {!v.ok && <span>实际：<code className="font-mono text-red-700">{v.actual}</code></span>}
            <span className="no-print">
              <Link to="/" className="text-ink-600 hover:text-ink-800 underline underline-offset-2">
                回到验算页面 →
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="w-1 h-4 bg-ember-500 rounded-sm" />
      <h3 className="font-serif text-sm text-ink-900 tracking-wide">{children}</h3>
    </div>
  );
}

function Stat({ k, v, accent, warn, alert }: { k: string; v: string | number; accent?: boolean; warn?: boolean; alert?: boolean }) {
  return (
    <div className="px-3 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-ink-500">{k}</div>
      <div className={clsx(
        "font-mono text-xl font-semibold mt-0.5",
        alert ? "text-verdict-fail" : warn ? "text-verdict-warn" : accent ? "text-ember-600" : "text-ink-800",
      )}>{v}</div>
    </div>
  );
}

function NoteCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="p-3 rounded-sm2 border border-ink-100 bg-white space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-medium text-ink-800">{title}</span>
      </div>
      <p className="text-xs text-ink-600 leading-relaxed">{body}</p>
    </div>
  );
}
