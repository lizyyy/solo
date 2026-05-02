import { RuleEngine } from '../src/rules';
import { NormalizedTimeline, GetStatsSample, SignalingEvent, LogSource } from '../src/types';

describe('RuleEngine', () => {
  const createSampleTimeline = (samples: GetStatsSample[], signalingEvents: SignalingEvent[] = []): NormalizedTimeline => {
    const source: LogSource = {
      id: 'test-source',
      name: 'Test Source',
      type: 'getstats',
      startTime: Math.min(...samples.map(s => s.timestamp)),
      endTime: Math.max(...samples.map(s => s.timestamp))
    };

    return {
      id: 'test-timeline',
      sessionId: 'test-session',
      events: [...samples, ...signalingEvents],
      startTime: source.startTime,
      endTime: source.endTime,
      sources: [source],
      timeOffset: 0
    };
  };

  const createGetStatsSample = (
    index: number,
    timestamp: number,
    options: {
      packetLossRate?: number;
      jitterSeconds?: number;
      targetBitrate?: number;
      qualityLimitationReason?: string;
      nominatedPairId?: string;
      rttSeconds?: number;
      frameDropRate?: number;
    } = {}
  ): GetStatsSample => {
    const {
      packetLossRate = 0,
      jitterSeconds = 0.01,
      targetBitrate = 2500000,
      qualityLimitationReason = 'none',
      nominatedPairId = 'RTCIceCandidatePair_abc123',
      rttSeconds = 0.05,
      frameDropRate = 0
    } = options;

    const basePackets = 1000 + index * 500;
    const baseLost = Math.floor(packetLossRate * (index + 1) * 50);
    const baseBytes = 500000 + index * 250000;

    return {
      timestamp,
      type: 'getstats_sample',
      source: 'getstats',
      peerConnectionId: 'test-peer',
      reports: {
        candidatePairs: [
          {
            id: 'RTCIceCandidatePair_abc123',
            localCandidateId: 'local1',
            remoteCandidateId: 'remote1',
            state: 'succeeded' as const,
            nominated: nominatedPairId === 'RTCIceCandidatePair_abc123',
            writable: true,
            readable: true,
            packetsSent: 1000 + index * 200,
            packetsReceived: 950 + index * 200,
            bytesSent: 1000000 + index * 500000,
            bytesReceived: 900000 + index * 500000,
            currentRoundTripTime: rttSeconds,
            totalRoundTripTime: 50
          },
          {
            id: 'RTCIceCandidatePair_def456',
            localCandidateId: 'local2',
            remoteCandidateId: 'remote2',
            state: 'waiting' as const,
            nominated: nominatedPairId === 'RTCIceCandidatePair_def456',
            writable: false,
            readable: true,
            packetsSent: 0,
            packetsReceived: 0,
            bytesSent: 0,
            bytesReceived: 0
          }
        ],
        inboundRtp: [
          {
            id: 'RTCInboundRTPVideo_1',
            kind: 'video' as const,
            ssrc: '123456',
            packetsReceived: basePackets,
            packetsLost: baseLost,
            jitter: jitterSeconds,
            frameWidth: 1280,
            frameHeight: 720,
            framesPerSecond: 30,
            framesReceived: 300 + index * 30,
            framesDecoded: 295 + index * 30,
            framesDropped: Math.floor(frameDropRate * (index + 1) * 3),
            keyFramesDecoded: 10 + index,
            bytesReceived: baseBytes,
            totalInterFrameDelay: 100
          },
          {
            id: 'RTCInboundRTPAudio_1',
            kind: 'audio' as const,
            ssrc: '789012',
            packetsReceived: basePackets,
            packetsLost: Math.floor(baseLost * 0.5),
            jitter: jitterSeconds * 0.5,
            bytesReceived: Math.floor(baseBytes * 0.2),
            totalInterFrameDelay: 50
          }
        ],
        outboundRtp: [
          {
            id: 'RTCOutboundRTPVideo_1',
            kind: 'video' as const,
            ssrc: '345678',
            packetsSent: basePackets,
            bytesSent: baseBytes,
            targetBitrate,
            framesEncoded: 300 + index * 30,
            keyFramesEncoded: 10 + index,
            totalEncodeTime: 5,
            qualityLimitationReason: qualityLimitationReason as 'none' | 'cpu' | 'bandwidth' | 'other',
            qualityLimitationDurations: {
              cpu: 0,
              bandwidth: qualityLimitationReason === 'bandwidth' ? 5000 : 0,
              none: qualityLimitationReason === 'none' ? 5000 : 0,
              other: 0
            }
          },
          {
            id: 'RTCOutboundRTPAudio_1',
            kind: 'audio' as const,
            ssrc: '901234',
            packetsSent: basePackets * 2,
            bytesSent: Math.floor(baseBytes * 0.2)
          }
        ],
        transports: [
          {
            id: 'RTCTransport_1',
            bytesSent: 1720000 + index * 600000,
            bytesReceived: 1000000 + index * 600000,
            packetsSent: 2800 + index * 400,
            packetsReceived: 1950 + index * 400,
            selectedCandidatePairId: nominatedPairId,
            dtlsState: 'connected',
            iceState: 'connected'
          }
        ]
      }
    };
  };

  describe('analyzeJitter', () => {
    it('should detect high jitter', () => {
      const ruleEngine = new RuleEngine({ jitterThreshold: 500 });
      
      const samples: GetStatsSample[] = [
        createGetStatsSample(0, 1714644000000, { jitterSeconds: 0.01 }),
        createGetStatsSample(1, 1714644001000, { jitterSeconds: 0.8 }),
        createGetStatsSample(2, 1714644002000, { jitterSeconds: 0.7 }),
        createGetStatsSample(3, 1714644003000, { jitterSeconds: 0.02 })
      ];

      const timeline = createSampleTimeline(samples);
      const result = ruleEngine.analyze(timeline);

      const jitterAnomalies = result.anomalies.filter(a => a.type === 'jitter_high');
      expect(jitterAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeQualityLimitation', () => {
    it('should detect bandwidth limitation', () => {
      const ruleEngine = new RuleEngine({ qualityLimitationDurationThreshold: 1000 });
      
      const samples: GetStatsSample[] = [
        createGetStatsSample(0, 1714644000000, { qualityLimitationReason: 'none' }),
        createGetStatsSample(1, 1714644001000, { qualityLimitationReason: 'bandwidth' }),
        createGetStatsSample(2, 1714644002000, { qualityLimitationReason: 'bandwidth' }),
        createGetStatsSample(3, 1714644003000, { qualityLimitationReason: 'none' })
      ];

      const timeline = createSampleTimeline(samples);
      const result = ruleEngine.analyze(timeline);

      const limitationAnomalies = result.anomalies.filter(a => a.type === 'quality_limitation');
      expect(limitationAnomalies.length).toBeGreaterThan(0);
    });

    it('should detect CPU limitation', () => {
      const ruleEngine = new RuleEngine({ qualityLimitationDurationThreshold: 1000 });
      
      const samples: GetStatsSample[] = [
        createGetStatsSample(0, 1714644000000, { qualityLimitationReason: 'none' }),
        createGetStatsSample(1, 1714644001000, { qualityLimitationReason: 'cpu' }),
        createGetStatsSample(2, 1714644002000, { qualityLimitationReason: 'cpu' }),
        createGetStatsSample(3, 1714644003000, { qualityLimitationReason: 'none' })
      ];

      const timeline = createSampleTimeline(samples);
      const result = ruleEngine.analyze(timeline);

      const limitationAnomalies = result.anomalies.filter(a => a.type === 'quality_limitation');
      expect(limitationAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeIceReconnect', () => {
    it('should detect ICE restart from signaling events', () => {
      const ruleEngine = new RuleEngine();
      
      const samples: GetStatsSample[] = [
        createGetStatsSample(0, 1714644000000)
      ];

      const signalingEvents: SignalingEvent[] = [
        {
          timestamp: 1714644005000,
          type: 'signaling_event',
          source: 'signaling',
          subtype: 'ice_restart',
          direction: 'send'
        }
      ];

      const timeline = createSampleTimeline(samples, signalingEvents);
      const result = ruleEngine.analyze(timeline);

      const iceAnomalies = result.anomalies.filter(a => a.type === 'ice_reconnect');
      expect(iceAnomalies.length).toBeGreaterThan(0);
    });

    it('should detect candidate pair switch', () => {
      const ruleEngine = new RuleEngine();
      
      const samples: GetStatsSample[] = [
        createGetStatsSample(0, 1714644000000, { nominatedPairId: 'RTCIceCandidatePair_abc123' }),
        createGetStatsSample(1, 1714644001000, { nominatedPairId: 'RTCIceCandidatePair_abc123' }),
        createGetStatsSample(2, 1714644002000, { nominatedPairId: 'RTCIceCandidatePair_def456' }),
        createGetStatsSample(3, 1714644003000, { nominatedPairId: 'RTCIceCandidatePair_def456' })
      ];

      const timeline = createSampleTimeline(samples);
      const result = ruleEngine.analyze(timeline);

      const iceAnomalies = result.anomalies.filter(a => a.type === 'ice_reconnect');
      expect(iceAnomalies.length).toBeGreaterThan(0);
    });
  });
});
