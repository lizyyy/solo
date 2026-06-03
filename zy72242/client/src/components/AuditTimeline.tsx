import { useState } from 'react';
import { AuditLog, ACTION_LABELS, ROLE_LABELS } from '../types';
import {
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

interface AuditTimelineProps {
  logs: AuditLog[];
}

export default function AuditTimeline({ logs }: AuditTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <ClockIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p>暂无操作记录</p>
      </div>
    );
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'modify': return 'bg-red-100 text-red-800 border-red-200';
      case 'adjust': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'review': return 'bg-green-100 text-green-800 border-green-200';
      case 'import': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'rerun': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'modify': return '✏️';
      case 'adjust': return '🔢';
      case 'review': return '✅';
      case 'import': return '📥';
      case 'rerun': return '🔄';
      default: return '📋';
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
      
      <div className="space-y-4">
        {logs.map((log) => {
          const isExpanded = expandedId === log.id;
          
          return (
            <div key={log.id} className="relative pl-10 animate-fade-in">
              <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 ${getActionColor(log.action)}`} />
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getActionIcon(log.action)}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`badge ${getActionColor(log.action)} border`}>
                          {ACTION_LABELS[log.action as keyof typeof ACTION_LABELS] || log.action}
                        </span>
                        {log.fieldName && (
                          <span className="text-sm text-gray-600">
                            字段: <code className="bg-gray-100 px-1 rounded text-xs">{log.fieldName}</code>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{log.reason}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {isExpanded ? (
                      <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>

                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <UserIcon className="w-3 h-3" />
                    <span>{log.operator}</span>
                    <span className="text-gray-400">({ROLE_LABELS[log.operatorRole]})</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <ClockIcon className="w-3 h-3" />
                    <span>{log.timestamp}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in space-y-2">
                    {log.oldValue && log.newValue && (
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-red-600 line-through bg-red-50 px-2 py-0.5 rounded">{log.oldValue}</span>
                        <ArrowRightIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded">{log.newValue}</span>
                      </div>
                    )}
                    
                    {log.affectedResults && (
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        <div className="text-xs font-medium text-gray-500 mb-1">影响结果</div>
                        <div className="text-gray-700">{log.affectedResults}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
