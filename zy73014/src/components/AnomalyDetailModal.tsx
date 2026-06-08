import { useEffect, useState } from 'react';
import {
  X,
  ArrowLeftRight,
  FileText,
  Clock,
  Scale,
  AlertTriangle,
  CheckCircle2,
  History,
  User,
  UserCog,
  ChevronRight,
  RefreshCcw,
} from 'lucide-react';
import type { AuditLog, FosterRegistration, FollowUpRecord } from '@/types';
import { FIELD_LABEL, STATUS_COLOR, STATUS_LABEL } from '@/types';
import { getCalcRule, parseWeight } from '@/utils';
import StatusBadge from '@/components/StatusBadge';
import { useStore } from '@/store';

interface Props {
  record: FollowUpRecord;
  onClose: () => void;
}

export default function AnomalyDetailModal({ record, onClose }: Props) {
  const fosters = useStore((s) => s.fosters);
  const auditLogs = useStore((s) => s.auditLogs);
  const confirmPending = useStore((s) => s.confirmPendingRecord);
  const updateRecord = useStore((s) => s.updateRecordStatus);

  const foster = fosters.find((f) => f.id === record.fosterId);
  const logs = auditLogs.filter((l) => l.recordId === record.id).sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : 1,
  );
  const rule = getCalcRule(record.calcRuleVersion);

  const [pendingResolve, setPendingResolve] = useState<'released' | 'need_material' | null>(null);
  const [confirmRemark, setConfirmRemark] = useState('');
  const [confirmReason, setConfirmReason] = useState('');
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignStatus, setReassignStatus] = useState<FollowUpRecord['status']>('released');
  const [reassignRemark, setReassignRemark] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirmPending = () => {
    if (!pendingResolve) return;
    confirmPending(record.id, {
      status: pendingResolve,
      operatorName: '阿凯（算法值班人）',
      remark: confirmRemark || undefined,
      reason: confirmReason || undefined,
    });
    setPendingResolve(null);
    setConfirmRemark('');
    setConfirmReason('');
  };

  const handleReassign = () => {
    updateRecord(record.id, reassignStatus, {
      operatorName: '周姐（复核人）',
      remark: reassignRemark || undefined,
      reason: reassignReason || undefined,
    });
    setReassignOpen(false);
    setReassignRemark('');
    setReassignReason('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center py-8 px-4 overflow-y-auto animate-slideDown"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[1080px] rounded-card bg-white border border-slate-200 card-shadow"
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-200 bg-gradient-to-r from-brand-cream/60 via-white to-white">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-status-hold/12 text-status-hold flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-xl font-bold text-brand-ink">
                  寄养回访追踪 · {record.id}
                </h2>
                <StatusBadge status={record.status} pulse={record.status === 'pending'} />
                <span className="text-[11px] font-kai text-brand-ink/50">
                  口径版本 {record.calcRuleVersion}
                </span>
              </div>
              <p className="text-sm font-kai text-brand-ink/65 mt-1">
                {foster?.petName} · {foster?.ownerName} · {foster?.ownerPhone} · 追踪创建于{' '}
                {record.createdAt}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-brand-ink/60 btn-press transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-12 gap-5 p-5">
          <div className="md:col-span-8 space-y-5">
            <FosterFormSnapshot foster={foster} diffFields={record.diffFields} />

            <section className="rounded-card border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-brand-teal" />
                  <h3 className="font-serif font-bold text-brand-ink">新旧记录对比</h3>
                </div>
                <div className="text-[11px] font-kai text-brand-ink/50">
                  差异字段 {record.diffFields.length} 处
                </div>
              </div>
              <DiffTable
                oldSnap={record.oldSnapshot}
                newSnap={record.newSnapshot}
                diffFields={record.diffFields}
              />
            </section>

            <section className="rounded-card border border-slate-200 p-4 bg-brand-cream/30">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-brand-teal" />
                <h3 className="font-serif font-bold text-brand-ink">本次计算口径</h3>
                <span className="text-[11px] font-kai text-brand-ink/50 ml-auto">
                  {rule.name}
                </span>
              </div>
              <ul className="space-y-1 text-[12px] font-kai text-brand-ink/80 list-disc pl-5 marker:text-brand-teal">
                {rule.rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-brand-teal/20">
                <div className="text-[12px] font-kai text-brand-teal/90 mb-1">放行条件</div>
                <ul className="space-y-1 text-[12px] font-kai text-brand-ink/80 list-disc pl-5 marker:text-brand-teal">
                  {rule.released.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <div className="md:col-span-4 space-y-5">
            <section
              className={[
                'rounded-card border-2 p-4',
                record.weightUnitMixed
                  ? 'bg-status-hold/5 border-status-hold/40'
                  : 'bg-slate-50 border-slate-200',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-4 h-4 text-status-hold" />
                <h3 className="font-serif font-bold text-brand-ink">体重处理逻辑</h3>
              </div>
              <WeightPanel record={record} />
              {record.weightUnitMixed && (
                <div className="mt-3">
                  <div className="text-[11px] font-kai text-status-hold/90 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    已自动挂起：宁挂起不做假稳定结论，请算法值班人确认
                  </div>
                  {pendingResolve === null ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPendingResolve('released')}
                        className="flex-1 text-xs font-kai py-1.5 rounded-btn bg-status-release/15 text-status-release border border-status-release/40 btn-press hover:bg-status-release/25"
                      >
                        确认后放行
                      </button>
                      <button
                        onClick={() => setPendingResolve('need_material')}
                        className="flex-1 text-xs font-kai py-1.5 rounded-btn bg-status-wait/20 text-status-wait border border-status-wait/50 btn-press hover:bg-status-wait/30"
                      >
                        转待补材料
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={confirmRemark}
                        onChange={(e) => setConfirmRemark(e.target.value)}
                        placeholder="补充说明（例如：致电主人确认，应以磅为准）"
                        className="w-full text-xs font-kai p-2 rounded-btn border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
                        rows={2}
                      />
                      <textarea
                        value={confirmReason}
                        onChange={(e) => setConfirmReason(e.target.value)}
                        placeholder="改判原因（将写入历史追溯）"
                        className="w-full text-xs font-kai p-2 rounded-btn border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleConfirmPending}
                          className="flex-1 text-xs font-kai py-1.5 rounded-btn bg-brand-ink text-white btn-press hover:bg-brand-ink/90"
                        >
                          确认并提交
                        </button>
                        <button
                          onClick={() => setPendingResolve(null)}
                          className="text-xs font-kai py-1.5 px-3 rounded-btn border border-slate-200 btn-press hover:bg-slate-50"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-card border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4 text-brand-teal" />
                  <h3 className="font-serif font-bold text-brand-ink">复核改判</h3>
                </div>
                <button
                  onClick={() => setReassignOpen((v) => !v)}
                  className="text-[11px] font-kai px-2.5 py-1 rounded-btn border border-slate-200 btn-press hover:bg-slate-50"
                >
                  {reassignOpen ? '收起' : '展开'}
                </button>
              </div>
              <div className="text-[11px] font-kai text-brand-ink/60 mb-2">
                当前状态：
                <span
                  className={[
                    'inline-flex items-center gap-1 px-2 py-0.5 ml-1 rounded-full border',
                    STATUS_COLOR[record.status],
                  ].join(' ')}
                >
                  {STATUS_LABEL[record.status]}
                </span>
              </div>
              {reassignOpen && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-kai">
                    {(['released', 'need_material', 'abnormal', 'normal'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setReassignStatus(s)}
                        className={[
                          'px-2 py-1.5 rounded-btn border transition-colors btn-press',
                          reassignStatus === s
                            ? STATUS_COLOR[s]
                            : 'border-slate-200 text-brand-ink/60 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                  <input
                    value={reassignRemark}
                    onChange={(e) => setReassignRemark(e.target.value)}
                    placeholder="新备注（替换原 remark）"
                    className="w-full text-xs font-kai p-2 rounded-btn border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
                  />
                  <input
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    placeholder="改判原因（写入历史追溯）"
                    className="w-full text-xs font-kai p-2 rounded-btn border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
                  />
                  <button
                    onClick={handleReassign}
                    className="w-full text-xs font-kai py-1.5 rounded-btn bg-brand-teal text-white btn-press hover:bg-brand-teal/90"
                  >
                    提交改判
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-card border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-[#6D597A]" />
                <h3 className="font-serif font-bold text-brand-ink">历史追溯</h3>
              </div>
              <HistoryTimeline logs={logs} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function FosterFormSnapshot({
  foster,
  diffFields,
}: {
  foster?: FosterRegistration;
  diffFields: string[];
}) {
  if (!foster) return null;
  const rows: { key: keyof FosterRegistration; wide?: boolean }[] = [
    { key: 'id' },
    { key: 'petName' },
    { key: 'ownerName' },
    { key: 'ownerPhone' },
    { key: 'petType' },
    { key: 'breed' },
    { key: 'weightRaw' },
    { key: 'checkInDate' },
    { key: 'checkOutDate' },
    { key: 'notes', wide: true },
  ];
  return (
    <section className="rounded-card border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50/70 border-b border-slate-200">
        <FileText className="w-4 h-4 text-brand-teal" />
        <h3 className="font-serif font-bold text-brand-ink">回到寄养登记表</h3>
        <span className="ml-auto text-[11px] font-kai text-brand-ink/50">
          登记时间：{foster.createdAt}
        </span>
      </div>
      <div className="grid md:grid-cols-4 gap-x-4 gap-y-3 p-4 bg-[#fffdf7]">
        {rows.map((r) => {
          const isDiff = diffFields.includes(r.key);
          const val = foster[r.key] as string;
          return (
            <div
              key={r.key}
              className={[
                'rounded-btn border px-3 py-2',
                r.wide ? 'md:col-span-4' : '',
                isDiff
                  ? 'bg-status-hold/5 border-status-hold/40'
                  : 'bg-white border-slate-200',
              ].join(' ')}
            >
              <div className="text-[10px] font-kai text-brand-ink/50 mb-0.5">
                {FIELD_LABEL[r.key]}
                {isDiff && (
                  <span className="ml-1 text-status-hold/80">· 有差异</span>
                )}
              </div>
              <div className="text-sm font-kai text-brand-ink break-words whitespace-pre-wrap">
                {val || '—'}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DiffTable({
  oldSnap,
  newSnap,
  diffFields,
}: {
  oldSnap: Partial<FosterRegistration>;
  newSnap: Partial<FosterRegistration>;
  diffFields: string[];
}) {
  const allKeys = Array.from(
    new Set([...Object.keys(oldSnap), ...Object.keys(newSnap)]),
  ) as (keyof FosterRegistration)[];
  return (
    <div className="divide-y divide-slate-100">
      <div className="grid grid-cols-[1fr_56px_1fr] bg-slate-50 text-[11px] font-kai text-brand-ink/60">
        <div className="px-4 py-2">旧记录</div>
        <div className="px-2 py-2 text-center text-brand-ink/30">↔</div>
        <div className="px-4 py-2">本次登记表</div>
      </div>
      {allKeys.map((k) => {
        const o = (oldSnap[k] as string) ?? '—';
        const n = (newSnap[k] as string) ?? '—';
        const isDiff = diffFields.includes(k);
        return (
          <div key={k} className="grid grid-cols-[1fr_56px_1fr] text-sm">
            <div
              className={[
                'px-4 py-3 font-kai break-words border-r border-slate-100',
                isDiff ? 'bg-status-hold/8 text-status-hold' : 'text-brand-ink/85',
              ].join(' ')}
            >
              <div className="text-[10px] text-brand-ink/40 mb-0.5">{FIELD_LABEL[k]}</div>
              {o}
            </div>
            <div className="flex items-center justify-center">
              {isDiff ? (
                <div className="w-7 h-7 rounded-full bg-status-hold/15 text-status-hold flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-status-release/12 text-status-release flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            <div
              className={[
                'px-4 py-3 font-kai break-words',
                isDiff ? 'bg-status-wait/10 text-status-wait' : 'text-brand-ink/85',
              ].join(' ')}
            >
              <div className="text-[10px] text-brand-ink/40 mb-0.5">{FIELD_LABEL[k]}</div>
              {n}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeightPanel({ record }: { record: FollowUpRecord }) {
  const o = parseWeight(record.oldSnapshot.weightRaw ?? '');
  const n = parseWeight(record.newSnapshot.weightRaw ?? '');
  const items = [
    { title: '旧记录', ...o },
    { title: '本次登记', ...n },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((i) => (
        <div
          key={i.title}
          className="rounded-btn bg-white border border-slate-200 p-2.5"
        >
          <div className="text-[10px] font-kai text-brand-ink/50 mb-1">{i.title}</div>
          <div className="text-sm font-serif font-bold text-brand-ink">
            {i.value === null ? '—' : i.value}{' '}
            <span className="text-[11px] font-kai text-brand-teal">{i.unit}</span>
          </div>
          <div className="mt-1 text-[10px] font-kai text-brand-ink/40 truncate" title={i.raw}>
            原手写：{i.raw}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryTimeline({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0)
    return <div className="text-[11px] font-kai text-brand-ink/40 py-4">暂无操作记录</div>;
  const actionColor: Record<string, string> = {
    create: '#E76F51',
    update_status: '#F4A261',
    confirm_pending: '#2A9D8F',
    reverse: '#6D597A',
    add_note: '#264653',
  };
  return (
    <ol className="relative border-l border-slate-200 ml-2 space-y-4">
      {logs.map((l, idx) => {
        const color = actionColor[l.action] ?? '#264653';
        return (
          <li key={l.id} className="ml-4">
            <span
              className="absolute -left-[7px] w-3.5 h-3.5 rounded-full border-2 border-white"
              style={{ backgroundColor: color }}
            />
            <div className="rounded-btn border border-slate-200 bg-white p-3 hover:border-brand-teal/30 transition-colors">
              <div className="flex items-center gap-1.5 text-[11px] font-kai text-brand-ink/50">
                {l.operator === '算法值班人' ? (
                  <UserCog className="w-3 h-3" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                <span>{l.operatorName}</span>
                <span className="text-brand-ink/30">·</span>
                <span>{l.operator}</span>
                <span className="text-brand-ink/30">·</span>
                <span className="ml-auto">{l.timestamp}</span>
              </div>
              <div className="mt-1.5 text-sm font-kai text-brand-ink/90">{l.remark}</div>
              {l.reason && (
                <div className="mt-1 text-[11px] font-kai text-brand-ink/60 flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 text-brand-teal shrink-0" />
                  <span>改判原因：{l.reason}</span>
                </div>
              )}
              {(l.oldSnapshot || l.newSnapshot) && (
                <div className="mt-2 pt-2 border-t border-dashed border-slate-200 grid grid-cols-2 gap-2 text-[11px] font-kai">
                  {l.oldSnapshot && (
                    <div>
                      <div className="text-brand-ink/40 mb-0.5">旧材料</div>
                      <div className="text-brand-ink/75 break-words">
                        {JSON.stringify(l.oldSnapshot, null, 0)}
                      </div>
                    </div>
                  )}
                  {l.newSnapshot && (
                    <div>
                      <div className="text-brand-ink/40 mb-0.5">新备注</div>
                      <div className="text-brand-ink/75 break-words">
                        {JSON.stringify(l.newSnapshot, null, 0)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {idx === logs.length - 1 && logs.length >= 2 && (
              <div className="mt-2 text-[10px] font-kai text-brand-teal/80 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                最新改判已写入，可追溯
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
