import React from 'react';
import type { HumanError } from '../types';
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface ErrorToastProps {
  error: HumanError;
  onClose: () => void;
}

const SEVERITY_STYLES = {
  info: {
    container: 'bg-primary-50 border-primary-200',
    icon: 'text-primary-500',
    title: 'text-primary-800',
    message: 'text-primary-700',
    suggestion: 'text-primary-600',
  },
  warning: {
    container: 'bg-warning-50 border-warning-200',
    icon: 'text-warning-500',
    title: 'text-warning-800',
    message: 'text-warning-700',
    suggestion: 'text-warning-600',
  },
  error: {
    container: 'bg-danger-50 border-danger-200',
    icon: 'text-danger-500',
    title: 'text-danger-800',
    message: 'text-danger-700',
    suggestion: 'text-danger-600',
  },
};

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

export function ErrorToast({ error, onClose }: ErrorToastProps) {
  const [isClosing, setIsClosing] = React.useState(false);
  const style = SEVERITY_STYLES[error.severity];
  const IconComponent = SEVERITY_ICONS[error.severity];

  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md w-full border rounded-lg shadow-lg p-4
        ${style.container} 
        ${isClosing ? 'animate-slide-out' : 'animate-slide-in'}`}
      role="alert"
    >
      <div className="flex gap-3">
        <IconComponent className={`w-5 h-5 mt-0.5 flex-shrink-0 ${style.icon}`} />
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold text-sm ${style.title}`}>{error.title}</h4>
          <p className={`text-sm mt-1 ${style.message}`}>{error.message}</p>
          {error.suggestion && (
            <p className={`text-xs mt-2 italic ${style.suggestion}`}>
              💡 {error.suggestion}
            </p>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ErrorDisplay({ error, onClose }: ErrorToastProps) {
  const style = SEVERITY_STYLES[error.severity];
  const IconComponent = SEVERITY_ICONS[error.severity];

  return (
    <div className={`border rounded-lg p-4 ${style.container}`}>
      <div className="flex gap-3">
        <IconComponent className={`w-5 h-5 mt-0.5 flex-shrink-0 ${style.icon}`} />
        <div className="flex-1">
          <h4 className={`font-semibold text-sm ${style.title}`}>{error.title}</h4>
          <p className={`text-sm mt-1 ${style.message}`}>{error.message}</p>
          {error.suggestion && (
            <p className={`text-xs mt-2 italic ${style.suggestion}`}>
              💡 {error.suggestion}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
