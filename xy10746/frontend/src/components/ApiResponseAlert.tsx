import React from 'react';
import { ApiResponseStatus } from '../types';
import { getApiStatusColor, getApiStatusLabel } from '../utils';
import { CheckCircle, Clock, XCircle, AlertTriangle, X } from 'lucide-react';

interface ApiResponseAlertProps {
  status: ApiResponseStatus;
  message: string;
  retryAfter?: number;
  onClose?: () => void;
}

const ApiResponseAlert: React.FC<ApiResponseAlertProps> = ({ status, message, retryAfter, onClose }) => {
  const getIcon = () => {
    switch (status) {
      case ApiResponseStatus.SUCCESS:
        return CheckCircle;
      case ApiResponseStatus.PENDING_REVIEW:
        return Clock;
      case ApiResponseStatus.BLOCKED:
        return XCircle;
      case ApiResponseStatus.RETRYABLE:
        return AlertTriangle;
      default:
        return CheckCircle;
    }
  };

  const Icon = getIcon();

  return (
    <div className={`rounded-lg border-l-4 p-4 mb-4 ${getApiStatusColor(status)}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">
            {getApiStatusLabel(status)}
          </p>
          <p className="mt-1 text-sm opacity-80">{message}</p>
          {retryAfter !== undefined && retryAfter > 0 && (
            <p className="mt-1 text-sm opacity-70">
              预计 {retryAfter} 秒后可重试
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto flex-shrink-0 hover:opacity-70 transition-opacity"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ApiResponseAlert;
