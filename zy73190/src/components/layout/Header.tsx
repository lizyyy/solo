import { useMemo } from 'react';
import { Calculator, FileSpreadsheet, GitBranch } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export function Header() {
  const paramVersions = useAppStore((state) => state.paramVersions);
  const currentParamVersionId = useAppStore((state) => state.currentParamVersionId);
  const samples = useAppStore((state) => state.samples);
  const filters = useAppStore((state) => state.filters);

  const currentVersion = useMemo(
    () => paramVersions.find((v) => v.id === currentParamVersionId),
    [paramVersions, currentParamVersionId]
  );

  const filteredSamples = useMemo(() => {
    return samples.filter((sample) => {
      if (filters.status.length > 0 && !filters.status.includes(sample.status)) {
        return false;
      }
      if (
        filters.sampleCode &&
        !sample.sampleCode.toLowerCase().includes(filters.sampleCode.toLowerCase())
      ) {
        return false;
      }
      if (filters.dateRange) {
        const sampleDate = new Date(sample.createdAt);
        const startDate = new Date(filters.dateRange[0]);
        const endDate = new Date(filters.dateRange[1]);
        if (sampleDate < startDate || sampleDate > endDate) {
          return false;
        }
      }
      return true;
    });
  }, [samples, filters]);

  const stats = useMemo(
    () => ({
      normal: filteredSamples.filter((s) => s.status === 'normal').length,
      abnormal: filteredSamples.filter((s) => s.status === 'abnormal').length,
      duplicate: filteredSamples.filter((s) => s.status === 'duplicate').length,
      pending: filteredSamples.filter((s) => s.status === 'pending').length,
    }),
    [filteredSamples]
  );

  const totalSamples = samples.length;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg">
            <Calculator size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800" style={{ fontFamily: 'Noto Serif SC, serif' }}>
              数列递推批量验算
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <GitBranch size={12} />
              <span>当前参数版本：{currentVersion?.name || '未选择'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-slate-500">总计</div>
              <div className="text-xl font-semibold text-slate-700">
                {filteredSamples.length}
                <span className="ml-1 text-xs font-normal text-slate-400">/ {totalSamples}</span>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <StatItem label="正常" value={stats.normal} color="emerald" />
            <StatItem label="异常" value={stats.abnormal} color="red" />
            <StatItem label="重复" value={stats.duplicate} color="amber" />
            <StatItem label="待确认" value={stats.pending} color="sky" />
          </div>

          <div className="h-10 w-px bg-slate-200" />

          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-slate-500" />
            <span className="text-sm text-slate-600">交班工具</span>
          </div>
        </div>
      </div>
    </header>
  );
}

interface StatItemProps {
  label: string;
  value: number;
  color: 'emerald' | 'red' | 'amber' | 'sky';
}

function StatItem({ label, value, color }: StatItemProps) {
  const colorClasses: Record<string, string> = {
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    sky: 'text-sky-600',
  };

  return (
    <div className="text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}
