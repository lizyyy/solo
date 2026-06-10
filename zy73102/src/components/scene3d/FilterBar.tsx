import { useTrackStore } from '@/stores/trackStore';
import type { FilterState } from '@/types';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

const materialTypeOptions = [
  { value: 'pipe', label: '管道' },
  { value: 'hopper', label: '雨水斗' },
  { value: 'gutter', label: '天沟' },
  { value: 'fitting', label: '管件' },
  { value: 'sealant', label: '密封材料' },
];

const statusOptions = [
  { value: 'confirmed', label: '已确认' },
  { value: 'pending', label: '待处理' },
  { value: 'conflicted', label: '有冲突' },
  { value: 'obsolete', label: '已废弃' },
];

const versionOptions = [
  { value: 'V1.0', label: 'V1.0' },
  { value: 'V1.1', label: 'V1.1' },
  { value: 'V1.2', label: 'V1.2' },
];

type FilterKey = 'materialTypes' | 'processingStatuses' | 'drawingVersions';

function TagGroup({
  title,
  options,
  selected,
  keyName,
}: {
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  keyName: FilterKey;
}) {
  const updateFilter = useTrackStore((s) => s.updateFilter);

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    updateFilter({ [keyName]: next } as Partial<FilterState>);
  };

  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-slate-500">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={cn(
                'rounded border px-2 py-1 text-xs transition-colors',
                active
                  ? 'border-[#1F3A5F] bg-[#1F3A5F] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FilterBar() {
  const filterState = useTrackStore((s) => s.filterState);
  const updateFilter = useTrackStore((s) => s.updateFilter);
  const resetAll = () => {
    updateFilter({
      materialTypes: [],
      processingStatuses: [],
      drawingVersions: [],
      collisionOnly: false,
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">筛选联动器</h3>
        <button onClick={resetAll} className="text-xs text-slate-400 hover:text-[#1F3A5F]">
          重置
        </button>
      </div>
      <div className="space-y-3">
        <TagGroup
          title="材料类型"
          options={materialTypeOptions}
          selected={filterState.materialTypes}
          keyName="materialTypes"
        />
        <TagGroup
          title="处理状态"
          options={statusOptions}
          selected={filterState.processingStatuses}
          keyName="processingStatuses"
        />
        <TagGroup
          title="图纸版本"
          options={versionOptions}
          selected={filterState.drawingVersions}
          keyName="drawingVersions"
        />
        <div>
          <button
            onClick={() => updateFilter({ collisionOnly: !filterState.collisionOnly })}
            className={cn(
              'flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs transition-colors',
              filterState.collisionOnly
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            )}
          >
            <AlertCircle size={14} />
            仅显示涉及碰撞的材料
          </button>
        </div>
      </div>
    </div>
  );
}
