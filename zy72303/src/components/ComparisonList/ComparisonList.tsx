
import { useAppContext } from '../../store/AppContext';
import {
  getStakeholderName,
  getStatusName,
  formatPathDescription,
} from '../../utils/dataUtils';
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  MapPin,
  FileText,
  Settings,
  Users,
  ChevronRight,
  Eye,
} from 'lucide-react';
import type { DetourComparisonResult, ParameterRecord } from '../../types';

interface ComparisonListProps {
  onSelectResult: (resultId: string) => void;
  selectedResultId: string | null;
  onJumpToRecord: (recordId: string) => void;
}

export function ComparisonList({
  onSelectResult,
  selectedResultId,
  onJumpToRecord,
}: ComparisonListProps) {
  const { state } = useAppContext();

  const getRelatedRecord = (result: DetourComparisonResult): ParameterRecord | undefined => {
    return state.parameterRecords.find(r => r.id === result.parameterRecordId);
  };

  const getStatusBadge = (result: DetourComparisonResult) => {
    if (result.status === 'zero_denominator') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          分母为0
        </span>
      );
    }
    if (result.isSignificantDetour) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
          <TrendingUp className="w-3 h-3" />
          显著绕行
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
        <CheckCircle className="w-3 h-3" />
        正常
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">绕行比较结果</h2>
            <p className="text-emerald-100 text-sm mt-1">
              共 {state.comparisonResults.length} 条比较结果
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-100 text-sm">参数版本</span>
            <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-mono">
              {state.currentParameterVersion}
            </span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {state.comparisonResults.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <p>暂无比较结果，请先运行绕行比较</p>
          </div>
        ) : (
          state.comparisonResults.map(result => {
            const record = getRelatedRecord(result);
            const isSelected = selectedResultId === result.id;

            return (
              <div
                key={result.id}
                className={`p-4 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50 border-l-4 border-emerald-500'
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
                onClick={() => onSelectResult(result.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-800">
                        {record?.sourceNode} → {record?.targetNode}
                      </span>
                    </div>
                    {getStatusBadge(result)}
                    {result.demoUpdated && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        已更新演示
                      </span>
                    )}
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onJumpToRecord(result.parameterRecordId);
                    }}
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-sm transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    查看参数
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">最短路长度</p>
                    <p className="text-lg font-bold text-gray-800">
                      {result.shortestPath.totalWeight.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 truncate" title={formatPathDescription(state.graph.nodes, result.shortestPath)}>
                      {formatPathDescription(state.graph.nodes, result.shortestPath)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">备选路径长度</p>
                    <p className="text-lg font-bold text-gray-800">
                      {result.alternativePath.totalWeight.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 truncate" title={formatPathDescription(state.graph.nodes, result.alternativePath)}>
                      {formatPathDescription(state.graph.nodes, result.alternativePath)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">绕行比例</p>
                    <p className={`text-lg font-bold ${
                      result.detourRatio === null
                        ? 'text-amber-600'
                        : result.isSignificantDetour
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}>
                      {result.detourRatio !== null
                        ? `${result.detourRatio.toFixed(2)} 倍`
                        : '无法计算'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      阈值 {result.thresholdUsed} 倍
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 mb-3">
                  <div className="flex items-start gap-2 mb-2">
                    <FileText className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-indigo-700 mb-1">为什么被留下</p>
                      <p className="text-sm text-gray-700">{result.explanation.whyKept}</p>
                    </div>
                  </div>
                  {result.explanation.missingMaterials.length > 0 && (
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700 mb-1">还缺什么材料</p>
                        <ul className="text-sm text-gray-700 list-disc list-inside">
                          {result.explanation.missingMaterials.map((mat, idx) => (
                            <li key={idx}>{mat}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 mb-1">下一步</p>
                      <p className="text-sm text-gray-700">{result.explanation.nextAction}</p>
                      <p className="text-xs text-emerald-600 mt-1">
                        负责人：{getStakeholderName(result.explanation.nextStakeholder)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Settings className="w-3 h-3" />
                      参数 v{result.parameterVersion.version}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span>
                      计算于 {new Date(result.calculationTimestamp).toLocaleString()}
                    </span>
                  </div>
                  {record && (
                    <span className={`px-2 py-0.5 rounded ${
                      record.status === 'zero_denominator'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {getStatusName(record.status)}
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50 rounded p-3">
                  <p className="text-xs font-semibold text-purple-700 mb-1">
                    参数版本 & 取舍理由
                  </p>
                  <p className="text-xs text-gray-600 mb-1">
                    <span className="font-mono">{result.parameterVersion.parameters.edgeWeightFormula}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {result.parameterVersion.reasoning}
                  </p>
                </div>

                {result.classroomNote && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-blue-700 mb-1">📝 课堂演示说明</p>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-blue-50 p-2 rounded">
                      {result.classroomNote}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
