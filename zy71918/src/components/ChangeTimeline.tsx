import React from 'react';
import type { ChangeLog } from 'shared/types';
import { CHANGE_TYPE_CONFIG, formatDate } from 'shared/constants';
import SourceTag from './SourceTag';
import ChangeTypeBadge from './ChangeTypeBadge';

interface ChangeTimelineProps {
  changes: ChangeLog[];
}

const ChangeTimeline: React.FC<ChangeTimelineProps> = ({ changes }) => {
  return (
    <div className="relative pl-6">
      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-studio-border" />

      {changes.map((change, index) => {
        const changeConfig = CHANGE_TYPE_CONFIG[change.changeType];

        return (
          <div
            key={change.id}
            className="relative pb-6 last:pb-0 animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div
              className="timeline-dot"
              style={{
                backgroundColor: changeConfig.color,
                top: '6px',
              }}
            />

            <div
              className="rounded-lg p-4 ml-2"
              style={{ backgroundColor: `${changeConfig.color}08` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <SourceTag type={change.sourceType} />
                <ChangeTypeBadge type={change.changeType} />
                <span className="text-xs text-studio-muted ml-auto">
                  {formatDate(change.timestamp)}
                </span>
              </div>

              <div className="text-sm text-slate-850 mb-2">
                <span className="font-medium">{change.operatorName}</span>
                {change.reason && (
                  <span className="text-studio-muted ml-2">
                    · {change.reason}
                  </span>
                )}
              </div>

              {change.oldValue && change.newValue && (
                <div className="space-y-1.5 text-xs">
                  {change.oldValue && (
                    <div className="p-2 rounded bg-red-50 border border-red-100">
                      <span className="text-red-700 font-medium">变更前：</span>
                      <span className="text-red-600 whitespace-pre-wrap">
                        {change.oldValue}
                      </span>
                    </div>
                  )}
                  {change.newValue && (
                    <div className="p-2 rounded bg-green-50 border border-green-100">
                      <span className="text-green-700 font-medium">变更后：</span>
                      <span className="text-green-600 whitespace-pre-wrap">
                        {change.newValue}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!change.oldValue && change.newValue && (
                <div className="text-xs text-studio-muted">
                  {change.newValue}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChangeTimeline;
