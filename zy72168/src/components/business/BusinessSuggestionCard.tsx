import { Lightbulb, AlertCircle, Info } from 'lucide-react';
import type { BusinessSuggestion } from '@/types';

interface BusinessSuggestionCardProps {
  suggestion: BusinessSuggestion;
}

const priorityConfig = {
  high: {
    icon: AlertCircle,
    bgColor: 'bg-red-50 border-red-200',
    iconColor: 'text-red-600',
    label: '高优先级',
  },
  medium: {
    icon: Lightbulb,
    bgColor: 'bg-amber-50 border-amber-200',
    iconColor: 'text-amber-600',
    label: '中优先级',
  },
  low: {
    icon: Info,
    bgColor: 'bg-slate-50 border-slate-200',
    iconColor: 'text-slate-600',
    label: '低优先级',
  },
};

export default function BusinessSuggestionCard({ suggestion }: BusinessSuggestionCardProps) {
  const config = priorityConfig[suggestion.priority];
  const Icon = config.icon;

  return (
    <div className={`border rounded-lg p-4 ${config.bgColor}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-md bg-white ${config.iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.iconColor} bg-white`}>
              {config.label}
            </span>
            <span className="text-xs text-slate-500">面向：{suggestion.targetRole}</span>
          </div>
          <p className="text-slate-700 text-sm leading-relaxed" style={{ fontFamily: '"Kaiti", "楷体", serif' }}>
            {suggestion.content}
          </p>
        </div>
      </div>
    </div>
  );
}
