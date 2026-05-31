import { ChevronRight, AlertCircle, Sparkles } from 'lucide-react';
import type { DecisionOption, ResourceEffect } from '@/types';
import { RESOURCE_LABELS, RESOURCE_UNITS } from '@/types';
import { formatNumber } from '@/utils/helpers';

interface DecisionPanelProps {
  decisions: DecisionOption[];
  onDecision: (decisionId: string) => void;
  disabled?: boolean;
  currentNodeDescription?: string;
}

export function DecisionPanel({
  decisions,
  onDecision,
  disabled = false,
  currentNodeDescription,
}: DecisionPanelProps) {
  const renderEffect = (effect: ResourceEffect) => {
    const sign = effect.change > 0 ? '+' : '';
    const value = effect.type === 'percentage' 
      ? `${sign}${formatNumber(effect.change)}%`
      : `${sign}${formatNumber(effect.change)}`;
    
    const isPositive = effect.change > 0;
    const isNegative = effect.change < 0;
    
    let impactClass = 'text-white';
    if (effect.resource === 'inflation') {
      impactClass = effect.change < 0 ? 'text-success-400' : 'text-warning-400';
    } else if (effect.resource === 'gdpGrowth' || effect.resource === 'employment') {
      impactClass = effect.change > 0 ? 'text-success-400' : 'text-warning-400';
    } else {
      impactClass = isNegative ? 'text-success-400' : isPositive ? 'text-warning-400' : 'text-white';
    }

    return (
      <div key={effect.resource} className="flex items-center justify-between text-sm">
        <span className="text-white/70">{RESOURCE_LABELS[effect.resource]}</span>
        <span className={`font-mono ${impactClass}`}>
          {value}{RESOURCE_UNITS[effect.resource]}
        </span>
      </div>
    );
  };

  if (decisions.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-bold text-accent-400 mb-4">决策选项</h3>
        <div className="text-center py-8 text-white/50">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>当前位置没有可用决策</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-bold text-accent-400 mb-2">决策选项</h3>
      
      {currentNodeDescription && (
        <p className="text-sm text-white/70 mb-4 p-3 bg-white/5 rounded-lg">
          <Sparkles className="w-4 h-4 inline mr-2 text-accent-400" />
          {currentNodeDescription}
        </p>
      )}
      
      <div className="space-y-3">
        {decisions.map((decision) => (
          <button
            key={decision.id}
            onClick={() => onDecision(decision.id)}
            disabled={disabled}
            className="w-full text-left p-4 rounded-lg bg-white/5 hover:bg-gradient-to-r hover:from-accent-500/20 hover:to-accent-600/10 border border-white/10 hover:border-accent-500/30 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-white group-hover:text-accent-400 transition-colors">
                  {decision.label}
                </h4>
                <p className="text-sm text-white/60 mt-1">{decision.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-accent-400 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
            </div>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-3 border-t border-white/10">
              {decision.resourceEffects.map(renderEffect)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
