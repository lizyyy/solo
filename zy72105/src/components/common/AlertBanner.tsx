import { AlertTriangle, CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useState } from 'react';

interface AlertBannerProps {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
  details?: string[];
  dismissible?: boolean;
}

export const AlertBanner = ({
  type,
  title,
  message,
  details,
  dismissible = false,
}: AlertBannerProps) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const config = {
    success: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      icon: CheckCircle,
      iconColor: 'text-green-500',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-800',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: XCircle,
      iconColor: 'text-red-500',
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-800',
      icon: Info,
      iconColor: 'text-blue-500',
    },
  };

  const { bg, text, icon: Icon, iconColor } = config[type];

  return (
    <div className={`${bg} border rounded-lg p-4 ${text} animate-in slide-in-from-top duration-300`}>
      <div className="flex items-start">
        <Icon className={`w-5 h-5 ${iconColor} mt-0.5 flex-shrink-0`} />
        <div className="ml-3 flex-1">
          <h4 className="font-semibold text-sm">{title}</h4>
          {message && <p className="mt-1 text-sm opacity-90">{message}</p>}
          {details && details.length > 0 && (
            <ul className="mt-2 space-y-1">
              {details.map((detail, idx) => (
                <li key={idx} className="text-sm opacity-80 flex items-start">
                  <span className="mr-2">•</span>
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>
        {dismissible && (
          <button
            onClick={() => setIsVisible(false)}
            className="ml-2 p-1 hover:bg-black/5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
