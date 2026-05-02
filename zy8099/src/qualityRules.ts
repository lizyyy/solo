import { WebrtcStat, SignalingEvent, ClinicRule, QualityEvent, AlignedTimeline } from './types';

function detectIceReconnectFailures(
  timeline: AlignedTimeline,
  rule: ClinicRule
): QualityEvent[] {
  const events: QualityEvent[] = [];
  const iceEvents = timeline.events.filter(e =>
    e.type.startsWith('signaling_') && e.type.toLowerCase().includes('ice')
  );

  let consecutiveFailures = 0;
  for (let i = 0; i < iceEvents.length; i++) {
    const event = iceEvents[i];
    if (event.type.toLowerCase().includes('fail') || event.type.toLowerCase().includes('disconnect')) {
      consecutiveFailures++;
      if (consecutiveFailures >= 2) {
        events.push({
          timestamp: event.timestamp,
          clientId: event.clientId,
          role: event.role,
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: 'high',
          description: 'ICE 重连失败，连续多次连接异常',
          value: consecutiveFailures,
          threshold: rule.threshold
        });
      }
    } else {
      consecutiveFailures = 0;
    }
  }

  return events;
}

function detectAvSyncIssues(
  stats: WebrtcStat[],
  rule: ClinicRule
): QualityEvent[] {
  const events: QualityEvent[] = [];
  const outboundRtp = stats.filter(s => s.type === 'outbound-rtp');

  for (const stat of outboundRtp) {
    const audioLevel = (stat as any).audioLevel;
    const videoLevel = (stat as any).videoLevel;
    if (audioLevel !== undefined && videoLevel !== undefined) {
      const diff = Math.abs(audioLevel - videoLevel);
      const threshold = rule.threshold || 0.5;
      if (diff > threshold) {
        events.push({
          timestamp: stat.timestamp,
          clientId: stat.clientId,
          role: stat.role,
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: diff > threshold * 2 ? 'high' : 'medium',
          description: `音视频不同步，差值为 ${diff.toFixed(3)}`,
          value: diff,
          threshold: threshold
        });
      }
    }
  }

  return events;
}

function detectPacketLossSpikes(
  stats: WebrtcStat[],
  rule: ClinicRule
): QualityEvent[] {
  const events: QualityEvent[] = [];
  const inboundRtp = stats.filter(s => s.type === 'inbound-rtp');

  for (const stat of inboundRtp) {
    const packetsLost = (stat as any).packetsLost;
    const packetsReceived = (stat as any).packetsReceived;
    if (packetsLost !== undefined && packetsReceived !== undefined && packetsReceived > 0) {
      const lossRate = packetsLost / packetsReceived;
      const threshold = rule.threshold || 0.05;
      if (lossRate > threshold) {
        events.push({
          timestamp: stat.timestamp,
          clientId: stat.clientId,
          role: stat.role,
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: lossRate > threshold * 2 ? 'high' : 'medium',
          description: `丢包率 ${(lossRate * 100).toFixed(2)}%`,
          value: lossRate,
          threshold: threshold
        });
      }
    }
  }

  return events;
}

function detectJitterSpikes(
  stats: WebrtcStat[],
  rule: ClinicRule
): QualityEvent[] {
  const events: QualityEvent[] = [];
  const inboundRtp = stats.filter(s => s.type === 'inbound-rtp');

  for (const stat of inboundRtp) {
    const jitter = (stat as any).jitter;
    if (jitter !== undefined) {
      const threshold = rule.threshold || 0.1;
      if (jitter > threshold) {
        events.push({
          timestamp: stat.timestamp,
          clientId: stat.clientId,
          role: stat.role,
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: jitter > threshold * 2 ? 'high' : 'medium',
          description: `抖动值 ${jitter.toFixed(3)}s`,
          value: jitter,
          threshold: threshold
        });
      }
    }
  }

  return events;
}

export function applyQualityRules(
  stats: WebrtcStat[],
  signalingEvents: SignalingEvent[],
  timeline: AlignedTimeline,
  rules: ClinicRule[]
): QualityEvent[] {
  const allEvents: QualityEvent[] = [];
  const enabledRules = rules.filter(r => r.enabled);

  for (const rule of enabledRules) {
    let ruleEvents: QualityEvent[] = [];
    switch (rule.category) {
      case 'ice':
        ruleEvents = detectIceReconnectFailures(timeline, rule);
        break;
      case 'av_sync':
        ruleEvents = detectAvSyncIssues(stats, rule);
        break;
      case 'packet_loss':
        ruleEvents = detectPacketLossSpikes(stats, rule);
        break;
      case 'jitter':
        ruleEvents = detectJitterSpikes(stats, rule);
        break;
      default:
        break;
    }
    allEvents.push(...ruleEvents);
  }

  allEvents.sort((a, b) => a.timestamp - b.timestamp);
  return allEvents;
}
