import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

const colorMap = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-sky-50 border-sky-200 text-sky-800'
};

const iconColorMap = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-sky-500'
};

export function MessageToast() {
  const { messages, removeMessage } = useAppStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {messages.map((msg) => {
        const Icon = iconMap[msg.type];
        return (
          <div
            key={msg.id}
            className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-in slide-in-from-right ${colorMap[msg.type]}`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColorMap[msg.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm leading-tight">{msg.title}</p>
              <p className="text-xs mt-1 opacity-80 whitespace-pre-line">{msg.message}</p>
              {msg.action && (
                <button
                  onClick={msg.action.handler}
                  className="mt-2 text-xs font-medium underline hover:no-underline"
                >
                  {msg.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => removeMessage(msg.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
