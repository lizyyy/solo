import type { BoundaryRecord } from '../types';
import { StatusBadge, BlockTypeBadge, SeverityBadge } from './StatusBadge';

interface BoundaryResultListProps {
  records: BoundaryRecord[];
  selectedId: string | null;
  onSelect: (record: BoundaryRecord) => void;
  isCalculating: boolean;
}

export function BoundaryResultList({
  records,
  selectedId,
  onSelect,
  isCalculating
}: BoundaryResultListProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="text-5xl mb-4">📊</div>
        <p className="text-lg font-medium mb-1">暂无复核结果</p>
        <p className="text-sm">请选择材料并点击"开始复核"按钮</p>
      </div>
    );
  }

  if (isCalculating) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-5xl mb-4 animate-spin">⚙️</div>
        <p className="text-lg font-medium text-blue-600">正在计算边界复核...</p>
        <p className="text-sm text-gray-500 mt-1">系统正在校验公式、单位、阈值...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">复核结果</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green-600">
            ✓ {records.filter(r => r.isWithinBounds && !r.isMaterialLevel).length} 界内
          </span>
          <span className="text-red-600">
            ✗ {records.filter(r => !r.isWithinBounds && !r.isMaterialLevel).length} 界外
          </span>
          <span className="text-yellow-600">
            ⚠️ {records.filter(r => r.status === 'warning').length} 警告
          </span>
        </div>
      </div>

      <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto pr-2">
        {records.map((record) => (
          <BoundaryResultCard
            key={record.id}
            record={record}
            isSelected={selectedId === record.id}
            onSelect={() => onSelect(record)}
          />
        ))}
      </div>
    </div>
  );
}

interface BoundaryResultCardProps {
  record: BoundaryRecord;
  isSelected: boolean;
  onSelect: () => void;
}

function BoundaryResultCard({ record, isSelected, onSelect }: BoundaryResultCardProps) {
  const errorCount = record.anomalies.filter(a => a.severity === 'error').length;
  const warningCount = record.anomalies.filter(a => a.severity === 'warning').length;

  if (record.isMaterialLevel) {
    return (
      <div
        className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
          isSelected
            ? 'border-indigo-500 bg-indigo-50 shadow-md'
            : 'border-indigo-200 bg-indigo-50/40 hover:border-indigo-400'
        }`}
        onClick={onSelect}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-medium text-gray-800">{record.canonicalName}</span>
              <span className="px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700">材料级</span>
              <StatusBadge status={record.status} />
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">
              {record.anomalies[0]?.message || '材料级异常'}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="text-xs text-gray-500">来源：{record.sourceName}</span>
              {warningCount > 0 && <span className="text-xs text-yellow-600">⚠️ {warningCount} 个警告</span>}
              {errorCount > 0 && <span className="text-xs text-red-600">❌ {errorCount} 个错误</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-2xl">🔗</span>
          </div>
        </div>
      </div>
    );
  }

  const range = record.upperBound - record.lowerBound;
  const progress = range === 0 ? 0 : Math.min(100, Math.max(0, ((record.calculatedValue - record.lowerBound) / range) * 100));

  return (
    <div
      className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : record.isWithinBounds
            ? 'border-gray-200 bg-white hover:border-green-300'
            : 'border-red-200 bg-red-50 hover:border-red-400'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {record.objectName !== record.canonicalName && (
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500 line-through">{record.objectName}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium text-gray-800">{record.canonicalName}</span>
              </div>
            )}
            {record.objectName === record.canonicalName && (
              <span className="font-medium text-gray-800">{record.canonicalName}</span>
            )}
            <StatusBadge status={record.status} />
          </div>

          <div className="flex items-center gap-4 text-sm mb-2">
            <div className="flex items-baseline gap-1">
              <span className="text-gray-500">输入值:</span>
              <span className="font-mono font-medium text-gray-800">
                {record.inputValue}{record.inputUnit}
              </span>
            </div>
            {record.calculatedUnit && record.calculatedUnit !== record.inputUnit && (
              <div className="flex items-baseline gap-1">
                <span className="text-gray-500">换算:</span>
                <span className="font-mono text-xs text-orange-600">
                  {record.calculatedValue}{record.calculatedUnit}
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-gray-500">概率:</span>
              <span className="font-mono font-medium text-blue-600">
                {(record.probability * 100).toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  record.isWithinBounds ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              [{record.lowerBound}, {record.upperBound}]{record.boundUnit}
            </span>
          </div>

          {record.anomalies.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {errorCount > 0 && (
                <span className="text-xs text-red-600">❌ {errorCount} 个错误</span>
              )}
              {warningCount > 0 && (
                <span className="text-xs text-yellow-600">⚠️ {warningCount} 个警告</span>
              )}
              {record.extrapolation && (
                <span className="text-xs text-orange-600">📈 外推检测</span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {record.isWithinBounds ? (
            <span className="text-2xl">✅</span>
          ) : (
            <span className="text-2xl">❌</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface AnomalyListProps {
  record: BoundaryRecord | null;
  onResolve: (anomalyId: string, resolution: string) => void;
}

export function AnomalyList({ record, onResolve }: AnomalyListProps) {
  if (!record) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="text-4xl mb-2">🔍</div>
        <p>选择一条复核记录查看异常详情</p>
      </div>
    );
  }

  if (record.anomalies.length === 0) {
    return (
      <div className="p-8 text-center text-green-600">
        <div className="text-4xl mb-2">✨</div>
        <p>该记录无异常，复核通过</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">异常详情</h3>
        <span className="text-sm text-gray-500">
          共 {record.anomalies.length} 条异常
        </span>
      </div>

      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <span>📎 数据来源</span>
        </div>
        <div className="text-sm font-medium text-gray-800">{record.sourceName}</div>
        {record.sourceContext && (
          <pre className="mt-1 p-2 bg-white rounded text-xs text-gray-600 font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
            {record.sourceContext}
          </pre>
        )}
      </div>

      {record.extrapolation && (
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2 text-xs text-orange-700 mb-2">
            <span>📈 外推分析</span>
            <span className="px-2 py-0.5 rounded bg-orange-100">
              方向：{record.extrapolation.direction === 'up' ? '向上外推' : record.extrapolation.direction === 'down' ? '向下外推' : '双向外推'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 mb-2">
            <div>建模样本范围：[{record.extrapolation.originalRange[0]}, {record.extrapolation.originalRange[1]}]{record.boundUnit}</div>
            <div>外推后取值：{record.extrapolation.extrapolatedValue}{record.calculatedUnit}</div>
            <div className="col-span-2">外推方法：{record.extrapolation.method}</div>
            {record.extrapolation.impactScope.length > 0 && (
              <div className="col-span-2">影响范围：{record.extrapolation.impactScope.join('、')}</div>
            )}
          </div>
          <div className="p-2 bg-white/70 rounded text-sm text-orange-800">
            <span className="font-medium">收尾建议：</span>{record.extrapolation.suggestion}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {record.anomalies.map((anomaly) => (
          <div
            key={anomaly.id}
            className={`p-4 rounded-lg border ${
              anomaly.resolved
                ? 'bg-gray-50 border-gray-200 opacity-60'
                : anomaly.severity === 'error'
                  ? 'bg-red-50 border-red-200'
                  : anomaly.severity === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <BlockTypeBadge type={anomaly.blockType} />
                <SeverityBadge severity={anomaly.severity} />
                {anomaly.resolved && (
                  <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
                    ✓ 已处理
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {new Date(anomaly.createdAt).toLocaleTimeString('zh-CN')}
              </span>
            </div>

            <p className={`text-sm ${
              anomaly.severity === 'error' ? 'text-red-700' :
              anomaly.severity === 'warning' ? 'text-yellow-700' : 'text-blue-700'
            }`}>
              {anomaly.message}
            </p>

            {anomaly.details && Object.keys(anomaly.details).length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  查看详情
                </summary>
                <pre className="mt-2 p-2 bg-white/50 rounded text-xs text-gray-600 font-mono overflow-x-auto">
                  {JSON.stringify(anomaly.details, null, 2)}
                </pre>
              </details>
            )}

            {anomaly.resolved && anomaly.resolution && (
              <p className="mt-2 text-xs text-gray-600 bg-white/50 p-2 rounded">
                <span className="font-medium">处理意见：</span>{anomaly.resolution}
              </p>
            )}

            {!anomaly.resolved && (
              <button
                onClick={() => {
                  const resolution = prompt('请输入处理意见：');
                  if (resolution) {
                    onResolve(anomaly.id, resolution);
                  }
                }}
                className="mt-2 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                标记为已处理
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
