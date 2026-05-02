import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RuleEngine } from '../src/rule-engine.js';
import { ImageAnalyzer } from '../src/image-analyzer.js';

describe('RuleEngine', () => {
  describe('checkOverlap', () => {
    it('should detect overlapping regions', () => {
      const region1 = { x: 0, y: 0, width: 100, height: 100 };
      const region2 = { x: 50, y: 50, width: 100, height: 100 };
      assert.ok(ImageAnalyzer.checkOverlap(region1, region2));
    });

    it('should not detect non-overlapping regions', () => {
      const region1 = { x: 0, y: 0, width: 100, height: 100 };
      const region2 = { x: 200, y: 200, width: 100, height: 100 };
      assert.ok(!ImageAnalyzer.checkOverlap(region1, region2));
    });
  });

  describe('safe area violations', () => {
    it('should detect top safe area violation', () => {
      const safeArea = { top: 47, bottom: 34, left: 0, right: 0 };
      const textRegion = { x: 50, y: 40, width: 100, height: 40 };
      const targetSize = { width: 393, height: 852 };

      const violations = [];
      if (textRegion.y < safeArea.top) violations.push('top');
      assert.ok(violations.length > 0);
    });

    it('should detect bottom safe area violation', () => {
      const safeArea = { top: 47, bottom: 34, left: 0, right: 0 };
      const textRegion = { x: 50, y: 820, width: 100, height: 40 };
      const targetSize = { width: 393, height: 852 };

      const violations = [];
      if (textRegion.y + textRegion.height > targetSize.height - safeArea.bottom) violations.push('bottom');
      assert.ok(violations.length > 0);
    });
  });

  describe('truncation risk', () => {
    it('should detect truncation risk when region exceeds 95% width', () => {
      const targetSize = { width: 393, height: 852 };
      const region = { x: 370, y: 200, width: 30, height: 40 };
      const isAtRisk = region.x + region.width > targetSize.width * 0.95;
      assert.ok(isAtRisk);
    });

    it('should not detect truncation risk when region is within 95% width', () => {
      const targetSize = { width: 393, height: 852 };
      const region = { x: 340, y: 200, width: 30, height: 40 };
      const isAtRisk = region.x + region.width > targetSize.width * 0.95;
      assert.ok(!isAtRisk);
    });
  });
});