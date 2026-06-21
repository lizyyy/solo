import { useAppStore } from '../../store/useStore';
import HudCard from '../common/HudCard';
import {
  AlertTriangle,
  XCircle,
  Search,
  Clock,
  UserRound,
  MapPin,
  Layers,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Paperclip,
} from 'lucide-react';
import { anomalyTypeLabel, formatDate, formatTimeShort } from '../../utils/helpers';
import { twMerge } from 'tailwind-merge';
import type { AnomalyRecord } from '../../types';

function AnomalyItem({
  a,
  selected,
  onSelect,
}: {
  a: AnomalyRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const statusMap: Record<AnomalyRecord['status'], { text: string; cls: string }> = {
    open: { text: '待处理', cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
    investigating: {
      text: '核查中',
      cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    resolved: {
      text: '已处理',
      cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    ignored: {
      text: '已忽略',
      cls: 'bg-slate-600/30 text-slate-400 border-slate-500/40',
    },
  };
  const stat = statusMap[a.status];
  const accent =
    a.type === 'layer_name'
      ? 'text-red-300'
      : a.type === 'attachment_late'
        ? 'text-orange-300'
        : 'text-amber-300';
  const Icon = a.type === 'layer_name' ? Layers : Paperclip;
  return (
    <button
      onClick={onSelect}
      className={twMerge(
        'group relative w-full rounded-md border p-2.5 text-left transition-all',
        selected
          ? 'border-red-400/70 bg-red-500/5 shadow-[0_0_20px_-7px_rgba(239,68,68,0.6)]'
          : 'border-slate-700/60 bg-slate-800/30 hover:border-slate-500/60 hover:bg-slate-800/60',
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={twMerge(
            'mt-0.5 shrink-0 rounded-md p-1',
            a.type === 'layer_name'
              ? 'bg-red-500/20 text-red-300'
              : 'bg-orange-500/20 text-orange-300',
          )}
        >
          <Icon size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={twMerge('text-[12px] font-semibold', accent)}>
              {a.title}
            </span>
            <span
              className={twMerge(
                'ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] border',
                stat.cls,
              )}
            >
              {a.status === 'resolved' && (
                <CheckCircle2 size={9.5} className="mr-0.5 inline -mt-0.5" />
              )}
              {stat.text}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-400">
            <span className="font-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              #{a.schemeId}
            </span>
            <span>·</span>
            <span>{anomalyTypeLabel(a.type)}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <Clock size={10} />
              {formatTimeShort(a.firstDetected)}
            </span>
          </div>
        </div>
        <ChevronRight
          size={14}
          className={twMerge(
            'mt-1 shrink-0 transition-all',
            selected
              ? 'translate-x-0.5 text-red-400'
              : 'text-slate-600 group-hover:text-slate-400',
          )}
        />
      </div>
    </button>
  );
}

function AnomalyDetail({ anomaly }: { anomaly: AnomalyRecord }) {
  const allNotes = useAppStore((s) => s.notes);
  const schemes = useAppStore((s) => s.schemes);
  const allTimeline = useAppStore((s) => s.timeline);
  const note = allNotes.find((n) => n.id === anomaly.noteId);
  const scheme = schemes.find((x) => x.id === anomaly.schemeId)!;
  const timeline = allTimeline.filter(
    (t) => t.anomalyId === anomaly.id || t.noteId === anomaly.noteId,
  );

  return (
    <div className="rounded-md border border-red-500/40 bg-gradient-to-br from-red-500/5 to-slate-900/80 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-red-400">
        <Search size={11} />
        异常详情 · 链路追踪 · 变动原因
      </div>

      <div className="text-[13px] font-semibold text-red-200">{anomaly.title}</div>

      <div className="grid grid-cols-2 gap-2 text-[11.5px]">
        <div className="rounded border border-slate-700/60 bg-slate-900/60 p-2">
          <div className="flex items-center gap-1 text-slate-500">
            <MapPin size={10.5} />
            受影响区域
          </div>
          <div className="mt-0.5 font-mono text-slate-200">
            {anomaly.affectedZoneId ?? '全局'}
            <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-[9.5px] text-red-300 border border-red-500/30">
              3D 已标红高亮
            </span>
          </div>
        </div>
        <div className="rounded border border-slate-700/60 bg-slate-900/60 p-2">
          <div className="flex items-center gap-1 text-slate-500">
            <UserRound size={10.5} />
            责任人 / 方
          </div>
          <div className="mt-0.5 text-slate-200">{anomaly.responsible}</div>
        </div>
      </div>

      <div className="rounded border border-slate-700/60 bg-slate-900/60 p-2 space-y-1.5">
        <div className="flex items-center gap-1 text-[10.5px] text-slate-500">
          <XCircle size={10.5} />
          具体异常（从正常结果拎出，未混入汇总）
        </div>
        <div className="text-[11.5px] leading-relaxed text-slate-200 whitespace-pre-line">
          {anomaly.detail}
        </div>
      </div>

      <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 space-y-1.5">
        <div className="flex items-center gap-1 text-[10.5px] text-amber-400">
          <AlertTriangle size={10.5} />
          变动原因（链路可追）
        </div>
        <div className="text-[11.5px] leading-relaxed text-amber-100 whitespace-pre-line">
          {anomaly.cause}
        </div>
        <div className="pt-1 text-[10.5px] text-slate-400 flex items-center gap-1">
          <ClipboardList size={10.5} />
          关联方案 {scheme.id}「{scheme.name}」责任口径：{scheme.responsible}
        </div>
      </div>

      {note && (
        <div className="rounded border border-dashed border-slate-600/60 bg-slate-900/50 p-2 space-y-1">
          <div className="text-[10.5px] text-slate-500">
            关联备注原文（同一数据源，无三套话）
          </div>
          <div className="font-mono text-[11px] text-slate-300 rounded bg-slate-950/60 p-1.5 border border-slate-700/50"
               style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <span className="text-slate-500">[{note.layerName}]</span> {note.content}
            <span className="ml-2 text-slate-600">— {note.author} @ {formatDate(note.createdAt)}</span>
          </div>
        </div>
      )}

      {timeline.length > 0 && (
        <div className="rounded border border-slate-700/60 bg-slate-900/60 p-2 space-y-1.5">
          <div className="flex items-center gap-1 text-[10.5px] text-slate-400">
            <Clock size={10.5} />
            本异常相关时间线（与右下大时间线同源）
          </div>
          <div className="space-y-1">
            {timeline.slice(-4).map((t) => (
              <div
                key={t.id}
                className="flex gap-2 text-[10.5px] border-l-2 border-slate-600/50 pl-2"
              >
                <span className="font-mono text-slate-500 shrink-0 w-[76px]"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  {formatTimeShort(t.timestamp)}
                </span>
                <span className="text-slate-300 leading-snug">{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-0.5">
        {anomaly.status !== 'resolved' && (
          <button
            onClick={() => useAppStore.getState().resolveAnomaly(anomaly.id)}
            className="rounded border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/25 transition-colors"
          >
            <CheckCircle2 size={11} className="mr-1 inline -mt-0.5" />
            标记已处理
          </button>
        )}
        {anomaly.type === 'attachment_late' && note && note.materialStatus === 'late' && (
          <button
            onClick={() => useAppStore.getState().markAttachmentArrived(note.id)}
            className="rounded border border-orange-500/50 bg-orange-500/15 px-2.5 py-1 text-[11px] text-orange-200 hover:bg-orange-500/25 transition-colors"
          >
            <Paperclip size={11} className="mr-1 inline -mt-0.5" />
            模拟附件已到齐
          </button>
        )}
        <div className="ml-auto text-[10.5px] text-slate-500 self-center">
          可点 3D 红色闪烁区域 / 汇总卡片异常角标回到此处
        </div>
      </div>
    </div>
  );
}

export default function AnomalyList() {
  const selected = useAppStore((s) => s.selectedSchemeId);
  const anomaliesAll = useAppStore((s) => s.anomalies);
  const sel = useAppStore((s) => s.selectedAnomalyId);
  const byScheme = anomaliesAll.filter((a) => a.schemeId === selected);
  const selectedAnom = anomaliesAll.find((a) => a.id === sel);
  const active = anomaliesAll.filter((a) => a.status !== 'resolved').length;

  return (
    <HudCard
      title={`异常记录区 · 已从正常结果拎出 · ${active} 条待处理`}
      accent="red"
      icon={<AlertTriangle size={12} className="text-red-400" />}
      className="flex h-full min-h-[260px] flex-col"
    >
      <div className="flex items-center gap-1 border-b border-slate-700/50 px-3 py-1.5 text-[10.5px]">
        <button
          onClick={() => useAppStore.getState().setActivePanelTab('side')}
          className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          ← 回侧边说明
        </button>
        <span className="ml-auto text-slate-500">
          方案{selected}：{byScheme.length} 条异常
        </span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5">
        {anomaliesAll.length === 0 ? (
          <div className="flex h-[150px] items-center justify-center rounded-md border border-dashed border-slate-700/60 bg-slate-900/30 text-center text-[12px] text-slate-500">
            暂无异常 · 导入 BIM 备注后，图层命名混乱 & 晚到附件将自动拎出此处
          </div>
        ) : (
          <div className="space-y-2">
            {anomaliesAll.map((a) => (
              <AnomalyItem
                key={a.id}
                a={a}
                selected={a.id === sel}
                onSelect={() => useAppStore.getState().selectAnomaly(a.id)}
              />
            ))}
          </div>
        )}
        {selectedAnom && (
          <div className="mt-3">
            <AnomalyDetail anomaly={selectedAnom} />
          </div>
        )}
      </div>
    </HudCard>
  );
}
