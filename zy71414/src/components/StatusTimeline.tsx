import { CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react';
import type { StatusTransition } from '../types';
import { STATUS_LABELS } from '../types';
import { formatDateTime } from '../utils/format';

interface StatusTimelineProps {
  transitions: StatusTransition[];
}

export function StatusTimeline({ transitions }: StatusTimelineProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'PAID':
        return <CheckCircle className="text-success-500" size={20} />;
      case 'REJECTED':
      case 'CANCELLED':
        return <XCircle className="text-red-500" size={20} />;
      case 'WITHDRAWN':
        return <XCircle className="text-orange-500" size={20} />;
      default:
        return <Clock className="text-primary-500" size={20} />;
    }
  };

  if (transitions.length === 0) {
    return <p className="text-gray-500 text-sm">暂无状态流转记录</p>;
  }

  return (
    <div className="space-y-4">
      {transitions.map((trans, index) => (
        <div key={trans.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              {getStatusIcon(trans.toStatus)}
            </div>
            {index < transitions.length - 1 && (
              <div className="w-0.5 h-full bg-gray-200 my-1" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-800">
                {STATUS_LABELS[trans.fromStatus]}
              </span>
              <ArrowRight size={16} className="text-gray-400" />
              <span className="font-medium text-primary-700">
                {STATUS_LABELS[trans.toStatus]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              {trans.operator} · {formatDateTime(trans.timestamp)}
            </p>
            {trans.remark && (
              <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                {trans.remark}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
