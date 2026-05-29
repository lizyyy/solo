import { useState, useMemo, useCallback, useEffect } from 'react';
import { X, GripVertical, TrendingUp, AlertCircle, Plus } from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';
import { useEstimationStore } from '@/store/useEstimationStore';
import type { EstimationRecord } from '@/types';
import { cn } from '@/lib/utils';

interface DiffValue {
  value: number | string;
  diff: number | null;
  hasDiff: boolean;
}

interface CompareRow {
  label: string;
  key: string;
  category: 'params' | 'result';
  values: DiffValue[];
}

const PARAM_FIELDS = [
  { key: 'tidalRange', label: '潮差' },
  { key: 'flowVelocity', label: '流速' },
  { key: 'impellerArea', label: '叶轮面积' },
  { key: 'efficiency', label: '效率' },
  { key: 'deviceConstraints.ratedPower', label: '额定功率' },
];

const RESULT_FIELDS = [
  { key: 'totalEnergy', label: '总能量' },
  { key: 'dailyGeneration', label: '日发电量' },
  { key: 'annualGeneration', label: '年发电量' },
  { key: 'capacityFactor', label: '容量系数' },
];

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export function ComparePanel() {
  const { comparisonScenarios, records, removeFromComparison, clearComparison, addToComparison } = useRecordStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [localScenarios, setLocalScenarios] = useState(comparisonScenarios);
  const { currentRecord } = useEstimationStore();

  useEffect(() => {
    setLocalScenarios(comparisonScenarios);
  }, [comparisonScenarios]);

  const scenarioRecords = useMemo(() => {
    return localScenarios.map(s => ({
      ...s,
      record: records.find(r => r.id === s.recordId) || null,
    }));
  }, [localScenarios, records]);

  const getBaseline = useCallback((key: string, recs: (EstimationRecord | null)[]): number => {
    for (const r of recs) {
      if (!r) continue;
      const v = getNestedValue(r, key);
      if (typeof v === 'number' && !isNaN(v)) return v;
    }
    return 1;
  }, []);

  const calcDiff = (val: unknown, base: number): DiffValue => {
    if (val === undefined || val === null) return { value: '-', diff: null, hasDiff: false };
    if (typeof val !== 'number') return { value: String(val), diff: null, hasDiff: false };
    if (isNaN(val)) return { value: '-', diff: null, hasDiff: false };
    if (base === 0) return { value: val, diff: val === 0 ? 0 : 100, hasDiff: val !== 0 };
    const diff = ((val - base) / Math.abs(base)) * 100;
    return { value: val, diff, hasDiff: Math.abs(diff) > 0.01 };
  };

  const rows = useMemo((): CompareRow[] => {
    const allRecs = scenarioRecords.map(s => s.record);
    const paramsRows = PARAM_FIELDS.map(f => ({
      label: f.label,
      key: f.key,
      category: 'params' as const,
      values: scenarioRecords.map(s => calcDiff(s.record ? getNestedValue(s.record.params, f.key) : undefined, getBaseline(`params.${f.key}`, allRecs))),
    }));
    const resultRows = RESULT_FIELDS.map(f => ({
      label: f.label,
      key: f.key,
      category: 'result' as const,
      values: scenarioRecords.map(s => calcDiff(s.record?.result ? getNestedValue(s.record.result, f.key) : undefined, getBaseline(`result.${f.key}`, allRecs))),
    }));
    return [...paramsRows, ...resultRows];
  }, [scenarioRecords, getBaseline]);

  const handleDragStart = (i: number) => setDraggedIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIndex(i); };

  const handleDrop = (i: number) => {
    if (draggedIndex === null || draggedIndex === i) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newScenarios = [...localScenarios];
    const [removed] = newScenarios.splice(draggedIndex, 1);
    newScenarios.splice(i, 0, removed);
    setLocalScenarios(newScenarios);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleAddCurrent = () => {
    if (currentRecord && localScenarios.length < 4) {
      addToComparison(currentRecord.id, `情景 ${localScenarios.length + 1}`);
    }
  };

  const formatVal = (v: number | string, key: string): string => {
    if (typeof v !== 'number') return String(v);
    if (key.includes('efficiency') || key.includes('capacityFactor')) return `${(v * 100).toFixed(1)}%`;
    if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(2)} M`;
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(2)} k`;
    return v.toFixed(2);
  };

  const diffColor = (d: number | null) => d === null ? '' : d > 0 ? 'text-success-500' : d < 0 ? 'text-alert-500' : 'text-ocean-300';

  if (localScenarios.length === 0) {
    return (
      <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-8 animate-fade-in">
        <div className="text-center py-8">
          <TrendingUp className="w-12 h-12 text-ocean-500 mx-auto mb-4 opacity-50" />
          <p className="text-ocean-300 text-sm mb-2">暂无对比情景</p>
          <p className="text-ocean-500 text-xs mb-4">从记录列表添加最多4个情景进行对比</p>
          {currentRecord && (
            <button onClick={handleAddCurrent} className="inline-flex items-center gap-2 px-4 py-2 bg-tech-500/20 text-tech-400 rounded-lg hover:bg-tech-500/30 transition-colors text-sm">
              <Plus className="w-4 h-4" />添加当前计算结果
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-ocean-600/50">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-tech-400" />情景对比
          <span className="text-xs font-normal text-ocean-400">({localScenarios.length}/4)</span>
        </h2>
        <button onClick={clearComparison} className="text-xs text-ocean-400 hover:text-alert-500 transition-colors">清空全部</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ocean-600/50">
              <th className="text-left p-3 text-xs font-medium text-ocean-400 w-28">指标</th>
              {scenarioRecords.map((s, i) => (
                <th
                  key={s.id}
                  className={cn('p-3 text-center min-w-[140px] border-l border-ocean-600/50', dragOverIndex === i && 'bg-tech-500/10')}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <GripVertical className="w-4 h-4 text-ocean-500 cursor-grab" />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm font-medium text-white">{s.label}</span>
                    <button onClick={() => removeFromComparison(s.id)} className="p-0.5 hover:bg-ocean-600 rounded">
                      <X className="w-3 h-3 text-ocean-400 hover:text-alert-500" />
                    </button>
                  </div>
                  {s.record?.status === 'invalid' && (
                    <div className="flex items-center justify-center gap-1 mt-1 text-alert-500">
                      <AlertCircle className="w-3 h-3" /><span className="text-[10px]">数据无效</span>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={cn('border-b border-ocean-600/30 last:border-b-0', row.category === 'result' && 'bg-ocean-600/20')}>
                <td className="p-3 text-xs text-ocean-300">
                  <div className="flex items-center gap-2">
                    {row.category === 'result' && <TrendingUp className="w-3 h-3 text-tech-400" />}
                    {row.label}
                  </div>
                </td>
                {row.values.map((v, i) => (
                  <td key={i} className={cn('p-3 text-center border-l border-ocean-600/30', v.hasDiff && 'bg-alert-500/5')}>
                    <div className={cn('text-sm font-mono', v.hasDiff ? 'text-white font-semibold' : 'text-ocean-200')}>
                      {formatVal(v.value, row.key)}
                    </div>
                    {v.diff !== null && v.hasDiff && (
                      <div className={cn('text-[10px] font-medium mt-0.5', diffColor(v.diff))}>
                        {v.diff > 0 ? '+' : ''}{v.diff.toFixed(1)}%
                      </div>
                    )}
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
