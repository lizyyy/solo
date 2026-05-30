import { EvidenceChain, GameEvent, ActionLog, ClueGroup } from '@/types';
import { v4 as uuidv4 } from '@/utils/uuid';

export const updateEvidenceChain = (
  evidenceChains: EvidenceChain[],
  event: GameEvent,
  action: ActionLog
): EvidenceChain[] => {
  return evidenceChains.map(chain => {
    if (chain.id === event.evidenceId) {
      return {
        ...chain,
        actions: [...chain.actions, action],
        events: chain.events.map(e => 
          e.id === event.id ? event : e
        ),
      };
    }
    return chain;
  });
};

export const findRelatedEvidence = (
  evidenceChains: EvidenceChain[],
  channelId: number,
  timestamp: number,
  windowSeconds: number = 5
): EvidenceChain | undefined => {
  return evidenceChains.find(chain => {
    const hasChannelEvent = chain.events.some(e => e.channelId === channelId);
    const withinTimeWindow = Math.abs(chain.startTime - timestamp) <= windowSeconds;
    return hasChannelEvent && withinTimeWindow && !chain.endTime;
  });
};

export const generateClueGroups = (
  events: GameEvent[],
  actions: ActionLog[],
  timeWindow: number = 8
): ClueGroup[] => {
  const groups: ClueGroup[] = [];
  const usedEventIds = new Set<string>();

  for (const event of events) {
    if (usedEventIds.has(event.id)) continue;

    const relatedEvents = events.filter(e => {
      if (usedEventIds.has(e.id)) return false;
      const timeDiff = Math.abs(e.timestamp - event.timestamp);
      const sameChannel = e.channelId && event.channelId && e.channelId === event.channelId;
      return timeDiff <= timeWindow || sameChannel;
    });

    const relatedActions = actions.filter(a => {
      return relatedEvents.some(e => {
        const timeDiff = Math.abs(a.timestamp - e.timestamp);
        const sameChannel = a.channelId && e.channelId && a.channelId === e.channelId;
        return timeDiff <= timeWindow || sameChannel;
      });
    });

    if (relatedEvents.length > 0) {
      const relatedChannels = [...new Set(relatedEvents.flatMap(e => e.channelId).filter(Boolean))];
      const startTime = Math.min(...relatedEvents.map(e => e.timestamp));
      const endTime = Math.max(...relatedEvents.map(e => e.resolvedAt || e.timestamp));

      let title = '未知事件组';
      if (relatedEvents.some(e => e.type === 'feedback')) {
        title = '啸叫事件链';
      } else if (relatedEvents.some(e => e.type === 'clipping')) {
        title = '爆峰事件链';
      } else if (relatedEvents.some(e => e.type === 'monitor_request')) {
        title = '返听调整组';
      } else if (relatedEvents.some(e => e.type === 'imbalance')) {
        title = '音量平衡调整';
      }

      groups.push({
        id: uuidv4(),
        title,
        events: relatedEvents,
        actions: relatedActions,
        timeWindow: { start: startTime, end: endTime },
        relatedChannels,
      });

      relatedEvents.forEach(e => usedEventIds.add(e.id));
    }
  }

  return groups.sort((a, b) => a.timeWindow.start - b.timeWindow.start);
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getEventTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    feedback: '啸叫',
    monitor_request: '返听请求',
    imbalance: '音量失衡',
    clipping: '主输出爆峰',
  };
  return labels[type] || type;
};

export const getActionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    fader_move: '推子调整',
    mute: '静音切换',
    solo: '独奏切换',
    master_adjust: '主输出调整',
  };
  return labels[type] || type;
};
