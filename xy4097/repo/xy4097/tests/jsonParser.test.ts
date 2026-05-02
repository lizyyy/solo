import { describe, it, expect } from 'vitest';
import { parseExhibitionJson, exportToJson } from '../src/parsers/jsonParser';
import { ExhibitionConfig } from '../src/types';

const validConfig: ExhibitionConfig = {
  version: '1.0.0',
  exhibitionName: '测试展览',
  exhibitionDate: '2026-01-01',
  venue: '测试展馆',
  floor: {
    width: 20,
    depth: 15,
    height: 0.1,
  },
  elements: [
    {
      id: 'entrance_1',
      type: 'entrance',
      name: '入口',
      position: { x: -9, z: 0 },
      dimensions: { width: 2, depth: 2, height: 0.1 },
    },
    {
      id: 'exit_1',
      type: 'exit',
      name: '出口',
      position: { x: 9, z: 0 },
      dimensions: { width: 2, depth: 2, height: 0.1 },
    },
    {
      id: 'exhibit_1',
      type: 'exhibit',
      name: '展柜1',
      position: { x: 0, z: 0 },
      dimensions: { width: 2, depth: 2, height: 2 },
    },
  ],
};

describe('jsonParser', () => {
  describe('parseExhibitionJson', () => {
    it('应该正确解析有效的 JSON 配置', () => {
      const jsonString = JSON.stringify(validConfig);
      const result = parseExhibitionJson(jsonString);
      
      expect(result.version).toBe('1.0.0');
      expect(result.exhibitionName).toBe('测试展览');
      expect(result.floor.width).toBe(20);
      expect(result.elements.length).toBe(3);
    });

    it('应该抛出错误如果 JSON 格式无效', () => {
      expect(() => parseExhibitionJson('invalid json')).toThrow();
    });

    it('应该抛出错误如果缺少必要字段', () => {
      const invalidConfig = { version: '1.0.0' };
      expect(() => parseExhibitionJson(JSON.stringify(invalidConfig))).toThrow();
    });

    it('应该抛出错误如果没有入口元素', () => {
      const configWithoutEntrance = {
        ...validConfig,
        elements: validConfig.elements.filter(e => e.type !== 'entrance'),
      };
      expect(() => parseExhibitionJson(JSON.stringify(configWithoutEntrance))).toThrow();
    });

    it('应该抛出错误如果没有出口元素', () => {
      const configWithoutExit = {
        ...validConfig,
        elements: validConfig.elements.filter(e => e.type !== 'exit'),
      };
      expect(() => parseExhibitionJson(JSON.stringify(configWithoutExit))).toThrow();
    });

    it('应该抛出错误如果有重复的元素 ID', () => {
      const configWithDuplicateId = {
        ...validConfig,
        elements: [
          ...validConfig.elements,
          {
            ...validConfig.elements[0],
            name: '重复ID',
          },
        ],
      };
      expect(() => parseExhibitionJson(JSON.stringify(configWithDuplicateId))).toThrow();
    });
  });

  describe('exportToJson', () => {
    it('应该正确导出配置为 JSON 字符串', () => {
      const jsonString = exportToJson(validConfig);
      const parsed = JSON.parse(jsonString);
      
      expect(parsed.version).toBe(validConfig.version);
      expect(parsed.exhibitionName).toBe(validConfig.exhibitionName);
      expect(parsed.elements.length).toBe(validConfig.elements.length);
    });

    it('导出的 JSON 应该可以重新解析', () => {
      const exported = exportToJson(validConfig);
      const reParsed = parseExhibitionJson(exported);
      
      expect(reParsed.version).toBe(validConfig.version);
      expect(reParsed.exhibitionName).toBe(validConfig.exhibitionName);
    });
  });
});
