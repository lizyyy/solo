import { useEffect, useState } from 'react';
import type { CleaningStep } from '@/types';
import { Check, AlertTriangle, ArrowRight } from 'lucide-react';

interface CleaningPipelineProps {
  steps: CleaningStep[];
  highlightStep?: number;
  showAnimation?: boolean;
  title?: string;
}

export default function CleaningPipeline({ 
  steps, 
  highlightStep, 
  showAnimation = false,
  title = '清洗流水线'
}: CleaningPipelineProps) {
  const [animatedStep, setAnimatedStep] = useState(-1);

  useEffect(() => {
    if (showAnimation) {
      setAnimatedStep(-1);
      const timers: ReturnType<typeof setTimeout>[] = [];
      steps.forEach((_, index) => {
        timers.push(
          setTimeout(() => {
            setAnimatedStep(index);
          }, 300 * (index + 1))
        );
      });
      return () => timers.forEach(clearTimeout);
    } else {
      setAnimatedStep(steps.length - 1);
    }
  }, [steps, showAnimation]);

  return (
    <div className="bg-ocean-800/50 rounded-xl border border-ocean-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-6">{title}</h3>
      
      <div className="flex items-start justify-between gap-2">
        {steps.map((step, index) => {
          const isActive = animatedStep >= index;
          const isHighlighted = highlightStep === index;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex-1 flex flex-col items-center relative">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 relative ${
                  isHighlighted
                    ? 'bg-nautical-warning/20 border-2 border-nautical-warning shadow-glow-orange scale-110'
                    : step.hasIssue && isActive
                    ? 'bg-nautical-warning/15 border-2 border-nautical-warning/60'
                    : isActive
                    ? 'bg-ocean-600 border-2 border-ocean-500'
                    : 'bg-ocean-900 border-2 border-ocean-700'
                }`}
              >
                {isActive ? (
                  step.hasIssue ? (
                    <AlertTriangle className={`w-6 h-6 ${isHighlighted ? 'text-nautical-warning animate-pulse' : 'text-nautical-warning'}`} />
                  ) : (
                    <Check className="w-6 h-6 text-nautical-success" />
                  )
                ) : (
                  <span className="text-xl font-bold text-ocean-600">{step.stepOrder}</span>
                )}

                {isHighlighted && (
                  <div className="absolute inset-0 rounded-full animate-glow-pulse" />
                )}
              </div>

              <div className="mt-3 text-center">
                <p className={`text-sm font-medium mb-1 ${isActive ? 'text-white' : 'text-ocean-500'}`}>
                  {step.stepName}
                </p>
                <div className={`font-mono text-sm ${
                  isActive ? 'text-ocean-200' : 'text-ocean-600'
                }`}>
                  {isActive ? (
                    <span className="text-nautical-success">{step.outputValue.toFixed(2)}</span>
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              <p className={`text-xs mt-2 max-w-[120px] text-center leading-relaxed ${
                isActive ? 'text-ocean-400' : 'text-ocean-600'
              }`}>
                {step.description.length > 30 ? step.description.slice(0, 30) + '...' : step.description}
              </p>

              {!isLast && (
                <div className="absolute top-8 left-[calc(50%+32px)] w-full">
                  <ArrowRight className={`w-5 h-5 ${
                    isActive && animatedStep > index ? 'text-ocean-400' : 'text-ocean-700'
                  }`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-ocean-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ocean-400">原始值</span>
          <span className="text-sm text-ocean-400">→</span>
          <span className="text-sm text-ocean-400">最终结果</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-lg font-mono text-ocean-300">
            {steps[0]?.inputValue.toFixed(2)}
          </span>
          <span className="text-xs text-ocean-500">
            变化 {(steps[steps.length - 1]?.outputValue - steps[0]?.inputValue).toFixed(2)}
            ({steps[0]?.inputValue ? (((steps[steps.length - 1]?.outputValue - steps[0]?.inputValue) / steps[0]?.inputValue) * 100).toFixed(1) : 0}%)
          </span>
          <span className="text-lg font-mono font-bold text-white">
            {steps[steps.length - 1]?.outputValue.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
