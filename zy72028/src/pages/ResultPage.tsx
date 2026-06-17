import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Trophy, XCircle, FileText, Calendar, 
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Edit3, Home, RotateCcw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { GameEngine } from '../utils/GameEngine';
import { ResourceBar } from '../components/ResourceBar';
import type { DecisionRecord } from '../types';

export function ResultPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { currentGame, currentMaterial, loadGame, initMaterials } = useGameStore();
  const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(new Set());

  useEffect(() => {
    initMaterials();
  }, [initMaterials]);

  useEffect(() => {
    if (gameId) {
      loadGame(gameId);
    }
  }, [gameId, loadGame]);

  if (!currentGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-slate-600">加载中...</div>
      </div>
    );
  }

  const isSuccess = currentGame.status === 'completed';
  const scoreAnalysis = GameEngine.getScoreAnalysis(currentGame);
  const failureDescription = currentGame.failureType 
    ? GameEngine.getFailureDescription(currentGame.failureType)
    : null;

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const toggleDecision = (eventId: string) => {
    setExpandedDecisions(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 bg-white shadow-lg">
            {isSuccess ? (
              <Trophy className="w-10 h-10 text-amber-500" />
            ) : (
              <XCircle className="w-10 h-10 text-red-500" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            {isSuccess ? '🎉 游戏完成！' : failureDescription?.title}
          </h1>
          {failureDescription && (
            <p className="text-slate-600">{failureDescription.description}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">最终得分</p>
              <p className={`text-3xl font-bold ${
                currentGame.score >= 80 ? 'text-green-600' :
                currentGame.score >= 60 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {currentGame.score}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">正确决策</p>
              <p className="text-3xl font-bold text-green-600">
                {scoreAnalysis.correctDecisions}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">错误决策</p>
              <p className="text-3xl font-bold text-red-600">
                {scoreAnalysis.incorrectDecisions}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">用时</p>
              <p className="text-3xl font-bold text-purple-600">
                {currentGame.totalTimeUsed}秒
              </p>
            </div>
          </div>
        </motion.div>

        {failureDescription && failureDescription.suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6"
          >
            <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              改进建议
            </h3>
            <ul className="space-y-2">
              {failureDescription.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2 text-amber-700">
                  <span className="text-amber-500">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6"
        >
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              关键决策回放
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              共 {currentGame.decisions.length} 个决策，以下为关键选择及扣分原因
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {currentGame.decisions.map((decision, index) => (
              <DecisionItem
                key={decision.eventId}
                decision={decision}
                index={index}
                isExpanded={expandedDecisions.has(decision.eventId)}
                onToggle={() => toggleDecision(decision.eventId)}
              />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            审计信息
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500 mb-1">材料包</p>
              <p className="font-medium text-slate-700">{currentGame.materialName}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500 mb-1">游戏ID</p>
              <p className="font-medium text-slate-700 font-mono text-xs">{currentGame.id}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500 mb-1">开始时间</p>
              <p className="font-medium text-slate-700">{formatTime(currentGame.startTime)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500 mb-1">结束时间</p>
              <p className="font-medium text-slate-700">
                {currentGame.endTime ? formatTime(currentGame.endTime) : '-'}
              </p>
            </div>
          </div>
          {currentMaterial && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                材料来源：<span className="font-medium text-slate-700">{currentMaterial.source}</span>
              </p>
              <p className="text-sm text-slate-500 mt-1">
                创建人：<span className="font-medium text-slate-700">{currentMaterial.createdBy}</span>
              </p>
            </div>
          )}
        </motion.div>

        {currentMaterial && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          >
            <h2 className="text-xl font-bold text-slate-800 mb-4">最终资源状态</h2>
            <ResourceBar resources={currentGame.resources} />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-wrap gap-4 justify-center"
        >
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center gap-2 transition-colors"
          >
            <Home className="w-5 h-5" />
            返回首页
          </button>
          <button
            onClick={() => {
              if (currentGame.materialId) {
                navigate(`/game/${currentGame.materialId}`);
              }
            }}
            className="px-6 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-medium flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            再玩一次
          </button>
          <button
            onClick={() => navigate(`/supplement/${currentGame.id}`)}
            className="px-6 py-3 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl font-medium flex items-center gap-2 transition-colors"
          >
            <Edit3 className="w-5 h-5" />
            助教补录备注
          </button>
        </motion.div>
      </div>
    </div>
  );
}

interface DecisionItemProps {
  decision: DecisionRecord;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function DecisionItem({ decision, index, isExpanded, onToggle }: DecisionItemProps) {
  const isCritical = !decision.isCorrect || Math.abs(decision.scoreChange) >= 10;

  return (
    <div className="transition-colors">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
          decision.isCorrect 
            ? 'bg-green-100 text-green-600' 
            : 'bg-red-100 text-red-600'
        }`}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800 truncate">{decision.eventTitle}</p>
            {isCritical && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                关键
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 truncate">{decision.selectedOptionText}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-bold ${
            decision.scoreChange >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {decision.scoreChange >= 0 ? '+' : ''}{decision.scoreChange}分
          </span>
          {decision.isCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 ml-12">
          <div className="p-4 bg-slate-50 rounded-lg space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">选择的方案</p>
              <p className="text-slate-700">{decision.selectedOptionText}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">规则依据</p>
              <p className="text-slate-700">{decision.ruleReference}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">得分变化</p>
                <p className={`font-bold ${
                  decision.scoreChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {decision.scoreChange >= 0 ? '+' : ''}{decision.scoreChange} 分
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">决策用时</p>
                <p className="font-medium text-slate-700">{decision.timeTaken} 秒</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">决策时间</p>
              <p className="text-slate-700">
                {new Date(decision.timestamp).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
