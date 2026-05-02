import { DiagnosticService } from '../src/services';
import { Session } from '../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('DiagnosticService', () => {
  let service: DiagnosticService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(__dirname, '..', 'temp-test-storage');
    service = new DiagnosticService({
      storageOptions: {
        dataDir: tempDir
      }
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createTestSession = (): Session => ({
    id: 'test-session-1',
    name: 'Test Session',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sources: [
      {
        id: 'source-1',
        name: 'getstats.json',
        type: 'getstats',
        filePath: '/path/to/getstats.json',
        startTime: 1714644000000,
        endTime: 1714644015000
      }
    ],
    timeline: {
      id: 'timeline-1',
      sessionId: 'test-session-1',
      events: [],
      startTime: 1714644000000,
      endTime: 1714644015000,
      sources: [],
      timeOffset: 0
    },
    anomalies: [
      {
        id: 'anomaly-1',
        type: 'packet_loss_high',
        startTime: 1714644005000,
        endTime: 1714644010000,
        duration: 5000,
        severity: 'high',
        title: '丢包率过高',
        description: '测试异常',
        evidence: {},
        rootCause: '网络拥塞',
        suggestion: '检查网络',
        relatedEventIds: []
      }
    ],
    stutters: [
      {
        id: 'stutter-1',
        startTime: 1714644005000,
        endTime: 1714644010000,
        duration: 5000,
        anomalies: [],
        primaryCause: 'packet_loss_high',
        confidence: 85,
        userImpact: '音频视频卡顿'
      }
    ],
    metadata: {
      totalDuration: 15000,
      stutterDuration: 5000,
      stutterPercentage: 33.3,
      anomalyCount: {
        ice_reconnect: 0,
        bitrate_drop: 0,
        packet_loss_high: 1,
        jitter_high: 0,
        track_mute: 0,
        device_switch: 0,
        signaling_break: 0,
        audiovideo_desync: 0,
        quality_limitation: 0,
        frames_dropped: 0,
        rtt_spike: 0
      },
      callQualityScore: 75
    }
  });

  describe('analyzeContent', () => {
    it('should analyze getStats content', async () => {
      const getStatsData = JSON.stringify([
        {
          timestamp: 1714644000000,
          reports: [
            {
              id: 'RTCInboundRTPVideo_1',
              type: 'inbound-rtp',
              kind: 'video',
              ssrc: '123456',
              packetsReceived: 1000,
              packetsLost: 50,
              jitter: 0.01,
              bytesReceived: 500000
            }
          ]
        },
        {
          timestamp: 1714644001000,
          reports: [
            {
              id: 'RTCInboundRTPVideo_1',
              type: 'inbound-rtp',
              kind: 'video',
              ssrc: '123456',
              packetsReceived: 1500,
              packetsLost: 150,
              jitter: 0.01,
              bytesReceived: 750000
            }
          ]
        }
      ]);

      const result = await service.analyzeContent([
        {
          content: getStatsData,
          type: 'getstats',
          name: 'test-getstats'
        }
      ]);

      expect(result.session).toBeDefined();
      expect(result.saved).toBe(false);
      expect(result.session.sources.length).toBeGreaterThan(0);
    });

    it('should analyze mixed content types', async () => {
      const getStatsData = JSON.stringify([
        {
          timestamp: 1714644000000,
          reports: [
            {
              id: 'RTCInboundRTPVideo_1',
              type: 'inbound-rtp',
              kind: 'video',
              ssrc: '123456',
              packetsReceived: 1000,
              packetsLost: 0,
              jitter: 0.01,
              bytesReceived: 500000
            }
          ]
        }
      ]);

      const signalingData = JSON.stringify([
        {
          timestamp: 1714644000000,
          type: 'offer',
          direction: 'send',
          sdp: 'v=0\r\n...'
        }
      ]);

      const userNoteData = `2024-05-02T14:00:00.000Z 开始远程庭审
2024-05-02T14:00:05.000Z [warning] 对方画面开始卡顿`;

      const result = await service.analyzeContent([
        { content: getStatsData, type: 'getstats', name: 'getstats' },
        { content: signalingData, type: 'signaling', name: 'signaling' },
        { content: userNoteData, type: 'usernote', name: 'usernote' }
      ]);

      expect(result.session).toBeDefined();
      expect(result.session.sources.length).toBe(3);
    });
  });

  describe('session storage', () => {
    it('should save and retrieve session', async () => {
      const session = createTestSession();
      
      const saved = await service.saveSession(session);
      expect(saved.id).toBe(session.id);

      const retrieved = await service.getSession(session.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should list sessions', async () => {
      const session1 = createTestSession();
      session1.id = 'session-1';
      session1.name = 'Session 1';

      const session2 = createTestSession();
      session2.id = 'session-2';
      session2.name = 'Session 2';

      await service.saveSession(session1);
      await service.saveSession(session2);

      const sessions = await service.listSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });

    it('should delete session', async () => {
      const session = createTestSession();
      
      await service.saveSession(session);
      
      const existsBefore = await service.getSession(session.id);
      expect(existsBefore).not.toBeNull();

      const deleted = await service.deleteSession(session.id);
      expect(deleted).toBe(true);

      const existsAfter = await service.getSession(session.id);
      expect(existsAfter).toBeNull();
    });
  });

  describe('report export', () => {
    it('should export JSON report to string', () => {
      const session = createTestSession();
      
      const report = service.exportJsonReportToString(session, {
        format: 'json',
        includeRawData: false,
        includeEvidence: true
      });

      expect(typeof report).toBe('string');
      
      const parsed = JSON.parse(report);
      expect(parsed.sessionId).toBe(session.id);
      expect(parsed.sessionName).toBe(session.name);
      expect(parsed.summary).toBeDefined();
    });

    it('should export Markdown report to string', () => {
      const session = createTestSession();
      
      const report = service.exportMarkdownReportToString(session, {
        format: 'markdown',
        includeRawData: false,
        includeEvidence: true
      });

      expect(typeof report).toBe('string');
      expect(report).toContain('#');
      expect(report).toContain(session.name);
    });
  });

  describe('quality score calculation', () => {
    it('should calculate quality score based on anomalies', async () => {
      const session = createTestSession();
      
      expect(session.metadata.callQualityScore).toBe(75);
    });

    it('should include stutter percentage in score', () => {
      const session = createTestSession();
      
      expect(session.metadata.stutterPercentage).toBeGreaterThan(0);
      expect(session.metadata.stutterDuration).toBe(5000);
    });
  });
});
