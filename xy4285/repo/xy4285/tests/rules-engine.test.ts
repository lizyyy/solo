import { RulesEngine } from '../src/rules-engine';
import { DeliveryRule, SubtitleFile, SubtitleCue } from '../src/types';

describe('RulesEngine', () => {
  let defaultRules: DeliveryRule;
  let engine: RulesEngine;

  beforeEach(() => {
    defaultRules = {
      platforms: [
        { name: 'TikTok', code: 'tiktok', requiredLanguages: ['zh', 'en', 'es'] }
      ],
      languages: [
        { code: 'zh', name: 'Chinese', readingSpeed: 8, maxLinesPerCue: 2 },
        { code: 'en', name: 'English', readingSpeed: 15, maxLinesPerCue: 2 }
      ],
      timing: {
        minGapBetweenCues: 40,
        minCueDuration: 300,
        maxCueDuration: 7000,
        allowOverlap: false
      },
      text: {
        allowEmptyLines: false,
        maxLineLength: 40,
        checkPunctuation: true
      },
      forbiddenWords: {
        enabled: true,
        words: ['敏感词', 'forbidden'],
        caseSensitive: false
      },
      naming: {
        pattern: '{platform}_{episode}_{language}.{ext}',
        requiredParts: ['platform', 'episode', 'language'],
        separator: '_'
      }
    };
    engine = new RulesEngine(defaultRules);
  });

  describe('Timing Validation', () => {
    it('should detect overlapping cues', () => {
      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 3500, text: 'First' },
          { id: '2', startTime: 3400, endTime: 5000, text: 'Second' }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateTiming(file);
      const overlapIssues = issues.filter(i => i.message.includes('重叠'));

      expect(overlapIssues.length).toBeGreaterThan(0);
      expect(overlapIssues[0].severity).toBe('error');
    });

    it('should detect cues that are too short', () => {
      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 1200, text: 'Too short' }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateTiming(file);
      const shortIssues = issues.filter(i => i.message.includes('过短'));

      expect(shortIssues.length).toBeGreaterThan(0);
      expect(shortIssues[0].severity).toBe('error');
    });

    it('should detect cues that are too long', () => {
      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 9000, text: 'Too long' }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateTiming(file);
      const longIssues = issues.filter(i => i.message.includes('过长'));

      expect(longIssues.length).toBeGreaterThan(0);
      expect(longIssues[0].severity).toBe('warning');
    });

    it('should detect gaps that are too small', () => {
      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 3000, text: 'First' },
          { id: '2', startTime: 3020, endTime: 5000, text: 'Second' }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateTiming(file);
      const gapIssues = issues.filter(i => i.message.includes('间隔'));

      expect(gapIssues.length).toBeGreaterThan(0);
      expect(gapIssues[0].severity).toBe('warning');
    });

    it('should pass valid timing', () => {
      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 3000, text: 'First' },
          { id: '2', startTime: 3100, endTime: 5000, text: 'Second' }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateTiming(file);

      expect(issues.length).toBe(0);
    });
  });

  describe('Reading Speed Validation', () => {
    it('should detect fast reading speed for Chinese', () => {
      const chineseText = '这是一段非常长的中文字幕，阅读速度会超过限制。';
      const charCount = chineseText.replace(/\s/g, '').length;
      const durationMs = 1000;
      const actualSpeed = charCount / (durationMs / 1000);

      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 2000, text: chineseText }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateReadingSpeed(file);
      const speedIssues = issues.filter(i => i.message.includes('阅读速度'));

      expect(speedIssues.length).toBeGreaterThan(0);
    });

    it('should detect too many lines per cue', () => {
      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 3000, text: 'Line 1\nLine 2\nLine 3' }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateReadingSpeed(file);
      const lineIssues = issues.filter(i => i.message.includes('行数过多'));

      expect(lineIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Forbidden Words Validation', () => {
    it('should detect forbidden Chinese words', () => {
      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 3000, text: '这里包含敏感词' }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateForbiddenWords(file);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].category).toBe('forbidden-word');
    });

    it('should detect forbidden English words case-insensitively', () => {
      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_en.srt',
        fileName: 'tiktok_ep001_en.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 3000, text: 'This has FORBIDDEN content' }
        ],
        language: 'en',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateForbiddenWords(file);

      expect(issues.length).toBeGreaterThan(0);
    });

    it('should not flag when forbidden words are disabled', () => {
      const rulesWithoutForbidden = { ...defaultRules };
      rulesWithoutForbidden.forbiddenWords.enabled = false;
      const disabledEngine = new RulesEngine(rulesWithoutForbidden);

      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 3000, text: '这里包含敏感词' }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = disabledEngine.validateForbiddenWords(file);

      expect(issues.length).toBe(0);
    });
  });

  describe('Text Validation', () => {
    it('should detect empty lines when not allowed', () => {
      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 3000, text: 'Line 1\n\nLine 2' }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateText(file);
      const emptyLineIssues = issues.filter(i => i.message.includes('空行'));

      expect(emptyLineIssues.length).toBeGreaterThan(0);
    });

    it('should detect lines that are too long', () => {
      const longLine = '这是一段非常非常非常非常非常非常非常非常长的文本，超过了每行最大长度限制';
      
      const file: SubtitleFile = {
        path: '/test/tiktok_ep001_zh.srt',
        fileName: 'tiktok_ep001_zh.srt',
        format: 'srt',
        cues: [
          { id: '1', startTime: 1000, endTime: 3000, text: longLine }
        ],
        language: 'zh',
        episode: '0001',
        platform: 'tiktok'
      };

      const issues = engine.validateText(file);
      const lengthIssues = issues.filter(i => i.message.includes('过长'));

      expect(lengthIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Naming Validation', () => {
    it('should detect wrong filename pattern', () => {
      const file: SubtitleFile = {
        path: '/test/wrong_name.srt',
        fileName: 'wrong_name.srt',
        format: 'srt',
        cues: [],
        language: 'unknown',
        episode: 'unknown',
        platform: 'unknown'
      };

      const issues = engine.validateNaming(file);

      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('Language Coverage', () => {
    it('should report missing languages', () => {
      const files: SubtitleFile[] = [
        {
          path: '/test/tiktok_ep001_zh.srt',
          fileName: 'tiktok_ep001_zh.srt',
          format: 'srt',
          cues: [],
          language: 'zh',
          episode: '0001',
          platform: 'tiktok'
        },
        {
          path: '/test/tiktok_ep001_en.srt',
          fileName: 'tiktok_ep001_en.srt',
          format: 'srt',
          cues: [],
          language: 'en',
          episode: '0001',
          platform: 'tiktok'
        }
      ];

      const platforms = [
        { name: 'TikTok', code: 'tiktok', requiredLanguages: ['zh', 'en', 'es'] }
      ];

      const coverage = engine.checkLanguageCoverage(files, platforms);

      expect(coverage.length).toBe(1);
      expect(coverage[0].complete).toBe(false);
      expect(coverage[0].missing).toContain('es');
    });

    it('should report complete coverage', () => {
      const files: SubtitleFile[] = [
        {
          path: '/test/tiktok_ep001_zh.srt',
          fileName: 'tiktok_ep001_zh.srt',
          format: 'srt',
          cues: [],
          language: 'zh',
          episode: '0001',
          platform: 'tiktok'
        },
        {
          path: '/test/tiktok_ep001_en.srt',
          fileName: 'tiktok_ep001_en.srt',
          format: 'srt',
          cues: [],
          language: 'en',
          episode: '0001',
          platform: 'tiktok'
        },
        {
          path: '/test/tiktok_ep001_es.srt',
          fileName: 'tiktok_ep001_es.srt',
          format: 'srt',
          cues: [],
          language: 'es',
          episode: '0001',
          platform: 'tiktok'
        }
      ];

      const platforms = [
        { name: 'TikTok', code: 'tiktok', requiredLanguages: ['zh', 'en', 'es'] }
      ];

      const coverage = engine.checkLanguageCoverage(files, platforms);

      expect(coverage.length).toBe(1);
      expect(coverage[0].complete).toBe(true);
      expect(coverage[0].missing.length).toBe(0);
    });
  });
});
