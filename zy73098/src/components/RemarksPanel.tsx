import { useMemo, useState } from 'react';
import { FileText, MessageSquare, Mic, AlertTriangle, CheckCircle, Clock, XCircle, PenLine, Diff, Save } from 'lucide-react';
import { useReviewStore } from '../store/reviewStore';
import { SCHEME_COLORS, STATUS_LABEL } from '../data/mockData';
import type { RecordStatus } from '../types';

function diffTokens(a: string, b: string) {
  const tokensA = a.split(/(\d+㎡|\d+樘|\d+\.\d+m|[,，。；;、\s]+)/g).filter(Boolean);
  const tokensB = b.split(/(\d+㎡|\d+樘|\d+\.\d+m|[,，。；;、\s]+)/g).filter(Boolean);
  return { has: tokensA.some((t, i) => tokensB[i] !== undefined && t !== tokensB[i]) };
}

function RemarkColumn({
  title,
  icon: Icon,
  accent,
  value,
  onChange,
  canEdit,
  diffPeer
}: {
  title: string;
  icon: React.ElementType;
  accent: string;
  value: string | null;
  onChange?: (v: string) => void;
  canEdit?: boolean;
  diffPeer?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const hasDiff = useMemo(() => {
    if (!value || !diffPeer) return false;
    return diffTokens(value, diffPeer).has;
  }, [value, diffPeer]);

  return (
    <div className={'flex-1 rounded-[5px] border-2 bg-slate-900/60 backdrop-blur transition-all ' + (hasDiff ? 'border-rose-500/70 ring-1 ring-rose-500/40' : 'border-slate-600/60')}>
      <div className={'flex items-center gap-2 px-3 py-2 border-b ' + (hasDiff ? 'border-rose-500/50 bg-rose-500/10' : 'border-slate-700/70 bg-slate-800/60')}>
        <Icon size={14} style={{ color: accent }} />
        <span className="font-mono text-[11px] tracking-wider" style={{ color: accent }}>{title}</span>
        {hasDiff && (
          <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-rose-300">
            <Diff size={11} /> 口径差异
          </span>
        )}
        {canEdit && (
          <button
            onClick={() => setEditing((v) => !v)}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-mono bg-slate-700/70 text-slate-300 hover:bg-slate-600/80 transition"
          >
            <PenLine size={10} /> {editing ? '取消' : '补录'}
          </button>
        )}
      </div>
      <div className="p-3 min-h-[118px]">
        {editing && canEdit ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-[3px] bg-slate-950/70 border border-slate-600/60 p-2 font-mono text-[11.5px] text-slate-200 leading-relaxed outline-none focus:border-sky-400/80 focus:ring-1 focus:ring-sky-400/50"
              placeholder={`请输入${title}...`}
            />
            <button
              onClick={() => { onChange?.(draft); setEditing(false); }}
              className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] font-mono text-[11px] bg-sky-600/85 hover:bg-sky-500 text-white transition"
            >
              <Save size={11} /> 保存补录
            </button>
          </div>
        ) : (
          value ? (
            <p className={'font-mono text-[11.5px] leading-relaxed ' + (hasDiff ? 'text-rose-200' : 'text-slate-200')}>
              {value.split(/(\d+㎡|\d+樘|\d+\.\d+m|[甲乙丙]级|A级|B级)/g).map((seg, i) => {
                const isToken = /(\d+㎡|\d+樘|\d+\.\d+m|[甲乙丙]级|A级|B级)/.test(seg);
                return isToken ? (
                  <span key={i} className={'border-b-2 border-dashed mx-0.5 ' + (hasDiff ? 'border-rose-400 text-rose-100 font-semibold' : 'border-sky-400/70 text-sky-200')}>
                    {seg}
                  </span>
                ) : (
                  <span key={i}>{seg}</span>
                );
              })}
            </p>
          ) : (
            <div className="flex flex-col items-center justify-center h-[92px] text-slate-500 gap-1.5">
              <AlertTriangle size={16} className="text-amber-500/70" />
              <p className="font-mono text-[11px]">暂无备注</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function RemarksPanel() {
  const {
    zones,
    records,
    anomalies,
    activeScheme,
    selectedZoneId,
    timelineIndex,
    timeline,
    updateRecordStatus,
    patchRemarks,
    addAnomaly
  } = useReviewStore();

  const zone = zones.find((z) => z.id === selectedZoneId);
  const record = records.find((r) => r.zoneId === selectedZoneId && r.schemeId === activeScheme);
  const relatedAnomalies = anomalies.filter((a) => a.zoneId === selectedZoneId && a.schemeId === activeScheme);
  const timelineNode = timeline[timelineIndex];
  const { main: schemeColor } = SCHEME_COLORS[activeScheme];

  if (!zone) {
    return (
      <div className="h-full flex items-center justify-center text-center p-8">
        <div className="space-y-3 max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-full border-2 border-dashed border-slate-600/70 flex items-center justify-center">
            <MessageSquare size={24} className="text-slate-500" />
          </div>
          <h3 className="font-mono text-sm tracking-wider text-slate-300">未选中分区</h3>
          <p className="font-mono text-[11px] text-slate-500 leading-relaxed">
            在左侧 Web3D 视图中点击任意分区体块，即可查看该分区下 BIM 原备注 / 后补备注 / 临时口头说明的三源口径对比，并完成状态标记与补录。
          </p>
        </div>
      </div>
    );
  }

  const remarks = record?.remarks ?? {
    bimOriginal: null,
    supplementary: null,
    verbal: null,
    lastModified: new Date().toISOString(),
    hasConflict: false
  };

  function ensureRecordId() {
    if (record) return record.id;
    const newId = `REC-${String(records.length + 1).padStart(3, '0')}`;
    useReviewStore.setState((s) => ({
      records: [
        ...s.records,
        {
          id: newId,
          zoneId: zone.id,
          schemeId: activeScheme,
          versionAt: new Date().toISOString(),
          remarks: { bimOriginal: null, supplementary: null, verbal: null, lastModified: new Date().toISOString(), hasConflict: false },
          status: 'pending',
          fileConclusion: '新创建的待补件记录',
          anomalyIds: []
        }
      ]
    }));
    return newId;
  }

  function handleStatus(s: RecordStatus) {
    const rid = ensureRecordId();
    const conclusionMap: Record<RecordStatus, string> = {
      confirmed: `[${timelineNode.label}] ${zone.name} 三源口径已核对，送审口径统一，负责人复核通过。`,
      pending: `[${timelineNode.label}] ${zone.name} 待补后补备注，当前口径未统一，补录后需再次复核。`,
      returned: `[${timelineNode.label}] ${zone.name} 口径冲突或脏数据未清理，退回修改后重新提交。`
    };
    updateRecordStatus(rid, s, conclusionMap[s]);
  }

  function markAnomaly() {
    const rid = ensureRecordId();
    if (!record && !remarks.hasConflict) return;
    addAnomaly({
      type: record?.remarks.hasConflict ? 'remark_conflict' : relatedAnomalies.length ? 'collision_duplicate' : 'remark_missing',
      zoneId: zone.id,
      schemeId: activeScheme,
      description: `手动标记：${zone.name} 在 ${timelineNode.label} 发现异常`,
      detail: `记录编号 ${rid} · 触发时间 ${new Date().toLocaleString('zh-CN')} · 由建筑师小赵手动标记。请核对三源备注与碰撞清单。`
    });
  }

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-lg font-bold" style={{ color: schemeColor }}>{zone.id}</span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-[3px] bg-slate-800/80 text-slate-300 border border-slate-600/60">
              F{zone.floor} 层
            </span>
            {record && (
              <span className={'font-mono text-[10.5px] px-2 py-0.5 rounded-[3px] border ' + STATUS_LABEL[record.status].bg + ' ' + STATUS_LABEL[record.status].border + ' ' + STATUS_LABEL[record.status].color}>
                {STATUS_LABEL[record.status].text}
              </span>
            )}
          </div>
          <h3 className="font-mono text-[13px] text-slate-100 tracking-wider">{zone.name}</h3>
          <p className="font-mono text-[10.5px] text-slate-500 mt-1">
            时间轴版本：{timelineNode.date} · {timelineNode.label}
            {record?.reviewedAt && ` · 复核于 ${new Date(record.reviewedAt).toLocaleDateString('zh-CN')}`}
          </p>
        </div>
        {record?.remarks.diffHighlights && record.remarks.diffHighlights.length > 0 && (
          <div className="flex-shrink-0 max-w-[220px] rounded-[4px] bg-rose-500/10 border border-rose-500/40 p-2 space-y-1">
            <p className="font-mono text-[10px] text-rose-300 tracking-wider">⚠ 口径差异点</p>
            {record.remarks.diffHighlights.map((d, i) => (
              <p key={i} className="font-mono text-[10.5px] text-rose-200/90">· {d}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2.5 items-stretch">
        <RemarkColumn
          title="BIM 模型原备注"
          icon={FileText}
          accent="#7DD3FC"
          value={remarks.bimOriginal}
          diffPeer={remarks.supplementary ?? remarks.verbal ?? undefined}
          canEdit
          onChange={(v) => patchRemarks(record?.id ?? ensureRecordId(), { bimOriginal: v || null })}
        />
        <RemarkColumn
          title="后补备注"
          icon={PenLine}
          accent="#A7F3D0"
          value={remarks.supplementary}
          diffPeer={remarks.bimOriginal ?? remarks.verbal ?? undefined}
          canEdit
          onChange={(v) => patchRemarks(record?.id ?? ensureRecordId(), { supplementary: v || null })}
        />
        <RemarkColumn
          title="临时口头说明"
          icon={Mic}
          accent="#FDE68A"
          value={remarks.verbal}
          diffPeer={remarks.bimOriginal ?? remarks.supplementary ?? undefined}
          canEdit
          onChange={(v) => patchRemarks(record?.id ?? ensureRecordId(), { verbal: v || null })}
        />
      </div>

      {relatedAnomalies.length > 0 && (
        <div className="rounded-[5px] border border-rose-500/40 bg-rose-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-rose-400" />
            <span className="font-mono text-[11px] text-rose-300 tracking-wider">关联异常队列（{relatedAnomalies.length}）</span>
          </div>
          <ul className="space-y-1.5">
            {relatedAnomalies.map((a) => (
              <li key={a.id} className="flex items-start gap-2 font-mono text-[10.5px]">
                <span className={'flex-shrink-0 px-1.5 py-0.5 rounded-[2px] text-[9.5px] text-white ' + (
                  a.type === 'collision_duplicate' ? 'bg-rose-500/90'
                  : a.type === 'remark_conflict' ? 'bg-orange-500/90'
                  : 'bg-yellow-500/90'
                )}>
                  {a.type === 'collision_duplicate' ? '碰撞重复×' + (a.duplicateCount ?? 1)
                   : a.type === 'remark_conflict' ? '口径冲突' : '备注缺失'}
                </span>
                <span className="text-slate-300 leading-relaxed">{a.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-slate-700/60">
        <div className="mb-2">
          <p className="font-mono text-[10.5px] text-slate-500 mb-1">文件结论（导出时写入 CSV）</p>
          <p className="font-mono text-[11.5px] text-slate-300 leading-relaxed bg-slate-900/70 border border-slate-700/60 rounded-[3px] p-2 min-h-[44px]">
            {record?.fileConclusion ?? '尚未形成记录结论，点击下方按钮开始记录。'}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => handleStatus('confirmed')}
            className="flex items-center justify-center gap-1.5 py-2 rounded-[4px] font-mono text-[11px] tracking-wider bg-emerald-600/85 hover:bg-emerald-500 text-white border border-emerald-400/60 transition"
          >
            <CheckCircle size={13} /> 已确认
          </button>
          <button
            onClick={() => handleStatus('pending')}
            className="flex items-center justify-center gap-1.5 py-2 rounded-[4px] font-mono text-[11px] tracking-wider bg-amber-600/85 hover:bg-amber-500 text-white border border-amber-400/60 transition"
          >
            <Clock size={13} /> 待补件
          </button>
          <button
            onClick={() => handleStatus('returned')}
            className="flex items-center justify-center gap-1.5 py-2 rounded-[4px] font-mono text-[11px] tracking-wider bg-rose-600/85 hover:bg-rose-500 text-white border border-rose-400/60 transition"
          >
            <XCircle size={13} /> 退回
          </button>
          <button
            onClick={markAnomaly}
            className="flex items-center justify-center gap-1.5 py-2 rounded-[4px] font-mono text-[11px] tracking-wider bg-slate-700/85 hover:bg-slate-600 text-slate-100 border border-slate-500/70 transition"
          >
            <AlertTriangle size={13} /> 标记异常
          </button>
        </div>
      </div>
    </div>
  );
}
