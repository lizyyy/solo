import { useEffect, useState } from 'react';
import { FileCheck, CheckCircle2, XCircle, Clock, Timer, BookX, CopyX } from 'lucide-react';
import { useStatistics } from '../store/workOrderStore';

function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span>{display}</span>;
}

interface StatCardProps {
  label: string;
  value: number;
  total: number;
  icon: React.ReactNode;
  gradient: string;
  accent: string;
  delta?: string;
}

function StatCard({ label, value, total, icon, gradient, accent, delta }: StatCardProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br ${gradient} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300`}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs font-medium text-slate-600 tracking-wide">{label}</div>
        <div className={`p-1.5 rounded-md ${accent}`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          <AnimatedNumber value={value} />
        </div>
        <div className="text-xs text-slate-500">/ 共 {total}</div>
      </div>
      <div className="mt-3 h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
        <div
          className={`h-full ${accent.replace('text-', 'bg-').replace('/20', '')} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {delta && <div className="mt-2 text-[11px] text-slate-500">{delta}</div>}
    </div>
  );
}

export function StatisticsCards() {
  const statistics = useStatistics();
  const { total, normal, abnormal, pending, lateArrivalCount, oldTerminologyHits, duplicateWarnings } = statistics;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <StatCard
        label="总工单数"
        value={total}
        total={total}
        icon={<FileCheck className="w-4 h-4 text-slate-50" />}
        gradient="from-slate-100 to-slate-50"
        accent="bg-slate-700 text-slate-50"
      />
      <StatCard
        label="正常通过"
        value={normal}
        total={total}
        icon={<CheckCircle2 className="w-4 h-4 text-white" />}
        gradient="from-emerald-50 to-white"
        accent="bg-emerald-600 text-emerald-50"
        delta={`占比 ${total ? Math.round((normal / total) * 100) : 0}%`}
      />
      <StatCard
        label="异常工单"
        value={abnormal}
        total={total}
        icon={<XCircle className="w-4 h-4 text-white" />}
        gradient="from-red-50 to-white"
        accent="bg-red-600 text-red-50"
        delta={`占比 ${total ? Math.round((abnormal / total) * 100) : 0}%`}
      />
      <StatCard
        label="待复核"
        value={pending}
        total={total}
        icon={<Clock className="w-4 h-4 text-white" />}
        gradient="from-amber-50 to-white"
        accent="bg-amber-500 text-amber-50"
      />
      <StatCard
        label="含晚到附件"
        value={lateArrivalCount}
        total={total}
        icon={<Timer className="w-4 h-4 text-white" />}
        gradient="from-orange-50 to-white"
        accent="bg-orange-500 text-orange-50"
        delta="需额外确认照片时序"
      />
      <StatCard
        label="旧说法命中"
        value={oldTerminologyHits}
        total={total}
        icon={<BookX className="w-4 h-4 text-white" />}
        gradient="from-yellow-50 to-white"
        accent="bg-yellow-600 text-yellow-50"
        delta="⚠ 可能被平均值掩盖"
      />
      <StatCard
        label="重复编号提示"
        value={duplicateWarnings}
        total={total}
        icon={<CopyX className="w-4 h-4 text-white" />}
        gradient="from-blue-50 to-white"
        accent="bg-blue-600 text-blue-50"
        delta="非报错，附下一步处理"
      />
    </div>
  );
}
