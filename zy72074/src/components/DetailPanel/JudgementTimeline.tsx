import { Clock, User, MessageSquare, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import type { Point, RemarkItem } from '../../types';
import { STATUS_COLORS } from '../../types';

interface JudgementTimelineProps {
  point: Point;
}

function TimelineItem({ remark, isLast }: { remark: RemarkItem; isLast: boolean }) {
  const isSystem = remark.author === '系统自动检测';
  
  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: isSystem ? 'rgba(100, 116, 139, 0.2)' : 'rgba(59, 130, 246, 0.2)',
            border: `1px solid ${isSystem ? 'rgba(100, 116, 139, 0.5)' : 'rgba(59, 130, 246, 0.5)'}`,
          }}
        >
          {isSystem ? (
            <AlertCircle size={14} className="text-gray-400" />
          ) : (
            <MessageSquare size={14} className="text-blue-400" />
          )}
        </div>
        {!isLast && (
          <div
            className="w-0.5 flex-1 mt-1"
            style={{
              background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0.1))',
            }}
          />
        )}
      </div>
      
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-white">{remark.author}</span>
          <span className="flex items-center text-[10px] text-gray-500">
            <Clock size={10} className="mr-1" />
            {remark.timestamp}
          </span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">{remark.content}</p>
      </div>
    </div>
  );
}

export function JudgementTimeline({ point }: JudgementTimelineProps) {
  return (
    <div className="space-y-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
        <CheckCircle size={14} style={{ color: STATUS_COLORS[point.status] }} />
        判定过程
      </h4>

      <div
        className="p-4 rounded-xl"
        style={{
          backgroundColor: `${STATUS_COLORS[point.status]}10`,
          border: `1px solid ${STATUS_COLORS[point.status]}30`,
        }}
      >
        <div className="flex items-start gap-3">
          <FileText size={16} style={{ color: STATUS_COLORS[point.status], marginTop: 2 }} />
          <div className="flex-1">
            <div className="text-xs font-medium mb-1" style={{ color: STATUS_COLORS[point.status] }}>
              最终判定
            </div>
            <p className="text-sm text-white leading-relaxed">{point.judgement}</p>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <User size={12} />
                处理人: {point.handler}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {point.handledAt}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h5 className="text-xs font-medium text-gray-400 mb-4">处理记录时间线</h5>
        <div className="space-y-1">
          {point.remarks.map((remark, index) => (
            <TimelineItem
              key={remark.id}
              remark={remark}
              isLast={index === point.remarks.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
