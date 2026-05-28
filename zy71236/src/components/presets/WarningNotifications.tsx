import { useEffect, useState } from 'react';
import { useSynthStore } from '../../store/useSynthStore';
import { Warning } from '../../types/synth';
import { AlertTriangle, X, AlertOctagon, AlertCircle, Info } from 'lucide-react';
import { Button } from '../ui/Button';

interface WarningToastProps {
  warning: Warning;
  onDismiss: () => void;
}

function WarningToast({ warning, onDismiss }: WarningToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const severityConfig = {
    low: {
      icon: Info,
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/50',
      text: 'text-blue-400',
      label: '提示',
    },
    medium: {
      icon: AlertCircle,
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/50',
      text: 'text-orange-400',
      label: '警告',
    },
    high: {
      icon: AlertOctagon,
      bg: 'bg-red-500/10',
      border: 'border-red-500/50',
      text: 'text-red-400',
      label: '危险',
    },
  };

  const config = severityConfig[warning.severity];
  const Icon = config.icon;

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-lg border backdrop-blur-sm
        ${config.bg} ${config.border}
        transform transition-all duration-300
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <Icon className={`${config.text} mt-0.5 flex-shrink-0 animate-pulse`} size={18} />
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-bold ${config.text} uppercase tracking-wider mb-0.5`}>
          {config.label}
        </div>
        <div className="text-sm text-gray-300">{warning.message}</div>
        {warning.correctedValue !== undefined && (
          <div className="text-xs text-cyan-400 mt-1">
            已自动修正为: {warning.correctedValue}
          </div>
        )}
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onDismiss, 300);
        }}
        className="text-gray-500 hover:text-gray-300 transition-colors p-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function WarningNotifications() {
  const { warnings, clearWarnings } = useSynthStore();
  const [displayedWarnings, setDisplayedWarnings] = useState<Warning[]>([]);

  useEffect(() => {
    if (warnings.length > displayedWarnings.length) {
      const newWarnings = warnings.slice(displayedWarnings.length);
      setDisplayedWarnings((prev) => [...prev, ...newWarnings]);
    }
  }, [warnings, displayedWarnings.length]);

  const dismissWarning = (index: number) => {
    setDisplayedWarnings((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed top-4 right-4 z-40 w-80 space-y-2">
      {displayedWarnings.slice(-3).map((warning, index) => (
        <WarningToast
          key={`${warning.timestamp || Date.now()}-${index}`}
          warning={warning}
          onDismiss={() => dismissWarning(index)}
        />
      ))}

      {warnings.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={clearWarnings}
          className="w-full text-xs text-gray-500"
        >
          清除所有警告 ({warnings.length})
        </Button>
      )}
    </div>
  );
}

export function WarningIndicator() {
  const { warnings } = useSynthStore();

  if (warnings.length === 0) return null;

  const hasHighSeverity = warnings.some((w) => w.severity === 'high');
  const hasMediumSeverity = warnings.some((w) => w.severity === 'medium');

  const colorClass = hasHighSeverity
    ? 'text-red-400 border-red-500/50 bg-red-500/10'
    : hasMediumSeverity
    ? 'text-orange-400 border-orange-500/50 bg-orange-500/10'
    : 'text-blue-400 border-blue-500/50 bg-blue-500/10';

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg border
        ${colorClass} animate-pulse
      `}
      title={`${warnings.length} 个警告`}
    >
      <AlertTriangle size={16} />
      <span className="text-sm font-mono font-bold">{warnings.length}</span>
    </div>
  );
}
