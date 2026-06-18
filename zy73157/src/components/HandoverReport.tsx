import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeft, FileText, Copy, Check, CheckCircle2, Clock, AlertOctagon, Wind, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

export function HandoverReport() {
  const { setActiveView, samples, anomalies, driftEvents, stations, logbookEntries } = useAppStore(useShallow((s) => ({
    setActiveView: s.setActiveView,
    samples: s.samples,
    anomalies: s.anomalies,
    driftEvents: s.driftEvents,
    stations: s.stations,
    logbookEntries: s.logbookEntries,
  })));
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => {
    let processed = 0, pending = 0, blocked = 0, withdrawn = 0;
    samples.forEach((s) => {
      if (s.isWithdrawn) withdrawn++;
      else if (s.status === 'processed') processed++;
      else if (s.status === 'pending') pending++;
      else if (s.status === 'blocked') blocked++;
    });
    const summary = { processed, pendingEvidence: pending, blocked, anomalies: anomalies.length, withdrawn, driftEvents: driftEvents.length };

    const blockedItems: any[] = [];
    const pendingItems: any[] = [];
    anomalies.forEach((a) => {
      const station = stations.find((st) => st.id === a.stationId);
      const sample = samples.find((s) => s.id === a.sampleId);
      const lb = logbookEntries.find((l) => l.id === a.sourceLogbookId);
      if (!station || !sample || !lb) return;
      const source = { page: lb.page, line: lb.lineNumber, content: lb.content };
      if (a.evidenceStatus === 'none' || sample.status === 'blocked') {
        blockedItems.push({
          id: a.id, station: station.name, timestamp: sample.timestamp,
          description: a.description, blocker: a.nextAction || '待处理', logbookSource: source,
        });
      } else if (a.evidenceStatus === 'partial') {
        const missing: string[] = [];
        if (a.id === 'an-001') missing.push('CTD原始剖面数据文件');
        if (a.id === 'an-004') missing.push('化学滴定氧样瓶标签照片');
        pendingItems.push({
          id: a.id, station: station.name, description: a.description,
          missingEvidence: missing.length > 0 ? missing : ['未说明缺失项'], logbookSource: source,
        });
      }
    });
    const driftItems = driftEvents.map((d) => ({
      id: d.id, sensorType: d.sensorType, startTimestamp: d.startTimestamp,
      endTimestamp: d.endTimestamp, impact: d.impact, rootCause: d.rootCause, corrected: d.corrected,
    }));
    return {
      generatedAt: new Date().toISOString(),
      shift: '早班 06:00-14:00 / 老何',
      summary, blockedItems, pendingItems, driftItems,
    };
  }, [samples, anomalies, driftEvents, stations]);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
  };

  const textReport = `=== 深海采样交班简报 ===
生成时间：${fmtTime(report.generatedAt)}
值班：${report.shift}

【汇总】
已处理：${report.summary.processed} 条
待补证据：${report.summary.pendingEvidence} 条
卡着的：${report.summary.blocked} 条
异常点：${report.summary.anomalies} 条
撤回记录：${report.summary.withdrawn} 条
传感器漂移：${report.summary.driftEvents} 起

【卡着的异常 · 需要项目经理推进】
${report.blockedItems.map((it) => `· [${it.station}] ${it.description}
  阻塞原因：${it.blocker}
  记录来源：${it.logbookSource.page} L${it.logbookSource.line}`).join('\n\n')}

【待补证据 · 工程师跟进中】
${report.pendingItems.map((it) => `· [${it.station}] ${it.description}
  缺失证据：${it.missingEvidence.join('、')}
  记录来源：${it.logbookSource.page} L${it.logbookSource.line}`).join('\n\n')}

【传感器漂移事件】
${report.driftItems.map((d) => `· ${d.sensorType} 漂移 · ${d.corrected ? '已校准' : '未校准'}
  影响：${d.impact}
  根因：${d.rootCause}`).join('\n\n')}
`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setActiveView('main')} className="btn btn-ghost">
          <ArrowLeft size={14} />
          返回时序回放
        </button>
        <div className="flex gap-2">
          <button onClick={handleCopy} className="btn btn-primary">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '已复制到剪贴板' : '复制文字简报'}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header border-b-deepsea-700">
          <span className="flex items-center gap-2 text-base">
            <FileText size={16} />
            深海采样交班简报 — 项目经理交代视图
          </span>
          <span className="text-[11px] text-deepsea-300">{fmtTime(report.generatedAt)} · {report.shift}</span>
        </div>

        <div className="grid grid-cols-6 gap-3 border-b border-deepsea-700 p-4">
          <Stat label="已处理" value={report.summary.processed} tone="processed" icon={CheckCircle2} />
          <Stat label="待补证据" value={report.summary.pendingEvidence} tone="pending" icon={Clock} />
          <Stat label="卡着的" value={report.summary.blocked} tone="blocked" icon={AlertOctagon} highlight />
          <Stat label="异常点" value={report.summary.anomalies} tone="blocked" />
          <Stat label="撤回记录" value={report.summary.withdrawn} tone="pending" />
          <Stat label="传感器漂移" value={report.summary.driftEvents} tone="drift" icon={Wind} />
        </div>

        <div className="space-y-5 p-5">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <AlertOctagon size={14} className="text-status-blocked" />
              <h3 className="text-sm font-semibold text-status-blocked">卡着的异常 · 需要项目经理推进</h3>
              <span className="tag tag-blocked">{report.blockedItems.length} 条</span>
            </div>
            <div className="space-y-2">
              {report.blockedItems.map((it) => (
                <div key={it.id} className="rounded-lg border border-status-blocked/30 bg-status-blocked/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-deepsea-400">{it.id}</span>
                    <span className="tag tag-blocked">阻塞</span>
                  </div>
                  <div className="mt-1 text-sm text-deepsea-50">{it.description}</div>
                  <div className="mt-2 flex items-start gap-2 text-[11px] text-status-pending">
                    <ChevronRight size={12} className="mt-0.5 shrink-0" />
                    <div>阻塞原因：{it.blocker}</div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-deepsea-400">
                    <span>{it.station}</span>
                    <span>·</span>
                    <span>{fmtTime(it.timestamp)}</span>
                    <span>·</span>
                    <span className="font-mono">来源 {it.logbookSource.page} L{it.logbookSource.line}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <Clock size={14} className="text-status-pending" />
              <h3 className="text-sm font-semibold text-status-pending">待补证据 · 工程师跟进中</h3>
              <span className="tag tag-pending">{report.pendingItems.length} 条</span>
            </div>
            <div className="space-y-2">
              {report.pendingItems.map((it) => (
                <div key={it.id} className="rounded-lg border border-status-pending/30 bg-status-pending/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-deepsea-400">{it.id}</span>
                    <span className="tag tag-pending">待补证据</span>
                  </div>
                  <div className="mt-1 text-sm text-deepsea-50">{it.description}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {it.missingEvidence.map((e) => (
                      <span key={e} className="tag tag-pending">{e}</span>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-deepsea-400">
                    <span>{it.station}</span>
                    <span>·</span>
                    <span className="font-mono">来源 {it.logbookSource.page} L{it.logbookSource.line}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <Wind size={14} className="text-status-drift" />
              <h3 className="text-sm font-semibold text-status-drift">传感器漂移事件</h3>
              <span className="tag tag-drift">{report.driftItems.length} 起</span>
            </div>
            <div className="space-y-2">
              {report.driftItems.map((d) => (
                <div key={d.id} className="rounded-lg border border-status-drift/30 bg-status-drift/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-deepsea-400">{d.id}</span>
                    {d.corrected ? <span className="tag tag-processed">已校准修正</span> : <span className="tag tag-blocked">未校准</span>}
                  </div>
                  <div className="mt-1 text-sm text-deepsea-50">
                    <span className="tag tag-drift mr-1.5">{d.sensorType}</span>
                    {d.impact}
                  </div>
                  <div className="mt-1.5 text-[11px] text-deepsea-300">根因：{d.rootCause}</div>
                  <div className="mt-1 text-[11px] text-deepsea-400">
                    {fmtTime(d.startTimestamp)} — {fmtTime(d.endTimestamp)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-lg border border-deepsea-700 bg-deepsea-900/60 p-4">
            <div className="mb-2 text-[11px] font-medium text-deepsea-300">纯文字简报（可直接复制到群/邮件）</div>
            <pre className="whitespace-pre-wrap font-typewriter text-[12px] leading-relaxed text-deepsea-200">{textReport}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number;
  tone: 'processed' | 'pending' | 'blocked' | 'drift';
  icon?: typeof CheckCircle2;
  highlight?: boolean;
}) {
  const toneMap = {
    processed: 'text-status-processed border-status-processed/30',
    pending: 'text-status-pending border-status-pending/30',
    blocked: 'text-status-blocked border-status-blocked/40',
    drift: 'text-status-drift border-status-drift/30',
  };
  return (
    <div className={`rounded-lg border ${toneMap[tone]} bg-deepsea-900/40 p-3 ${highlight ? 'shadow-danger' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-deepsea-300">{label}</span>
        {Icon && <Icon size={12} className={toneMap[tone].split(' ')[0]} />}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold text-deepsea-50">{value}</div>
    </div>
  );
}
