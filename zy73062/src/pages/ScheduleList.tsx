import AppLayout from '@/components/layout/AppLayout';
import StatsRow from '@/components/schedule/StatsRow';
import DedupList from '@/components/schedule/DedupList';

export default function ScheduleList() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <StatsRow />

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5">💡</span>
          <span>
            同一「管线 + 备件型号 + 巡检周期」连续提交会自动合并为同一条，不重复计数
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">排程记录</h2>
          <p className="text-sm text-slate-500">按业务主键去重，重复提交自动合并</p>
        </div>

        <DedupList />
      </div>
    </AppLayout>
  );
}
