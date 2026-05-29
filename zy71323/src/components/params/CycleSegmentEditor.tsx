import { Clock, Waves, Wind, Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import { useEstimationStore } from '@/store/useEstimationStore';
import { cn } from '@/lib/utils';
import type { TideCycleSegment, TidePhase } from '@/types';

const phaseOptions: { value: TidePhase; label: string; color: string }[] = [
  { value: 'flood', label: '涨潮', color: 'text-tech-400' },
  { value: 'ebb', label: '落潮', color: 'text-ocean-300' },
  { value: 'slack', label: '平潮', color: 'text-ocean-400' },
];

const formatTime = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

interface SegmentCardProps {
  segment: TideCycleSegment;
  index: number;
  isLast: boolean;
}

function SegmentCard({ segment, index, isLast }: SegmentCardProps) {
  const { updateCycleSegment, removeCycleSegment, validation } = useEstimationStore();

  const hasError = validation.errors.some(
    (e) => e.field === 'tideCycles' && e.message.includes(segment.startTime.toString())
  );

  const handleChange = (field: keyof TideCycleSegment, value: number | string) => {
    updateCycleSegment(segment.id, { [field]: value });
  };

  const phaseInfo = phaseOptions.find((p) => p.value === segment.phase);

  const inputClass = "w-full px-2 py-1.5 bg-ocean-900/50 border border-ocean-600 rounded text-sm text-ocean-100 focus:outline-none focus:border-tech-500";

  return (
    <div className={cn(
      'bg-ocean-800/50 rounded-lg p-3 border transition-all',
      hasError ? 'border-alert-500' : 'border-ocean-600'
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-ocean-600 flex items-center justify-center text-xs text-ocean-200">{index + 1}</span>
          <span className={cn('text-xs font-medium', phaseInfo?.color)}>{phaseInfo?.label}</span>
        </div>
        <button
          onClick={() => removeCycleSegment(segment.id)}
          className="p-1.5 text-ocean-400 hover:text-alert-500 hover:bg-alert-500/10 rounded transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-ocean-400" />
            <span className="text-xs text-ocean-400">开始</span>
          </div>
          <input type="number" value={segment.startTime} onChange={(e) => handleChange('startTime', parseFloat(e.target.value) || 0)} min={0} max={24} className={inputClass} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-ocean-400" />
            <span className="text-xs text-ocean-400">结束</span>
          </div>
          <input type="number" value={segment.endTime} onChange={(e) => handleChange('endTime', parseFloat(e.target.value) || 0)} min={0} max={24} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Waves className="w-3 h-3 text-ocean-400" />
            <span className="text-xs text-ocean-400">潮位 (m)</span>
          </div>
          <input type="number" value={segment.tideHeight} onChange={(e) => handleChange('tideHeight', parseFloat(e.target.value) || 0)} step="0.1" className={inputClass} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Wind className="w-3 h-3 text-ocean-400" />
            <span className="text-xs text-ocean-400">流速 (m/s)</span>
          </div>
          <input type="number" value={segment.flowVelocity} onChange={(e) => handleChange('flowVelocity', parseFloat(e.target.value) || 0)} step="0.1" min={0} className={inputClass} />
        </div>
      </div>

      <div className="relative">
        <select
          value={segment.phase}
          onChange={(e) => handleChange('phase', e.target.value as TidePhase)}
          className="w-full px-2 py-1.5 bg-ocean-900/50 border border-ocean-600 rounded text-sm text-ocean-100 focus:outline-none focus:border-tech-500 appearance-none pr-8"
        >
          {phaseOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ocean-400 pointer-events-none" />
      </div>

      <p className="text-xs text-ocean-500 mt-2">{formatTime(segment.startTime)} - {formatTime(segment.endTime)}</p>

      {hasError && (
        <div className="flex items-start gap-1.5 mt-2 p-2 bg-alert-500/10 rounded">
          <AlertCircle className="w-3.5 h-3.5 text-alert-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-alert-500">
            {validation.errors.find(
              (e) => e.field === 'tideCycles' && e.message.includes(segment.startTime.toString())
            )?.message || '时间范围无效'}
          </p>
        </div>
      )}

      {!isLast && (
        <div className="flex justify-center -mb-5 mt-2">
          <div className="w-0.5 h-4 bg-ocean-600" />
        </div>
      )}
    </div>
  );
}

export default function CycleSegmentEditor() {
  const { params, addCycleSegment, validation } = useEstimationStore();
  const cycleErrors = validation.errors.filter((e) => e.field === 'tideCycles');
  const canAdd = params.tideCycles.length === 0 || params.tideCycles[params.tideCycles.length - 1].endTime < 24;

  return (
    <div className="bg-ocean-700/50 rounded-xl p-4 border border-ocean-600 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-tech-400" />
          <h3 className="text-sm font-medium text-ocean-100">潮汐周期分段</h3>
        </div>
        <button
          onClick={addCycleSegment}
          disabled={!canAdd}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            canAdd ? 'bg-tech-500 text-ocean-900 hover:bg-tech-400' : 'bg-ocean-600 text-ocean-400 cursor-not-allowed'
          )}
        >
          <Plus className="w-4 h-4" />
          添加分段
        </button>
      </div>

      {cycleErrors.length > 0 && (
        <div className="flex items-start gap-2 p-2 bg-alert-500/10 border border-alert-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-alert-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-alert-500">
            {cycleErrors.map((e, i) => <p key={i}>{e.message}</p>)}
          </div>
        </div>
      )}

      <div className="space-y-1">
        {params.tideCycles.map((segment, index) => (
          <SegmentCard key={segment.id} segment={segment} index={index} isLast={index === params.tideCycles.length - 1} />
        ))}
      </div>

      {params.tideCycles.length === 0 && (
        <div className="text-center py-8 text-ocean-500 text-sm">
          <p>暂无分段数据</p>
          <p className="text-xs mt-1">点击"添加分段"开始</p>
        </div>
      )}
    </div>
  );
}
