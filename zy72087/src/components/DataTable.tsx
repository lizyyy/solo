import { useStore } from '@/store/useStore';
import { useFilteredData } from '@/hooks/useFilteredData';
import { isDuplicate, getSampleIssues, formatInterval } from '@/engine/validator';
import { ISSUE_TYPE_LABELS, SUGGESTION_LEVEL_LABELS, type IssueType } from '@/types';
import { cn } from '@/lib/utils';

const QUALITY_BADGE: Record<
  string,
  { label: string; cls: string }
> = {
  null_value: {
    label: ISSUE_TYPE_LABELS.null_value,
    cls: 'bg-red-100 text-red-700',
  },
  duplicate: {
    label: ISSUE_TYPE_LABELS.duplicate,
    cls: 'bg-gray-200 text-gray-600',
  },
  out_of_bounds: {
    label: ISSUE_TYPE_LABELS.out_of_bounds,
    cls: 'bg-yellow-100 text-yellow-700',
  },
  unit_mismatch: {
    label: ISSUE_TYPE_LABELS.unit_mismatch,
    cls: 'bg-blue-100 text-blue-700',
  },
};

const SUGGESTION_BADGE: Record<string, string> = {
  pass: 'bg-green-100 text-green-700',
  warn: 'bg-yellow-100 text-yellow-700',
  fail: 'bg-red-100 text-red-700',
};

const COLUMNS = [
  '样本ID',
  '线路',
  '日期',
  '时段',
  '实际间隔',
  '客流量',
  '准点率',
  '来源',
  '口径',
  '数据质量',
  '优化建议',
] as const;

export default function DataTable() {
  const { filteredSamples, filteredChains } = useFilteredData();
  const issues = useStore((s) => s.issues);

  const chainMap = new Map(filteredChains.map((c) => [c.sampleId, c]));

  function getQualityBadges(sampleId: string) {
    const sampleIssues = getSampleIssues(sampleId, issues);
    const dup = isDuplicate(sampleId, issues);
    const badges: { type: IssueType; label: string; cls: string }[] = [];

    for (const issue of sampleIssues) {
      const config = QUALITY_BADGE[issue.type];
      if (config) {
        badges.push({ type: issue.type, label: config.label, cls: config.cls });
      }
    }

    if (dup && !badges.some((b) => b.type === 'duplicate')) {
      badges.push({
        type: 'duplicate',
        label: QUALITY_BADGE.duplicate.label,
        cls: QUALITY_BADGE.duplicate.cls,
      });
    }

    const seen = new Set<string>();
    return badges.filter((b) => {
      if (seen.has(b.type)) return false;
      seen.add(b.type);
      return true;
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 text-gray-600 text-left">
            {COLUMNS.map((col) => (
              <th
                key={col}
                className="sticky top-0 bg-gray-100 px-3 py-2.5 font-medium whitespace-nowrap z-10"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredSamples.length === 0 && (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="px-3 py-8 text-center text-gray-400"
              >
                暂无匹配数据
              </td>
            </tr>
          )}
          {filteredSamples.map((s, idx) => {
            const chain = chainMap.get(s.id);
            const qualityBadges = getQualityBadges(s.id);
            return (
              <tr
                key={s.id}
                className={cn(
                  'border-t border-gray-100 hover:bg-teal-50/40 transition-colors',
                  idx % 2 === 1 && 'bg-gray-50',
                )}
              >
                <td className="px-3 py-2 font-mono text-gray-700">{s.id}</td>
                <td className="px-3 py-2">{s.lineName}</td>
                <td className="px-3 py-2 font-mono">{s.date}</td>
                <td className="px-3 py-2">{s.timePeriod}</td>
                <td className="px-3 py-2 font-mono">
                  {s.actualInterval !== null
                    ? formatInterval(
                        s.actualIntervalUnit === 'min'
                          ? s.actualInterval * 60
                          : s.actualInterval,
                      )
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  {s.passengerCount !== null ? (
                    <span className="font-mono">{s.passengerCount}</span>
                  ) : (
                    <span className="inline-block rounded bg-red-100 text-red-700 text-xs px-1.5 py-0.5">
                      空值
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono">
                  {s.onTimeRate !== null
                    ? `${(s.onTimeRate * 100).toFixed(1)}%`
                    : '—'}
                </td>
                <td className="px-3 py-2">{s.source}</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {s.caliberTag}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {qualityBadges.map((b) => (
                      <span
                        key={b.type}
                        className={cn(
                          'inline-block rounded text-xs px-1.5 py-0.5',
                          b.cls,
                        )}
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {chain ? (
                    <span
                      className={cn(
                        'inline-block rounded text-xs px-1.5 py-0.5',
                        SUGGESTION_BADGE[chain.level] ?? '',
                      )}
                    >
                      {chain.finalSuggestion}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
