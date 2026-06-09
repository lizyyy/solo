import { AlertTriangle, AlertCircle } from 'lucide-react';

interface WarningBannerProps {
  type: 'old-terminology' | 'late-arrival' | 'average-mask';
  text?: string;
  showMaskWarning?: boolean;
}

export function WarningBanner({ type, text, showMaskWarning = false }: WarningBannerProps) {
  const configs = {
    'old-terminology': {
      bg: 'bg-amber-50',
      border: 'border-amber-400',
      text: 'text-amber-900',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
      label: '旧说法识别',
      detail: text || '照片描述中检测到已废止的旧标准/旧流程术语',
      extra: showMaskWarning
        ? '⚠ 此条在统计均值中可能被掩盖，建议单独复核判断'
        : null,
    },
    'late-arrival': {
      bg: 'bg-red-50',
      border: 'border-red-400',
      text: 'text-red-900',
      icon: <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />,
      label: '晚到附件',
      detail: text || '存在工单完成后补传的照片或附件，需确认是否影响判断',
      extra: null,
    },
    'average-mask': {
      bg: 'bg-orange-50',
      border: 'border-orange-400',
      text: 'text-orange-900',
      icon: <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />,
      label: '平均值掩盖风险',
      detail: text || '异常值可能在整体统计均值中被稀释拉平，请勿只看数字',
      extra: null,
    },
  } as const;

  const c = configs[type];

  return (
    <div
      className={`${c.bg} ${c.border} border-l-4 border rounded-r-md p-3 ${c.text} transition-all animate-pulse-slow`}
    >
      <div className="flex gap-3">
        {c.icon}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-0.5">{c.label}</div>
          <div className="text-xs opacity-90 leading-relaxed">{c.detail}</div>
          {c.extra && (
            <div className="mt-1 pt-1 border-t border-dashed border-amber-300 text-xs font-medium text-orange-700">
              {c.extra}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
