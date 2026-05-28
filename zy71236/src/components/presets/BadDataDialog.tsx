import { useState, useEffect } from 'react';
import { ValidationResult, ValidationError } from '../../types/synth';
import { Button } from '../ui/Button';
import { AlertTriangle, CheckCircle, XCircle, FileWarning } from 'lucide-react';

interface BadDataDialogProps {
  result: ValidationResult;
  onClose: () => void;
}

export function BadDataDialog({ result, onClose }: BadDataDialogProps) {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);

  useEffect(() => {
    if (result.errors.length > 0) {
      const timer = setInterval(() => {
        setCurrentErrorIndex((prev) => {
          if (prev < result.errors.length - 1) {
            setVisibleLines((lines) => [...lines, prev]);
            return prev + 1;
          }
          clearInterval(timer);
          setVisibleLines((lines) => [...lines, prev]);
          return prev;
        });
      }, 300);
      return () => clearInterval(timer);
    }
  }, [result.errors.length]);

  const getErrorIcon = (type: ValidationError['type']) => {
    switch (type) {
      case 'json_parse':
        return <XCircle className="text-red-400" size={18} />;
      case 'missing_field':
        return <AlertTriangle className="text-yellow-400" size={18} />;
      case 'type_mismatch':
        return <AlertTriangle className="text-orange-400" size={18} />;
      case 'out_of_range':
        return <AlertTriangle className="text-orange-400" size={18} />;
      case 'logic_conflict':
        return <AlertTriangle className="text-purple-400" size={18} />;
      default:
        return <AlertTriangle className="text-gray-400" size={18} />;
    }
  };

  const getTypeLabel = (type: ValidationError['type']) => {
    const labels: Record<string, string> = {
      json_parse: 'JSON 解析错误',
      missing_field: '字段缺失',
      type_mismatch: '类型错误',
      out_of_range: '数值越界',
      logic_conflict: '逻辑冲突',
    };
    return labels[type] || type;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div
          className={`
            p-4 border-b flex items-center gap-3
            ${result.valid ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}
          `}
        >
          {result.valid ? (
            <CheckCircle className="text-green-400" size={24} />
          ) : (
            <FileWarning className="text-red-400" size={24} />
          )}
          <div>
            <h3 className="font-bold text-lg">
              {result.valid ? '导入成功' : '数据校验失败'}
            </h3>
            <p className="text-sm text-gray-400">
              {result.valid
                ? `配置已加载，发现 ${result.errors.length} 处警告`
                : `发现 ${result.errors.length} 处问题需要处理`}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {result.errors.length === 0 ? (
            <div className="text-center py-8 text-green-400">
              <CheckCircle size={48} className="mx-auto mb-3" />
              <p>数据格式完全正确</p>
            </div>
          ) : (
            result.errors.map((error, index) => (
              <div
                key={index}
                className={`
                  rounded-lg border overflow-hidden transition-all duration-300
                  ${visibleLines.includes(index) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                  ${result.valid ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-red-500/30 bg-red-500/5'}
                `}
              >
                <div className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getErrorIcon(error.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`
                            text-xs px-2 py-0.5 rounded font-mono uppercase tracking-wider
                            ${result.valid ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}
                          `}
                        >
                          {getTypeLabel(error.type)}
                        </span>
                        {error.line !== undefined && (
                          <span className="text-xs text-gray-500 font-mono">
                            第 {error.line} 行
                            {error.column !== undefined && `, 第 ${error.column} 列`}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-300 mb-2">{error.message}</p>

                      {error.field && (
                        <div className="text-xs text-gray-400 mb-2">
                          字段: <code className="text-cyan-400">{error.field}</code>
                        </div>
                      )}

                      {error.value !== undefined && (
                        <div className="text-xs text-gray-400 mb-2">
                          当前值:{' '}
                          <code className="text-orange-400">
                            {JSON.stringify(error.value)}
                          </code>
                        </div>
                      )}

                      {error.expected && (
                        <div className="text-xs text-gray-400">
                          期望值: <span className="text-green-400">{error.expected}</span>
                          {error.actual && (
                            <span>
                              {' '}
                              / 实际值: <span className="text-red-400">{error.actual}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {error.source && (
                  <div className="border-t border-gray-700 bg-gray-950 p-3">
                    <div className="text-xs text-gray-500 mb-1">原始内容:</div>
                    <pre className="text-xs font-mono text-gray-300 bg-gray-900 p-2 rounded overflow-x-auto">
                      {error.source.split('\n').map((line, i) => {
                        const isErrorLine = error.line !== undefined && i === Math.floor(error.line / 2);
                        return (
                          <div
                            key={i}
                            className={isErrorLine ? 'bg-red-500/20 -mx-2 px-2' : ''}
                          >
                            {line}
                          </div>
                        );
                      })}
                    </pre>
                  </div>
                )}

                {error.type === 'out_of_range' && result.correctedParams && (
                  <div className="border-t border-gray-700 bg-cyan-500/5 p-3 text-xs text-cyan-400">
                    ✓ 已自动修正到安全范围
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          {!result.valid && (
            <div className="flex-1 text-sm text-gray-400">
              ⚠️ 数据存在严重问题，已拒绝加载
            </div>
          )}
          <Button variant="primary" onClick={onClose}>
            {result.valid ? '确认' : '关闭'}
          </Button>
        </div>
      </div>
    </div>
  );
}
