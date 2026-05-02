import { describe, it, expect } from 'vitest';
import { evaluateAllRisks, getTotalDuration } from '@/risk';
import { defaultProject } from '@/data/defaultProject';

describe('risk engine', () => {
  describe('getTotalDuration', () => {
    it('should calculate correct duration from default project', () => {
      const duration = getTotalDuration(defaultProject);
      expect(duration).toBeGreaterThan(0);
    });

    it('should handle empty timelines', () => {
      const projectWithNoTimelines = {
        ...defaultProject,
        actorTimelines: [],
        rigTimelines: [],
        lightTimelines: [],
        scenes: [],
      };
      const duration = getTotalDuration(projectWithNoTimelines);
      expect(duration).toBe(0);
    });
  });

  describe('evaluateAllRisks', () => {
    it('should generate risk map for default project', () => {
      const risks = evaluateAllRisks(defaultProject, 5);
      expect(risks).toBeInstanceOf(Map);
    });

    it('should sample at specified intervals', () => {
      const risks = evaluateAllRisks(defaultProject, 10);
      const times = Array.from(risks.keys());
      times.forEach((time) => {
        expect(time % 10).toBeLessThan(0.0001);
      });
    });
  });
});
