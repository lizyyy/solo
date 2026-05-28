import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { generateReport } from '../engine/gameEngine';
import { ScoreRadarChart } from '../components/result/ScoreRadarChart';
import { ReportPreview } from '../components/result/ReportPreview';
import { ExportButtons } from '../components/result/ExportButtons';

export function ResultPage() {
  const navigate = useNavigate();
  const { finalScore, selectedArtwork, getEndReason, resetGame } = useGameStore();

  useEffect(() => {
    if (!finalScore || !selectedArtwork) {
      navigate('/');
    }
  }, [finalScore, selectedArtwork, navigate]);

  const report = useMemo(() => {
    const state = useGameStore.getState();
    if (!state.finalScore || !state.selectedArtwork) return null;
    return generateReport(state);
  }, [finalScore, selectedArtwork]);

  if (!finalScore || !selectedArtwork || !report) return null;

  const endReason = getEndReason();
  const isFailure = finalScore.grade === 'F' || endReason.includes('被迫终止') || endReason.includes('无法修复') || endReason.includes('濒临损毁');

  const handleBack = () => {
    resetGame();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-museum-bg bg-noise">
      <header className="border-b border-museum-bronze/20 bg-museum-bg/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-museum-paper/70 hover:text-museum-paper transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">返回首页</span>
          </button>

          <h1 className="text-xl font-serif font-bold text-museum-paper">
            修复报告
          </h1>

          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isFailure && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl flex items-start gap-3"
          >
            <AlertTriangle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-medium mb-1">修复任务未能正常完成</h3>
              <p className="text-red-300/80 text-sm">{endReason}</p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <ScoreRadarChart score={finalScore} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <div className="card-paper">
              <h3 className="text-lg font-serif font-bold text-museum-ink mb-3">作品信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-museum-ink/60">作品名称</span>
                  <span className="text-museum-ink font-medium">{selectedArtwork.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-museum-ink/60">创作年代</span>
                  <span className="text-museum-ink">{selectedArtwork.creationEra}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-museum-ink/60">作品材质</span>
                  <span className="text-museum-ink">{selectedArtwork.materials.join('、')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-museum-ink/60">颜料成分</span>
                  <span className="text-museum-ink">{selectedArtwork.paintComposition}</span>
                </div>
              </div>
            </div>

            <div className="card-paper">
              <h3 className="text-lg font-serif font-bold text-museum-ink mb-3">状态对比</h3>
              <div className="space-y-3 text-sm">
                <StatusCompareRow
                  label="污渍程度"
                  before={selectedArtwork.initialStain}
                  after={report.finalState.stain}
                  inverse
                />
                <StatusCompareRow
                  label="颜料层"
                  before={selectedArtwork.initialPaintLayer}
                  after={report.finalState.paintLayer}
                />
                <StatusCompareRow
                  label="结构强度"
                  before={selectedArtwork.initialStructure}
                  after={report.finalState.structure}
                />
                <StatusCompareRow
                  label="时间预算"
                  before={selectedArtwork.timeBudget}
                  after={report.finalState.remainingTime}
                  suffix=" 单位"
                />
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <ReportPreview report={report} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <ExportButtons report={report} />

            <div className="card-paper">
              <h3 className="text-lg font-serif font-bold text-museum-ink mb-3">修复建议</h3>
              <div className="space-y-2 text-sm text-museum-ink/70">
                {finalScore.appearance < 20 && (
                  <p className="flex items-start gap-2">
                    <span className="text-museum-ochre">•</span>
                    外观修复效果一般，建议采用更温和的清洁方式逐步去除污渍。
                  </p>
                )}
                {finalScore.structure < 20 && (
                  <p className="flex items-start gap-2">
                    <span className="text-museum-ochre">•</span>
                    结构保存不佳，下次修复时优先考虑加固操作，避免颜料层进一步损伤。
                  </p>
                )}
                {finalScore.materialCompatibility < 15 && (
                  <p className="flex items-start gap-2">
                    <span className="text-museum-ochre">•</span>
                    材料兼容性存在问题，建议在修复前充分检测作品材质，选择匹配的修复材料。
                  </p>
                )}
                {finalScore.timeEfficiency < 50 && (
                  <p className="flex items-start gap-2">
                    <span className="text-museum-ochre">•</span>
                    时间管理有待提升，合理规划修复步骤可提高效率。
                  </p>
                )}
                {finalScore.riskControl < 50 && (
                  <p className="flex items-start gap-2">
                    <span className="text-museum-ochre">•</span>
                    风险事件频发，建议在操作前先确认所有未知信息，降低操作风险。
                  </p>
                )}
                {finalScore.total >= 80 && (
                  <p className="flex items-start gap-2">
                    <span className="text-museum-patina">✓</span>
                    修复工作完成出色！各方面表现均衡，可作为标准修复案例参考。
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function StatusCompareRow({
  label,
  before,
  after,
  inverse = false,
  suffix = '%',
}: {
  label: string;
  before: number;
  after: number;
  inverse?: boolean;
  suffix?: string;
}) {
  const delta = after - before;
  const improved = inverse ? delta < 0 : delta > 0;
  const color = improved ? 'text-museum-patina' : delta === 0 ? 'text-museum-ink/60' : 'text-museum-cinnabar';
  const arrow = inverse ? (delta < 0 ? '↓' : delta > 0 ? '↑' : '→') : (delta > 0 ? '↑' : delta < 0 ? '↓' : '→');

  return (
    <div className="flex items-center justify-between">
      <span className="text-museum-ink/60">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-museum-ink/50">{before}{suffix}</span>
        <span className="text-museum-ink/30">→</span>
        <span className="text-museum-ink font-medium">{after}{suffix}</span>
        {delta !== 0 && (
          <span className={`text-xs ${color}`}>
            {arrow} {Math.abs(delta)}{suffix}
          </span>
        )}
      </div>
    </div>
  );
}
