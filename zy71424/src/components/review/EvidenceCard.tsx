import React from 'react';
import { EvidenceChain } from '@/types';
import { formatTime, getEventTypeLabel, getActionTypeLabel } from '@/engine/evidenceRecorder';
import { Clock, Activity, MousePointer, CheckCircle, XCircle } from 'lucide-react';

interface EvidenceCardProps {
  evidence: EvidenceChain;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({ evidence }) => {
  const duration = evidence.endTime ? evidence.endTime - evidence.startTime : null;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-white">
            {getEventTypeLabel(evidence.eventType)} 事件
          </h4>
          <span className={`px-2 py-1 text-xs rounded font-medium ${
            evidence.conclusion === 'resolved'
              ? 'bg-green-900/50 text-green-400'
              : evidence.conclusion === 'missed'
              ? 'bg-red-900/50 text-red-400'
              : 'bg-yellow-900/50 text-yellow-400'
          }`}>
            {evidence.conclusion === 'resolved' ? '已解决' : evidence.conclusion === 'missed' ? '遗漏' : '处理中'}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <Clock size={14} />
            <span>{formatTime(evidence.startTime)}</span>
          </div>
          {duration !== null && (
            <div className="flex items-center gap-1">
              <Activity size={14} />
              <span>耗时 {duration}s</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h5 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <CheckCircle size={14} className="text-green-400" />
            关联事件 ({evidence.events.length})
          </h5>
          <div className="space-y-2">
            {evidence.events.map(event => (
              <div key={event.id} className="bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  {event.resolved ? (
                    <CheckCircle size={12} className="text-green-400" />
                  ) : (
                    <XCircle size={12} className="text-red-400" />
                  )}
                  <span className="text-xs text-gray-500 font-mono">
                    {formatTime(event.timestamp)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300">
                    {getEventTypeLabel(event.type)}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mt-1">{event.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h5 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <MousePointer size={14} className="text-blue-400" />
            操作记录 ({evidence.actions.length})
          </h5>
          {evidence.actions.length === 0 ? (
            <div className="text-sm text-gray-500 italic">暂无操作记录</div>
          ) : (
            <div className="space-y-2">
              {evidence.actions.map(action => (
                <div key={action.id} className="bg-gray-900/50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">
                      {formatTime(action.timestamp)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-900/50 text-cyan-300">
                      {getActionTypeLabel(action.type)}
                    </span>
                    {action.channelId && (
                      <span className="text-xs text-gray-400">CH{action.channelId}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mt-1">
                    {action.type === 'fader_move' && `推子: ${action.fromValue} → ${action.toValue}`}
                    {action.type === 'master_adjust' && `主输出: ${action.fromValue} → ${action.toValue}`}
                    {action.type === 'mute' && `静音: ${action.toValue === 1 ? '开启' : '关闭'}`}
                    {action.type === 'solo' && `独奏: ${action.toValue === 1 ? '开启' : '关闭'}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {evidence.notes && (
          <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/30">
            <h5 className="text-sm font-medium text-blue-400 mb-1">备注</h5>
            <p className="text-sm text-gray-300">{evidence.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};
