import { useDrumKitStore } from '@/store/useDrumKitStore';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function BottomStatusBar() {
  const { analysis, session } = useDrumKitStore();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const errors = analysis.errors.filter(e => e.severity === 'error');
  const warnings = analysis.errors.filter(e => e.severity === 'warning');
  const infos = analysis.errors.filter(e => e.severity === 'info');
  
  const totalIssues = errors.length + warnings.length + infos.length;
  
  const getStepStatus = (category: string) => {
    const categoryErrors = analysis.errors.filter(e => e.category === category);
    if (categoryErrors.length === 0) return { status: 'pass', label: '通过' };
    
    const hasError = categoryErrors.some(e => e.severity === 'error');
    if (hasError) return { status: 'error', label: '失败' };
    return { status: 'warning', label: '警告' };
  };
  
  const steps = [
    { key: 'format', label: '格式校验' },
    { key: 'unit', label: '单位校验' },
    { key: 'distance', label: '距离校验' },
    { key: 'occlusion', label: '遮挡检测' },
    { key: 'phase', label: '相位分析' },
  ].map(step => ({ ...step, ...getStepStatus(step.key) }));
  
  const StatusIcon = errors.length > 0 ? AlertCircle : warnings.length > 0 ? AlertTriangle : CheckCircle;
  const statusColor = errors.length > 0 
    ? 'bg-red-900/50 border-red-700 text-red-300' 
    : warnings.length > 0 
      ? 'bg-amber-900/50 border-amber-700 text-amber-300' 
      : 'bg-green-900/50 border-green-700 text-green-300';
  const statusText = errors.length > 0 
    ? '检测到错误，请检查参数' 
    : warnings.length > 0 
      ? '存在警告，建议优化' 
      : '所有校验通过';
  
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      phase: '相位问题',
      distance: '距离问题',
      occlusion: '遮挡问题',
      format: '格式问题',
      unit: '单位问题',
    };
    return labels[category] || category;
  };
  
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30">
      <div className={`border-t ${statusColor} transition-all`}>
        <div 
          className="flex items-center justify-between px-4 py-2 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${errors.length > 0 ? 'text-red-400' : warnings.length > 0 ? 'text-amber-400' : 'text-green-400'}`} />
              <span className="text-sm font-medium">{statusText}</span>
            </div>
            
            <div className="flex items-center gap-3 text-xs">
              {errors.length > 0 && (
                <span className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  {errors.length} 错误
                </span>
              )}
              {warnings.length > 0 && (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  {warnings.length} 警告
                </span>
              )}
              {infos.length > 0 && (
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-400" />
                  {infos.length} 提示
                </span>
              )}
              {totalIssues === 0 && (
                <span className="text-green-400">✓ 全部通过</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1">
              {steps.map((step, index) => (
                <div key={step.key} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                    step.status === 'pass' ? 'text-green-400' :
                    step.status === 'error' ? 'text-red-400 bg-red-900/30' :
                    'text-amber-400 bg-amber-900/30'
                  }`}>
                    <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                      {index + 1}
                    </span>
                    <span>{step.label}</span>
                    {step.status === 'pass' ? '✓' : step.status === 'error' ? '✗' : '!'}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-6 h-px ${
                      step.status === 'pass' ? 'bg-green-700' :
                      step.status === 'error' ? 'bg-red-700' :
                      'bg-amber-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            
            <div className="text-xs text-slate-500">
              {session.microphones.length} 麦 | {session.drumPieces.length} 鼓件
            </div>
            
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>
        
        {isExpanded && totalIssues > 0 && (
          <div className="border-t border-slate-700 bg-slate-900/90 max-h-60 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-slate-200">详细问题列表</h4>
                <div className="text-xs text-slate-500">
                  点击左侧错误项可快速定位到相关麦克风
                </div>
              </div>
              
              <div className="space-y-2">
                {analysis.errors.map(error => {
                  const Icon = error.severity === 'error' ? AlertCircle : error.severity === 'warning' ? AlertTriangle : Info;
                  const bgColor = error.severity === 'error'
                    ? 'bg-red-900/20 border-red-800 hover:bg-red-900/40'
                    : error.severity === 'warning'
                      ? 'bg-amber-900/20 border-amber-800 hover:bg-amber-900/40'
                      : 'bg-blue-900/20 border-blue-800 hover:bg-blue-900/40';
                  const textColor = error.severity === 'error'
                    ? 'text-red-400'
                    : error.severity === 'warning'
                      ? 'text-amber-400'
                      : 'text-blue-400';
                  
                  return (
                    <div
                      key={error.id}
                      className={`${bgColor} border rounded-lg p-3 cursor-pointer transition-colors`}
                      onClick={() => {
                        if (error.sourceId) {
                          useDrumKitStore.getState().selectMicrophone(error.sourceId);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${textColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${textColor} bg-slate-800/50`}>
                              {getCategoryLabel(error.category)}
                            </span>
                            {error.field && (
                              <span className="text-xs text-slate-500 font-mono">
                                字段: {error.field}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-200">
                            {error.message}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            💡 {error.suggestion}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        
        {isExpanded && totalIssues === 0 && (
          <div className="border-t border-slate-700 bg-slate-900/90 p-4">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
              <p className="text-green-300 font-medium">所有校验项已通过</p>
              <p className="text-sm text-slate-500 mt-1">
                当前拾音方案格式正确、参数合理，可以保存或导出报告
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
