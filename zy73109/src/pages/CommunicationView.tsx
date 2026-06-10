import { useState } from 'react';
import {
  MessageSquare,
  Download,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  AlertTriangle,
  FileText,
  AlertCircle,
  CalendarDays,
  MapPin,
  ShieldCheck,
  ClipboardCheck,
  Users,
  Copy,
  Check,
  AlertOctagon,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { MOCK_BATCH } from '@/data/mockData';
import { SOURCE_META, ANOMALY_STATUS_META, type SourceType, type RecordItem } from '@/types';
import { cn } from '@/lib/utils';

function getSuggestedPerson(source: SourceType): string {
  switch (source) {
    case 'old_visa':
      return '设计档案组';
    case 'verbal':
      return '施工经理阿乔';
    case 'anomaly':
      return 'BIM组 / 算法组';
    case 'normal':
    default:
      return '设计校核组';
  }
}

function extractMissingItems(remark?: string): string[] {
  if (!remark) return ['需补充说明材料'];
  const clues = [
    '需确认', '需核对', '需补充', '待补', '需规划局', '需设计',
    '需签字', '无正式', '需提供', '待算法', '待BIM', '待设计'
  ];
  const found: string[] = [];
  for (const clue of clues) {
    const idx = remark.indexOf(clue);
    if (idx >= 0) {
      let end = idx + 20;
      const punct = ['。', '，', '；', '\n', '（', '('];
      for (const p of punct) {
        const pidx = remark.indexOf(p, idx);
        if (pidx > idx && pidx < end) end = pidx;
      }
      found.push(remark.slice(idx, Math.min(end, remark.length)).trim());
    }
  }
  return found.length > 0 ? found : [remark.trim()];
}

function ConfirmedCard({ record }: { record: RecordItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 px-5 py-4 hover:bg-emerald-50/50 transition-colors text-left"
      >
        <div className="flex-shrink-0 mt-0.5">
          {open ? (
            <ChevronDown className="w-4 h-4 text-emerald-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-emerald-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded">
              {record.code}
            </span>
            <span className="text-sm font-semibold text-slate-800 truncate">{record.title}</span>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
              SOURCE_META[record.source].bgColor,
              SOURCE_META[record.source].color,
              SOURCE_META[record.source].borderColor
            )}>
              {SOURCE_META[record.source].icon} {SOURCE_META[record.source].label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" />
              <span className="font-medium text-slate-600">{record.confirmBy ?? '—'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {record.confirmAt ?? '—'}
            </span>
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-emerald-100 px-5 py-4 space-y-4 bg-emerald-50/30">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">内容全文</p>
            <p className="text-sm text-slate-700 leading-relaxed">{record.content}</p>
          </div>
          {record.remark && (
            <div className="rounded-lg bg-white border border-slate-200 p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">备注</p>
              <p className="text-xs text-slate-600 leading-relaxed">{record.remark}</p>
            </div>
          )}
          {record.anomaly && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-1">关联异常信息</p>
              <p className="text-xs text-red-700 leading-relaxed">{record.anomaly.description}</p>
              <p className="text-[11px] text-red-600 mt-1">检测依据：{record.anomaly.detectionBasis}</p>
            </div>
          )}
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">结论摘要</p>
              <p className="text-xs text-emerald-800 leading-relaxed font-medium">{record.impactSummary}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {record.buildingInfo} {record.floorRange}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingCard({ record, onConfirm }: { record: RecordItem; onConfirm: () => void }) {
  const missingItems = extractMissingItems(record.remark);
  const suggestedPerson = getSuggestedPerson(record.source);

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50/80 to-white overflow-hidden shadow-sm">
      <div className="px-5 py-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded">
                {record.code}
              </span>
              <span className="text-sm font-bold text-slate-800">{record.title}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                SOURCE_META[record.source].bgColor,
                SOURCE_META[record.source].color,
                SOURCE_META[record.source].borderColor
              )}>
                {SOURCE_META[record.source].icon} {SOURCE_META[record.source].label}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <MapPin className="w-3 h-3" />
                {record.buildingInfo} {record.floorRange}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-white border border-amber-200 p-3">
          <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" />
            缺失项说明
          </p>
          <ul className="space-y-1.5">
            {missingItems.map((item, i) => (
              <li key={i} className="text-xs text-slate-700 leading-relaxed flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-white border border-slate-200 p-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              建议补充人
            </p>
            <p className="text-xs font-semibold text-slate-800">{suggestedPerson}</p>
          </div>
          <div className="rounded-lg bg-amber-100 border border-amber-300 p-3">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              补充截止提醒
            </p>
            <p className="text-xs font-bold text-red-600">建议 48h 内补充</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-500 truncate">
              <FileText className="w-3 h-3 inline mr-1" />
              内容：{record.content.slice(0, 50)}...
            </p>
          </div>
          <button
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-sm shadow-emerald-500/20 flex-shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            我已补充证据
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommunicationView() {
  const { records, batch, updateRecordStatus } = useAppStore();
  const [copied, setCopied] = useState(false);

  const confirmedRecords = records.filter((r) => r.status === 'confirmed');
  const pendingRecords = records.filter((r) => r.status === 'pending_evidence');
  const anomalyRecords = records.filter((r) => r.source === 'anomaly' && r.anomaly);

  const handleCopySummary = async () => {
    const batchInfo = batch ?? MOCK_BATCH;
    const confirmedList = confirmedRecords
      .map((r) => `  - [${r.code}] ${r.title}（确认人：${r.confirmBy ?? '-'}，${r.confirmAt ?? '-'}）`)
      .join('\n');
    const pendingList = pendingRecords
      .map((r) => `  - [${r.code}] ${r.title}（来源：${SOURCE_META[r.source].label}，建议补充人：${getSuggestedPerson(r.source)}）`)
      .join('\n');
    const anomalyList = anomalyRecords
      .map((r) => {
        const a = r.anomaly!;
        return `  - [${r.code}] ${a.typeLabel}：${ANOMALY_STATUS_META[a.handlingStatus].label}${a.handlingRemark ? ` - ${a.handlingRemark}` : ''}`;
      })
      .join('\n');

    const summary = `【交底沟通摘要】
批次号：${batchInfo.batchId}
项目：${batchInfo.projectName} - ${batchInfo.name}
导出时间：${new Date().toLocaleString('zh-CN')}

================ 已确认记录（${confirmedRecords.length}条）================
${confirmedList || '  （无）'}

================ 待补证据（${pendingRecords.length}条）================
${pendingList || '  （无）'}

================ 异常处理进展（${anomalyRecords.length}条）================
${anomalyList || '  （无）'}
`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert('复制失败，请手动复制');
    }
  };

  const handleConfirmRecord = (recordId: string) => {
    updateRecordStatus(recordId, 'confirmed', '当前用户');
  };

  return (
    <div className="doc-container space-y-5">
      <div className="doc-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-yellow/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">沟通视图</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                算法值班人沟通用：已确认 vs 待补证据，证据链一目了然
              </p>
            </div>
          </div>
          <button
            onClick={handleCopySummary}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all',
              copied
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                : 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-700 shadow-sm shadow-slate-900/20'
            )}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                已复制到剪贴板
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                导出沟通摘要
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="doc-card p-0 overflow-hidden border-l-4 border-l-emerald-500">
          <div className="px-5 py-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-emerald-900">已确认</h2>
              <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-full bg-emerald-500 text-white text-xs font-bold">
                {confirmedRecords.length}
              </span>
            </div>
            <span className="text-xs text-emerald-700/80">可作为正式交底依据</span>
          </div>
          <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
            {confirmedRecords.length > 0 ? (
              confirmedRecords.map((r) => <ConfirmedCard key={r.id} record={r} />)
            ) : (
              <div className="py-16 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-400" />
                <p className="text-sm text-slate-500">暂无已确认记录</p>
              </div>
            )}
          </div>
          <div className="px-5 py-3 bg-emerald-50/40 border-t border-emerald-100">
            <p className="text-[11px] text-emerald-800 leading-relaxed flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              以上记录已通过算法复核 + 人工确认，可作为正式交底依据
            </p>
          </div>
        </div>

        <div className="doc-card p-0 overflow-hidden border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50/30 to-white">
          <div className="px-5 py-4 bg-amber-50/60 border-b border-amber-200/80 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-amber-900">📋待补证据</h2>
              <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                {pendingRecords.length}
              </span>
            </div>
            <span className="text-xs text-amber-700/80">请尽快补充，避免影响交底</span>
          </div>
          <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
            {pendingRecords.length > 0 ? (
              pendingRecords.map((r) => (
                <PendingCard
                  key={r.id}
                  record={r}
                  onConfirm={() => handleConfirmRecord(r.id)}
                />
              ))
            ) : (
              <div className="py-16 text-center">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
                <p className="text-sm text-slate-500">所有证据已补齐，非常棒！</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="doc-card p-0 overflow-hidden border-l-4 border-l-red-500">
        <div className="px-5 py-4 bg-red-50/50 border-b border-red-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-red-900">异常处理进展</h2>
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-full bg-red-500 text-white text-xs font-bold">
              {anomalyRecords.length}
            </span>
          </div>
          <span className="text-xs text-red-700/80">异常未解决前不得用于正式交底</span>
        </div>
        <div className="p-5 space-y-3">
          {anomalyRecords.length > 0 ? (
            anomalyRecords.map((r) => {
              const a = r.anomaly!;
              const meta = ANOMALY_STATUS_META[a.handlingStatus];
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col lg:flex-row lg:items-start gap-4"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded">
                          {r.code}
                        </span>
                        <h3 className="text-sm font-bold text-slate-800">{a.typeLabel}</h3>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium",
                          meta.bgColor,
                          meta.color,
                          "border-current/20"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            a.handlingStatus === 'open' && "bg-red-500",
                            a.handlingStatus === 'in_progress' && "bg-orange-500 animate-pulse",
                            a.handlingStatus === 'resolved' && "bg-emerald-500",
                            a.handlingStatus === 'ignored' && "bg-slate-500"
                          )} />
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{r.title}</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{a.description}</p>
                      {a.handlingRemark && (
                        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                          <p className="text-[11px] font-semibold text-slate-500 mb-0.5">处理进展</p>
                          <p className="text-xs text-slate-700">{a.handlingRemark}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="lg:w-52 lg:flex-shrink-0 space-y-2 text-xs">
                    {a.handledBy && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>处理人：<span className="font-medium">{a.handledBy}</span></span>
                      </div>
                    )}
                    {a.handledAt && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>处理时间：<span className="font-medium">{a.handledAt}</span></span>
                      </div>
                    )}
                    {a.handlingSuggestion && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                        <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
                          预计完成
                        </p>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          {a.handlingSuggestion.length > 60
                            ? a.handlingSuggestion.slice(0, 60) + '...'
                            : a.handlingSuggestion}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center">
              <AlertOctagon className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-400" />
              <p className="text-sm text-slate-500">暂无异常记录，运行结果一切正常</p>
            </div>
          )}
        </div>
      </div>

      {copied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <Check className="w-4 h-4" />
          沟通摘要已复制到剪贴板
        </div>
      )}
    </div>
  );
}
