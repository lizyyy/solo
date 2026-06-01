import React, { useState } from 'react';
import {
  Play,
  MousePointerClick,
  Gavel,
  Clock,
  StickyNote,
  Settings,
  Flag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { TimelineEvent as TimelineEventType, JudgmentResult, JudgmentStep } from '../types';
import { formatTimestamp, formatSessionTime } from '../utils/diffCalculator';
import { getFailureTypeLabel } from '../utils/judgmentEngine';

interface TimelineEventProps {
  event: TimelineEventType;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
}

const eventIcons: Record<string, React.ReactNode> = {
  problem_start: <Play size={14} />,
  player_choice: <MousePointerClick size={14} />,
  judgment: <Gavel size={14} />,
  timeout: <Clock size={14} />,
  note_added: <StickyNote size={14} />,
  control_action: <Settings size={14} />,
  session_end: <Flag size={14} />,
  session_start: <Play size={14} />,
};

const eventLabels: Record<string, string> = {
  problem_start: '问题开始',
  player_choice: '玩家选择',
  judgment: '系统判断',
  timeout: '超时',
  note_added: '添加备注',
  control_action: '控制操作',
  session_end: '会话结束',
  session_start: '会话开始',
};

const getEventClass = (event: TimelineEventType): string => {
  if (event.type === 'judgment') {
    const judgment = event.data as unknown as JudgmentResult;
    if (judgment.isCorrect) return 'success';
    if (judgment.failureType === 'operation_timeout') return 'warning';
    return 'failure';
  }
  if (event.type === 'timeout') return 'warning';
  if (event.type === 'note_added') return 'note';
  return '';
};

export const TimelineEventItem: React.FC<TimelineEventProps> = ({ event, isSelected, isActive, onClick }) => {
  const [expanded, setExpanded] = useState(false);
  const eventClass = getEventClass(event);

  const getSummary = (): string => {
    switch (event.type) {
      case 'problem_start':
        return `开始：${event.data.problemTitle || event.problemId}`;
      case 'player_choice':
        return `选择：${event.data.optionLabel || event.data.optionId} (${event.data.responseTime}ms)`;
      case 'judgment': {
        const j = event.data as unknown as JudgmentResult;
        return j.isCorrect
          ? `判断：正确 (+${j.scoreChange}分)`
          : `判断：${getFailureTypeLabel(j.failureType)} (${j.scoreChange}分)`;
      }
      case 'timeout':
        return `超时：${event.data.timeLimit}秒未响应`;
      case 'note_added':
        return `备注：${(event.data.content as string).slice(0, 20)}...`;
      case 'control_action':
        return `控制：${event.data.action}`;
      case 'session_start':
        return '演练开始';
      case 'session_end':
        return `演练结束，最终得分：${event.data.finalScore}`;
      default:
        return eventLabels[event.type] || event.type;
    }
  };

  const renderDetails = () => {
    if (event.type === 'judgment') {
      const j = event.data as unknown as JudgmentResult;
      return (
        <div className="mt-2 space-y-2">
          <div className="text-sm space-y-1">
            {j.reasons.map((r, i) => (
              <div key={i} className="text-industrial-muted">• {r}</div>
            ))}
          </div>
          <div className="text-xs space-y-1">
            <div className="text-industrial-muted font-semibold">判断链：</div>
            {j.judgmentChain.map((step: JudgmentStep, i: number) => (
              <div key={i} className="font-mono flex items-center gap-2">
                <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] ${step.result ? 'bg-emerald-600' : 'bg-red-600'}`}>
                  {step.result ? '✓' : '✗'}
                </span>
                <span className="text-industrial-muted">{step.step}</span>
              </div>
            ))}
          </div>
          {j.ruleReferences.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {j.ruleReferences.map((r) => (
                <span key={r} className="px-1.5 py-0.5 bg-industrial-bg text-[10px] text-amber-400 rounded">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (event.type === 'note_added') {
      return (
        <div className="mt-2 p-2 bg-blue-900/20 rounded border border-blue-800/50">
          <div className="text-xs text-blue-400">{event.data.author as string}</div>
          <div className="text-sm text-industrial-text mt-1">{event.data.content as string}</div>
          {event.data.isSupplementary && (
            <div className="text-[10px] text-amber-400 mt-1">* 补录备注</div>
          )}
        </div>
      );
    }
    if (event.type === 'problem_start') {
      return (
        <div className="mt-2 text-xs text-industrial-muted">
          时限：{event.data.timeLimit as number}秒
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={`timeline-node ${eventClass} ${isActive ? 'active' : ''} ${isSelected ? 'bg-industrial-bg/50 -mx-2 px-2 py-1 rounded' : ''} cursor-pointer hover:bg-industrial-bg/30 -mx-2 px-2 py-1 rounded transition-colors`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs ${
              eventClass === 'success' ? 'bg-emerald-600/30 text-emerald-400' :
              eventClass === 'failure' ? 'bg-red-600/30 text-red-400' :
              eventClass === 'warning' ? 'bg-amber-600/30 text-amber-400' :
              eventClass === 'note' ? 'bg-blue-600/30 text-blue-400' :
              'bg-industrial-border text-industrial-muted'
            }`}>
              {eventIcons[event.type]}
            </span>
            <span className="text-sm font-medium text-industrial-text">
              {getSummary()}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 ml-8">
            <span className="font-mono text-[10px] text-industrial-muted">
              {formatSessionTime(event.sessionTime)}
            </span>
            <span className="text-[10px] text-industrial-muted">
              {formatTimestamp(event.timestamp)}
            </span>
          </div>
          {isSelected && expanded && renderDetails()}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-industrial-muted hover:text-amber-400 p-1"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
    </div>
  );
};
