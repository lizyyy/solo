import { 
  NormalizedTimeline, 
  Anomaly, 
  AnomalyType,
  StutterSegment,
  GetStatsSample,
  SignalingEvent,
  CandidatePairStats
} from '../types';
import { generateId, mean, median, sortByKey } from '../utils';

export interface RuleEngineOptions {
  packetLossThreshold?: number;
  jitterThreshold?: number;
  bitrateDropRatio?: number;
  rttSpikeMultiplier?: number;
  frameDropThreshold?: number;
  qualityLimitationDurationThreshold?: number;
  silenceDurationThreshold?: number;
}

const DEFAULT_OPTIONS: Required<RuleEngineOptions> = {
  packetLossThreshold: 5,
  jitterThreshold: 500,
  bitrateDropRatio: 0.5,
  rttSpikeMultiplier: 3,
  frameDropThreshold: 10,
  qualityLimitationDurationThreshold: 3000,
  silenceDurationThreshold: 5000
};

interface TimeSeriesValue {
  timestamp: number;
  value: number;
}

export class RuleEngine {
  private options: Required<RuleEngineOptions>;

  constructor(options: RuleEngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  analyze(timeline: NormalizedTimeline): {
    anomalies: Anomaly[];
    stutters: StutterSegment[];
  } {
    const anomalies: Anomaly[] = [];
    
    const getStatsSamples = timeline.events.filter(
      e => e.type === 'getstats_sample'
    ) as GetStatsSample[];
    
    const signalingEvents = timeline.events.filter(
      e => e.type === 'signaling_event'
    ) as SignalingEvent[];

    if (getStatsSamples.length > 0) {
      anomalies.push(...this.analyzeIceReconnect(getStatsSamples, signalingEvents));
      anomalies.push(...this.analyzeBitrateDrops(getStatsSamples));
      anomalies.push(...this.analyzePacketLoss(getStatsSamples));
      anomalies.push(...this.analyzeJitter(getStatsSamples));
      anomalies.push(...this.analyzeTrackMute(getStatsSamples));
      anomalies.push(...this.analyzeDeviceSwitch(getStatsSamples));
      anomalies.push(...this.analyzeQualityLimitation(getStatsSamples));
      anomalies.push(...this.analyzeFramesDropped(getStatsSamples));
      anomalies.push(...this.analyzeRttSpikes(getStatsSamples));
      anomalies.push(...this.analyzeAudioVideoDesync(getStatsSamples));
    }

    if (signalingEvents.length > 0) {
      anomalies.push(...this.analyzeSignalingBreaks(signalingEvents));
    }

    const sortedAnomalies = sortByKey(anomalies, a => a.startTime);
    const stutters = this.aggregateToStutterSegments(sortedAnomalies, timeline);

    return {
      anomalies: sortedAnomalies,
      stutters
    };
  }

  private analyzeIceReconnect(
    samples: GetStatsSample[],
    signalingEvents: SignalingEvent[]
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const iceRestartEvents = signalingEvents.filter(
      e => e.subtype === 'ice_restart'
    );
    
    for (const event of iceRestartEvents) {
      const anomaly: Anomaly = {
        id: generateId(),
        type: 'ice_reconnect',
        startTime: event.timestamp,
        endTime: event.timestamp + 5000,
        duration: 5000,
        severity: 'high',
        title: 'ICE 重连检测',
        description: '检测到 ICE 重启，可能是网络连接不稳定导致的连接重建',
        evidence: { during: event },
        rootCause: '网络连接中断或候选地址变更触发 ICE 重连',
        suggestion: '检查网络稳定性，确认 NAT/防火墙配置是否有变化',
        relatedEventIds: []
      };
      anomalies.push(anomaly);
    }

    const candidatePairChanges = this.detectCandidatePairChanges(samples);
    
    for (const change of candidatePairChanges) {
      const existing = anomalies.find(
        a => a.type === 'ice_reconnect' && 
             Math.abs(a.startTime - change.timestamp) < 10000
      );
      
      if (!existing) {
        const anomaly: Anomaly = {
          id: generateId(),
          type: 'ice_reconnect',
          startTime: change.timestamp,
          endTime: change.timestamp + 3000,
          duration: 3000,
          severity: 'medium',
          title: 'Candidate Pair 切换',
          description: `候选连接对从 ${change.beforePairId || '未知'} 切换到 ${change.afterPairId || '未知'}`,
          evidence: {
            before: change.beforePair,
            after: change.afterPair
          },
          rootCause: '当前连接路径质量下降，ICE 选择了新的候选连接',
          suggestion: '检查候选连接切换前后的延迟和丢包率变化',
          relatedEventIds: []
        };
        anomalies.push(anomaly);
      }
    }

    const iceStateChanges = this.detectIceStateChanges(samples);
    for (const stateChange of iceStateChanges) {
      if (stateChange.afterState === 'disconnected' || stateChange.afterState === 'failed') {
        const anomaly: Anomaly = {
          id: generateId(),
          type: 'ice_reconnect',
          startTime: stateChange.timestamp,
          endTime: stateChange.timestamp + 10000,
          duration: 10000,
          severity: 'critical',
          title: `ICE 连接 ${stateChange.afterState === 'failed' ? '失败' : '断开'}`,
          description: `ICE 连接状态从 ${stateChange.beforeState} 变为 ${stateChange.afterState}`,
          evidence: { during: stateChange },
          rootCause: stateChange.afterState === 'failed' 
            ? '所有候选连接都无法建立' 
            : '网络连接暂时中断',
          suggestion: '检查网络连通性，确认 TURN/STUN 服务器可达',
          relatedEventIds: []
        };
        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  private detectCandidatePairChanges(samples: GetStatsSample[]) {
    const changes: Array<{
      timestamp: number;
      beforePairId?: string;
      afterPairId?: string;
      beforePair?: CandidatePairStats;
      afterPair?: CandidatePairStats;
    }> = [];

    for (let i = 1; i < samples.length; i++) {
      const prevSample = samples[i - 1];
      const currSample = samples[i];
      
      const prevNominated = prevSample.reports.candidatePairs?.filter(p => p.nominated);
      const currNominated = currSample.reports.candidatePairs?.filter(p => p.nominated);
      
      if (prevNominated && currNominated && prevNominated.length > 0 && currNominated.length > 0) {
        const prevIds = new Set(prevNominated.map(p => p.id));
        const currIds = new Set(currNominated.map(p => p.id));
        
        const hasNew = [...currIds].some(id => !prevIds.has(id));
        
        if (hasNew) {
          changes.push({
            timestamp: currSample.timestamp,
            beforePairId: prevNominated[0]?.id,
            afterPairId: currNominated[0]?.id,
            beforePair: prevNominated[0],
            afterPair: currNominated[0]
          });
        }
      }
    }

    return changes;
  }

  private detectIceStateChanges(samples: GetStatsSample[]) {
    const changes: Array<{
      timestamp: number;
      beforeState?: string;
      afterState?: string;
    }> = [];

    for (let i = 1; i < samples.length; i++) {
      const prevSample = samples[i - 1];
      const currSample = samples[i];
      
      const prevTransports = prevSample.reports.transports || [];
      const currTransports = currSample.reports.transports || [];
      
      for (const prevTransport of prevTransports) {
        const currTransport = currTransports.find(t => t.id === prevTransport.id);
        if (currTransport && currTransport.iceState !== prevTransport.iceState) {
          changes.push({
            timestamp: currSample.timestamp,
            beforeState: prevTransport.iceState,
            afterState: currTransport.iceState
          });
        }
      }
    }

    return changes;
  }

  private analyzeBitrateDrops(samples: GetStatsSample[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const bitrateSeries = this.calculateBitrateSeries(samples);
    
    if (bitrateSeries.length < 5) {
      return anomalies;
    }

    const baselineValues = bitrateSeries.slice(0, Math.min(20, Math.floor(bitrateSeries.length / 2)));
    const baselineBitrate = median(baselineValues.map(v => v.value));
    
    let inDrop = false;
    let dropStartIndex = 0;
    
    for (let i = 0; i < bitrateSeries.length; i++) {
      const currentBitrate = bitrateSeries[i].value;
      const dropRatio = currentBitrate / baselineBitrate;
      
      if (dropRatio <= this.options.bitrateDropRatio && currentBitrate > 0) {
        if (!inDrop) {
          inDrop = true;
          dropStartIndex = i;
        }
      } else if (inDrop) {
        const dropDuration = bitrateSeries[i].timestamp - bitrateSeries[dropStartIndex].timestamp;
        
        if (dropDuration >= 1000) {
          const minBitrate = Math.min(...bitrateSeries.slice(dropStartIndex, i).map(v => v.value));
          
          const anomaly: Anomaly = {
            id: generateId(),
            type: 'bitrate_drop',
            startTime: bitrateSeries[dropStartIndex].timestamp,
            endTime: bitrateSeries[i].timestamp,
            duration: dropDuration,
            severity: dropRatio < 0.2 ? 'high' : (dropRatio < 0.3 ? 'medium' : 'low'),
            title: '码率突降',
            description: `码率从基线 ${Math.round(baselineBitrate / 1000)} kbps 下降到最低 ${Math.round(minBitrate / 1000)} kbps，下降比例 ${Math.round((1 - dropRatio) * 100)}%`,
            evidence: {
              baselineBitrate,
              minBitrate,
              dropRatio,
              startSample: samples[dropStartIndex],
              endSample: samples[i]
            },
            rootCause: '网络带宽受限或拥塞控制降低发送码率',
            suggestion: '检查网络带宽，查看是否有质量限制原因（CPU/带宽）',
            relatedEventIds: []
          };
          anomalies.push(anomaly);
        }
        inDrop = false;
      }
    }

    return anomalies;
  }

  private calculateBitrateSeries(samples: GetStatsSample[]): TimeSeriesValue[] {
    const series: TimeSeriesValue[] = [];
    
    for (let i = 1; i < samples.length; i++) {
      const prevSample = samples[i - 1];
      const currSample = samples[i];
      
      const timeDelta = (currSample.timestamp - prevSample.timestamp) / 1000;
      
      if (timeDelta <= 0) continue;

      let totalBytesSent = 0;
      let totalBytesReceived = 0;

      const prevOutbound = prevSample.reports.outboundRtp || [];
      const currOutbound = currSample.reports.outboundRtp || [];
      
      for (const curr of currOutbound) {
        const prev = prevOutbound.find(p => p.ssrc === curr.ssrc);
        if (prev) {
          totalBytesSent += curr.bytesSent - prev.bytesSent;
        }
      }

      const prevInbound = prevSample.reports.inboundRtp || [];
      const currInbound = currSample.reports.inboundRtp || [];
      
      for (const curr of currInbound) {
        const prev = prevInbound.find(p => p.ssrc === curr.ssrc);
        if (prev) {
          totalBytesReceived += curr.bytesReceived - prev.bytesReceived;
        }
      }

      const totalBytes = Math.max(totalBytesSent, totalBytesReceived);
      const bitrate = (totalBytes * 8) / timeDelta;
      
      series.push({
        timestamp: currSample.timestamp,
        value: bitrate
      });
    }

    return series;
  }

  private analyzePacketLoss(samples: GetStatsSample[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const lossSeries = this.calculatePacketLossSeries(samples);
    
    if (lossSeries.length === 0) {
      return anomalies;
    }

    let inHighLoss = false;
    let highLossStartIndex = 0;
    
    for (let i = 0; i < lossSeries.length; i++) {
      const lossRate = lossSeries[i].value;
      
      if (lossRate >= this.options.packetLossThreshold) {
        if (!inHighLoss) {
          inHighLoss = true;
          highLossStartIndex = i;
        }
      } else if (inHighLoss) {
        const lossDuration = lossSeries[i].timestamp - lossSeries[highLossStartIndex].timestamp;
        
        if (lossDuration >= 500) {
          const maxLoss = Math.max(...lossSeries.slice(highLossStartIndex, i).map(v => v.value));
          
          const anomaly: Anomaly = {
            id: generateId(),
            type: 'packet_loss_high',
            startTime: lossSeries[highLossStartIndex].timestamp,
            endTime: lossSeries[i].timestamp,
            duration: lossDuration,
            severity: maxLoss > 20 ? 'critical' : (maxLoss > 10 ? 'high' : 'medium'),
            title: '丢包率过高',
            description: `丢包率持续高于阈值 ${this.options.packetLossThreshold}%，最高达到 ${maxLoss.toFixed(2)}%`,
            evidence: {
              maxLoss,
              threshold: this.options.packetLossThreshold,
              samples: lossSeries.slice(highLossStartIndex, i)
            },
            rootCause: '网络拥塞或链路质量差导致数据包丢失',
            suggestion: '检查网络连接质量，考虑使用 FEC 或 ARQ 机制',
            relatedEventIds: []
          };
          anomalies.push(anomaly);
        }
        inHighLoss = false;
      }
    }

    return anomalies;
  }

  private calculatePacketLossSeries(samples: GetStatsSample[]): TimeSeriesValue[] {
    const series: TimeSeriesValue[] = [];
    
    for (let i = 1; i < samples.length; i++) {
      const prevSample = samples[i - 1];
      const currSample = samples[i];
      
      const prevInbound = prevSample.reports.inboundRtp || [];
      const currInbound = currSample.reports.inboundRtp || [];
      
      let totalPacketsDelta = 0;
      let totalLostDelta = 0;

      for (const curr of currInbound) {
        const prev = prevInbound.find(p => p.ssrc === curr.ssrc);
        if (prev) {
          const packetsDelta = curr.packetsReceived - prev.packetsReceived;
          const lostDelta = curr.packetsLost - prev.packetsLost;
          
          if (packetsDelta > 0) {
            totalPacketsDelta += packetsDelta;
            totalLostDelta += Math.max(0, lostDelta);
          }
        }
      }

      if (totalPacketsDelta > 0) {
        const lossRate = (totalLostDelta / totalPacketsDelta) * 100;
        series.push({
          timestamp: currSample.timestamp,
          value: lossRate
        });
      }
    }

    return series;
  }

  private analyzeJitter(samples: GetStatsSample[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const jitterSeries = this.calculateJitterSeries(samples);
    
    if (jitterSeries.length === 0) {
      return anomalies;
    }

    let inHighJitter = false;
    let highJitterStartIndex = 0;
    
    for (let i = 0; i < jitterSeries.length; i++) {
      const jitterMs = jitterSeries[i].value * 1000;
      
      if (jitterMs >= this.options.jitterThreshold) {
        if (!inHighJitter) {
          inHighJitter = true;
          highJitterStartIndex = i;
        }
      } else if (inHighJitter) {
        const jitterDuration = jitterSeries[i].timestamp - jitterSeries[highJitterStartIndex].timestamp;
        
        if (jitterDuration >= 1000) {
          const maxJitter = Math.max(...jitterSeries.slice(highJitterStartIndex, i).map(v => v.value * 1000));
          
          const anomaly: Anomaly = {
            id: generateId(),
            type: 'jitter_high',
            startTime: jitterSeries[highJitterStartIndex].timestamp,
            endTime: jitterSeries[i].timestamp,
            duration: jitterDuration,
            severity: maxJitter > 1000 ? 'high' : 'medium',
            title: '抖动过高',
            description: `网络抖动持续高于阈值 ${this.options.jitterThreshold}ms，最高达到 ${maxJitter.toFixed(2)}ms`,
            evidence: {
              maxJitter,
              threshold: this.options.jitterThreshold,
              samples: jitterSeries.slice(highJitterStartIndex, i)
            },
            rootCause: '网络延迟变化大，可能是网络拥塞或路径不稳定',
            suggestion: '检查网络稳定性，考虑使用抖动缓冲区或 QoS 机制',
            relatedEventIds: []
          };
          anomalies.push(anomaly);
        }
        inHighJitter = false;
      }
    }

    return anomalies;
  }

  private calculateJitterSeries(samples: GetStatsSample[]): TimeSeriesValue[] {
    const series: TimeSeriesValue[] = [];
    
    for (const sample of samples) {
      const inbound = sample.reports.inboundRtp || [];
      
      const jitters = inbound
        .map(r => r.jitter)
        .filter((j): j is number => j !== undefined && j > 0);
      
      if (jitters.length > 0) {
        const avgJitter = mean(jitters);
        series.push({
          timestamp: sample.timestamp,
          value: avgJitter
        });
      }
    }

    return series;
  }

  private analyzeTrackMute(samples: GetStatsSample[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const trackStates = this.trackTrackStates(samples);
    
    for (const [trackId, states] of trackStates) {
      for (let i = 1; i < states.length; i++) {
        const prev = states[i - 1];
        const curr = states[i];
        
        if (prev.muted === false && curr.muted === true) {
          const anomaly: Anomaly = {
            id: generateId(),
            type: 'track_mute',
            startTime: curr.timestamp,
            endTime: curr.timestamp + 1000,
            duration: 1000,
            severity: 'low',
            title: '轨道静音',
            description: `轨道 ${trackId} 被静音`,
            evidence: { before: prev, during: curr },
            rootCause: '用户操作静音或轨道被禁用',
            suggestion: '确认是否为用户主动操作，检查轨道状态变化',
            relatedEventIds: []
          };
          anomalies.push(anomaly);
        }
        
        if (prev.enabled === true && curr.enabled === false) {
          const anomaly: Anomaly = {
            id: generateId(),
            type: 'track_mute',
            startTime: curr.timestamp,
            endTime: curr.timestamp + 1000,
            duration: 1000,
            severity: 'medium',
            title: '轨道禁用',
            description: `轨道 ${trackId} 被禁用`,
            evidence: { before: prev, during: curr },
            rootCause: '轨道被应用程序禁用',
            suggestion: '检查应用程序轨道管理逻辑',
            relatedEventIds: []
          };
          anomalies.push(anomaly);
        }
      }
    }

    return anomalies;
  }

  private trackTrackStates(samples: GetStatsSample[]) {
    const trackStates = new Map<string, Array<{
      timestamp: number;
      muted?: boolean;
      enabled?: boolean;
      ended?: boolean;
    }>>();
    
    for (const sample of samples) {
      const tracks = sample.reports.tracks || [];
      
      for (const track of tracks) {
        const trackId = track.trackIdentifier || track.id;
        
        if (!trackStates.has(trackId)) {
          trackStates.set(trackId, []);
        }
        
        trackStates.get(trackId)!.push({
          timestamp: sample.timestamp,
          muted: track.muted,
          enabled: track.enabled,
          ended: track.ended
        });
      }
    }

    return trackStates;
  }

  private analyzeDeviceSwitch(samples: GetStatsSample[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const deviceChanges = this.detectDeviceChanges(samples);
    
    for (const change of deviceChanges) {
      const anomaly: Anomaly = {
        id: generateId(),
        type: 'device_switch',
        startTime: change.timestamp,
        endTime: change.timestamp + 2000,
        duration: 2000,
        severity: 'low',
        title: '设备切换',
        description: `检测到 ${change.kind} 设备从 ${change.before || '未知'} 切换到 ${change.after || '未知'}`,
        evidence: { before: change.before, after: change.after },
        rootCause: '用户切换了音视频输入设备',
        suggestion: '确认设备切换是否为用户主动操作，检查新设备的兼容性',
        relatedEventIds: []
      };
      anomalies.push(anomaly);
    }

    return anomalies;
  }

  private detectDeviceChanges(samples: GetStatsSample[]) {
    const changes: Array<{
      timestamp: number;
      kind: 'audio' | 'video';
      before?: string;
      after?: string;
    }> = [];

    for (let i = 1; i < samples.length; i++) {
      const prevSample = samples[i - 1];
      const currSample = samples[i];
      
      const prevTracks = prevSample.reports.tracks || [];
      const currTracks = currSample.reports.tracks || [];
      
      const prevById = new Map(prevTracks.map(t => [t.trackIdentifier || t.id, t]));
      const currById = new Map(currTracks.map(t => [t.trackIdentifier || t.id, t]));
      
      for (const [id, currTrack] of currById) {
        const prevTrack = prevById.get(id);
        if (prevTrack) continue;
        
        const sameKindPrev = prevTracks.find(t => t.kind === currTrack.kind);
        
        if (sameKindPrev) {
          changes.push({
            timestamp: currSample.timestamp,
            kind: currTrack.kind,
            before: sameKindPrev.trackIdentifier,
            after: currTrack.trackIdentifier
          });
        }
      }
    }

    return changes;
  }

  private analyzeQualityLimitation(samples: GetStatsSample[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const limitationEvents = this.detectQualityLimitations(samples);
    
    for (const event of limitationEvents) {
      const severity = event.reason === 'bandwidth' ? 'high' : 
                       event.reason === 'cpu' ? 'medium' : 'low';
      
      const reasonNames: Record<string, string> = {
        bandwidth: '带宽受限',
        cpu: 'CPU 受限',
        none: '无限制',
        other: '其他原因'
      };
      
      const anomaly: Anomaly = {
        id: generateId(),
        type: 'quality_limitation',
        startTime: event.startTime,
        endTime: event.endTime,
        duration: event.duration,
        severity,
        title: `质量限制: ${reasonNames[event.reason] || event.reason}`,
        description: `检测到 ${reasonNames[event.reason] || event.reason} 导致的编码质量限制，持续 ${(event.duration / 1000).toFixed(1)} 秒`,
        evidence: {
          reason: event.reason,
          duration: event.duration,
          samples: event.samples
        },
        rootCause: event.reason === 'bandwidth' 
          ? '网络带宽不足，编码器降低码率' 
          : event.reason === 'cpu' 
            ? 'CPU 处理能力不足，编码器降低帧率或分辨率'
            : '其他系统资源限制',
        suggestion: event.reason === 'bandwidth'
          ? '检查网络带宽，考虑降低分辨率或帧率'
          : event.reason === 'cpu'
            ? '检查 CPU 使用率，关闭其他占用 CPU 的应用'
            : '检查系统资源状态',
        relatedEventIds: []
      };
      anomalies.push(anomaly);
    }

    return anomalies;
  }

  private detectQualityLimitations(samples: GetStatsSample[]) {
    const events: Array<{
      startTime: number;
      endTime: number;
      duration: number;
      reason: string;
      samples: GetStatsSample[];
    }> = [];

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const outbound = sample.reports.outboundRtp || [];
      
      for (const rtp of outbound) {
        if (rtp.qualityLimitationReason && rtp.qualityLimitationReason !== 'none') {
          const reason = rtp.qualityLimitationReason;
          
          let endIndex = i;
          const affectedSamples: GetStatsSample[] = [sample];
          
          for (let j = i + 1; j < samples.length; j++) {
            const nextSample = samples[j];
            const nextOutbound = nextSample.reports.outboundRtp || [];
            const sameReason = nextOutbound.some(
              r => r.qualityLimitationReason === reason
            );
            
            if (sameReason) {
              endIndex = j;
              affectedSamples.push(nextSample);
            } else {
              break;
            }
          }
          
          const startTime = sample.timestamp;
          const endTime = samples[endIndex].timestamp;
          const duration = endTime - startTime;
          
          if (duration >= this.options.qualityLimitationDurationThreshold) {
            events.push({
              startTime,
              endTime,
              duration,
              reason,
              samples: affectedSamples
            });
          }
          
          i = endIndex;
          break;
        }
      }
    }

    return events;
  }

  private analyzeFramesDropped(samples: GetStatsSample[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const frameDropSeries = this.calculateFrameDropSeries(samples);
    
    if (frameDropSeries.length === 0) {
      return anomalies;
    }

    for (let i = 0; i < frameDropSeries.length; i++) {
      const dropRate = frameDropSeries[i].value;
      
      if (dropRate >= this.options.frameDropThreshold) {
        const anomaly: Anomaly = {
          id: generateId(),
          type: 'frames_dropped',
          startTime: frameDropSeries[i].timestamp,
          endTime: frameDropSeries[i].timestamp + 1000,
          duration: 1000,
          severity: dropRate > 30 ? 'high' : 'medium',
          title: '丢帧',
          description: `检测到丢帧率 ${dropRate.toFixed(2)}%，超过阈值 ${this.options.frameDropThreshold}%`,
          evidence: {
            dropRate,
            threshold: this.options.frameDropThreshold
          },
          rootCause: '解码或渲染能力不足导致丢帧',
          suggestion: '检查 CPU/GPU 使用率，考虑降低分辨率或帧率',
          relatedEventIds: []
        };
        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  private calculateFrameDropSeries(samples: GetStatsSample[]): TimeSeriesValue[] {
    const series: TimeSeriesValue[] = [];
    
    for (let i = 1; i < samples.length; i++) {
      const prevSample = samples[i - 1];
      const currSample = samples[i];
      
      const prevInbound = prevSample.reports.inboundRtp || [];
      const currInbound = currSample.reports.inboundRtp || [];
      
      for (const curr of currInbound) {
        if (curr.kind !== 'video') continue;
        
        const prev = prevInbound.find(p => p.ssrc === curr.ssrc);
        if (!prev) continue;
        
        const currFrames = curr.framesReceived ?? 0;
        const prevFrames = prev.framesReceived ?? 0;
        const currDropped = curr.framesDropped ?? 0;
        const prevDropped = prev.framesDropped ?? 0;
        
        const framesDelta = currFrames - prevFrames;
        const droppedDelta = currDropped - prevDropped;
        
        if (framesDelta > 0) {
          const dropRate = (droppedDelta / framesDelta) * 100;
          series.push({
            timestamp: currSample.timestamp,
            value: Math.max(0, dropRate)
          });
        }
      }
    }

    return series;
  }

  private analyzeRttSpikes(samples: GetStatsSample[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const rttSeries = this.calculateRttSeries(samples);
    
    if (rttSeries.length < 5) {
      return anomalies;
    }

    const baselineRtt = median(rttSeries.slice(0, Math.min(20, rttSeries.length)).map(v => v.value));
    const thresholdRtt = baselineRtt * this.options.rttSpikeMultiplier;

    for (let i = 0; i < rttSeries.length; i++) {
      const currentRtt = rttSeries[i].value;
      
      if (currentRtt >= thresholdRtt && currentRtt > 100) {
        const anomaly: Anomaly = {
          id: generateId(),
          type: 'rtt_spike',
          startTime: rttSeries[i].timestamp,
          endTime: rttSeries[i].timestamp + 1000,
          duration: 1000,
          severity: currentRtt > baselineRtt * 5 ? 'high' : 'medium',
          title: 'RTT 尖峰',
          description: `网络延迟从基线 ${baselineRtt.toFixed(2)}ms 突增到 ${currentRtt.toFixed(2)}ms`,
          evidence: {
            baselineRtt,
            currentRtt,
            spikeRatio: currentRtt / baselineRtt
          },
          rootCause: '网络临时拥塞或路由变化导致延迟突增',
          suggestion: '检查网络路由和拥塞情况，考虑使用更稳定的网络路径',
          relatedEventIds: []
        };
        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  private calculateRttSeries(samples: GetStatsSample[]): TimeSeriesValue[] {
    const series: TimeSeriesValue[] = [];
    
    for (const sample of samples) {
      const candidatePairs = sample.reports.candidatePairs || [];
      const nominated = candidatePairs.filter(p => p.nominated && p.currentRoundTripTime !== undefined);
      
      if (nominated.length > 0) {
        const avgRtt = mean(nominated.map(p => p.currentRoundTripTime! * 1000));
        series.push({
          timestamp: sample.timestamp,
          value: avgRtt
        });
      }
    }

    return series;
  }

  private analyzeAudioVideoDesync(samples: GetStatsSample[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const desyncEvents = this.detectAudioVideoDesync(samples);
    
    for (const event of desyncEvents) {
      const anomaly: Anomaly = {
        id: generateId(),
        type: 'audiovideo_desync',
        startTime: event.timestamp,
        endTime: event.timestamp + 2000,
        duration: 2000,
        severity: event.desyncMs > 500 ? 'high' : (event.desyncMs > 200 ? 'medium' : 'low'),
        title: '音视频不同步',
        description: `检测到音视频不同步，偏差约 ${event.desyncMs.toFixed(0)}ms`,
        evidence: { desyncMs: event.desyncMs },
        rootCause: '音频和视频的编码、传输或解码延迟差异导致同步问题',
        suggestion: '检查音视频同步机制，考虑使用缓冲区或同步标记',
        relatedEventIds: []
      };
      anomalies.push(anomaly);
    }

    return anomalies;
  }

  private detectAudioVideoDesync(samples: GetStatsSample[]) {
    const events: Array<{
      timestamp: number;
      desyncMs: number;
    }> = [];

    for (const sample of samples) {
      const inbound = sample.reports.inboundRtp || [];
      const audioRtp = inbound.find(r => r.kind === 'audio' && r.totalInterFrameDelay !== undefined);
      const videoRtp = inbound.find(r => r.kind === 'video' && r.totalInterFrameDelay !== undefined);
      
      if (audioRtp && videoRtp && 
          audioRtp.totalInterFrameDelay !== undefined &&
          videoRtp.totalInterFrameDelay !== undefined) {
        const audioDelay = audioRtp.totalInterFrameDelay / 1000;
        const videoDelay = videoRtp.totalInterFrameDelay / 1000;
        const desyncMs = Math.abs(audioDelay - videoDelay);
        
        if (desyncMs > 100) {
          events.push({
            timestamp: sample.timestamp,
            desyncMs
          });
        }
      }
    }

    return events;
  }

  private analyzeSignalingBreaks(
    signalingEvents: SignalingEvent[]
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    const breaks = this.detectSignalingBreaks(signalingEvents);
    
    for (const breakEvent of breaks) {
      const anomaly: Anomaly = {
        id: generateId(),
        type: 'signaling_break',
        startTime: breakEvent.startTime,
        endTime: breakEvent.endTime,
        duration: breakEvent.duration,
        severity: breakEvent.duration > 30000 ? 'high' : 'medium',
        title: '信令中断',
        description: `检测到信令事件间隔过长，持续 ${(breakEvent.duration / 1000).toFixed(1)} 秒`,
        evidence: {
          lastEvent: breakEvent.lastEvent,
          nextEvent: breakEvent.nextEvent,
          gapDuration: breakEvent.duration
        },
        rootCause: '信令服务器不可达或网络连接中断',
        suggestion: '检查信令服务器状态和网络连接',
        relatedEventIds: []
      };
      anomalies.push(anomaly);
    }

    const errors = signalingEvents.filter(e => e.subtype === 'error');
    for (const error of errors) {
      const anomaly: Anomaly = {
        id: generateId(),
        type: 'signaling_break',
        startTime: error.timestamp,
        endTime: error.timestamp + 5000,
        duration: 5000,
        severity: 'high',
        title: '信令错误',
        description: `信令错误: ${error.error?.message || error.error?.name || '未知错误'}`,
        evidence: { errorEvent: error },
        rootCause: '信令消息处理失败或协议错误',
        suggestion: '检查信令协议实现和服务器日志',
        relatedEventIds: []
      };
      anomalies.push(anomaly);
    }

    return anomalies;
  }

  private detectSignalingBreaks(signalingEvents: SignalingEvent[]) {
    const breaks: Array<{
      startTime: number;
      endTime: number;
      duration: number;
      lastEvent?: SignalingEvent;
      nextEvent?: SignalingEvent;
    }> = [];

    const sortedEvents = sortByKey(signalingEvents, e => e.timestamp);
    const breakThreshold = 10000;

    for (let i = 1; i < sortedEvents.length; i++) {
      const prevEvent = sortedEvents[i - 1];
      const currEvent = sortedEvents[i];
      const gap = currEvent.timestamp - prevEvent.timestamp;
      
      if (gap >= breakThreshold) {
        breaks.push({
          startTime: prevEvent.timestamp,
          endTime: currEvent.timestamp,
          duration: gap,
          lastEvent: prevEvent,
          nextEvent: currEvent
        });
      }
    }

    return breaks;
  }

  private aggregateToStutterSegments(
    anomalies: Anomaly[],
    timeline: NormalizedTimeline
  ): StutterSegment[] {
    if (anomalies.length === 0) {
      return [];
    }

    const segments: StutterSegment[] = [];
    const mergeThreshold = 5000;

    let currentSegment: {
      anomalies: Anomaly[];
      startTime: number;
      endTime: number;
    } | null = null;

    for (const anomaly of anomalies) {
      if (!currentSegment) {
        currentSegment = {
          anomalies: [anomaly],
          startTime: anomaly.startTime,
          endTime: anomaly.endTime
        };
      } else {
        const gap = anomaly.startTime - currentSegment.endTime;
        
        if (gap <= mergeThreshold) {
          currentSegment.anomalies.push(anomaly);
          currentSegment.endTime = Math.max(currentSegment.endTime, anomaly.endTime);
        } else {
          segments.push(this.createStutterSegment(currentSegment, timeline));
          currentSegment = {
            anomalies: [anomaly],
            startTime: anomaly.startTime,
            endTime: anomaly.endTime
          };
        }
      }
    }

    if (currentSegment) {
      segments.push(this.createStutterSegment(currentSegment, timeline));
    }

    return segments;
  }

  private createStutterSegment(
    segment: { anomalies: Anomaly[]; startTime: number; endTime: number },
    _timeline: NormalizedTimeline
  ): StutterSegment {
    const severityOrder = ['critical', 'high', 'medium', 'low'] as const;
    const typePriority: AnomalyType[] = [
      'ice_reconnect',
      'packet_loss_high',
      'bitrate_drop',
      'signaling_break',
      'jitter_high',
      'rtt_spike',
      'frames_dropped',
      'quality_limitation',
      'audiovideo_desync',
      'track_mute',
      'device_switch'
    ];

    const sortedBySeverity = [...segment.anomalies].sort((a, b) => {
      const aSeverity = severityOrder.indexOf(a.severity);
      const bSeverity = severityOrder.indexOf(b.severity);
      if (aSeverity !== bSeverity) return aSeverity - bSeverity;
      
      const aPriority = typePriority.indexOf(a.type);
      const bPriority = typePriority.indexOf(b.type);
      return aPriority - bPriority;
    });

    const primaryCause = sortedBySeverity[0].type;
    
    const highSeverityCount = segment.anomalies.filter(
      a => a.severity === 'high' || a.severity === 'critical'
    ).length;
    
    const confidence = Math.min(100, 50 + highSeverityCount * 20);

    const userImpacts: string[] = [];
    if (segment.anomalies.some(a => a.type === 'packet_loss_high' || a.type === 'jitter_high')) {
      userImpacts.push('音频视频卡顿、马赛克');
    }
    if (segment.anomalies.some(a => a.type === 'ice_reconnect')) {
      userImpacts.push('连接中断、画面冻结');
    }
    if (segment.anomalies.some(a => a.type === 'bitrate_drop' || a.type === 'quality_limitation')) {
      userImpacts.push('画面模糊、分辨率下降');
    }
    if (segment.anomalies.some(a => a.type === 'audiovideo_desync')) {
      userImpacts.push('音画不同步');
    }
    if (segment.anomalies.some(a => a.type === 'track_mute')) {
      userImpacts.push('音频静音');
    }

    return {
      id: generateId(),
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.endTime - segment.startTime,
      anomalies: segment.anomalies,
      primaryCause,
      confidence,
      userImpact: userImpacts.join('；') || '通话质量下降'
    };
  }
}

export { RuleEngine as default };
