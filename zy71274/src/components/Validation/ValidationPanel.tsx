import { useAppStore } from '@/store/appStore';
import { AlertTriangle, CheckCircle, Info, Wrench, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';

export function ValidationPanel() {
  const { validationResults, validateData, updateTransition, updateSpectrumLine, transitions, spectrumLines } = useAppStore();

  const errorCount = validationResults.filter(r => r.level === 'error').length;
  const warningCount = validationResults.filter(r => r.level === 'warning').length;
  const infoCount = validationResults.filter(r => r.level === 'info').length;

  const getIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertTriangle size={18} className="text-red-400" />;
      case 'warning': return <AlertTriangle size={18} className="text-amber-400" />;
      default: return <Info size={18} className="text-blue-400" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'energy_order': return '能级顺序';
      case 'probability': return '跃迁概率';
      case 'spectrum_color': return '光谱颜色';
      default: return type;
    }
  };

  const handleQuickFix = (result: typeof validationResults[0]) => {
    if (result.type === 'probability') {
      result.affected_ids.forEach(id => {
        const t = transitions.find(tr => tr.id === id);
        if (t) {
          const fixedProb = Math.min(1, Math.max(0, t.probability));
          updateTransition(id, { probability: fixedProb });
        }
      });
    } else if (result.type === 'spectrum_color') {
      result.affected_ids.forEach(id => {
        const line = spectrumLines.find(l => l.id === id);
        if (line) {
          const match = result.suggestion.match(/#[a-fA-F0-9]{6}/);
          if (match) {
            updateSpectrumLine(id, { color_hex: match[0] });
          }
        }
      });
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle size={16} className={errorCount > 0 ? 'text-red-400' : 'text-green-400'} />
          数据质量检测
        </h3>
        <button
          onClick={validateData}
          className="p-1.5 hover:bg-slate-700 rounded transition-colors"
          title="重新检测"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="p-4 border-b border-slate-700">
        <div className="flex gap-4 justify-center">
          <div className="text-center">
            <div className={cn(
              "text-2xl font-bold",
              errorCount > 0 ? "text-red-400" : "text-slate-400"
            )}>
              {errorCount}
            </div>
            <div className="text-xs text-slate-500">错误</div>
          </div>
          <div className="text-center">
            <div className={cn(
              "text-2xl font-bold",
              warningCount > 0 ? "text-amber-400" : "text-slate-400"
            )}>
              {warningCount}
            </div>
            <div className="text-xs text-slate-500">警告</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-400">{infoCount}</div>
            <div className="text-xs text-slate-500">提示</div>
          </div>
        </div>
      </div>

      <div className="p-2 max-h-64 overflow-y-auto">
        {validationResults.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-slate-500">
            <CheckCircle size={40} className="text-green-500 mb-2" />
            <p className="text-sm">所有数据验证通过</p>
          </div>
        ) : (
          <div className="space-y-2">
            {validationResults.map((result, index) => (
              <div
                key={index}
                className={cn(
                  "p-3 rounded-lg border",
                  result.level === 'error' && "bg-red-950/30 border-red-900/50",
                  result.level === 'warning' && "bg-amber-950/30 border-amber-900/50",
                  result.level === 'info' && "bg-blue-950/30 border-blue-900/50"
                )}
              >
                <div className="flex items-start gap-2">
                  {getIcon(result.level)}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium mb-1">
                      {getTypeLabel(result.type)}
                    </div>
                    <div className="text-xs text-slate-300 break-words">
                      {result.message}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      💡 {result.suggestion}
                    </div>
                    <button
                      onClick={() => handleQuickFix(result)}
                      className="mt-2 flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <Wrench size={12} />
                      一键修正
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
