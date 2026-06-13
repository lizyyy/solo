import type { Sample } from '../../shared/types';

interface SampleCardProps {
  sample: Sample;
  onSelect: (sampleId: string) => void;
  selected?: boolean;
}

function labelColor(label: string) {
  if (label === 'pass') return 'text-emerald-400';
  if (label === 'reject') return 'text-red-400';
  return 'text-slate-400';
}

function labelText(label: string) {
  if (label === 'pass') return '通过';
  if (label === 'reject') return '拒绝';
  return '待定';
}

export default function SampleCard({ sample, onSelect, selected }: SampleCardProps) {
  return (
    <div
      onClick={() => onSelect(sample.id)}
      className={`cursor-pointer px-4 py-3 border-l-4 ${
        sample.isLowConfidence ? 'border-amber-500' : 'border-transparent'
      } ${selected ? 'bg-white/10' : 'hover:bg-white/5'} transition-colors`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500 font-mono">{sample.id}</span>
        {sample.finalLabel && (
          <span className={`text-xs font-medium ${labelColor(sample.finalLabel)}`}>
            已{labelText(sample.finalLabel)}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-200 line-clamp-2 mb-3">{sample.content}</p>
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">模型A <span className={labelColor(sample.labelA)}>{labelText(sample.labelA)}</span></span>
            <span className="text-slate-500">{(sample.confidenceA * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1 bg-slate-700 rounded-sm overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${sample.confidenceA * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">模型B <span className={labelColor(sample.labelB)}>{labelText(sample.labelB)}</span></span>
            <span className="text-slate-500">{(sample.confidenceB * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1 bg-slate-700 rounded-sm overflow-hidden">
            <div
              className="h-full bg-purple-500"
              style={{ width: `${sample.confidenceB * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs pt-1 border-t border-white/5">
          <span className="text-slate-400">灰度判定:</span>
          <span className={`font-medium ${labelColor(sample.grayLabel)}`}>
            {labelText(sample.grayLabel)}
          </span>
        </div>
      </div>
      {sample.annotatorNote && (
        <div className="mt-3 px-2.5 py-1.5 bg-slate-800/50 rounded-sm">
          <p className="text-xs text-slate-400">标注员: {sample.annotatorNote}</p>
        </div>
      )}
    </div>
  );
}
