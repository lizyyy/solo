import React from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { StatusHistory } from '../types';
import { StatusBadge } from './StatusBadge';
import { Clock, User } from 'lucide-react';

interface TimelineProps {
  history: StatusHistory[];
}

export const Timeline: React.FC<TimelineProps> = ({ history }) => {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-4">
      {sortedHistory.map((item, index) => (
        <div key={item.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full ${
              index === 0 ? 'bg-blue-500' : 'bg-gray-300'
            }`} />
            {index < sortedHistory.length - 1 && (
              <div className="w-0.5 h-full bg-gray-200 mt-2" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={item.status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {item.operator}
              </span>
            </div>
            {item.note && (
              <p className="text-sm text-gray-600 mt-1">{item.note}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
