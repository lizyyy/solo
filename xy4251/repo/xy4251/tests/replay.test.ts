import { ReplayEngine, Timeline } from '../src/replay';
import { MqttMessage } from '../src/types';

describe('Timeline', () => {
  let timeline: Timeline;

  beforeEach(() => {
    timeline = new Timeline();
  });

  describe('addMessage', () => {
    it('should add message to timeline', () => {
      const message: MqttMessage = {
        id: 'msg-001',
        timestamp: Date.now(),
        topic: 'test/topic',
        payload: 'test payload',
        qos: 1,
        retain: false,
        dup: false,
        direction: 'in',
        clientId: 'test-client'
      };

      timeline.addMessage(message);
      const messages = timeline.getMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe('msg-001');
    });

    it('should sort messages by timestamp', () => {
      const now = Date.now();
      const messages: MqttMessage[] = [
        {
          id: 'msg-003',
          timestamp: now + 2000,
          topic: 'test/topic',
          payload: 'message 3',
          qos: 1,
          retain: false,
          dup: false,
          direction: 'in',
          clientId: 'test-client'
        },
        {
          id: 'msg-001',
          timestamp: now,
          topic: 'test/topic',
          payload: 'message 1',
          qos: 1,
          retain: false,
          dup: false,
          direction: 'in',
          clientId: 'test-client'
        },
        {
          id: 'msg-002',
          timestamp: now + 1000,
          topic: 'test/topic',
          payload: 'message 2',
          qos: 1,
          retain: false,
          dup: false,
          direction: 'in',
          clientId: 'test-client'
        }
      ];

      messages.forEach(m => timeline.addMessage(m));
      const sortedMessages = timeline.getMessages();

      expect(sortedMessages[0].id).toBe('msg-001');
      expect(sortedMessages[1].id).toBe('msg-002');
      expect(sortedMessages[2].id).toBe('msg-003');
    });
  });

  describe('getMessagesInRange', () => {
    it('should filter messages by time range', () => {
      const now = Date.now();
      const messages: MqttMessage[] = [
        {
          id: 'msg-001',
          timestamp: now - 10000,
          topic: 'test/topic',
          payload: 'old message',
          qos: 1,
          retain: false,
          dup: false,
          direction: 'in',
          clientId: 'test-client'
        },
        {
          id: 'msg-002',
          timestamp: now - 5000,
          topic: 'test/topic',
          payload: 'recent message',
          qos: 1,
          retain: false,
          dup: false,
          direction: 'in',
          clientId: 'test-client'
        },
        {
          id: 'msg-003',
          timestamp: now,
          topic: 'test/topic',
          payload: 'current message',
          qos: 1,
          retain: false,
          dup: false,
          direction: 'in',
          clientId: 'test-client'
        }
      ];

      messages.forEach(m => timeline.addMessage(m));
      const inRange = timeline.getMessagesInRange(now - 7000, now - 3000);

      expect(inRange.length).toBe(1);
      expect(inRange[0].id).toBe('msg-002');
    });
  });

  describe('getStatistics', () => {
    it('should provide statistics', () => {
      const now = Date.now();
      const messages: MqttMessage[] = [
        {
          id: 'msg-001',
          timestamp: now - 10000,
          topic: 'device-001/telemetry',
          payload: 'message 1',
          qos: 1,
          retain: false,
          dup: false,
          direction: 'in',
          clientId: 'device-001'
        },
        {
          id: 'msg-002',
          timestamp: now,
          topic: 'device-002/telemetry',
          payload: 'message 2',
          qos: 1,
          retain: false,
          dup: false,
          direction: 'in',
          clientId: 'device-002'
        }
      ];

      messages.forEach(m => timeline.addMessage(m));
      const stats = timeline.getStatistics();

      expect(stats.totalMessages).toBe(2);
      expect(stats.deviceCount).toBe(2);
      expect(stats.topicCount).toBe(2);
      expect(stats.duration).toBe(10000);
    });
  });
});

describe('ReplayEngine', () => {
  let replayEngine: ReplayEngine;

  beforeEach(() => {
    replayEngine = new ReplayEngine();
  });

  describe('replay', () => {
    it('should process messages in order', async () => {
      const now = Date.now();
      const messages: MqttMessage[] = [
        {
          id: 'msg-001',
          timestamp: now,
          topic: 'device-001/telemetry',
          payload: JSON.stringify({ temperature: 25 }),
          qos: 1,
          retain: false,
          dup: false,
          direction: 'in',
          clientId: 'device-001'
        },
        {
          id: 'msg-002',
          timestamp: now + 1000,
          topic: '$aws/things/device-001/shadow/update',
          payload: JSON.stringify({ version: 1, state: { reported: { status: 'online' } } }),
          qos: 1,
          retain: true,
          dup: false,
          direction: 'in',
          clientId: 'device-001'
        }
      ];

      replayEngine = new ReplayEngine(messages);
      const result = await replayEngine.replay();

      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should handle retained messages', async () => {
      const now = Date.now();
      const retainedMessage: MqttMessage = {
        id: 'msg-001',
        timestamp: now,
        topic: 'device-001/status',
        payload: JSON.stringify({ status: 'online' }),
        qos: 1,
        retain: true,
        dup: false,
        direction: 'in',
        clientId: 'device-001'
      };

      replayEngine = new ReplayEngine([retainedMessage]);
      const result = await replayEngine.replay();

      const retainedMessages = result.retainedMessages;
      expect(retainedMessages.size).toBe(1);
      expect(retainedMessages.get('device-001/status')).not.toBeUndefined();
    });

    it('should clear retained message with empty payload', async () => {
      const now = Date.now();
      const messages: MqttMessage[] = [
        {
          id: 'msg-001',
          timestamp: now,
          topic: 'device-001/status',
          payload: JSON.stringify({ status: 'online' }),
          qos: 1,
          retain: true,
          dup: false,
          direction: 'in',
          clientId: 'device-001'
        },
        {
          id: 'msg-002',
          timestamp: now + 1000,
          topic: 'device-001/status',
          payload: '',
          qos: 1,
          retain: true,
          dup: false,
          direction: 'in',
          clientId: 'device-001'
        }
      ];

      replayEngine = new ReplayEngine(messages);
      const result = await replayEngine.replay();

      expect(result.retainedMessages.size).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset replay state', async () => {
      const now = Date.now();
      const message: MqttMessage = {
        id: 'msg-001',
        timestamp: now,
        topic: 'device-001/telemetry',
        payload: JSON.stringify({ temperature: 25 }),
        qos: 1,
        retain: true,
        dup: false,
        direction: 'in',
        clientId: 'device-001'
      };

      replayEngine = new ReplayEngine([message]);
      await replayEngine.replay();

      const result1 = replayEngine.getResult();
      expect(result1.events.length).toBeGreaterThan(0);
      expect(result1.retainedMessages.size).toBe(1);

      replayEngine.reset();
      const result2 = replayEngine.getResult();
      expect(result2.events.length).toBe(0);
      expect(result2.retainedMessages.size).toBe(0);
    });
  });
});
