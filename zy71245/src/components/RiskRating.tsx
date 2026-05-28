import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Gavel } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

interface RiskRatingProps {
  onSubmit: () => void;
  onBack: () => void;
}

export default function RiskRating({ onSubmit, onBack }: RiskRatingProps) {
  const { currentLevel, currentSession } = useGameStore();

  const markedAnomalies = currentSession?.playerChoices.filter(c => c.markedAsAnomaly) || [];

  const getRiskLevel = (rating?: number) => {
    if (!rating) return '未评分';
    if (rating === 1) return '低风险';
    if (rating === 2) return '中风险';
    return '高风险';
  };

  const getRiskColor = (rating?: number) => {
    if (!rating) return 'text-ink-200';
    if (rating === 1) return 'text-bronze-300';
    if (rating === 2) return 'text-amber-600';
    return 'text-seal-300';
  };

  const allRated = markedAnomalies.every(a => a.riskRating);

  const getClueTitle = (clueId: string) => {
    return currentLevel?.clues.find(c => c.id === clueId)?.title || '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto p-8"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-seal-100 rounded-full mb-4">
          <Gavel className="w-8 h-8 text-seal-300" />
        </div>
        <h2 className="text-3xl font-kai text-ink-300 mb-2">风险评级</h2>
        <p className="text-ink-200 font-song">
          对您发现的疑点进行风险等级评定
        </p>
      </div>

      <div className="bg-paper-50 rounded-lg p-6 border border-paper-300 mb-6">
        <h3 className="font-kai text-lg text-ink-300 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-seal-300" />
          已标记疑点列表
        </h3>

        {markedAnomalies.length === 0 ? (
          <div className="text-center py-8 text-ink-200 font-song">
            您还没有标记任何疑点
          </div>
        ) : (
          <div className="space-y-4">
            {markedAnomalies.map((anomaly, index) => (
              <motion.div
                key={anomaly.clueId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-paper-100 rounded-lg border border-paper-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-seal-100 rounded-full flex items-center justify-center text-seal-300 font-kai">
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="font-kai text-ink-300">
                        {getClueTitle(anomaly.clueId)}
                      </h4>
                      <p className="text-sm text-ink-200 font-song">
                        标记时间：{new Date(anomaly.timestamp).toLocaleTimeString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className={`font-kai text-lg ${getRiskColor(anomaly.riskRating)}`}>
                    {getRiskLevel(anomaly.riskRating)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-paper-50 rounded-lg p-6 border border-paper-300 mb-6">
        <h3 className="font-kai text-lg text-ink-300 mb-4">风险等级说明</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-bronze-50 rounded-lg border border-bronze-200 text-center">
            <div className="text-2xl mb-2">🟢</div>
            <div className="font-kai text-bronze-300">低风险</div>
            <p className="text-xs text-ink-200 mt-1 font-song">
              局部瑕疵，不影响真伪判断
            </p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
            <div className="text-2xl mb-2">🟡</div>
            <div className="font-kai text-amber-600">中风险</div>
            <p className="text-xs text-ink-200 mt-1 font-song">
              存在疑问，需结合其他线索
            </p>
          </div>
          <div className="p-4 bg-seal-50 rounded-lg border border-seal-200 text-center">
            <div className="text-2xl mb-2">🔴</div>
            <div className="font-kai text-seal-300">高风险</div>
            <p className="text-xs text-ink-200 mt-1 font-song">
              重大疑点，可直接判定真伪
            </p>
          </div>
        </div>
      </div>

      {!allRated && markedAnomalies.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-amber-700 font-song text-sm">
            ⚠️ 部分疑点尚未进行风险评级，建议返回线索分析页面完成评级
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-paper-200 text-ink-200 rounded-lg font-kai hover:bg-paper-300 transition-colors"
        >
          返回年代推断
        </button>
        <button
          onClick={onSubmit}
          className="flex items-center gap-2 px-6 py-3 bg-seal-300 text-white rounded-lg font-kai hover:bg-seal-200 transition-colors"
        >
          <CheckCircle className="w-5 h-5" />
          提交鉴定结论
        </button>
      </div>
    </motion.div>
  );
}
