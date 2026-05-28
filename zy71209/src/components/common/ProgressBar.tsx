interface ProgressBarProps {
  value: number;
  warningThreshold: number;
  dangerThreshold: number;
  max?: number;
  showLabels?: boolean;
}

export function ProgressBar({
  value,
  warningThreshold,
  dangerThreshold,
  max = 200,
  showLabels = true,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const warningPercent = (warningThreshold / max) * 100;
  const dangerPercent = (dangerThreshold / max) * 100;

  let barColor = 'bg-green-500';
  if (value >= dangerThreshold) {
    barColor = 'bg-red-600';
  } else if (value >= warningThreshold) {
    barColor = 'bg-red-400';
  }

  return (
    <div className="w-full">
      {showLabels && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">0%</span>
          <span className="text-gray-600">{dangerThreshold}% 平仓</span>
          <span className="text-gray-600">{warningThreshold}% 预警</span>
          <span className="text-gray-600">{max}%</span>
        </div>
      )}
      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full border-r-2 border-dashed border-gray-400"
          style={{ width: `${warningPercent}%` }}
        />
        <div
          className="absolute left-0 top-0 h-full border-r-2 border-dashed border-red-500"
          style={{ width: `${dangerPercent}%` }}
        />
        <div
          className={`absolute left-0 top-0 h-full ${barColor} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
        <div
          className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-800 rounded-full shadow-md"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
      {showLabels && (
        <div className="text-right text-sm font-bold mt-1">
          <span
            className={
              value >= dangerThreshold
                ? 'text-red-600'
                : value >= warningThreshold
                ? 'text-red-400'
                : 'text-green-600'
            }
          >
            {value.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}
