import React from 'react';
import { TimelineEvent } from '../types';
import { formatDate } from '../utils';
import { Clock, User, CheckCircle, XCircle, Shield, FileText, RefreshCw } from 'lucide-react';

interface TimelineProps {
  events: TimelineEvent[];
}

const Timeline: React.FC<TimelineProps> = ({ events }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'created':
        return FileText;
      case 'submission':
        return FileText;
      case 'security_scan':
        return Shield;
      case 'security_pass':
        return CheckCircle;
      case 'security_fail':
        return XCircle;
      case 'review_pending':
        return Clock;
      case 'review_approved':
        return CheckCircle;
      case 'review_rejected':
        return XCircle;
      case 'published':
        return CheckCircle;
      case 'unpublished':
        return XCircle;
      case 'correction':
        return RefreshCw;
      default:
        return FileText;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'security_pass':
      case 'review_approved':
      case 'published':
        return 'bg-green-500';
      case 'security_fail':
      case 'review_rejected':
      case 'unpublished':
        return 'bg-red-500';
      case 'security_scan':
      case 'review_pending':
        return 'bg-yellow-500';
      case 'correction':
        return 'bg-orange-500';
      default:
        return 'bg-blue-500';
    }
  };

  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">操作时间线</h3>
      <div className="flow-root">
        <ul className="-mb-8">
          {sortedEvents.map((event, index) => {
            const Icon = getIcon(event.type);
            const isLast = index === sortedEvents.length - 1;
            
            return (
              <li key={event.id}>
                <div className="relative pb-8">
                  {!isLast && (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getIconColor(event.type)}`}>
                        <Icon className="h-5 w-5 text-white" />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{event.title}</p>
                        <p className="mt-1 text-sm text-gray-500">{event.description}</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <User className="h-4 w-4 mr-1" />
                          {event.actor}
                        </div>
                        <div className="flex items-center text-xs text-gray-400 mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(event.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default Timeline;
