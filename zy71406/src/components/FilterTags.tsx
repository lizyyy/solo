import { X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { STATUS_LABELS, CONFLICT_DETAILS, type ApplicationStatus, type ConflictType } from '@/types';
import { formatDate } from '@/utils/format';

export default function FilterTags() {
  const { filterConditions, setFilterConditions } = useStore();

  const tags: { label: string; onRemove: () => void }[] = [];

  if (filterConditions.bondCode) {
    tags.push({
      label: `债券代码: ${filterConditions.bondCode}`,
      onRemove: () => setFilterConditions({ bondCode: undefined }),
    });
  }

  if (filterConditions.customerName) {
    tags.push({
      label: `客户名称: ${filterConditions.customerName}`,
      onRemove: () => setFilterConditions({ customerName: undefined }),
    });
  }

  if (filterConditions.exerciseDateStart) {
    tags.push({
      label: `行权日≥: ${formatDate(filterConditions.exerciseDateStart)}`,
      onRemove: () => setFilterConditions({ exerciseDateStart: undefined }),
    });
  }

  if (filterConditions.exerciseDateEnd) {
    tags.push({
      label: `行权日≤: ${formatDate(filterConditions.exerciseDateEnd)}`,
      onRemove: () => setFilterConditions({ exerciseDateEnd: undefined }),
    });
  }

  if (filterConditions.applicationStatus?.length) {
    filterConditions.applicationStatus.forEach((status) => {
      tags.push({
        label: `状态: ${STATUS_LABELS[status as ApplicationStatus]}`,
        onRemove: () => {
          const current = filterConditions.applicationStatus?.filter((s) => s !== status);
          setFilterConditions({
            applicationStatus: current && current.length > 0 ? current : undefined,
          });
        },
      });
    });
  }

  if (filterConditions.conflictTypes?.length) {
    filterConditions.conflictTypes.forEach((type) => {
      tags.push({
        label: `异常: ${CONFLICT_DETAILS[type as ConflictType].label}`,
        onRemove: () => {
          const current = filterConditions.conflictTypes?.filter((t) => t !== type);
          setFilterConditions({
            conflictTypes: current && current.length > 0 ? current : undefined,
          });
        },
      });
    });
  }

  if (filterConditions.positionQuantityMin !== undefined) {
    tags.push({
      label: `持仓≥: ${filterConditions.positionQuantityMin.toLocaleString()}`,
      onRemove: () => setFilterConditions({ positionQuantityMin: undefined }),
    });
  }

  if (filterConditions.applyQuantityMin !== undefined) {
    tags.push({
      label: `申请≥: ${filterConditions.applyQuantityMin.toLocaleString()}`,
      onRemove: () => setFilterConditions({ applyQuantityMin: undefined }),
    });
  }

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {tags.map((tag, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-accent-50 text-accent-700 border border-accent-200"
        >
          {tag.label}
          <button
            onClick={tag.onRemove}
            className="ml-1 hover:bg-accent-200 rounded-full p-0.5 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
