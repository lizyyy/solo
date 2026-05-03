import { TrajectoryParser } from '../../src/parser/trajectory-parser';
import { TabTrajectory } from '../../src/types';

describe('TrajectoryParser', () => {
  describe('parse', () => {
    it('应该正确解析有效的轨迹 JSON', () => {
      const jsonString = JSON.stringify({
        pageUrl: 'http://example.com',
        snapshotId: 'test-123',
        timestamp: 1234567890,
        items: [
          {
            timestamp: 1234567890,
            selector: '#button1',
            xpath: '//button[1]',
            tagName: 'BUTTON',
            textContent: '点击我',
            ariaLabel: null,
            visible: true,
            isFocused: true,
            isModal: false
          }
        ],
        metadata: {
          browser: 'Chrome 120',
          viewport: {
            width: 1920,
            height: 1080
          }
        }
      });

      const parser = new TrajectoryParser();
      const result = parser.parse(jsonString);

      expect(result.pageUrl).toBe('http://example.com');
      expect(result.snapshotId).toBe('test-123');
      expect(result.items.length).toBe(1);
      expect(result.items[0].selector).toBe('#button1');
      expect(result.metadata.browser).toBe('Chrome 120');
    });

    it('应该对缺失字段使用默认值', () => {
      const jsonString = JSON.stringify({
        pageUrl: 'http://example.com',
        items: []
      });

      const parser = new TrajectoryParser();
      const result = parser.parse(jsonString);

      expect(result.pageUrl).toBe('http://example.com');
      expect(result.items).toEqual([]);
      expect(result.metadata.browser).toBe('Unknown');
    });

    it('应该抛出错误当不是有效的 JSON', () => {
      const parser = new TrajectoryParser();
      expect(() => parser.parse('invalid json')).toThrow();
    });
  });

  describe('analyzeTrajectory', () => {
    it('应该分析轨迹的基本统计', () => {
      const trajectory: TabTrajectory = {
        pageUrl: 'http://example.com',
        snapshotId: 'test-123',
        timestamp: Date.now(),
        items: [
          {
            timestamp: Date.now(),
            selector: '#a',
            xpath: '//a',
            tagName: 'A',
            textContent: 'Link 1',
            ariaLabel: null,
            visible: true,
            isFocused: true,
            isModal: false
          },
          {
            timestamp: Date.now() + 100,
            selector: '#b',
            xpath: '//button',
            tagName: 'BUTTON',
            textContent: 'Button',
            ariaLabel: null,
            visible: true,
            isFocused: true,
            isModal: false
          }
        ],
        metadata: {
          browser: 'Chrome',
          viewport: { width: 1920, height: 1080 }
        }
      };

      const parser = new TrajectoryParser();
      const analysis = parser.analyzeTrajectory(trajectory);

      expect(analysis.totalItems).toBe(2);
      expect(analysis.uniqueElements).toBe(2);
      expect(analysis.visibleCount).toBe(2);
      expect(analysis.transitions.length).toBe(1);
    });

    it('应该检测上下文变化', () => {
      const trajectory: TabTrajectory = {
        pageUrl: 'http://example.com',
        snapshotId: 'test-123',
        timestamp: Date.now(),
        items: [
          {
            timestamp: Date.now(),
            selector: '#a',
            xpath: '//a',
            tagName: 'A',
            textContent: 'Link',
            ariaLabel: null,
            visible: true,
            isFocused: true,
            isModal: false
          },
          {
            timestamp: Date.now() + 100,
            selector: '#modal-btn',
            xpath: '//div/button',
            tagName: 'BUTTON',
            textContent: 'Modal Button',
            ariaLabel: null,
            visible: true,
            isFocused: true,
            isModal: true
          },
          {
            timestamp: Date.now() + 200,
            selector: '#a',
            xpath: '//a',
            tagName: 'A',
            textContent: 'Link',
            ariaLabel: null,
            visible: true,
            isFocused: true,
            isModal: false
          }
        ],
        metadata: {
          browser: 'Chrome',
          viewport: { width: 1920, height: 1080 }
        }
      };

      const parser = new TrajectoryParser();
      const analysis = parser.analyzeTrajectory(trajectory);

      expect(analysis.entersModal).toBe(true);
      expect(analysis.exitsModal).toBe(true);
      expect(analysis.contextChanges.length).toBe(2);
    });

    it('应该检测可见性变化', () => {
      const trajectory: TabTrajectory = {
        pageUrl: 'http://example.com',
        snapshotId: 'test-123',
        timestamp: Date.now(),
        items: [
          {
            timestamp: Date.now(),
            selector: '#visible',
            xpath: '//button[1]',
            tagName: 'BUTTON',
            textContent: 'Visible',
            ariaLabel: null,
            visible: true,
            isFocused: true,
            isModal: false
          },
          {
            timestamp: Date.now() + 100,
            selector: '#hidden',
            xpath: '//button[2]',
            tagName: 'BUTTON',
            textContent: 'Hidden',
            ariaLabel: null,
            visible: false,
            isFocused: true,
            isModal: false
          }
        ],
        metadata: {
          browser: 'Chrome',
          viewport: { width: 1920, height: 1080 }
        }
      };

      const parser = new TrajectoryParser();
      const analysis = parser.analyzeTrajectory(trajectory);

      expect(analysis.visibilityChanges.length).toBe(1);
      expect(analysis.hiddenCount).toBe(1);
    });
  });
});
