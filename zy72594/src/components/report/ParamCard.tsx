import { Settings, Info } from 'lucide-react';
import type { CalculationParam } from '../../types';

interface ParamCardProps {
  param: CalculationParam;
}

export function ParamCard({ param }: ParamCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Settings size={16} className="text-slate-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-800">{param.paramName}</h4>
            <p className="text-xs text-slate-500">版本：{param.version}</p>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <span className="inline-block px-3 py-1.5 bg-sky-50 text-sky-700 rounded-md text-sm font-mono border border-sky-100">
          {param.paramValue}
        </span>
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-md border border-amber-100">
        <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          <span className="font-medium">取舍理由：</span>
          {param.tradeOffReason}
        </p>
      </div>
    </div>
  );
}
