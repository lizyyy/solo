import { useMemo } from 'react';
import { Search, FileWarning, PauseCircle, CheckCircle2, AlertTriangle, ListTodo } from 'lucide-react';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import AbnormalBadge from '@/components/AbnormalBadge';
import { useStore } from '@/store';
import type { FilterKey } from '@/store';
import type { FollowUpRecord, FosterRegistration } from '@/types';
import AnomalyDetailModal from '@/components/AnomalyDetailModal';

export default function DashboardPage() {
  const {
    records,
    fosters,
    activeFilter,
    setActiveFilter,
    keyword,
    setKeyword,
    selectedRecordId,
    setSelectedRecordId,
  } = useStore();

  const stats = useMemo(() => {
    return {
      total: records.length,
      abnormal: records.filter((r) => r.status === 'abnormal').length,
      pending: records.filter((r) => r.status === 'pending').length,
      released: records.filter((r) => r.status === 'released').length,
      needMaterial: records.filter((r) => r.status === 'need_material').length,
    };
  }, [records]);

  const fosterById = useMemo(() => {
    const m: Record<string, (typeof fosters)[number]> = {};
    for (const f of fosters) m[f.id] = f;
    return m;
  }, [fosters]);

  const filteredRecords = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return records.filter((r) => {
      if (activeFilter !== 'all' && r.status !== activeFilter) return false;
      if (!kw) return true;
      const f = fosterById[r.fosterId];
      const hay = [
        r.id,
        f?.petName,
        f?.ownerName,
        f?.ownerPhone,
        f?.breed,
        r.remark,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(kw);
    });
  }, [records, activeFilter, keyword, fosterById]);

  const selected = selectedRecordId
    ? records.find((r) => r.id === selectedRecordId) ?? null
    : null;

  const filters: { key: FilterKey; icon: any; label: string; value: number; color: string }[] = [
    { key: 'all', icon: ListTodo, label: '总追踪单', value: stats.total, color: '#264653' },
    { key: 'abnormal', icon: FileWarning, label: '异常记录', value: stats.abnormal, color: '#E76F51' },
    { key: 'pending', icon: PauseCircle, label: '挂起待确认', value: stats.pending, color: '#E76F51' },
    { key: 'need_material', icon: AlertTriangle, label: '待补材料', value: stats.needMaterial, color: '#F4A261' },
    { key: 'released', icon: CheckCircle2, label: '已放行', value: stats.released, color: '#2A9D8F' },
  ];

  return (
    <div className="space-y-6 animate-slideDown">
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {filters.map((f) => (
          <StatCard
            key={f.key}
            icon={f.icon}
            label={f.label}
            value={f.value}
            color={f.color}
            active={activeFilter === f.key}
            onClick={() => setActiveFilter(activeFilter === f.key ? 'all' : f.key)}
          />
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜宠物名 / 主人 / 联系电话 / 单号..."
            className="w-full pl-9 pr-3 py-2 rounded-btn border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/30 text-sm font-kai"
          />
        </div>
        <div className="flex items-center gap-1 text-xs font-kai text-brand-ink/60">
          <span className="px-2 py-1 rounded-btn bg-brand-orange/15 border border-brand-orange/40">
            现场毛边样例：FU-004（疫苗本+入住日期划改）
          </span>
          <span className="px-2 py-1 rounded-btn bg-status-hold/12 border border-status-hold/30">
            边界样本：FU-002（体重单位 kg/磅 混写）
          </span>
        </div>
      </section>

      <section className="rounded-card bg-white border border-slate-200 card-shadow overflow-hidden">
        <div className="grid grid-cols-[80px_1.2fr_1fr_1fr_1fr_1.6fr_1.2fr_110px] items-center gap-3 px-5 py-3 border-b border-slate-200 bg-brand-cream/50 text-[12px] font-kai text-brand-ink/70">
          <div>单号</div>
          <div>宠物 / 品种</div>
          <div>主人 / 联系电话</div>
          <div>入住 → 出院</div>
          <div>状态</div>
          <div>异常标签</div>
          <div>备注</div>
          <div className="text-right pr-2">操作</div>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredRecords.length === 0 && (
            <div className="py-16 text-center text-brand-ink/50 font-kai text-sm">没有符合条件的记录</div>
          )}
          {filteredRecords.map((r, idx) => (
            <RecordRow
              key={r.id}
              record={r}
              foster={fosterById[r.fosterId]}
              alt={idx % 2 === 1}
              onOpen={() => setSelectedRecordId(r.id)}
            />
          ))}
        </div>
      </section>

      {selected && (
        <AnomalyDetailModal record={selected} onClose={() => setSelectedRecordId(null)} />
      )}
    </div>
  );
}

function RecordRow({
  record,
  foster,
  alt,
  onOpen,
}: {
  record: FollowUpRecord;
  foster?: FosterRegistration;
  alt: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className={[
        'grid grid-cols-[80px_1.2fr_1fr_1fr_1fr_1.6fr_1.2fr_110px] items-center gap-3 px-5 py-4 cursor-pointer transition-colors group',
        alt ? 'bg-slate-50/40' : 'bg-white',
        'hover:bg-brand-orange/10',
      ].join(' ')}
    >
      <div className="text-[11px] font-mono text-brand-ink/70">{record.id}</div>
      <div>
        <div className="font-serif font-bold text-brand-ink">{foster?.petName ?? '—'}</div>
        <div className="text-[11px] text-brand-ink/55 font-kai">{foster?.breed ?? '—'}</div>
      </div>
      <div>
        <div className="text-sm font-kai text-brand-ink">{foster?.ownerName ?? '—'}</div>
        <div className="text-[11px] text-brand-ink/55 font-mono">{foster?.ownerPhone ?? '—'}</div>
      </div>
      <div className="text-[12px] font-kai text-brand-ink/80">
        <div>{foster?.checkInDate}</div>
        <div className="text-brand-ink/40">→ {foster?.checkOutDate}</div>
      </div>
      <div>
        <StatusBadge status={record.status} pulse={record.status === 'pending'} />
      </div>
      <div className="flex flex-wrap gap-1">
        {record.abnormalTypes.length === 0 ? (
          <span className="text-[11px] text-brand-ink/40 font-kai">— 无异常</span>
        ) : (
          record.abnormalTypes.map((t) => <AbnormalBadge key={t} type={t} />)
        )}
      </div>
      <div className="text-[11px] font-kai text-brand-ink/70 line-clamp-2 leading-relaxed">
        {record.remark ?? <span className="text-brand-ink/30">（无）</span>}
      </div>
      <div className="text-right pr-2">
        <button className="text-[11px] font-kai px-3 py-1 rounded-btn border border-brand-teal/40 text-brand-teal bg-brand-teal/5 hover:bg-brand-teal/15 btn-press group-hover:border-brand-teal transition-colors">
          查看详情
        </button>
      </div>
    </div>
  );
}
