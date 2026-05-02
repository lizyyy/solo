import { TimelineNormalizer } from '../src/timeline';
import { LogSource, TimestampedEvent } from '../src/types';

describe('TimelineNormalizer', () => {
  const createTestSource = (id: string, type: LogSource['type']): LogSource => ({
    id,
    name: `Source ${id}`,
    type,
    startTime: 1714644000000,
    endTime: 1714644015000
  });

  const createTestEvents = (baseTime: number, count: number): TimestampedEvent[] => {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: baseTime + i * 1000,
      type: 'test_event',
      source: 'getstats' as const
    }));
  };

  describe('normalize', () => {
    it('should normalize single source timeline', () => {
      const normalizer = new TimelineNormalizer();
      const source = createTestSource('1', 'getstats');
      const events = createTestEvents(1714644000000, 5);

      const result = normalizer.normalize([{ source, events }]);

      expect(result.events.length).toBe(5);
      expect(result.sources.length).toBe(1);
      expect(result.startTime).toBeLessThanOrEqual(result.endTime);
    });

    it('should normalize multiple sources with auto align', () => {
      const normalizer = new TimelineNormalizer();
      const source1 = createTestSource('1', 'getstats');
      const source2 = createTestSource('2', 'signaling');
      const source3 = createTestSource('3', 'usernote');

      const events1 = createTestEvents(1714644000000, 5);
      const events2 = createTestEvents(1714644002000, 5);
      const events3 = createTestEvents(1714644001000, 5);

      const result = normalizer.normalize(
        [
          { source: source1, events: events1 },
          { source: source2, events: events2 },
          { source: source3, events: events3 }
        ],
        { autoAlign: true }
      );

      expect(result.events.length).toBe(15);
      expect(result.sources.length).toBe(3);
    });

    it('should apply time alignments', () => {
      const normalizer = new TimelineNormalizer();
      const source1 = createTestSource('1', 'getstats');
      const source2 = createTestSource('2', 'signaling');

      const events1 = createTestEvents(1714644000000, 3);
      const events2 = createTestEvents(1714644005000, 3);

      const alignment = normalizer.createAlignment(
        '2',
        1714644005000,
        1714644000000
      );

      const result = normalizer.normalize(
        [
          { source: source1, events: events1 },
          { source: source2, events: events2 }
        ],
        { alignments: [alignment] }
      );

      expect(result.events.length).toBe(6);
    });

    it('should throw for empty sources', () => {
      const normalizer = new TimelineNormalizer();
      expect(() => normalizer.normalize([])).toThrow();
    });
  });

  describe('sliceTimeline', () => {
    it('should slice timeline within range', () => {
      const normalizer = new TimelineNormalizer();
      const source = createTestSource('1', 'getstats');
      const events = createTestEvents(1714644000000, 10);

      const timeline = normalizer.normalize([{ source, events }]);
      const sliced = normalizer.sliceTimeline(
        timeline,
        1714644002000,
        1714644007000
      );

      expect(sliced.startTime).toBe(1714644002000);
      expect(sliced.endTime).toBe(1714644007000);
    });
  });

  describe('getEventsInRange', () => {
    it('should return events within time range', () => {
      const normalizer = new TimelineNormalizer();
      const source = createTestSource('1', 'getstats');
      const events = createTestEvents(1714644000000, 10);

      const timeline = normalizer.normalize([{ source, events }]);
      const filtered = normalizer.getEventsInRange(
        timeline,
        1714644002000,
        1714644005000
      );

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(event => {
        expect(event.timestamp).toBeGreaterThanOrEqual(1714644002000);
        expect(event.timestamp).toBeLessThanOrEqual(1714644005000);
      });
    });
  });

  describe('getEventsByType', () => {
    it('should return events by type', () => {
      const normalizer = new TimelineNormalizer();
      const source = createTestSource('1', 'getstats');
      const events = createTestEvents(1714644000000, 5);

      const timeline = normalizer.normalize([{ source, events }]);
      const filtered = normalizer.getEventsByType(timeline, 'test_event');

      expect(filtered.length).toBe(5);
    });
  });

  describe('alignByEventTypes', () => {
    it('should create alignments based on event types', () => {
      const normalizer = new TimelineNormalizer();
      const source1 = createTestSource('1', 'getstats');
      const source2 = createTestSource('2', 'signaling');

      const events1: TimestampedEvent[] = [
        { timestamp: 1714644000000, type: 'start_call', source: 'getstats' },
        { timestamp: 1714644001000, type: 'test_event', source: 'getstats' }
      ];

      const events2: TimestampedEvent[] = [
        { timestamp: 1714644002000, type: 'start_call', source: 'signaling' },
        { timestamp: 1714644003000, type: 'test_event', source: 'signaling' }
      ];

      const alignments = normalizer.alignByEventTypes(
        [
          { source: source1, events: events1 },
          { source: source2, events: events2 }
        ],
        ['start_call']
      );

      expect(alignments.length).toBe(1);
    });
  });
});
