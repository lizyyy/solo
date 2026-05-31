import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info, Camera, MapPin, Phone, User } from 'lucide-react';
import { HumanMessage, SourceType, SOURCE_TYPE_LABELS } from '@/types';

interface HumanMessageCardProps {
  message: HumanMessage;
  sourceType?: SourceType;
  onAction?: (action: string) => void;
}

const levelConfig = {
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: <Info className="w-5 h-5 text-signal-blue" />,
    title: 'text-blue-800',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    icon: <AlertTriangle className="w-5 h-5 text-signal-orange" />,
    title: 'text-amber-800',
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: <XCircle className="w-5 h-5 text-signal-red" />,
    title: 'text-red-800',
  },
  success: {
    bg: 'bg-green-50 border-green-200',
    icon: <CheckCircle className="w-5 h-5 text-signal-green" />,
    title: 'text-green-800',
  },
};

const sourceIcons: Record<SourceType, React.ReactNode> = {
  inspection_photo: <Camera className="w-4 h-4" />,
  walkthrough: <MapPin className="w-4 h-4" />,
  manual: <User className="w-4 h-4" />,
};

export const HumanMessageCard: React.FC<HumanMessageCardProps> = ({ message, sourceType, onAction }) => {
  const config = levelConfig[message.level];

  return (
    <div className={`rounded-lg border ${config.bg} p-4 animate-fade-in`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${config.title} mb-1`}>{message.title}</h4>
          <p className="text-sm text-gray-700 mb-2">{message.description}</p>
          <p className="text-xs text-gray-500 mb-3">{message.reason}</p>

          {sourceType && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded text-xs text-gray-600 mb-3">
              {sourceIcons[sourceType]}
              来源：{SOURCE_TYPE_LABELS[sourceType]}
            </div>
          )}

          {message.contact && (
            <div className="bg-white/70 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-700">{message.contact.name}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-500">{message.contact.role}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <a href={`tel:${message.contact.phone}`} className="flex items-center gap-1 text-signal-blue hover:underline">
                  <Phone className="w-3 h-3" />
                  {message.contact.phone}
                </a>
                <a href={`mailto:${message.contact.email}`} className="text-signal-blue hover:underline">
                  {message.contact.email}
                </a>
              </div>
            </div>
          )}

          {message.nextSteps && message.nextSteps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {message.nextSteps.map((step, index) => (
                <button
                  key={index}
                  onClick={() => onAction?.(step.action || '')}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
                >
                  {step.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
