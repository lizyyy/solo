import { X, Database, Clock, Hash, Info, AlertCircle, Lightbulb } from 'lucide-react';
import type { SelectableObject, QualityReport, QualityIssue } from '../../types';
import { generateQualitySummary } from '../../quality/checker';

interface DetailPanelProps {
  selectedObject: SelectableObject | null;
  qualityReport: QualityReport | null;
  onClose: () => void;
  onAffectedClick?: (id: string) => void;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTypeName(type: string): string {
  switch (type) {
    case 'blackHole':
      return '黑洞';
    case 'lightRay':
      return '光线';
    case 'star':
      return '恒星';
    default:
      return '未知';
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'blackHole':
      return 'text-purple-400';
    case 'lightRay':
      return 'text-blue-400';
    case 'star':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
}

function ObjectDetail({ obj }: { obj: SelectableObject }) {
  if (obj.type === 'blackHole') {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            物理参数
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">质量</span>
              <span className="text-sm font-mono text-orange-400">{obj.mass.toFixed(2)} M☉</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">史瓦西半径</span>
              <span className="text-sm font-mono text-orange-400">
                {obj.schwarzschildRadius.toExponential(4)} m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">自旋参数</span>
              <span className="text-sm font-mono text-orange-400">{obj.spin.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            <Info className="w-3 h-3 inline mr-1" />
            计算公式
          </h4>
          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <p className="text-xs text-gray-300 font-mono leading-relaxed">
              {obj.formula}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (obj.type === 'lightRay') {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            路径参数
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">碰撞参数</span>
              <span className="text-sm font-mono text-blue-400">
                {obj.impactParameter.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">偏折角度</span>
              <span className="text-sm font-mono text-blue-400">
                {((obj.deflectionAngle * 180) / Math.PI).toFixed(2)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">路径类型</span>
              <span
                className={`text-sm font-medium ${
                  obj.pathType === 'captured'
                    ? 'text-red-400'
                    : obj.pathType === 'critical'
                    ? 'text-yellow-400'
                    : 'text-green-400'
                }`}
              >
                {obj.pathType === 'captured'
                  ? '被捕获'
                  : obj.pathType === 'critical'
                  ? '临界光线'
                  : '正常偏折'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">采样点数</span>
              <span className="text-sm font-mono text-blue-400">{obj.pathPoints.length}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            端点坐标
          </h4>
          <div className="space-y-2">
            <div className="p-2 bg-gray-800/50 rounded">
              <span className="text-[10px] text-gray-500 block mb-1">起点</span>
              <span className="text-xs font-mono text-gray-300">
                ({obj.startPoint.map((v) => v.toFixed(2)).join(', ')})
              </span>
            </div>
            <div className="p-2 bg-gray-800/50 rounded">
              <span className="text-[10px] text-gray-500 block mb-1">终点</span>
              <span className="text-xs font-mono text-gray-300">
                ({obj.endPoint.map((v) => v.toFixed(2)).join(', ')})
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (obj.type === 'star') {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            恒星参数
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">视星等</span>
              <span className="text-sm font-mono text-yellow-400">{obj.magnitude.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">表面温度</span>
              <span className="text-sm font-mono text-yellow-400">{obj.temperature.toFixed(0)} K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">是否被透镜</span>
              <span
                className={`text-sm font-medium ${
                  obj.isLensed ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                {obj.isLensed ? '是' : '否'}
              </span>
            </div>
            {obj.magnification && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-300">放大倍数</span>
                <span className="text-sm font-mono text-yellow-400">
                  {obj.magnification.toFixed(2)}x
                </span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            位置信息
          </h4>
          <div className="space-y-2">
            <div className="p-2 bg-gray-800/50 rounded">
              <span className="text-[10px] text-gray-500 block mb-1">真实位置</span>
              <span className="text-xs font-mono text-gray-300">
                ({obj.position.map((v) => v.toFixed(2)).join(', ')})
              </span>
            </div>
            {obj.lensedPosition && (
              <div className="p-2 bg-gray-800/50 rounded border border-green-700/30">
                <span className="text-[10px] text-green-500 block mb-1">透镜后位置</span>
                <span className="text-xs font-mono text-green-400">
                  ({obj.lensedPosition.map((v) => v.toFixed(2)).join(', ')})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function QualityDetail({ report, onAffectedClick }: { report: QualityReport; onAffectedClick?: (id: string) => void }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-red-700/50 bg-red-900/20';
      case 'medium':
        return 'border-yellow-700/50 bg-yellow-900/20';
      case 'low':
        return 'border-blue-700/50 bg-blue-900/20';
      default:
        return 'border-gray-700/50 bg-gray-900/20';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high':
        return { text: '严重', color: 'text-red-400' };
      case 'medium':
        return { text: '中等', color: 'text-yellow-400' };
      case 'low':
        return { text: '轻微', color: 'text-blue-400' };
      default:
        return { text: '未知', color: 'text-gray-400' };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'scale':
        return '尺度问题';
      case 'penetration':
        return '光线穿模';
      case 'occlusion':
        return '恒星遮挡';
      default:
        return '未知问题';
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-medium text-gray-200">智能评估</span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          {generateQualitySummary(report)}
        </p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          问题详情
        </h4>
        <div className="space-y-3">
          {report.issues.map((issue, index) => {
            const severity = getSeverityLabel(issue.severity);
            return (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-200">
                    {getTypeLabel(issue.type)}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${severity.color} bg-gray-800/50`}>
                    {severity.text}
                  </span>
                </div>
                <p className="text-xs text-gray-300 mb-2">{issue.description}</p>
                <div className="p-2 bg-gray-900/50 rounded border-l-2 border-orange-500 mb-2">
                  <p className="text-xs text-orange-300 leading-relaxed">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    {issue.humanReason}
                  </p>
                </div>
                {issue.affectedIds.length > 0 && (
                  <div>
                    <span className="text-[10px] text-gray-500 block mb-1">
                      受影响对象 ({issue.affectedIds.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {issue.affectedIds.slice(0, 10).map((id) => (
                        <button
                          key={id}
                          onClick={() => onAffectedClick?.(id)}
                          className="text-[10px] px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                        >
                          {id}
                        </button>
                      ))}
                      {issue.affectedIds.length > 10 && (
                        <span className="text-[10px] text-gray-500 px-2 py-0.5">
                          +{issue.affectedIds.length - 10} 更多
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DetailPanel({ selectedObject, qualityReport, onClose, onAffectedClick }: DetailPanelProps) {
  const hasContent = selectedObject || qualityReport;

  return (
    <div className="w-80 bg-gray-900/90 backdrop-blur-md border-l border-gray-700/50 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
        <h2 className="text-lg font-bold text-orange-400 font-['Orbitron'] tracking-wider">
          {selectedObject ? '对象明细' : '质量报告'}
        </h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!hasContent && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Info className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm text-center">
              点击场景中的对象查看详情
              <br />
              或运行质量检查获取报告
            </p>
          </div>
        )}

        {selectedObject && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center`}>
                <span className={`text-lg font-bold ${getTypeColor(selectedObject.type)}`}>
                  {getTypeName(selectedObject.type).charAt(0)}
                </span>
              </div>
              <div>
                <div className={`text-sm font-medium ${getTypeColor(selectedObject.type)}`}>
                  {getTypeName(selectedObject.type)}
                </div>
                <div className="text-[10px] text-gray-500 font-mono">
                  {selectedObject.id}
                </div>
              </div>
            </div>

            <ObjectDetail obj={selectedObject} />

            <div className="pt-4 border-t border-gray-700/50">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                <Database className="w-3 h-3 inline mr-1" />
                数据溯源
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">数据来源</span>
                  <span className="text-gray-200">
                    {(selectedObject as any).dataSource || '未知'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">数据版本</span>
                  <span className="text-gray-200 font-mono">
                    {(selectedObject as any).version || '未知'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">
                    <Clock className="w-3 h-3 inline mr-1" />
                    创建时间
                  </span>
                  <span className="text-gray-200">
                    {(selectedObject as any).createdAt
                      ? formatDate((selectedObject as any).createdAt)
                      : '未知'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedObject && qualityReport && (
          <QualityDetail report={qualityReport} onAffectedClick={onAffectedClick} />
        )}
      </div>
    </div>
  );
}
