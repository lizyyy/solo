import { MapPin, FileText, ArrowRight } from 'lucide-react';
import type { GameStep, Resources } from '@/types';
import { RESOURCE_LABELS } from '@/types';
import { formatDateTime, formatNumber } from '@/utils/helpers';

interface StepTimelineProps {
  steps: GameStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

export function StepTimeline({
  steps,
  currentStepIndex,
  onStepClick,
}: StepTimelineProps) {
  const getResourceChanges = (step: GameStep) => {
    const changes: { key: keyof Resources; diff: number; before: number; after: number }[] = [];
    const keys = Object.keys(step.resourcesBefore) as (keyof Resources)[];
    
    keys.forEach((key) => {
      const diff = step.resourcesAfter[key] - step.resourcesBefore[key];
      if (Math.abs(diff) > 0.001) {
        changes.push({
          key,
          diff,
          before: step.resourcesBefore[key],
          after: step.resourcesAfter[key],
        });
      }
    });
    
    return changes;
  };

  return (
    <div className="card">
      <h3 className="text-lg font-bold text-accent-400 mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5" />
        决策时间线
      </h3>

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10" />

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isPast = index < currentStepIndex;
            const changes = getResourceChanges(step);

            return (
              <div
                key={index}
                onClick={() => onStepClick?.(index)}
                className={`relative pl-12 cursor-pointer transition-all ${
                  onStepClick ? 'hover:opacity-80' : ''
                }`}
              >
                <div
                  className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    isActive
                      ? 'bg-accent-500 border-accent-400 text-primary-900 animate-pulse'
                      : isPast
                      ? 'bg-primary-500/30 border-primary-400 text-primary-300'
                      : 'bg-white/5 border-white/20 text-white/50'
                  }`}
                >
                  {step.isSupplement ? (
                    <FileText className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-bold">{index + 1}</span>
                  )}
                </div>

                <div
                  className={`p-4 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-accent-500/10 border-accent-500/50'
                      : isPast
                      ? 'bg-white/5 border-white/10'
                      : 'bg-white/[0.02] border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className={`font-medium ${
                        isActive ? 'text-accent-400' : 'text-white'
                      }`}>
                        {step.decisionLabel || (step.isSupplement ? '补充材料' : '节点到达')}
                      </h4>
                      {step.isSupplement && step.supplementReason && (
                        <p className="text-sm text-warning-400 mt-1">
                          补充原因：{step.supplementReason}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-white/40">
                      {formatDateTime(step.timestamp)}
                    </span>
                  </div>

                  {changes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-2">
                        {changes.map(({ key, diff, before, after }) => (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-white/60">{RESOURCE_LABELS[key]}</span>
                            <span className="flex items-center gap-1">
                              <span className="text-white/40">{formatNumber(before)}%</span>
                              <ArrowRight className="w-3 h-3 text-white/30" />
                              <span className={diff > 0 ? 'text-success-400' : 'text-danger-400'}>
                                {formatNumber(after)}%
                              </span>
                              <span className={`text-xs ${
                                diff > 0 ? 'text-success-400/70' : 'text-danger-400/70'
                              }`}>
                                ({diff > 0 ? '+' : ''}{formatNumber(diff)})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
