import { useGameStore } from '@/store/useGameStore';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export default function ConfigValidator() {
  const { configValidation, currentConfig } = useGameStore();

  if (!configValidation || !currentConfig) return null;

  const { valid, errors, warnings, emptyLevels, duplicateEvents, boundaryIssues } = configValidation;

  if (valid && warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 bg-emerald-950/30 border border-emerald-700/30 rounded-lg">
        <Info size={14} className="text-emerald-400" />
        <span className="text-sm text-emerald-300">配置校验通过，可以开始比赛</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {errors.length > 0 && (
        <div className="p-3 bg-red-950/30 border border-red-700/30 rounded-lg space-y-1.5">
          <div className="flex items-center gap-2 text-red-300 text-sm font-medium">
            <AlertCircle size={14} /> 配置有错误，无法开始
          </div>
          {errors.map((e, i) => (
            <div key={i} className="text-xs text-red-400/80 pl-5">{e}</div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-3 bg-yellow-950/30 border border-yellow-700/30 rounded-lg space-y-1.5">
          <div className="flex items-center gap-2 text-yellow-300 text-sm font-medium">
            <AlertTriangle size={14} /> 配置有警告
          </div>
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-yellow-400/80 pl-5">{w}</div>
          ))}
        </div>
      )}

      {emptyLevels.length > 0 && (
        <div className="p-2 bg-slate-800/50 border border-slate-700/30 rounded-lg">
          <div className="text-xs text-slate-400">
            空关卡（运行时自动跳过）：{emptyLevels.join('、')}
          </div>
        </div>
      )}

      {duplicateEvents.length > 0 && (
        <div className="p-2 bg-slate-800/50 border border-slate-700/30 rounded-lg">
          <div className="text-xs text-slate-400">
            重复事件ID/名称：{duplicateEvents.join('、')}
          </div>
        </div>
      )}

      {boundaryIssues.length > 0 && (
        <div className="p-2 bg-slate-800/50 border border-slate-700/30 rounded-lg">
          <div className="text-xs text-slate-400">
            边界问题资源：{boundaryIssues.join('、')}
          </div>
        </div>
      )}

      {valid && errors.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <Info size={12} />
          虽然有警告，但配置可以运行
        </div>
      )}
    </div>
  );
}
