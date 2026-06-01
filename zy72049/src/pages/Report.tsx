import { useParams, useNavigate } from 'react-router-dom';
import { getRecordById } from '../data/mockRecords';
import { useTrainingStore } from '../store/trainingStore';
import { getRiskLabel, formatTime } from '../utils/businessEngine';
import {
  ArrowLeft, Trophy, Zap, Cpu, Timer, CheckCircle,
  AlertTriangle, Clock, GripVertical, MousePointer2, Pause,
} from 'lucide-react';

const Report = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();

  const record = recordId ? getRecordById(recordId) : undefined;
  const { resources, decisionHistory, conflictResolved } = useTrainingStore();

  if (!record) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">未找到记录</h2>
          <p className="text-zinc-400 mb-4">该练习记录不存在</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const hasTrainingData = decisionHistory.length > 0;
  const finalScore = hasTrainingData ? resources.score : record.baseScore;
  const finalResources = hasTrainingData
    ? resources
    : {
        energy: record.initialResources.energy,
        compute: record.initialResources.compute,
        time: record.initialResources.time,
        score: record.baseScore,
        riskLevel: 0 as const,
        isNegative: false,
      };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'drag':
        return <GripVertical className="w-4 h-4 text-blue-400" />;
      case 'click':
        return <MousePointer2 className="w-4 h-4 text-purple-400" />;
      case 'pause':
        return <Pause className="w-4 h-4 text-yellow-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
  };

  const riskBadgeClass = (level: number) => {
    switch (level) {
      case 0:
        return 'bg-green-500/20 text-green-400';
      case 1:
        return 'bg-yellow-500/20 text-yellow-400';
      case 2:
        return 'bg-orange-500/20 text-orange-400';
      case 3:
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  const totalScoreDelta = decisionHistory.reduce((sum, step) => sum + step.scoreDelta, 0);
  const hasNegativeResource = decisionHistory.some(
    (step) =>
      step.resourceDelta.energy < 0 ||
      step.resourceDelta.compute < 0 ||
      step.resourceDelta.time < 0
  );

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold">训练报告 - {record.title}</h1>
              <p className="text-xs text-zinc-400">
                {record.createdAt} · {record.source === 'student_import' ? '学生导入' : '系统生成'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {record.status === 'legacy' && (
              <span className="px-3 py-1.5 rounded-md text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30">
                旧口径数据
              </span>
            )}
            {record.conflictData && (
              <span
                className={`px-3 py-1.5 rounded-md text-xs border ${
                  conflictResolved || record.conflictData.resolved
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                }`}
              >
                {conflictResolved || record.conflictData.resolved ? '冲突已解决' : '存在数据冲突'}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center">
            <Trophy className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-xs text-zinc-400 mb-1">最终分数</div>
            <div className="font-mono text-3xl font-bold text-amber-400">
              {finalScore}
            </div>
            {hasTrainingData && totalScoreDelta !== 0 && (
              <div className="text-xs text-zinc-500 mt-1">
                操作累计: {totalScoreDelta > 0 ? '+' : ''}
                {totalScoreDelta}
              </div>
            )}
          </div>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center">
            <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <div className="text-xs text-zinc-400 mb-1">剩余能源</div>
            <div
              className={`font-mono text-3xl font-bold ${
                finalResources.energy < 0 ? 'text-red-400' : 'text-white'
              }`}
            >
              {finalResources.energy}
            </div>
          </div>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center">
            <Cpu className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <div className="text-xs text-zinc-400 mb-1">剩余算力</div>
            <div
              className={`font-mono text-3xl font-bold ${
                finalResources.compute < 0 ? 'text-red-400' : 'text-white'
              }`}
            >
              {finalResources.compute}
            </div>
          </div>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center">
            <Timer className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <div className="text-xs text-zinc-400 mb-1">剩余时间</div>
            <div
              className={`font-mono text-3xl font-bold ${
                finalResources.time < 0 ? 'text-red-400' : 'text-white'
              }`}
            >
              {finalResources.time}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">风险等级</span>
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${riskBadgeClass(
                finalResources.riskLevel
              )}`}
            >
              {getRiskLabel(finalResources.riskLevel)}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-400">操作次数:</span>
              <span className="font-mono">{decisionHistory.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-blue-400" />
              <span className="text-zinc-400">拖拽:</span>
              <span className="font-mono">
                {decisionHistory.filter((s) => s.actionType === 'drag').length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MousePointer2 className="w-4 h-4 text-purple-400" />
              <span className="text-zinc-400">点击:</span>
              <span className="font-mono">
                {decisionHistory.filter((s) => s.actionType === 'click').length}
              </span>
            </div>
          </div>
        </div>

        {hasNegativeResource && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="font-semibold text-red-400">资源异常提醒</h3>
            </div>
            <p className="text-sm text-zinc-300">
              训练过程中出现资源不足情况，部分操作的自动计分已暂停。请查看下方详细记录。
            </p>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold mb-4">决策过程追溯</h2>
          {decisionHistory.length === 0 ? (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-8 text-center">
              <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500">暂无操作记录，这是初始状态报告</p>
              <p className="text-xs text-zinc-600 mt-2">
                基础分数: {record.baseScore} · 初始资源: 能源{record.initialResources.energy}/
                算力{record.initialResources.compute}/时间{record.initialResources.time}
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-zinc-700" />
              <div className="space-y-4">
                {decisionHistory.map((step, index) => (
                  <div key={step.id} className="relative flex items-start gap-4 pl-12">
                    <div
                      className={`absolute left-4 w-5 h-5 rounded-full border-4 border-zinc-900 flex items-center justify-center ${
                        step.actionType === 'pause'
                          ? 'bg-yellow-500'
                          : step.scoreDelta === 0
                          ? 'bg-zinc-500'
                          : step.scoreDelta > 0
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }`}
                    />
                    <div className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {getActionIcon(step.actionType)}
                          <span className="text-sm font-medium">
                            步骤 {index + 1} ·{' '}
                            {step.actionType === 'drag'
                              ? '拖拽'
                              : step.actionType === 'click'
                              ? '点击'
                              : step.actionType === 'pause'
                              ? '暂停'
                              : '继续'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${riskBadgeClass(
                              step.riskLevel
                            )}`}
                          >
                            {getRiskLabel(step.riskLevel)}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {formatTime(step.timestamp)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300 mb-3">{step.description}</p>
                      <div className="flex items-center gap-4 text-xs border-t border-zinc-700 pt-3">
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          <span className="text-zinc-500">能源:</span>
                          <span
                            className={`font-mono ${
                              step.resourceDelta.energy < 0 ? 'text-red-400' : ''
                            }`}
                          >
                            {step.resourceDelta.energy > 0 ? '+' : ''}
                            {step.resourceDelta.energy}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-blue-400" />
                          <span className="text-zinc-500">算力:</span>
                          <span
                            className={`font-mono ${
                              step.resourceDelta.compute < 0 ? 'text-red-400' : ''
                            }`}
                          >
                            {step.resourceDelta.compute > 0 ? '+' : ''}
                            {step.resourceDelta.compute}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Timer className="w-3 h-3 text-green-400" />
                          <span className="text-zinc-500">时间:</span>
                          <span
                            className={`font-mono ${
                              step.resourceDelta.time < 0 ? 'text-red-400' : ''
                            }`}
                          >
                            {step.resourceDelta.time > 0 ? '+' : ''}
                            {step.resourceDelta.time}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-amber-400" />
                          <span className="text-zinc-500">分数:</span>
                          <span
                            className={`font-mono ${
                              step.scoreDelta > 0
                                ? 'text-green-400'
                                : step.scoreDelta < 0
                                ? 'text-red-400'
                                : 'text-zinc-400'
                            }`}
                          >
                            {step.scoreDelta > 0 ? '+' : ''}
                            {step.scoreDelta}
                            {step.scoreDelta === 0 && ' (暂停计分)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
          <h3 className="font-semibold mb-3">结果汇总</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded">
              <span className="text-zinc-400">基础分数</span>
              <span className="font-mono">{record.baseScore}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded">
              <span className="text-zinc-400">操作加分</span>
              <span className="font-mono text-green-400">
                +{decisionHistory.filter((s) => s.scoreDelta > 0).reduce((sum, s) => sum + s.scoreDelta, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded">
              <span className="text-zinc-400">操作减分</span>
              <span className="font-mono text-red-400">
                {decisionHistory.filter((s) => s.scoreDelta < 0).reduce((sum, s) => sum + s.scoreDelta, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded border border-amber-500/30">
              <span className="text-amber-400 font-medium">最终得分</span>
              <span className="font-mono text-xl font-bold text-amber-400">{finalScore}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm transition-colors"
          >
            返回列表
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/train/${recordId}`)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm transition-colors"
            >
              重新训练
            </button>
            {record.status === 'pending' && !record.conflictData?.resolved && !conflictResolved && (
              <button
                onClick={() => navigate(`/conflict/${recordId}`)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-md text-sm font-medium transition-colors"
              >
                处理冲突
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Report;
