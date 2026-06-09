import { useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '../store/useAppStore';
import {
  FileText,
  Link2,
  GitBranch,
  MessageSquare,
  CircleAlert,
  ArrowRight,
  ChevronRight,
  Database,
  RefreshCcw,
} from 'lucide-react';
import { formatTime } from '../utils';

export default function ReportPanel() {
  const {
    reportSections,
    remarks,
    inspections,
    scrollToReportId,
    setScrollToReportId,
    setActiveTab,
    setSelectedInspection,
    criterion,
  } = useAppStore();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sortedSections = useMemo(
    () => [...reportSections].sort((a, b) => a.createdAt - b.createdAt),
    [reportSections]
  );

  useEffect(() => {
    if (scrollToReportId && sectionRefs.current[scrollToReportId]) {
      const el = sectionRefs.current[scrollToReportId];
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el?.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2', 'ring-offset-slate-900');
      const id = scrollToReportId;
      const t = setTimeout(() => {
        sectionRefs.current[id]?.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-2', 'ring-offset-slate-900');
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [scrollToReportId]);

  function buildChain() {
    return remarks
      .filter((r) => r.reportAnchorId)
      .map((r) => {
        const insp = inspections.find((i) => i.id === r.inspectionId);
        const section = reportSections.find((s) => s.id === r.reportAnchorId);
        return { remark: r, insp, section };
      })
      .filter((x) => x.section);
  }

  const chains = buildChain();

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-700/60">
        <h3 className="text-slate-100 font-semibold tracking-wide text-sm flex items-center gap-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          <FileText size={15} className="text-blue-400" />
          Markdown 报告 + 历史追溯链
        </h3>
        <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1.5">
          <Database size={10} className="text-emerald-400" />
          基于 localStorage 持久化 · 服务重启后可从备注继续追溯到此处结论
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {chains.length > 0 && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="text-xs text-blue-300 font-medium mb-2.5 flex items-center gap-1.5">
              <GitBranch size={13} />
              备注 → 异常 → 报告 关联链（排班同事交接班用）
            </div>
            <div className="space-y-2">
              {chains.map(({ remark, insp, section }, idx) => (
                <div
                  key={remark.id}
                  className="relative rounded border border-slate-700/70 bg-slate-800/50 p-2.5"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-center pt-1">
                      <ChevronRight size={14} className="text-blue-400" />
                      {idx < chains.length - 1 && (
                        <div className="w-px h-full flex-1 bg-gradient-to-b from-blue-500/40 to-transparent min-h-[32px]" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px] flex-wrap">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                          <MessageSquare size={9} /> 备注
                        </span>
                        <span className="text-slate-400">{remark.author}</span>
                        {remark.isSupplementary && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            补录
                          </span>
                        )}
                        <span className="text-slate-500">· {formatTime(remark.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-200 line-clamp-2">{remark.content}</p>

                      {insp && (
                        <button
                          onClick={() => {
                            setSelectedInspection(insp.id);
                            setActiveTab('detail');
                          }}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-slate-700/80 text-slate-300 hover:bg-slate-600 transition"
                        >
                          <CircleAlert size={9} /> 巡检表 {formatTime(insp.inspectionTime)}
                          <ArrowRight size={8} />
                        </button>
                      )}

                      <div className="flex items-center gap-1">
                        <ArrowRight size={10} className="text-blue-500/50" />
                        <button
                          onClick={() => setScrollToReportId(section!.id)}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition"
                        >
                          <Link2 size={9} /> {section!.title}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-700/70 bg-slate-800/40 p-3 text-[11px] text-slate-400 flex items-start gap-1.5">
          <RefreshCcw size={12} className="text-emerald-400 mt-0.5" />
          <span>
            <span className="text-emerald-400 font-medium">服务重启恢复说明：</span>
            本页面所有内容和「备注-巡检-报告」关联链均持久化在浏览器 localStorage 中（键：<code className="px-1 rounded bg-slate-700">cutter_*_v1</code>）。
            服务/浏览器重启后，接手同事打开本系统即可顺着历史备注继续定位到此处 Markdown 结论。
            <span className="block mt-1 text-slate-500">
              当前计算口径版本：<code className="px-1 rounded bg-slate-700 text-slate-300">{criterion.version}</code>（{criterion.updatedBy} · {formatTime(criterion.updatedAt)}）
            </span>
          </span>
        </div>

        <div className="space-y-3">
          {sortedSections.length === 0 && (
            <div className="text-sm text-slate-500 p-6 text-center border border-dashed border-slate-700 rounded-lg">
              暂无 Markdown 报告
            </div>
          )}
          {sortedSections.map((sec) => (
            <div
              key={sec.id}
              ref={(el) => (sectionRefs.current[sec.id] = el)}
              id={`report-${sec.id}`}
              className="rounded-lg border border-slate-700/70 bg-slate-900/60 overflow-hidden transition-all"
            >
              <div className="px-3 py-2 border-b border-slate-700/70 bg-slate-800/60 flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-slate-100 text-sm font-medium flex items-center gap-1.5">
                  <FileText size={13} className="text-blue-400" />
                  {sec.title}
                </h4>
                <span className="text-[10px] text-slate-500">生成于 {formatTime(sec.createdAt)}</span>
              </div>
              <div className="p-4 prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-li:text-slate-400 prose-strong:text-slate-100 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded prose-code:text-pink-300 prose-code:text-[11px] prose-th:text-slate-300 prose-td:text-slate-400">
                <ReactMarkdown>{sec.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
