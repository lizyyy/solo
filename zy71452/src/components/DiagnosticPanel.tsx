import { Panel } from './ui/Panel';
import { AlertTriangle, AlertCircle, MapPin, Lightbulb, FileText } from 'lucide-react';
import { useBridgeStore } from '@/store/useBridgeStore';
import { cn } from '@/lib/utils';

export function DiagnosticPanel() {
  const errors = useBridgeStore(state => state.validationErrors);
  const clearErrors = useBridgeStore(state => state.clearErrors);
  const locateError = useBridgeStore(state => state.locateError);
  
  if (errors.length === 0) return null;

  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'node_connection':
        return <AlertCircle className="w-4 h-4" />;
      case 'frequency_unit':
        return <AlertTriangle className="w-4 h-4" />;
      case 'load_boundary':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getErrorColor = (severity: string) => {
    return severity === 'error' ? 'text-red-400' : 'text-amber-400';
  };

  const getErrorBg = (severity: string) => {
    return severity === 'error' 
      ? 'border-red-500/30 bg-red-500/10' 
      : 'border-amber-500/30 bg-amber-500/10';
  };

  return (
    <div className="fixed top-4 right-4 z-10 w-96">
      <Panel title="数据诊断">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-zinc-300">发现 {errors.length} 个问题</span>
          </div>
          <button
            onClick={clearErrors}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            清除
          </button>
        </div>
        
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {errors.map(error => (
            <div
              key={error.id}
              className={cn(
                'p-3 rounded-lg border',
                getErrorBg(error.severity)
              )}
            >
              <div className="flex items-start gap-3">
                <div className={getErrorColor(error.severity)}>
                  {getErrorIcon(error.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 font-medium">
                    {error.message}
                  </div>
                  
                  <div className="mt-2 text-xs text-zinc-500">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>来源: {error.sourceFileName}</span>
                    </div>
                    {error.location.lineNumber && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>位置: 第 {error.location.lineNumber} 行</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs text-zinc-400 italic">
                    "{error.humanReason}"
                  </div>
                  
                  <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                    <Lightbulb className="w-3 h-3" />
                    <span>{error.suggestion}</span>
                  </div>
                </div>
                <button
                  onClick={() => locateError(error.id)}
                  className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="定位到视图"
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
