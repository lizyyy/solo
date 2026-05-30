import React from 'react';
import { SimilarityBreakdown } from '../types';
import { Activity, BarChart3, Radio, Target } from 'lucide-react';

interface SimilarityScoreProps {
  breakdown: SimilarityBreakdown;
  passThreshold: number;
}

const SimilarityScore: React.FC<SimilarityScoreProps> = ({ breakdown, passThreshold }) => {
  const getScoreColor = (score: number) => {
    if (score >= passThreshold) return 'text-cyber-success';
    if (score >= passThreshold * 0.7) return 'text-cyber-accent';
    return 'text-cyber-danger';
  };

  const getProgressColor = (score: number) => {
    if (score >= passThreshold) return 'bg-cyber-success';
    if (score >= passThreshold * 0.7) return 'bg-cyber-accent';
    return 'bg-cyber-danger';
  };

  const items = [
    { label: '波形匹配', value: breakdown.waveformMatch, icon: <Activity size={14} />, key: 'waveform' },
    { label: '频谱匹配', value: breakdown.frequencyMatch, icon: <BarChart3 size={14} />, key: 'frequency' },
    { label: '谐波匹配', value: breakdown.harmonicMatch, icon: <Radio size={14} />, key: 'harmonic' },
  ];

  return (
    <div className="p-4 rounded-lg neon-border bg-cyber-card/50">
      <div className="flex items-center gap-2 mb-4">
        <Target className="text-cyber-primary" size={20} />
        <span className="font-orbitron text-cyber-primary font-bold">相似度分析</span>
      </div>

      <div className="text-center mb-6">
        <div className={`text-5xl font-orbitron font-bold ${getScoreColor(breakdown.total)} neon-text`}>
          {breakdown.total}%
        </div>
        <div className="text-xs text-cyber-muted mt-1">
          通关阈值: {passThreshold}%
        </div>
      </div>

      <div className="w-full h-2 bg-cyber-bgDark rounded-full overflow-hidden mb-6">
        <div 
          className={`h-full ${getProgressColor(breakdown.total)} transition-all duration-500`}
          style={{ width: `${breakdown.total}%` }}
        />
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3">
            <div className="text-cyber-muted">
              {item.icon}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-cyber-muted">{item.label}</span>
                <span className={`font-orbitron ${getScoreColor(item.value)}`}>
                  {item.value}%
                </span>
              </div>
              <div className="w-full h-1 bg-cyber-bgDark rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getProgressColor(item.value)} transition-all duration-300`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-cyber-muted/20">
        <div className="text-xs text-cyber-muted text-center">
          总分 = 波形40% + 频谱40% + 谐波20%
        </div>
      </div>
    </div>
  );
};

export default SimilarityScore;
