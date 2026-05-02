import { 
  GetStatsSample, 
  CandidatePairStats, 
  InboundRtpStats, 
  OutboundRtpStats, 
  TrackStats, 
  TransportStats,
  LogSource,
  ParseOptions
} from '../types';
import { BaseParser } from './base';
import { safeJsonParse, isObject } from '../utils';

interface RawStatsReport {
  id: string;
  type: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface GetStatsSnapshot {
  timestamp: number;
  reports: RawStatsReport[];
  peerConnectionId?: string;
}

export class GetStatsParser extends BaseParser {
  private peerConnectionId: string;

  constructor(options: ParseOptions & { peerConnectionId?: string } = {}) {
    super(options);
    this.peerConnectionId = options.peerConnectionId || `pc-${Date.now()}`;
  }

  protected getSourceType(): 'getstats' {
    return 'getstats';
  }

  async parse(content: string): Promise<{
    events: GetStatsSample[];
    source: LogSource;
  }> {
    const snapshots = this.parseContent(content);
    
    if (snapshots.length === 0) {
      throw new Error('没有找到有效的 getStats 数据');
    }

    const events = snapshots.map(snapshot => this.convertSnapshotToEvent(snapshot));
    
    const { start, end } = this.getTimeRange(events);
    const source = this.createLogSource(start, end);

    return { events, source };
  }

  private parseContent(content: string): GetStatsSnapshot[] {
    const parsed = safeJsonParse(content);
    
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => this.normalizeSnapshot(item, index));
    }
    
    if (isObject(parsed)) {
      if ('reports' in parsed || 'stats' in parsed) {
        return [this.normalizeSnapshot(parsed, 0)];
      }
      
      const values = Object.values(parsed);
      if (values.length > 0 && isObject(values[0]) && ('type' in values[0] || 'id' in values[0])) {
        return [{
          timestamp: Date.now(),
          reports: values as RawStatsReport[]
        }];
      }
    }

    const lines = content.trim().split('\n');
    if (lines.length > 0) {
      const snapshots: GetStatsSnapshot[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
          const parsedLine = JSON.parse(line);
          if (isObject(parsedLine) || Array.isArray(parsedLine)) {
            const snapshot = this.normalizeSnapshot(parsedLine, i);
            snapshots.push(snapshot);
          }
        } catch {
          continue;
        }
      }
      
      if (snapshots.length > 0) {
        return snapshots;
      }
    }

    return [];
  }

  private normalizeSnapshot(data: unknown, index: number): GetStatsSnapshot {
    if (Array.isArray(data)) {
      return {
        timestamp: this.extractTimestamp(data, index),
        reports: data.filter(isObject) as RawStatsReport[]
      };
    }

    if (!isObject(data)) {
      return {
        timestamp: Date.now() + index * 1000,
        reports: []
      };
    }

    let reports: RawStatsReport[] = [];
    let timestamp: number = Date.now() + index * 1000;
    let peerConnectionId: string | undefined;

    if ('timestamp' in data && typeof data.timestamp === 'number') {
      timestamp = data.timestamp;
    }
    
    if ('peerConnectionId' in data && typeof data.peerConnectionId === 'string') {
      peerConnectionId = data.peerConnectionId;
    }

    if ('reports' in data && Array.isArray(data.reports)) {
      reports = data.reports.filter(isObject) as RawStatsReport[];
    } else if ('stats' in data && Array.isArray(data.stats)) {
      reports = data.stats.filter(isObject) as RawStatsReport[];
    } else {
      const values = Object.values(data);
      const objectValues = values.filter(isObject);
      if (objectValues.length > 0 && objectValues.every(v => 'type' in v || 'id' in v)) {
        reports = objectValues as RawStatsReport[];
      }
    }

    return { timestamp, reports, peerConnectionId };
  }

  private extractTimestamp(reports: RawStatsReport[], index: number): number {
    const timestamps = reports
      .map(r => r.timestamp)
      .filter((t): t is number => typeof t === 'number');
    
    if (timestamps.length > 0) {
      return Math.min(...timestamps);
    }
    
    return Date.now() + index * 1000;
  }

  private convertSnapshotToEvent(snapshot: GetStatsSnapshot): GetStatsSample {
    const candidatePairs = this.extractCandidatePairs(snapshot.reports);
    const inboundRtp = this.extractInboundRtp(snapshot.reports);
    const outboundRtp = this.extractOutboundRtp(snapshot.reports);
    const tracks = this.extractTracks(snapshot.reports);
    const transports = this.extractTransports(snapshot.reports);

    return {
      timestamp: this.adjustTimestamp(snapshot.timestamp),
      type: 'getstats_sample',
      source: 'getstats',
      peerConnectionId: snapshot.peerConnectionId || this.peerConnectionId,
      reports: {
        candidatePairs: candidatePairs.length > 0 ? candidatePairs : undefined,
        inboundRtp: inboundRtp.length > 0 ? inboundRtp : undefined,
        outboundRtp: outboundRtp.length > 0 ? outboundRtp : undefined,
        tracks: tracks.length > 0 ? tracks : undefined,
        transports: transports.length > 0 ? transports : undefined
      },
      rawData: snapshot.reports
    };
  }

  private extractCandidatePairs(reports: RawStatsReport[]): CandidatePairStats[] {
    return reports
      .filter(r => r.type === 'candidate-pair')
      .map(r => ({
        id: String(r.id),
        localCandidateId: String(r.localCandidateId || r.localCandidate || ''),
        remoteCandidateId: String(r.remoteCandidateId || r.remoteCandidate || ''),
        state: this.parseCandidatePairState(String(r.state || '')),
        nominated: Boolean(r.nominated),
        writable: Boolean(r.writable),
        readable: Boolean(r.readable),
        packetsSent: Number(r.packetsSent || 0),
        packetsReceived: Number(r.packetsReceived || 0),
        bytesSent: Number(r.bytesSent || 0),
        bytesReceived: Number(r.bytesReceived || 0),
        currentRoundTripTime: r.currentRoundTripTime !== undefined ? Number(r.currentRoundTripTime) : undefined,
        totalRoundTripTime: r.totalRoundTripTime !== undefined ? Number(r.totalRoundTripTime) : undefined,
        requestsReceived: r.requestsReceived !== undefined ? Number(r.requestsReceived) : undefined,
        requestsSent: r.requestsSent !== undefined ? Number(r.requestsSent) : undefined,
        responsesReceived: r.responsesReceived !== undefined ? Number(r.responsesReceived) : undefined,
        responsesSent: r.responsesSent !== undefined ? Number(r.responsesSent) : undefined,
        consentRequestsSent: r.consentRequestsSent !== undefined ? Number(r.consentRequestsSent) : undefined
      }));
  }

  private parseCandidatePairState(state: string): CandidatePairStats['state'] {
    const validStates: CandidatePairStats['state'][] = ['frozen', 'waiting', 'in-progress', 'failed', 'succeeded'];
    const normalized = state.toLowerCase().replace(' ', '-') as CandidatePairStats['state'];
    return validStates.includes(normalized) ? normalized : 'failed';
  }

  private extractInboundRtp(reports: RawStatsReport[]): InboundRtpStats[] {
    return reports
      .filter(r => r.type === 'inbound-rtp')
      .map(r => ({
        id: String(r.id),
        trackId: r.trackId !== undefined ? String(r.trackId) : undefined,
        transportId: r.transportId !== undefined ? String(r.transportId) : undefined,
        codecId: r.codecId !== undefined ? String(r.codecId) : undefined,
        kind: (r.kind === 'audio' || r.kind === 'video') ? r.kind : 'video',
        ssrc: String(r.ssrc || r.id),
        packetsReceived: Number(r.packetsReceived || 0),
        packetsLost: Number(r.packetsLost || 0),
        jitter: r.jitter !== undefined ? Number(r.jitter) : undefined,
        frameWidth: r.frameWidth !== undefined ? Number(r.frameWidth) : undefined,
        frameHeight: r.frameHeight !== undefined ? Number(r.frameHeight) : undefined,
        framesPerSecond: r.framesPerSecond !== undefined ? Number(r.framesPerSecond) : undefined,
        framesReceived: r.framesReceived !== undefined ? Number(r.framesReceived) : undefined,
        framesDecoded: r.framesDecoded !== undefined ? Number(r.framesDecoded) : undefined,
        framesDropped: r.framesDropped !== undefined ? Number(r.framesDropped) : undefined,
        keyFramesDecoded: r.keyFramesDecoded !== undefined ? Number(r.keyFramesDecoded) : undefined,
        bytesReceived: Number(r.bytesReceived || 0),
        headerBytesReceived: r.headerBytesReceived !== undefined ? Number(r.headerBytesReceived) : undefined,
        lastPacketReceivedTimestamp: r.lastPacketReceivedTimestamp !== undefined ? Number(r.lastPacketReceivedTimestamp) : undefined,
        totalProcessingDelay: r.totalProcessingDelay !== undefined ? Number(r.totalProcessingDelay) : undefined,
        totalDecodeTime: r.totalDecodeTime !== undefined ? Number(r.totalDecodeTime) : undefined,
        totalInterFrameDelay: r.totalInterFrameDelay !== undefined ? Number(r.totalInterFrameDelay) : undefined
      }));
  }

  private extractOutboundRtp(reports: RawStatsReport[]): OutboundRtpStats[] {
    return reports
      .filter(r => r.type === 'outbound-rtp')
      .map(r => ({
        id: String(r.id),
        trackId: r.trackId !== undefined ? String(r.trackId) : undefined,
        transportId: r.transportId !== undefined ? String(r.transportId) : undefined,
        codecId: r.codecId !== undefined ? String(r.codecId) : undefined,
        kind: (r.kind === 'audio' || r.kind === 'video') ? r.kind : 'video',
        ssrc: String(r.ssrc || r.id),
        packetsSent: Number(r.packetsSent || 0),
        bytesSent: Number(r.bytesSent || 0),
        headerBytesSent: r.headerBytesSent !== undefined ? Number(r.headerBytesSent) : undefined,
        retransmittedPacketsSent: r.retransmittedPacketsSent !== undefined ? Number(r.retransmittedPacketsSent) : undefined,
        retransmittedBytesSent: r.retransmittedBytesSent !== undefined ? Number(r.retransmittedBytesSent) : undefined,
        targetBitrate: r.targetBitrate !== undefined ? Number(r.targetBitrate) : undefined,
        totalEncodedBytesTarget: r.totalEncodedBytesTarget !== undefined ? Number(r.totalEncodedBytesTarget) : undefined,
        framesEncoded: r.framesEncoded !== undefined ? Number(r.framesEncoded) : undefined,
        keyFramesEncoded: r.keyFramesEncoded !== undefined ? Number(r.keyFramesEncoded) : undefined,
        totalEncodeTime: r.totalEncodeTime !== undefined ? Number(r.totalEncodeTime) : undefined,
        qualityLimitationReason: this.parseQualityLimitationReason(String(r.qualityLimitationReason || '')),
        qualityLimitationDurations: this.parseQualityLimitationDurations(r.qualityLimitationDurations)
      }));
  }

  private parseQualityLimitationReason(reason: string): OutboundRtpStats['qualityLimitationReason'] {
    const validReasons: OutboundRtpStats['qualityLimitationReason'][] = ['none', 'cpu', 'bandwidth', 'other'];
    const normalized = reason.toLowerCase() as OutboundRtpStats['qualityLimitationReason'];
    return validReasons.includes(normalized) ? normalized : 'other';
  }

  private parseQualityLimitationDurations(
    data: unknown
  ): OutboundRtpStats['qualityLimitationDurations'] {
    const defaultDurations = { cpu: 0, bandwidth: 0, none: 0, other: 0 };
    
    if (!isObject(data)) {
      return defaultDurations;
    }

    return {
      cpu: typeof data.cpu === 'number' ? data.cpu : 0,
      bandwidth: typeof data.bandwidth === 'number' ? data.bandwidth : 0,
      none: typeof data.none === 'number' ? data.none : 0,
      other: typeof data.other === 'number' ? data.other : 0
    };
  }

  private extractTracks(reports: RawStatsReport[]): TrackStats[] {
    return reports
      .filter(r => r.type === 'track' || r.type === 'media-source')
      .map(r => ({
        id: String(r.id),
        kind: (r.kind === 'audio' || r.kind === 'video') ? r.kind : 'video',
        trackIdentifier: String(r.trackIdentifier || r.id),
        mediaSourceId: r.mediaSourceId !== undefined ? String(r.mediaSourceId) : undefined,
        detached: r.detached !== undefined ? Boolean(r.detached) : undefined,
        ended: r.ended !== undefined ? Boolean(r.ended) : undefined,
        remoteSource: Boolean(r.remoteSource || false),
        muted: r.muted !== undefined ? Boolean(r.muted) : undefined,
        enabled: r.enabled !== undefined ? Boolean(r.enabled) : undefined,
        frameHeight: r.frameHeight !== undefined ? Number(r.frameHeight) : undefined,
        frameWidth: r.frameWidth !== undefined ? Number(r.frameWidth) : undefined,
        framesPerSecond: r.framesPerSecond !== undefined ? Number(r.framesPerSecond) : undefined,
        framesSent: r.framesSent !== undefined ? Number(r.framesSent) : undefined,
        framesReceived: r.framesReceived !== undefined ? Number(r.framesReceived) : undefined,
        framesDecoded: r.framesDecoded !== undefined ? Number(r.framesDecoded) : undefined,
        framesDropped: r.framesDropped !== undefined ? Number(r.framesDropped) : undefined,
        audioLevel: r.audioLevel !== undefined ? Number(r.audioLevel) : undefined,
        totalAudioEnergy: r.totalAudioEnergy !== undefined ? Number(r.totalAudioEnergy) : undefined,
        voiceActivityFlag: r.voiceActivityFlag !== undefined ? Boolean(r.voiceActivityFlag) : undefined
      }));
  }

  private extractTransports(reports: RawStatsReport[]): TransportStats[] {
    return reports
      .filter(r => r.type === 'transport')
      .map(r => ({
        id: String(r.id),
        bytesSent: Number(r.bytesSent || 0),
        bytesReceived: Number(r.bytesReceived || 0),
        packetsSent: Number(r.packetsSent || 0),
        packetsReceived: Number(r.packetsReceived || 0),
        selectedCandidatePairId: r.selectedCandidatePairId !== undefined ? String(r.selectedCandidatePairId) : undefined,
        dtlsState: this.parseDtlsState(String(r.dtlsState || '')),
        iceState: this.parseIceState(String(r.iceState || ''))
      }));
  }

  private parseDtlsState(state: string): TransportStats['dtlsState'] {
    const validStates: TransportStats['dtlsState'][] = ['new', 'connecting', 'connected', 'closed', 'failed'];
    const normalized = state.toLowerCase() as TransportStats['dtlsState'];
    return validStates.includes(normalized) ? normalized : undefined;
  }

  private parseIceState(state: string): TransportStats['iceState'] {
    const validStates: TransportStats['iceState'][] = ['new', 'checking', 'connected', 'completed', 'disconnected', 'failed', 'closed'];
    const normalized = state.toLowerCase() as TransportStats['iceState'];
    return validStates.includes(normalized) ? normalized : undefined;
  }
}
