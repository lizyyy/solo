import { ParserManager, GetStatsParser, SignalingParser, UserNoteParser } from '../src/parsers';

describe('Parsers', () => {
  describe('GetStatsParser', () => {
    it('should parse getStats JSON array', async () => {
      const parser = new GetStatsParser();
      const jsonData = JSON.stringify([
        {
          timestamp: 1714644000000,
          reports: [
            {
              id: 'RTCIceCandidatePair_1',
              type: 'candidate-pair',
              state: 'succeeded',
              nominated: true,
              writable: true,
              readable: true,
              packetsSent: 1000,
              packetsReceived: 950,
              bytesSent: 1000000,
              bytesReceived: 900000
            }
          ]
        }
      ]);
      
      const result = await parser.parse(jsonData);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].type).toBe('getstats_sample');
    });

    it('should throw error for empty getStats data', async () => {
      const parser = new GetStatsParser();
      const jsonData = JSON.stringify([]);
      
      await expect(parser.parse(jsonData)).rejects.toThrow('没有找到有效的 getStats 数据');
    });
  });

  describe('SignalingParser', () => {
    it('should parse signaling events JSON', async () => {
      const parser = new SignalingParser();
      const jsonData = JSON.stringify([
        {
          timestamp: 1714644000000,
          type: 'offer',
          direction: 'send',
          sdp: 'v=0\r\n...'
        },
        {
          timestamp: 1714644001000,
          type: 'ice_candidate',
          direction: 'send',
          candidate: {
            candidate: 'candidate:0 1 UDP 2122252543 192.168.1.100 50000 typ host',
            sdpMid: '0',
            sdpMLineIndex: 0
          }
        }
      ]);
      
      const result = await parser.parse(jsonData);
      expect(result.events.length).toBe(2);
      expect(result.events[0].type).toBe('signaling_event');
    });

    it('should handle text format signaling logs', async () => {
      const parser = new SignalingParser();
      const textData = `2024-05-02T14:00:00.000Z [SEND] offer
2024-05-02T14:00:01.000Z [SEND] ice_candidate
2024-05-02T14:00:03.000Z [RECV] answer`;
      
      const result = await parser.parse(textData);
      expect(result.events.length).toBeGreaterThan(0);
    });
  });

  describe('UserNoteParser', () => {
    it('should parse user notes with timestamps', async () => {
      const parser = new UserNoteParser();
      const textData = `2024-05-02T14:00:00.000Z 开始远程庭审
2024-05-02T14:00:05.000Z [warning] 对方画面开始卡顿
2024-05-02T14:00:08.000Z [critical] 画面完全冻结`;
      
      const result = await parser.parse(textData);
      expect(result.events.length).toBe(3);
      expect(result.events[0].type).toBe('user_note');
    });

    it('should parse relative time notes', async () => {
      const parser = new UserNoteParser();
      const textData = `开始远程庭审
5s后 [warning] 对方画面开始卡顿
10s后 [critical] 画面完全冻结`;
      
      const result = await parser.parse(textData);
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should detect severity tags', async () => {
      const parser = new UserNoteParser();
      const textData = `2024-05-02T14:00:05.000Z [warning] 对方画面开始卡顿
2024-05-02T14:00:08.000Z [critical] 画面完全冻结
2024-05-02T14:00:15.000Z 画面恢复正常`;
      
      const result = await parser.parse(textData);
      
      const warningNote = result.events.find(e => 
        'severity' in e && e.severity === 'warning'
      );
      const criticalNote = result.events.find(e => 
        'severity' in e && e.severity === 'critical'
      );
      const infoNote = result.events.find(e => 
        'severity' in e && e.severity === 'info'
      );
      
      expect(warningNote).toBeDefined();
      expect(criticalNote).toBeDefined();
      expect(infoNote).toBeDefined();
    });
  });

  describe('ParserManager', () => {
    it('should auto-detect getStats JSON', async () => {
      const manager = new ParserManager();
      const jsonData = JSON.stringify([
        {
          timestamp: 1714644000000,
          reports: [
            {
              id: 'RTCInboundRTPVideo_1',
              type: 'inbound-rtp',
              kind: 'video',
              ssrc: '123456',
              packetsReceived: 500,
              packetsLost: 10,
              jitter: 0.01,
              bytesReceived: 500000
            }
          ]
        }
      ]);
      
      const result = await manager.parse(jsonData);
      expect(result.detectedType).toBe('getstats');
    });

    it('should auto-detect signaling JSON', async () => {
      const manager = new ParserManager();
      const jsonData = JSON.stringify([
        {
          timestamp: 1714644000000,
          type: 'offer',
          direction: 'send',
          sdp: 'v=0\r\n...'
        }
      ]);
      
      const result = await manager.parse(jsonData);
      expect(result.detectedType).toBe('signaling');
    });

    it('should parse multiple files with types', async () => {
      const manager = new ParserManager();
      
      const getStatsData = JSON.stringify([
        {
          timestamp: 1714644000000,
          reports: [
            {
              id: 'RTCInboundRTPVideo_1',
              type: 'inbound-rtp',
              kind: 'video',
              ssrc: '123456',
              packetsReceived: 500,
              packetsLost: 10,
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

      const [result1, result2, result3] = await Promise.all([
        manager.parse(getStatsData, { type: 'getstats' }),
        manager.parse(signalingData, { type: 'signaling' }),
        manager.parse(userNoteData, { type: 'usernote' })
      ]);

      expect(result1.detectedType).toBe('getstats');
      expect(result2.detectedType).toBe('signaling');
      expect(result3.detectedType).toBe('usernote');
    });
  });
});
