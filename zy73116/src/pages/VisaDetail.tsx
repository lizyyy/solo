import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  MapPin,
  Ruler,
} from "lucide-react";
import { usePreReviewStore } from "@/store/preReviewStore";
import StatusBadge from "@/components/StatusBadge";

export default function VisaDetail() {
  const { visaNo = "" } = useParams();
  const { getVisaLinesByNo, getVisaNos, collisions } = usePreReviewStore();
  const visaNos = useMemo(() => getVisaNos(), [getVisaNos]);
  const lines = useMemo(() => getVisaLinesByNo(visaNo || visaNos[0] || ""), [visaNo, visaNos, getVisaLinesByNo]);
  const [active, setActive] = useState(visaNo || visaNos[0] || "");

  const biasCount = lines.filter((l) => l.causesBias).length;
  const totalOffset = lines.reduce((a, b) => a + Math.abs(b.offsetMm), 0);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="h-8 w-8 rounded-md border border-ink-700 bg-ink-800 text-ink-300 hover:text-ink-100 hover:border-ink-600 flex items-center justify-center transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-ink-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              现场签证单详情
            </h1>
            <p className="text-xs text-ink-500 mt-0.5">行级追踪 · 红色竖条标注拖偏预审的行</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {visaNos.map((v) => (
            <Link
              key={v}
              to={`/visa/${v}`}
              onClick={() => setActive(v)}
              className={`h-7 px-2.5 rounded-md border text-[11px] font-mono-num transition ${
                (active || visaNo) === v
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                  : "bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-600 hover:text-ink-100"
              }`}
            >
              {v}
            </Link>
          ))}
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-12 text-center text-sm text-ink-500">
          无该签证单记录
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <SummaryCard label="签证号" value={lines[0].visaNo} mono />
            <SummaryCard label="行数" value={String(lines.length)} mono />
            <SummaryCard label="拖偏行" value={String(biasCount)} accent="#ef4444" mono />
            <SummaryCard label="累计偏移" value={`${totalOffset} mm`} accent="#f59e0b" mono />
          </div>

          <section className="rounded-lg border border-ink-800 bg-ink-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
              <div className="text-sm font-medium text-ink-100">签证行明细</div>
              <div className="text-[11px] text-ink-500 flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1 h-3 rounded-sm bg-red-500" />
                  拖偏预审
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1 h-3 rounded-sm bg-ink-600" />
                  正常行
                </span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-ink-400 uppercase tracking-wider bg-ink-900/60">
                  <th className="w-1.5"></th>
                  <th className="text-left font-medium px-3 py-2.5 w-16">行号</th>
                  <th className="text-left font-medium px-3 py-2.5">内容</th>
                  <th className="text-left font-medium px-3 py-2.5 w-32">偏移量</th>
                  <th className="text-left font-medium px-3 py-2.5 w-40">关联碰撞</th>
                  <th className="text-left font-medium px-3 py-2.5 w-28">状态</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const col = collisions.find((c) => c.id === l.collisionId);
                  return (
                    <tr
                      key={l.id}
                      className={`border-t border-ink-800/60 ${idx % 2 === 0 ? "bg-ink-900/20" : ""} hover:bg-ink-800/40 transition`}
                    >
                      <td className="">
                        <span
                          className={`block w-1 h-full ${
                            l.causesBias ? "bg-red-500" : "bg-ink-700"
                          }`}
                          style={{ height: "52px" }}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono-num text-xs text-ink-400">L{l.lineNo}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-ink-200">{l.content}</span>
                          {l.causesBias && (
                            <span className="inline-flex items-center gap-1 shrink-0 mt-0.5 rounded px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              拖偏预审
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Ruler className={`w-3.5 h-3.5 ${l.offsetMm > 10 ? "text-red-400" : l.offsetMm > 0 ? "text-amber-400" : "text-ink-500"}`} />
                          <span
                            className={`font-mono-num text-xs ${
                              l.offsetMm > 10 ? "text-red-300" : l.offsetMm > 0 ? "text-amber-300" : "text-ink-400"
                            }`}
                          >
                            {l.offsetMm > 0 ? `+${l.offsetMm}` : l.offsetMm} mm
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {col ? (
                          <Link to="/" className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 hover:underline">
                            <MapPin className="w-3 h-3" />
                            <span className="font-mono-num">{col.pointCode}</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-ink-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {col ? (
                          <StatusBadge status={col.status} isDuplicate={col.isDuplicate} />
                        ) : (
                          <span className="text-ink-500 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {biasCount > 0 && (
            <section className="mt-5 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-md bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-red-300">拖偏预审的签证行</div>
                  <div className="text-[12px] text-red-200/80 mt-1">
                    共 {biasCount} 行超过允许偏差阈值,可能直接影响碰撞预审结论。点击碰撞点编码可跳转至预审面板定位对应记录。
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {lines
                      .filter((l) => l.causesBias)
                      .map((l) => (
                        <span
                          key={l.id}
                          className="inline-flex items-center gap-1 rounded-md bg-red-500/10 border border-red-500/25 px-2 py-1 text-[11px] text-red-300 font-mono-num"
                        >
                          {lines[0].visaNo} · L{l.lineNo}
                          <ArrowRight className="w-3 h-3 opacity-60" />
                          {l.offsetMm}mm
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent, mono }: { label: string; value: string; accent?: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-ink-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold ${mono ? "font-mono-num" : ""}`}
        style={{ color: accent || "#e2e8f0" }}
      >
        {value}
      </div>
    </div>
  );
}
