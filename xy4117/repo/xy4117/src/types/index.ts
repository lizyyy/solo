export type RTCPeerConnectionState = 
  | 'new' 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'failed' 
  | 'closed';

export type RTCIceConnectionState = 
  | 'new' 
  | 'checking' 
  | 'connected' 
  | 'completed' 
  | 'disconnected' 
  | 'failed' 
  | 'closed';

export interface RTCIceCandidateInit {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface TimestampedEvent {
  timestamp: number;
  type: string;
  source: 'getstats' | 'signaling' | 'usernote';
  rawData?: unknown;
}

export interface GetStatsSample extends TimestampedEvent {
  type: 'getstats_sample';
  peerConnectionId: string;
  reports: RTCStatsReportData;
}

export interface RTCStatsReportData {
  candidatePairs?: CandidatePairStats[];
  inboundRtp?: InboundRtpStats[];
  outboundRtp?: OutboundRtpStats[];
  tracks?: TrackStats[];
  transports?: TransportStats[];
  codecs?: CodecStats[];
  iceServers?: IceServerStats[];
}

export interface CandidatePairStats {
  id: string;
  localCandidateId: string;
  remoteCandidateId: string;
  state: 'frozen' | 'waiting' | 'in-progress' | 'failed' | 'succeeded';
  nominated: boolean;
  writable: boolean;
  readable: boolean;
  packetsSent: number;
  packetsReceived: number;
  bytesSent: number;
  bytesReceived: number;
  currentRoundTripTime?: number;
  totalRoundTripTime?: number;
  requestsReceived?: number;
  requestsSent?: number;
  responsesReceived?: number;
  responsesSent?: number;
  consentRequestsSent?: number;
}

export interface InboundRtpStats {
  id: string;
  trackId?: string;
  transportId?: string;
  codecId?: string;
  kind: 'audio' | 'video';
  ssrc: string;
  packetsReceived: number;
  packetsLost: number;
  jitter?: number;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  framesReceived?: number;
  framesDecoded?: number;
  framesDropped?: number;
  keyFramesDecoded?: number;
  bytesReceived: number;
  headerBytesReceived?: number;
  lastPacketReceivedTimestamp?: number;
  totalProcessingDelay?: number;
  totalDecodeTime?: number;
  totalInterFrameDelay?: number;
}

export interface OutboundRtpStats {
  id: string;
  trackId?: string;
  transportId?: string;
  codecId?: string;
  kind: 'audio' | 'video';
  ssrc: string;
  packetsSent: number;
  bytesSent: number;
  headerBytesSent?: number;
  retransmittedPacketsSent?: number;
  retransmittedBytesSent?: number;
  targetBitrate?: number;
  totalEncodedBytesTarget?: number;
  framesEncoded?: number;
  keyFramesEncoded?: number;
  totalEncodeTime?: number;
  qualityLimitationReason?: 'none' | 'cpu' | 'bandwidth' | 'other';
  qualityLimitationDurations?: {
    cpu: number;
    bandwidth: number;
    none: number;
    other: number;
  };
}

export interface TrackStats {
  id: string;
  kind: 'audio' | 'video';
  trackIdentifier: string;
  mediaSourceId?: string;
  detached?: boolean;
  ended?: boolean;
  remoteSource: boolean;
  muted?: boolean;
  enabled?: boolean;
  frameHeight?: number;
  frameWidth?: number;
  framesPerSecond?: number;
  framesSent?: number;
  framesReceived?: number;
  framesDecoded?: number;
  framesDropped?: number;
  audioLevel?: number;
  totalAudioEnergy?: number;
  voiceActivityFlag?: boolean;
}

export interface TransportStats {
  id: string;
  bytesSent: number;
  bytesReceived: number;
  packetsSent: number;
  packetsReceived: number;
  selectedCandidatePairId?: string;
  dtlsState?: 'new' | 'connecting' | 'connected' | 'closed' | 'failed';
  iceState?: 'new' | 'checking' | 'connected' | 'completed' | 'disconnected' | 'failed' | 'closed';
}

export interface CodecStats {
  id: string;
  transportId?: string;
  payloadType: number;
  mimeType: string;
  clockRate?: number;
  channels?: number;
  sdpFmtpLine?: string;
}

export interface IceServerStats {
  url: string;
  port: number;
  relayProtocol?: string;
}

export interface SignalingEvent extends TimestampedEvent {
  type: 'signaling_event';
  subtype: 'offer' | 'answer' | 'ice_candidate' | 'ice_restart' | 'renegotiation' | 'error' | 'connection_state_change';
  direction: 'send' | 'receive';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  connectionState?: RTCPeerConnectionState;
  iceConnectionState?: RTCIceConnectionState;
  error?: {
    name: string;
    message: string;
  };
}

export interface UserNote extends TimestampedEvent {
  type: 'user_note';
  note: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface LogSource {
  id: string;
  name: string;
  type: 'getstats' | 'signaling' | 'usernote';
  filePath?: string;
  startTime: number;
  endTime: number;
}

export interface NormalizedTimeline {
  id: string;
  sessionId: string;
  events: TimestampedEvent[];
  startTime: number;
  endTime: number;
  sources: LogSource[];
  timeOffset: number;
}

export type AnomalyType = 
  | 'ice_reconnect'
  | 'bitrate_drop'
  | 'packet_loss_high'
  | 'jitter_high'
  | 'track_mute'
  | 'device_switch'
  | 'signaling_break'
  | 'audiovideo_desync'
  | 'quality_limitation'
  | 'frames_dropped'
  | 'rtt_spike';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  startTime: number;
  endTime: number;
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  rootCause: string;
  suggestion: string;
  relatedEventIds: string[];
}

export interface StutterSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  anomalies: Anomaly[];
  primaryCause: AnomalyType;
  confidence: number;
  userImpact: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sources: LogSource[];
  timeline: NormalizedTimeline;
  anomalies: Anomaly[];
  stutters: StutterSegment[];
  metadata: {
    totalDuration: number;
    stutterDuration: number;
    stutterPercentage: number;
    anomalyCount: Record<AnomalyType, number>;
    callQualityScore: number;
  };
}

export interface ReportOptions {
  format: 'json' | 'markdown';
  includeRawData: boolean;
  includeEvidence: boolean;
}

export interface JsonReport {
  sessionId: string;
  sessionName: string;
  analyzedAt: number;
  summary: {
    totalDuration: number;
    stutterDuration: number;
    stutterPercentage: number;
    callQualityScore: number;
    anomalyCounts: Record<AnomalyType, number>;
  };
  stutterSegments: StutterSegment[];
  anomalies: Anomaly[];
  rootCauseAnalysis: {
    primaryRootCause: AnomalyType;
    contributingFactors: AnomalyType[];
    timelineAnalysis: string;
  };
}

export interface ParseOptions {
  sourceName?: string;
  startTimeOffset?: number;
}
