import { useMemo, useState } from 'react';
import {
  BookOpen,
  Flame,
  Download,
  ArrowRight,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useStore } from '@/store';
import type { FosterRegistration, FollowUpRecord } from '@/types';
import { ABNORMAL_LABEL, FIELD_LABEL, STATUS_LABEL } from '@/types';
import { downloadCSV, exportRecordsToCSV } from '@/utils';
import AbnormalBadge from '@/components/AbnormalBadge';
import StatusBadge from '@/components/StatusBadge';
import AnomalyDetailModal from '@/components/AnomalyDetailModal';

const SAMPLE_IDS = ['FU-002', 'FU-004'];
const SAMPLE_LABEL: Record<string, string> = {
  'FU-002': '边界样本：体重单位混写（kg vs 磅）',
  'FU-004': '现场毛边：疫苗本补送 + 入住日期划改后改判放行',
};

export default function ReceptionPage() {
  const records = useStore((s) => s.records);
  const fosters = useStore((s) => s.fosters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const samples = useMemo(
    () => records.filter((r) => SAMPLE_IDS.includes(r.id)),
    [records],
  );
  const anomalies = useMemo(
    () => records.filter((r) => r.abnormalTypes.length > 0),
    [records],
  );
  const fosterMap = useMemo(() => {
    const m: Record<string, FosterRegistration> = {};
    for (const f of fosters) m[f.id] = f;
    return m;
  }, [fosters]);

  const selected = selectedId ? records.find((r) => r.id === selectedId) ?? null : null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleExport = () => {
    const csv = exportRecordsToCSV(records);
    downloadCSV(`宠物寄养回访追踪-${todayStr()}.csv`, csv);
    showToast(`已导出 ${records.length} 条记录`);
  };

  return (
    <div className="space-y-6 animate-slideDown">
      <div className="rounded-card border border-slate-200 bg-white card-shadow p-5 flex flex-wrap items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange to-status-wait flex items-center justify-center text-white shadow-sm">
          <Info className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-[280px]">
          <h2 className="font-serif text-xl font-bold text-brand-ink">
            小温你好，接班只要知道三件事就够啦 👇
          </h2>
          <p className="text-sm font-kai text-brand-ink/60 mt-1">
            样例在哪 → 异常在哪 → 结果怎么导出，不用读大段说明
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-kai text-brand-ink/50">
          <span className="px-2 py-1 rounded-full bg-brand-teal/10 text-brand-teal border border-brand-teal/30">
            接班时间 {todayStr()}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <QuickCard
          tone="teal"
          icon={BookOpen}
          title="样例在哪"
          desc="2 条必看样例，含边界样本和现场毛边"
          primaryText="打开样例卡片"
          count={samples.length}
          onClick={() => setShowSamples((v) => !v)}
        />
        <QuickCard
          tone="coral"
          icon={Flame}
          title="异常在哪"
          desc="今天有哪些新旧记录对不上"
          primaryText="查看异常列表"
          count={anomalies.length}
          onClick={() => setShowAnomalies((v) => !v)}
        />
        <QuickCard
          tone="orange"
          icon={Download}
          title="结果怎么导出"
          desc="一键导出 CSV，Excel 可直接打开"
          primaryText="导出全部记录"
          onClick={handleExport}
        />
      </div>

      {showSamples && (
        <section className="rounded-card border border-brand-teal/30 bg-brand-teal/5 p-4 card-shadow animate-slideDown">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-brand-teal" />
            <h3 className="font-serif font-bold text-brand-ink">样例 · 必看</h3>
            <span className="text-[11px] font-kai text-brand-ink/50 ml-auto">
              点卡片任意位置可回到登记表和计算口径
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {samples.map((r) => (
              <SampleCard
                key={r.id}
                title={SAMPLE_LABEL[r.id] ?? r.id}
                record={r}
                foster={fosterMap[r.fosterId]}
                onClick={() => setSelectedId(r.id)}
              />
            ))}
          </div>
        </section>
      )}

      {showAnomalies && (
        <section className="rounded-card border border-status-hold/30 bg-status-hold/5 p-4 card-shadow animate-slideDown">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-status-hold" />
            <h3 className="font-serif font-bold text-brand-ink">今日异常</h3>
            <span className="text-[11px] font-kai text-brand-ink/50 ml-auto">
              共 {anomalies.length} 条，点行查看详情
            </span>
          </div>
          <div className="rounded-btn border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
            {anomalies.map((r) => {
              const f = fosterMap[r.fosterId];
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="w-full text-left grid grid-cols-[1fr_1.4fr_100px_110px] items-center gap-3 px-4 py-3 hover:bg-brand-orange/10 transition-colors"
                >
                  <div>
                    <div className="font-serif font-bold text-brand-ink text-sm">
                      {f?.petName ?? '—'}
                      <span className="ml-2 text-[10px] font-mono text-brand-ink/45">
                        {r.id}
                      </span>
                    </div>
                    <div className="text-[11px] font-kai text-brand-ink/55">
                      {f?.ownerName ?? '—'} · {f?.ownerPhone ?? '—'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.abnormalTypes.map((t) => (
                      <span key={t} className="text-[11px] font-kai text-brand-ink/80">
                        <AbnormalBadge type={t} />
                      </span>
                    ))}
                  </div>
                  <StatusBadge status={r.status} pulse={r.status === 'pending'} />
                  <div className="text-right flex items-center justify-end gap-1 text-[11px] font-kai text-brand-teal">
                    看详情 <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-slideDown">
          <div className="rounded-full bg-brand-ink text-white text-sm font-kai px-5 py-2 card-shadow flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-teal" />
            {toast}
          </div>
        </div>
      )}

      {selected && (
        <AnomalyDetailModal record={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function QuickCard({
  tone,
  icon: Icon,
  title,
  desc,
  primaryText,
  count,
  onClick,
}: {
  tone: 'teal' | 'coral' | 'orange';
  icon: any;
  title: string;
  desc: string;
  primaryText: string;
  count?: number;
  onClick: () => void;
}) {
  const tones = {
    teal: {
      grad: 'from-brand-teal to-[#26A69A]',
      softBg: 'bg-brand-teal/10',
      text: 'text-brand-teal',
      border: 'border-brand-teal/30 hover:border-brand-teal/60',
      btn: 'bg-brand-teal hover:bg-brand-teal/90',
    },
    coral: {
      grad: 'from-status-hold to-[#F08A5D]',
      softBg: 'bg-status-hold/10',
      text: 'text-status-hold',
      border: 'border-status-hold/30 hover:border-status-hold/60',
      btn: 'bg-status-hold hover:bg-status-hold/90',
    },
    orange: {
      grad: 'from-brand-orange to-status-wait',
      softBg: 'bg-brand-orange/15',
      text: 'text-[#a87a1e]',
      border: 'border-brand-orange/40 hover:border-brand-orange/70',
      btn: 'bg-brand-orange hover:bg-brand-orange/90',
    },
  }[tone];

  return (
    <button
      onClick={onClick}
      className={[
        'group text-left rounded-card border bg-white p-5 card-shadow card-hover btn-press transition-all min-h-[220px] flex flex-col justify-between',
        tones.border,
      ].join(' ')}
    >
      <div>
        <div className="flex items-start justify-between">
          <div
            className={[
              'w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform',
              tones.grad,
            ].join(' ')}
          >
            <Icon className="w-6 h-6" />
          </div>
          {typeof count === 'number' && (
            <span
              className={[
                'inline-flex items-center justify-center min-w-[30px] h-[30px] px-2 rounded-full font-serif font-bold text-sm',
                tones.softBg,
                tones.text,
              ].join(' ')}
            >
              {count}
            </span>
          )}
        </div>
        <h3 className="mt-5 font-serif text-lg font-bold text-brand-ink">{title}</h3>
        <p className="mt-1 text-sm font-kai text-brand-ink/60 leading-relaxed">{desc}</p>
      </div>
      <div
        className={[
          'mt-4 inline-flex items-center justify-center gap-2 w-full rounded-btn py-2 text-sm text-white font-kai btn-press transition-colors',
          tones.btn,
        ].join(' ')}
      >
        {primaryText}
        <ArrowRight className="w-4 h-4" />
      </div>
    </button>
  );
}

function SampleCard({
  title,
  record,
  foster,
  onClick,
}: {
  title: string;
  record: FollowUpRecord;
  foster?: FosterRegistration;
  onClick: () => void;
}) {
  const fields: (keyof typeof FIELD_LABEL)[] = [
    'weightRaw',
    'checkInDate',
    'notes',
  ];
  return (
    <button
      onClick={onClick}
      className="text-left rounded-btn border border-slate-200 bg-white p-4 card-hover btn-press transition-all hover:border-brand-teal/50"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-serif font-bold text-brand-ink text-sm">{title}</h4>
        <span className="text-[10px] font-mono text-brand-ink/45">{record.id}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] font-kai">
        <div className="text-brand-ink/50">宠物 / 主人</div>
        <div className="text-brand-ink/85">
          {foster?.petName} · {foster?.ownerName}
        </div>
        {fields.map((k) => {
          const val = (record.newSnapshot[k] ?? foster?.[k]) as string | undefined;
          const isDiff = record.diffFields.includes(k);
          return (
            <div key={k} className="contents">
              <div className="text-brand-ink/50 flex items-center gap-1">
                {FIELD_LABEL[k]}
                {isDiff && (
                  <span className="text-status-hold">·有差异</span>
                )}
              </div>
              <div
                className={[
                  'text-brand-ink/85 truncate',
                  isDiff ? 'text-status-hold font-bold' : '',
                ].join(' ')}
                title={val}
              >
                {val || '—'}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] font-kai">
        <div className="flex items-center gap-2">
          <StatusBadge status={record.status} />
          {record.abnormalTypes.slice(0, 2).map((t) => (
            <span key={t} className="text-brand-ink/60">
              {ABNORMAL_LABEL[t]}
            </span>
          ))}
        </div>
        <span className="flex items-center gap-1 text-brand-teal">
          回到登记表 <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
