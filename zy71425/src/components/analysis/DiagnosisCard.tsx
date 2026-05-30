import { motion } from 'framer-motion';
import { DiagnosisResult, FailureType } from '../../types';
import { AlertTriangle, Zap, Target, Unlink, Brain, Lightbulb } from 'lucide-react';

const failureTypeInfo: Record<FailureType, { icon: typeof AlertTriangle; color: string; title: string }> = {
  'magnetic_direction': {
    icon: Zap,
    color: 'magnetic-purple',
    title: '磁场方向错误',
  },
  'high_energy': {
    icon: Zap,
    color: 'energy-red',
    title: '能量过高',
  },
  'track_broken': {
    icon: Unlink,
    color: 'energy-yellow',
    title: '轨道不连续',
  },
  'wall_collision': {
    icon: Target,
    color: 'energy-red',
    title: '碰撞管壁',
  },
};

interface DiagnosisCardProps {
  diagnosis: DiagnosisResult;
  onGoToReplay?: () => void;
}

export function DiagnosisCard({ diagnosis, onGoToReplay }: DiagnosisCardProps) {
  const info = diagnosis.failureType ? failureTypeInfo[diagnosis.failureType] : null;
  const Icon = info?.icon || Brain;
  const colorClass = info?.color || 'plasma-blue';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card border-${colorClass}/50 bg-${colorClass}/5`}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl bg-${colorClass}/20`}>
          <Icon className={`w-6 h-6 text-${colorClass}`} />
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h3 className="font-display font-bold text-xl text-white">
              {diagnosis.success ? '✓ 成功通过' : info?.title || '诊断结果'}
            </h3>
            <p className="font-mono text-sm text-tech-light mt-1">
              {diagnosis.summary}
            </p>
          </div>

          {!diagnosis.success && (
            <div className="space-y-3">
              <div className="bg-space-medium rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-energy-yellow" />
                  <span className="font-mono text-sm text-energy-yellow">物理公式</span>
                </div>
                <div className="font-mono text-plasma-blue text-lg">
                  {diagnosis.formula}
                </div>
                <p className="font-mono text-xs text-tech-light mt-2">
                  {diagnosis.explanation}
                </p>
              </div>

              {diagnosis.evidence.length > 0 && (
                <div className="bg-space-medium rounded-lg p-4">
                  <div className="font-mono text-sm text-white mb-2">关键证据</div>
                  <ul className="space-y-1">
                    {diagnosis.evidence.map((item, idx) => (
                      <li key={idx} className="font-mono text-xs text-tech-light flex items-start gap-2">
                        <span className="text-plasma-blue">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {diagnosis.suggestions.length > 0 && (
                <div className="bg-space-medium rounded-lg p-4">
                  <div className="font-mono text-sm text-neon-green mb-2">改进建议</div>
                  <ul className="space-y-1">
                    {diagnosis.suggestions.map((item, idx) => (
                      <li key={idx} className="font-mono text-xs text-tech-light flex items-start gap-2">
                        <span className="text-neon-green">→</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {diagnosis.success && diagnosis.calculations.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {diagnosis.calculations.map((calc, idx) => (
                <div key={idx} className="bg-space-medium rounded-lg p-3">
                  <div className="font-mono text-xs text-tech-light">{calc.label}</div>
                  <div className="font-mono text-sm text-plasma-blue">{calc.value}</div>
                </div>
              ))}
            </div>
          )}

          {onGoToReplay && !diagnosis.success && (
            <motion.button
              onClick={onGoToReplay}
              className="btn-primary text-sm w-full"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              查看复盘回放 →
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
