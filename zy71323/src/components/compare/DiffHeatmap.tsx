import { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';
import type { EstimationRecord } from '@/types';
import { cn } from '@/lib/utils';

interface HeatmapCell {
  rowLabel: string;
  colLabel: string;
  diff: number;
  absDiff: number;
  color: string;
}

const TECH_400 = { r: 77, g: 226, b: 255 };
const ALERT_500 = { r: 255, g: 107, b: 53 };

function interpolateColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(TECH_400.r + (ALERT_500.r - TECH_400.r) * clamped);
  const g = Math.round(TECH_400.g + (ALERT_500.g - TECH_400.g) * clamped);
  const b = Math.round(TECH_400.b + (ALERT_500.b - TECH_400.b) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

const COMPARE_FIELDS = [
  { key: 'params.tidalRange', label: '潮差' },
  { key: 'params.flowVelocity', label: '流速' },
  { key: 'params.efficiency', label: '效率' },
  { key: 'result.totalEnergy', label: '总能量' },
  { key: 'result.annualGeneration', label: '年发电量' },
  { key: 'result.capacityFactor', label: '容量系数' },
];

function getNestedValue(obj: unknown, path: string): number | undefined {
  const value = path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
  return typeof value === 'number' ? value : undefined;
}

function calculateDiff(a: number, b: number): number {
  const baseline = Math.abs(a);
  if (baseline === 0) return b === 0 ? 0 : 100;
  return ((b - a) / baseline) * 100;
}

export function DiffHeatmap() {
  const { comparisonScenarios, records } = useRecordStore();

  const scenarioRecords = useMemo(() => {
    return comparisonScenarios
      .map(s => ({
        ...s,
        record: records.find(r => r.id === s.recordId) || null,
      }))
      .filter(s => s.record !== null) as Array<{
      id: string;
      recordId: string;
      label: string;
      color: string;
      record: EstimationRecord;
    }>;
  }, [comparisonScenarios, records]);

  const heatmapData = useMemo((): HeatmapCell[][] => {
    if (scenarioRecords.length < 2) return [];

    return COMPARE_FIELDS.map(field => {
      const row: HeatmapCell[] = [];

      for (let i = 0; i < scenarioRecords.length; i++) {
        for (let j = i + 1; j < scenarioRecords.length; j++) {
          const valA = getNestedValue(scenarioRecords[i].record, field.key);
          const valB = getNestedValue(scenarioRecords[j].record, field.key);

          if (valA === undefined || valB === undefined) {
            row.push({
              rowLabel: field.label,
              colLabel: `${scenarioRecords[i].label} vs ${scenarioRecords[j].label}`,
              diff: 0,
              absDiff: 0,
              color: 'transparent',
            });
            continue;
          }

          const diff = calculateDiff(valA, valB);
          const absDiff = Math.abs(diff);
          const maxDiff = 100;
          const intensity = Math.min(absDiff / maxDiff, 1);

          row.push({
            rowLabel: field.label,
            colLabel: `${scenarioRecords[i].label} vs ${scenarioRecords[j].label}`,
            diff,
            absDiff,
            color: interpolateColor(intensity),
          });
        }
      }

      return row;
    });
  }, [scenarioRecords]);

  const columnPairs = useMemo(() => {
    if (scenarioRecords.length < 2) return [];
    const pairs: Array<{
      label: string;
      aLabel: string;
      bLabel: string;
      aColor: string;
      bColor: string;
    }> = [];

    for (let i = 0; i < scenarioRecords.length; i++) {
      for (let j = i + 1; j < scenarioRecords.length; j++) {
        pairs.push({
          label: `${scenarioRecords[i].label} vs ${scenarioRecords[j].label}`,
          aLabel: scenarioRecords[i].label,
          bLabel: scenarioRecords[j].label,
          aColor: scenarioRecords[i].color,
          bColor: scenarioRecords[j].color,
        });
      }
    }
    return pairs;
  }, [scenarioRecords]);

  if (scenarioRecords.length < 2) {
    return (
      <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-6 animate-fade-in">
        <div className="text-center py-6">
          <Flame className="w-10 h-10 text-ocean-500 mx-auto mb-3 opacity-50" />
          <p className="text-ocean-300 text-sm">请至少添加2个情景以查看差异热力图</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-ocean-600/50">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Flame className="w-4 h-4 text-tech-400" />
          差异热力图
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-ocean-400">差异小</span>
          <div className="flex">
            <div
              className="w-4 h-3 rounded-l"
              style={{ backgroundColor: interpolateColor(0) }}
            />
            <div
              className="w-4 h-3"
              style={{ backgroundColor: interpolateColor(0.33) }}
            />
            <div
              className="w-4 h-3"
              style={{ backgroundColor: interpolateColor(0.66) }}
            />
            <div
              className="w-4 h-3 rounded-r"
              style={{ backgroundColor: interpolateColor(1) }}
            />
          </div>
          <span className="text-ocean-400">差异大</span>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-2 text-xs font-medium text-ocean-400 w-24" />
              {columnPairs.map((pair, idx) => (
                <th
                  key={idx}
                  className="p-2 text-center min-w-[120px] text-xs font-medium"
                >
                  <div className="flex items-center justify-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: pair.aColor }}
                    />
                    <span className="text-ocean-200">{pair.aLabel}</span>
                    <span className="text-ocean-500">vs</span>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: pair.bColor }}
                    />
                    <span className="text-ocean-200">{pair.bLabel}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapData.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="p-2 text-xs text-ocean-300 font-medium">
                  {COMPARE_FIELDS[rowIdx].label}
                </td>
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="p-2 text-center">
                    <div
                      className={cn(
                        'relative w-full h-10 rounded-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-105',
                        cell.color === 'transparent' && 'bg-ocean-600/30'
                      )}
                      style={{
                        backgroundColor: cell.color !== 'transparent' ? cell.color : undefined,
                      }}
                      title={`${cell.rowLabel}: ${cell.diff > 0 ? '+' : ''}${cell.diff.toFixed(1)}%`}
                    >
                      <span
                        className={cn(
                          'text-xs font-mono font-semibold',
                          cell.absDiff > 50 ? 'text-white' : 'text-ocean-900'
                        )}
                      >
                        {cell.color === 'transparent'
                          ? '-'
                          : `${cell.diff > 0 ? '+' : ''}${cell.diff.toFixed(0)}%`}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
