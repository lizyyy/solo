import { useNavigate } from 'react-router-dom';
import type { WarningAlert, InspectionRecord } from '@/types';
import { LevelBadge } from '@/components/common/Badges';

export interface RiskBarChartProps {
  warnings: WarningAlert[];
  records: InspectionRecord[];
}

interface GroupData {
  pipeline: string;
  area: string;
  red: number;
  yellow: number;
  green: number;
  total: number;
}

export default function RiskBarChart({ warnings, records }: RiskBarChartProps) {
  const navigate = useNavigate();

  const groupsMap = new Map<string, GroupData>();
  records.forEach((r) => {
    const key = r.pipeline_name;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { pipeline: r.pipeline_name, area: r.area, red: 0, yellow: 0, green: 0, total: 0 });
    }
  });

  warnings.forEach((w) => {
    const rec = records.find((r) => r.id === w.record_id);
    if (!rec) return;
    const g = groupsMap.get(rec.pipeline_name);
    if (!g) return;
    g[w.level] += 1;
    g.total += 1;
  });

  groupsMap.forEach((g) => {
    const recs = records.filter((r) => r.pipeline_name === g.pipeline);
    const withWarningIds = new Set(warnings.filter((w) => recs.some((r) => r.id === w.record_id)).map((w) => w.record_id));
    g.green = Math.max(0, recs.length - Array.from(withWarningIds).length);
    g.total = recs.length;
  });

  const groups = Array.from(groupsMap.values()).sort((a, b) => b.red + b.yellow - (a.red + a.yellow));
  const maxTotal = Math.max(...groups.map((g) => g.total), 1);

  return (
    <div className="card-base p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0">管线风险分布</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-alert-red" />
            红警
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-alert-orange" />
            黄警
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-alert-green" />
            正常
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {groups.map((g, idx) => {
          const redW = (g.red / maxTotal) * 100;
          const yellowW = (g.yellow / maxTotal) * 100;
          const greenW = (g.green / maxTotal) * 100;
          const topLevel: 'red' | 'yellow' | 'green' = g.red > 0 ? 'red' : g.yellow > 0 ? 'yellow' : 'green';
          return (
            <div
              key={g.pipeline}
              className="group cursor-pointer rounded-lg p-3 -mx-1 hover:bg-industrial-50/60 transition-colors"
              onClick={() => navigate('/inspections')}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <LevelBadge level={topLevel} label={g.area} />
                  <span className="text-sm font-medium text-industrial-700 truncate">{g.pipeline}</span>
                </div>
                <div className="flex items-center gap-1 text-xs num">
                  <span className="text-alert-red font-semibold min-w-[20px] text-right">{g.red}</span>
                  <span className="text-industrial-300">/</span>
                  <span className="text-alert-orange font-semibold min-w-[20px] text-right">{g.yellow}</span>
                  <span className="text-industrial-300">/</span>
                  <span className="text-industrial-500 min-w-[20px] text-right">{g.green}</span>
                </div>
              </div>
              <div className="h-2.5 bg-surface-muted rounded-full overflow-hidden flex">
                {redW > 0 && (
                  <div
                    className="h-full bg-alert-red transition-all duration-700 group-hover:brightness-110"
                    style={{ width: `${redW}%` }}
                  />
                )}
                {yellowW > 0 && (
                  <div
                    className="h-full bg-alert-orange transition-all duration-700 group-hover:brightness-110"
                    style={{ width: `${yellowW}%` }}
                  />
                )}
                {greenW > 0 && (
                  <div
                    className="h-full bg-alert-green/80 transition-all duration-700 group-hover:brightness-110"
                    style={{ width: `${greenW}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
