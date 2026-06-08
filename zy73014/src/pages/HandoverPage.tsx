import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  GripVertical,
  ArrowRightLeft,
  Sparkles,
  Eye,
} from 'lucide-react';
import { useStore } from '@/store';
import type { FollowUpStatus, FosterRegistration } from '@/types';
import { STATUS_LABEL } from '@/types';
import AbnormalBadge from '@/components/AbnormalBadge';
import StatusBadge from '@/components/StatusBadge';
import AnomalyDetailModal from '@/components/AnomalyDetailModal';

const COLUMNS: {
  key: FollowUpStatus;
  title: string;
  subtitle: string;
  icon: any;
  headerColor: string;
  emptyText: string;
  dropTargets: FollowUpStatus[];
}[] = [
  {
    key: 'pending',
    title: '挂起待确认',
    subtitle: '体重单位混写 / 算法不确定',
    icon: PauseCircle,
    headerColor: 'bg-status-hold/12 text-status-hold border-status-hold/30',
    emptyText: '没有挂起的记录，今天算法值班很顺利 🎉',
    dropTargets: ['need_material', 'released'],
  },
  {
    key: 'need_material',
    title: '待补材料',
    subtitle: '主人未联系上 / 纸质资料未齐',
    icon: AlertTriangle,
    headerColor: 'bg-status-wait/15 text-status-wait border-status-wait/40',
    emptyText: '没有需要补材料的记录',
    dropTargets: ['pending', 'released'],
  },
  {
    key: 'released',
    title: '放行清单',
    subtitle: '复核人 / 算法值班人已确认',
    icon: CheckCircle2,
    headerColor: 'bg-status-release/12 text-status-release border-status-release/35',
    emptyText: '还没有确认放行的记录',
    dropTargets: ['pending', 'need_material'],
  },
];

export default function HandoverPage() {
  const records = useStore((s) => s.records);
  const fosters = useStore((s) => s.fosters);
  const confirmPending = useStore((s) => s.confirmPendingRecord);
  const updateRecord = useStore((s) => s.updateRecordStatus);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<FollowUpStatus | null>(null);

  const fosterMap = useMemo(() => {
    const m: Record<string, FosterRegistration> = {};
    for (const f of fosters) m[f.id] = f;
    return m;
  }, [fosters]);

  const byStatus = useMemo(() => {
    const r: Record<string, typeof records> = { pending: [], need_material: [], released: [] };
    for (const rec of records) {
      if (rec.status in r) r[rec.status].push(rec);
    }
    return r;
  }, [records]);

  const counts = useMemo(() => {
    const total = records.filter((r) => ['pending', 'need_material', 'released'].includes(r.status)).length;
    const unresolved = records.filter((r) => r.status === 'pending' || r.status === 'need_material').length;
    return {
      total,
      released: records.filter((r) => r.status === 'released').length,
      unresolved,
    };
  }, [records]);

  const selected = selectedId ? records.find((r) => r.id === selectedId) ?? null : null;

  const moveRecord = (id: string, target: FollowUpStatus) => {
    const rec = records.find((r) => r.id === id);
    if (!rec) return;
    if (rec.status === target) return;
    if (rec.status === 'pending') {
      confirmPending(id, {
        status: target,
        operatorName: '阿凯（算法值班人·拖拽）',
        reason: `交接面板手动流转：${STATUS_LABEL[rec.status]} → ${STATUS_LABEL[target]}`,
      });
    } else {
      updateRecord(id, target, {
        operatorName: '阿凯（算法值班人·拖拽）',
        reason: `交接面板手动流转：${STATUS_LABEL[rec.status]} → ${STATUS_LABEL[target]}`,
      });
    }
  };

  return (
    <div className="space-y-5 animate-slideDown">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-brand-ink flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-brand-teal" />
            算法值班人交接视图
          </h2>
          <p className="text-sm font-kai text-brand-ink/60 mt-1">
            哪些能放行 · 哪些还缺材料 · 哪些挂起等你拍板 · 可直接拖拽跨栏流转
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm font-kai">
          <div className="rounded-card border border-slate-200 bg-white px-4 py-2 card-shadow">
            <div className="text-[10px] text-brand-ink/50">今日交接总计</div>
            <div className="font-serif font-bold text-lg text-brand-ink">{counts.total}</div>
          </div>
          <div className="rounded-card border border-status-release/30 bg-status-release/5 px-4 py-2 card-shadow">
            <div className="text-[10px] text-status-release/80">已放行</div>
            <div className="font-serif font-bold text-lg text-status-release">{counts.released}</div>
          </div>
          <div className="rounded-card border border-status-hold/30 bg-status-hold/5 px-4 py-2 card-shadow">
            <div className="text-[10px] text-status-hold/80">未闭环</div>
            <div className="font-serif font-bold text-lg text-status-hold">{counts.unresolved}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const Icon = col.icon;
          const items = byStatus[col.key] ?? [];
          return (
            <section
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setHoverCol(col.key);
              }}
              onDragLeave={() => setHoverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) moveRecord(id, col.key);
                setDraggingId(null);
                setHoverCol(null);
              }}
              className={[
                'rounded-card border-2 transition-all',
                hoverCol === col.key && draggingId
                  ? 'border-dashed border-brand-teal bg-brand-teal/5'
                  : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <header className={`rounded-t-[14px] border-b px-4 py-3 ${col.headerColor}`}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <h3 className="font-serif font-bold">{col.title}</h3>
                  <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 rounded-full bg-white/70 text-[11px] font-kai font-bold">
                    {items.length}
                  </span>
                </div>
                <p className="text-[11px] opacity-75 font-kai mt-1">{col.subtitle}</p>
              </header>

              <div className="p-3 space-y-3 min-h-[320px] max-h-[72vh] overflow-y-auto scrollbar-thin">
                {items.length === 0 && (
                  <div className="h-[320px] flex flex-col items-center justify-center gap-2 text-[12px] font-kai text-brand-ink/40 border-2 border-dashed border-slate-200 rounded-btn">
                    <Sparkles className="w-7 h-7 opacity-50" />
                    {col.emptyText}
                  </div>
                )}
                {items.map((rec) => {
                  const f = fosterMap[rec.fosterId];
                  const isDragging = draggingId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(rec.id);
                        e.dataTransfer.setData('text/plain', rec.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setHoverCol(null);
                      }}
                      className={[
                        'group rounded-btn border border-slate-200 p-3 bg-white card-shadow card-hover cursor-grab active:cursor-grabbing',
                        isDragging ? 'opacity-50 scale-[0.98]' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 text-brand-ink/30 group-hover:text-brand-ink/60 transition-colors">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-serif font-bold text-brand-ink">
                                {f?.petName ?? '—'}
                              </span>
                              <span className="ml-2 text-[10px] font-mono text-brand-ink/45">
                                {rec.id}
                              </span>
                            </div>
                            <StatusBadge status={rec.status} pulse={rec.status === 'pending'} />
                          </div>
                          <div className="text-[11px] font-kai text-brand-ink/60 mt-0.5">
                            {f?.ownerName ?? '—'} · {f?.ownerPhone ?? '—'} · {f?.breed ?? '—'}
                          </div>
                          {rec.abnormalTypes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {rec.abnormalTypes.map((t) => (
                                <AbnormalBadge key={t} type={t} />
                              ))}
                            </div>
                          )}
                          {rec.remark && (
                            <div className="mt-2 text-[11px] font-kai text-brand-ink/75 bg-brand-cream/50 border border-brand-orange/25 rounded-btn px-2 py-1.5 leading-relaxed">
                              📝 {rec.remark}
                            </div>
                          )}
                          <div className="mt-2 flex items-center justify-between text-[10px] font-kai text-brand-ink/45">
                            <span>更新于 {rec.updatedAt}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(rec.id);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 hover:bg-slate-50 btn-press"
                            >
                              <Eye className="w-3 h-3" />
                              看详情
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="rounded-card border border-slate-200 bg-white p-4 card-shadow flex flex-wrap items-center gap-3 text-[12px] font-kai text-brand-ink/70">
        <Sparkles className="w-4 h-4 text-brand-teal" />
        <span>
          交接提示：按住卡片<strong className="text-brand-ink">拖到邻栏</strong>就能手动流转；点「看详情」可回到登记表+计算口径+改判留痕
        </span>
        <span className="ml-auto text-brand-ink/40">
          交班人：阿凯 · 接班人：下次刷新系统确认
        </span>
      </div>

      {selected && (
        <AnomalyDetailModal record={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
