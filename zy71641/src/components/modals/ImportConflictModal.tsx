import { useState } from 'react';
import { AlertTriangle, Check, X, RefreshCw, Copy, ArrowRight } from 'lucide-react';
import { ImportResult, ImportConflict } from '@/types';
import { useSwingStore } from '@/store/useSwingStore';

interface ImportConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  importResult: ImportResult | null;
}

export function ImportConflictModal({ isOpen, onClose, importResult }: ImportConflictModalProps) {
  const { resolveConflict } = useSwingStore();
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  
  if (!isOpen || !importResult) return null;
  
  const getResultTypeConfig = () => {
    switch (importResult.resultType) {
      case 'duplicate':
        return {
          icon: <Copy className="w-8 h-8" />,
          iconColor: 'text-golf-blue',
          bgColor: 'bg-golf-blue/20',
          title: '检测到重复数据',
          description: '该数据已存在于系统中，无需重复导入。',
        };
      case 'update':
        return {
          icon: <RefreshCw className="w-8 h-8" />,
          iconColor: 'text-golf-green',
          bgColor: 'bg-golf-green/20',
          title: '检测到数据更新',
          description: `检测到 ${importResult.updatedFields.length} 个字段有更新，是否应用更新？`,
        };
      case 'conflict':
        return {
          icon: <AlertTriangle className="w-8 h-8" />,
          iconColor: 'text-golf-orange',
          bgColor: 'bg-golf-orange/20',
          title: '检测到数据冲突',
          description: `检测到 ${importResult.conflicts.length} 处数据冲突，请选择处理方式。`,
        };
      default:
        return {
          icon: <Check className="w-8 h-8" />,
          iconColor: 'text-golf-green',
          bgColor: 'bg-golf-green/20',
          title: '导入成功',
          description: '数据已成功导入系统。',
        };
    }
  };
  
  const config = getResultTypeConfig();
  
  const handleResolveAll = (resolution: 'keep' | 'replace') => {
    importResult.conflicts.forEach(conflict => {
      resolveConflict(conflict, resolution);
    });
    setConflicts([]);
    onClose();
  };
  
  const handleResolve = (conflict: ImportConflict, resolution: 'keep' | 'replace') => {
    resolveConflict(conflict, resolution);
    const updatedConflicts = conflicts.filter(c => c.field !== conflict.field);
    setConflicts(updatedConflicts);
    if (updatedConflicts.length === 0) {
      onClose();
    }
  };
  
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '无';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <div className="bg-golf-bg-light border border-golf-border rounded-xl w-full max-w-lg shadow-2xl animate-slide-up">
        <div className="p-6 border-b border-golf-border">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor} ${config.iconColor}`}>
              {config.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-golf-text mb-1">
                {config.title}
              </h3>
              <p className="text-sm text-golf-text-muted">
                {config.description}
              </p>
              {importResult.existingSessionId && (
                <p className="text-xs text-golf-text-dim mt-2 font-mono">
                  已有会话 ID: {importResult.existingSessionId}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 text-golf-text-muted hover:text-golf-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {importResult.resultType === 'update' && importResult.updatedFields.length > 0 && (
          <div className="p-4 border-b border-golf-border">
            <div className="text-xs text-golf-text-muted mb-2">将更新以下字段：</div>
            <div className="flex flex-wrap gap-2">
              {importResult.updatedFields.map((field, idx) => (
                <span 
                  key={idx}
                  className="px-2 py-1 text-xs bg-golf-green/10 text-golf-green rounded border border-golf-green/30"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {importResult.resultType === 'conflict' && importResult.conflicts.length > 0 && (
          <div className="p-4 border-b border-golf-border max-h-64 overflow-y-auto">
            <div className="text-xs text-golf-text-muted mb-3">冲突详情：</div>
            <div className="space-y-3">
              {importResult.conflicts.map((conflict, idx) => (
                <div 
                  key={idx}
                  className="p-3 bg-golf-bg border border-golf-border rounded-lg"
                >
                  <div className="text-sm font-medium text-golf-text mb-2 font-mono">
                    {conflict.field}
                  </div>
                  <div className="flex items-start gap-2 mb-3">
                    <div className="flex-1 p-2 bg-golf-red/5 border border-golf-red/20 rounded">
                      <div className="text-[10px] text-golf-red mb-1">现有值</div>
                      <pre className="text-xs text-golf-text-muted whitespace-pre-wrap font-mono">
                        {formatValue(conflict.existingValue)}
                      </pre>
                    </div>
                    <ArrowRight className="w-4 h-4 text-golf-text-muted mt-6 flex-shrink-0" />
                    <div className="flex-1 p-2 bg-golf-green/5 border border-golf-green/20 rounded">
                      <div className="text-[10px] text-golf-green mb-1">新值</div>
                      <pre className="text-xs text-golf-text whitespace-pre-wrap font-mono">
                        {formatValue(conflict.newValue)}
                      </pre>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolve(conflict, 'keep')}
                      className="flex-1 px-3 py-1.5 text-xs bg-golf-blue/20 text-golf-blue rounded hover:bg-golf-blue/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" /> 保留现有
                    </button>
                    <button
                      onClick={() => handleResolve(conflict, 'replace')}
                      className="flex-1 px-3 py-1.5 text-xs bg-golf-orange/20 text-golf-orange rounded hover:bg-golf-orange/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> 使用新值
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-4 flex gap-3">
          {importResult.resultType === 'conflict' && importResult.conflicts.length > 0 && (
            <>
              <button
                onClick={() => handleResolveAll('keep')}
                className="flex-1 px-4 py-2 bg-golf-blue/20 text-golf-blue rounded-lg hover:bg-golf-blue/30 transition-colors text-sm font-medium"
              >
                全部保留现有
              </button>
              <button
                onClick={() => handleResolveAll('replace')}
                className="flex-1 px-4 py-2 bg-golf-orange/20 text-golf-orange rounded-lg hover:bg-golf-orange/30 transition-colors text-sm font-medium"
              >
                全部使用新值
              </button>
            </>
          )}
          {(importResult.resultType === 'duplicate' || importResult.resultType === 'new') && (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-golf-green/20 text-golf-green rounded-lg hover:bg-golf-green/30 transition-colors text-sm font-medium"
            >
              <Check className="w-4 h-4 inline mr-2" />
              确定
            </button>
          )}
          {importResult.resultType === 'update' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-golf-text-dim/20 text-golf-text-muted rounded-lg hover:bg-golf-text-dim/30 transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-golf-green/20 text-golf-green rounded-lg hover:bg-golf-green/30 transition-colors text-sm font-medium"
              >
                <Check className="w-4 h-4 inline mr-2" />
                应用更新
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
