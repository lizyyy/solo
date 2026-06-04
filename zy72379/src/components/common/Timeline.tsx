import React from 'react';
import { Clock } from 'lucide-react';

interface TimelineItem {
  id: string;
  title: string;
  time: string;
  icon?: React.ReactNode;
  color?: string;
  operator?: string;
  detail?: string;
  evidenceRefs?: string[];
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

const colorMap: Record<string, { border: string; bg: string; text: string; line: string; title: string }> = {
  'bg-primary-500': { border: 'border-primary-500', bg: 'bg-primary-100', text: 'text-primary-700', line: 'bg-primary-200', title: 'text-primary-900' },
  'bg-success-500': { border: 'border-success-500', bg: 'bg-success-100', text: 'text-success-700', line: 'bg-success-200', title: 'text-success-900' },
  'bg-warning-500': { border: 'border-warning-500', bg: 'bg-warning-100', text: 'text-warning-700', line: 'bg-warning-200', title: 'text-warning-900' },
  'bg-danger-500': { border: 'border-danger-500', bg: 'bg-danger-100', text: 'text-danger-700', line: 'bg-danger-200', title: 'text-danger-900' },
  'bg-info-500': { border: 'border-info-500', bg: 'bg-info-100', text: 'text-info-700', line: 'bg-info-200', title: 'text-info-900' },
};

const defaultColors = { border: 'border-neutral-500', bg: 'bg-neutral-100', text: 'text-neutral-700', line: 'bg-neutral-200', title: 'text-neutral-900' };

interface TimelineStepProps {
  index: number;
  item: TimelineItem;
  isLast: boolean;
}

const TimelineStep: React.FC<TimelineStepProps> = ({ index, item, isLast }) => {
  const colors = (item.color && colorMap[item.color]) || defaultColors;

  return (
    <div className="flex gap-4 relative">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center flex-shrink-0`}>
          {item.icon ? (
            item.icon
          ) : (
            <span className={`text-xs font-bold ${colors.text} font-mono`}>{index + 1}</span>
          )}
        </div>
        {!isLast && <div className={`w-0.5 h-full ${colors.line} mt-1`} />}
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`font-semibold ${colors.title}`}>{item.title}</h4>
          <span className="text-xs text-neutral-500 font-mono">{item.time}</span>
        </div>
        {item.detail && <p className="text-sm text-neutral-700 mb-2">{item.detail}</p>}
        <div className="flex items-center gap-4 text-xs">
          {item.operator && (
            <span className="text-neutral-500">操作人：<span className="text-neutral-700">{item.operator}</span></span>
          )}
          {item.evidenceRefs && item.evidenceRefs.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded text-neutral-600">
              <span className="text-neutral-500">证据：</span>
              <span className="font-mono">{item.evidenceRefs.join(', ')}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const Timeline: React.FC<TimelineProps> = ({ items, className = '' }) => {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 text-neutral-500 p-4 bg-neutral-50 rounded-lg">
        <Clock className="w-5 h-5" />
        <span>暂无时间线记录</span>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {items.map((item, index) => (
        <TimelineStep
          key={item.id}
          index={index}
          item={item}
          isLast={index === items.length - 1}
        />
      ))}
    </div>
  );
};

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
  completedSteps?: number[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps, labels, completedSteps = [] }) => {
  return (
    <div className="flex items-center justify-between w-full">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isCompleted = completedSteps.includes(stepNum);
        const isCurrent = stepNum === currentStep;

        return (
          <React.Fragment key={stepNum}>
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted
                    ? 'bg-success-500 border-success-500'
                    : isCurrent
                    ? 'bg-primary-500 border-primary-500'
                    : 'bg-white border-neutral-300'
                }`}
              >
                {isCompleted ? (
                  <span className="text-white font-bold">✓</span>
                ) : isCurrent ? (
                  <span className="text-white font-bold font-mono">{stepNum}</span>
                ) : (
                  <span className="text-neutral-400 font-mono">{stepNum}</span>
                )}
              </div>
              <span
                className={`text-xs font-medium text-center ${
                  isCurrent ? 'text-primary-700' : 'text-neutral-500'
                }`}
              >
                {labels[i]}
              </span>
            </div>
            {stepNum < totalSteps && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-6 ${
                  completedSteps.includes(stepNum + 1) ? 'bg-success-400' : 'bg-neutral-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
