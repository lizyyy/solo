import { WebrtcStat, SignalingEvent, TimelineEvent, AlignedTimeline } from './types';

interface ClientTimestamps {
  [clientId: string]: {
    minTimestamp: number;
    maxTimestamp: number;
  };
}

export function deduplicateStats(stats: WebrtcStat[]): WebrtcStat[] {
  const seen = new Set<string>();
  return stats.filter(stat => {
    const key = `${stat.clientId}-${stat.type}-${stat.id}-${stat.timestamp}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function calculateClockOffsets(
  stats: WebrtcStat[],
  signalingEvents: SignalingEvent[]
): { [clientId: string]: number } {
  const allEvents = [
    ...stats.map(s => ({ timestamp: s.timestamp, clientId: s.clientId })),
    ...signalingEvents.map(e => ({ timestamp: e.timestamp, clientId: e.clientId }))
  ];

  const clientTimestamps: ClientTimestamps = {};
  allEvents.forEach(event => {
    if (!clientTimestamps[event.clientId]) {
      clientTimestamps[event.clientId] = {
        minTimestamp: event.timestamp,
        maxTimestamp: event.timestamp
      };
    } else {
      clientTimestamps[event.clientId].minTimestamp = Math.min(
        clientTimestamps[event.clientId].minTimestamp,
        event.timestamp
      );
      clientTimestamps[event.clientId].maxTimestamp = Math.max(
        clientTimestamps[event.clientId].maxTimestamp,
        event.timestamp
      );
    }
  });

  const clientIds = Object.keys(clientTimestamps);
  const offsets: { [clientId: string]: number } = {};

  if (clientIds.length > 0) {
    const referenceMin = Math.min(...clientIds.map(id => clientTimestamps[id].minTimestamp));
    clientIds.forEach(clientId => {
      offsets[clientId] = referenceMin - clientTimestamps[clientId].minTimestamp;
    });
  }

  return offsets;
}

export function alignTimeline(
  stats: WebrtcStat[],
  signalingEvents: SignalingEvent[],
  offsets: { [clientId: string]: number }
): AlignedTimeline {
  const events: TimelineEvent[] = [];

  stats.forEach(stat => {
    const offset = offsets[stat.clientId] || 0;
    events.push({
      timestamp: stat.timestamp + offset,
      clientId: stat.clientId,
      role: stat.role,
      type: `webrtc_${stat.type}`,
      data: stat
    });
  });

  signalingEvents.forEach(event => {
    const offset = offsets[event.clientId] || 0;
    events.push({
      timestamp: event.timestamp + offset,
      clientId: event.clientId,
      role: event.role,
      type: `signaling_${event.eventType}`,
      data: event
    });
  });

  events.sort((a, b) => a.timestamp - b.timestamp);

  const startTime = events.length > 0 ? events[0].timestamp : 0;
  const endTime = events.length > 0 ? events[events.length - 1].timestamp : 0;
  const duration = endTime - startTime;

  return { events, startTime, endTime, duration };
}

export function processTimeline(
  stats: WebrtcStat[],
  signalingEvents: SignalingEvent[]
): AlignedTimeline {
  const deduplicatedStats = deduplicateStats(stats);
  const offsets = calculateClockOffsets(deduplicatedStats, signalingEvents);
  return alignTimeline(deduplicatedStats, signalingEvents, offsets);
}
