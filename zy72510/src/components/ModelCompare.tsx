import type { Sample } from '../../shared/types';

interface ModelCompareProps {
  sample: Sample;
}

function labelColor(label: string) {
  if (label === 'pass') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (label === 'reject') return 'bg-red-500/15 text-red-400 border-red-500/30';
  return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
}

function labelText(label: string) {
  if (label === 'pass') return '通过';
  if (label === 'reject') return '拒绝';
  return '待定';
}

export default function ModelCompare({ sample }: ModelCompareProps) {
  const hasMismatch = sample.labelA !== sample.labelB;
  const aIsDiff = hasMismatch;
  const bIsDiff = hasMismatch;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className={`p-4 rounded-sm border ${aIsDiff ? 'border-red-500/40 bg-red-500/5' : 'border-white/10 bg-slate-800/50'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">模型 A</span>
          <span className={`text-xs px-2 py-0.5 rounded-sm border font-medium ${labelColor(sample.labelA)}`}>
            {labelText(sample.labelA)}
          </span>
        </div>
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">置信度</span>
            <span className="text-slate-300">{(sample.confidenceA * 100).toFixed(2)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-sm overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${sample.confidenceA * 100}%` }}
            />
          </div>
        </div>
      </div>
      <div className={`p-4 rounded-sm border ${bIsDiff ? 'border-red-500/40 bg-red-500/5' : 'border-white/10 bg-slate-800/50'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">模型 B</span>
          <span className={`text-xs px-2 py-0.5 rounded-sm border font-medium ${labelColor(sample.labelB)}`}>
            {labelText(sample.labelB)}
          </span>
        </div>
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">置信度</span>
            <span className="text-slate-300">{(sample.confidenceB * 100).toFixed(2)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-sm overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all"
              style={{ width: `${sample.confidenceB * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
