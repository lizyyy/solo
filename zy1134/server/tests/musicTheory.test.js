import { describe, it, expect } from 'vitest';
import {
  getNoteIndex,
  getNoteName,
  getSemitones,
  getScaleDegrees,
  getChordNotes,
  getInversion,
  analyzeError,
  ERROR_TAGS,
} from '../src/utils/musicTheory.js';

describe('音乐理论工具函数', () => {
  describe('音符索引计算', () => {
    it('应该正确计算升号音符的索引', () => {
      expect(getNoteIndex('C')).toBe(0);
      expect(getNoteIndex('C#')).toBe(1);
      expect(getNoteIndex('D')).toBe(2);
      expect(getNoteIndex('E')).toBe(4);
      expect(getNoteIndex('G')).toBe(7);
      expect(getNoteIndex('B')).toBe(11);
    });

    it('应该正确计算降号音符的索引', () => {
      expect(getNoteIndex('Db')).toBe(1);
      expect(getNoteIndex('Eb')).toBe(3);
      expect(getNoteIndex('Gb')).toBe(6);
      expect(getNoteIndex('Ab')).toBe(8);
      expect(getNoteIndex('Bb')).toBe(10);
    });

    it('无效音符应该返回 -1', () => {
      expect(getNoteIndex('H')).toBe(-1);
      expect(getNoteIndex('')).toBe(-1);
      expect(getNoteIndex(null)).toBe(-1);
    });
  });

  describe('音符名称获取', () => {
    it('应该正确获取升号音符名称', () => {
      expect(getNoteName(0)).toBe('C');
      expect(getNoteName(1)).toBe('C#');
      expect(getNoteName(4)).toBe('E');
      expect(getNoteName(7)).toBe('G');
      expect(getNoteName(11)).toBe('B');
    });

    it('应该正确获取降号音符名称', () => {
      expect(getNoteName(1, false)).toBe('Db');
      expect(getNoteName(3, false)).toBe('Eb');
      expect(getNoteName(6, false)).toBe('Gb');
      expect(getNoteName(8, false)).toBe('Ab');
      expect(getNoteName(10, false)).toBe('Bb');
    });

    it('应该正确处理超出范围的索引', () => {
      expect(getNoteName(12)).toBe('C');
      expect(getNoteName(13)).toBe('C#');
      expect(getNoteName(-1)).toBe('B');
      expect(getNoteName(24)).toBe('C');
    });
  });

  describe('半音数计算', () => {
    it('应该正确计算两个音符之间的半音数', () => {
      expect(getSemitones('C', 'C')).toBe(0);
      expect(getSemitones('C', 'C#')).toBe(1);
      expect(getSemitones('C', 'D')).toBe(2);
      expect(getSemitones('C', 'E')).toBe(4);
      expect(getSemitones('C', 'G')).toBe(7);
      expect(getSemitones('C', 'B')).toBe(11);
    });

    it('应该正确处理降号音符', () => {
      expect(getSemitones('C', 'Db')).toBe(1);
      expect(getSemitones('Db', 'Eb')).toBe(2);
    });

    it('无效音符应该返回 null', () => {
      expect(getSemitones('C', 'H')).toBeNull();
      expect(getSemitones('X', 'C')).toBeNull();
    });
  });

  describe('音阶音级计算', () => {
    it('应该正确计算大调音阶', () => {
      expect(getScaleDegrees('C', 'major')).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
      expect(getScaleDegrees('G', 'major')).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F#']);
      expect(getScaleDegrees('D', 'major')).toEqual(['D', 'E', 'F#', 'G', 'A', 'B', 'C#']);
    });

    it('应该正确使用降号表示带降号的调', () => {
      expect(getScaleDegrees('F', 'major')).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
      expect(getScaleDegrees('Bb', 'major')).toEqual(['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A']);
    });

    it('应该正确计算自然小调音阶', () => {
      expect(getScaleDegrees('A', 'natural_minor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
      expect(getScaleDegrees('E', 'natural_minor')).toEqual(['E', 'F#', 'G', 'A', 'B', 'C', 'D']);
    });

    it('应该正确计算和声小调音阶', () => {
      expect(getScaleDegrees('A', 'harmonic_minor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G#']);
    });

    it('无效调性应该返回 null', () => {
      expect(getScaleDegrees('X', 'major')).toBeNull();
    });
  });

  describe('和弦构成计算', () => {
    it('应该正确计算大三和弦', () => {
      expect(getChordNotes('C', 'major', false)).toEqual(['C', 'E', 'G']);
      expect(getChordNotes('G', 'major', false)).toEqual(['G', 'B', 'D']);
      expect(getChordNotes('F', 'major', false)).toEqual(['F', 'A', 'C']);
    });

    it('应该正确计算小三和弦', () => {
      expect(getChordNotes('C', 'minor', false)).toEqual(['C', 'Eb', 'G']);
      expect(getChordNotes('A', 'minor', false)).toEqual(['A', 'C', 'E']);
      expect(getChordNotes('D', 'minor', false)).toEqual(['D', 'F', 'A']);
    });

    it('应该正确计算减三和弦', () => {
      expect(getChordNotes('B', 'diminished', false)).toEqual(['B', 'D', 'F']);
      expect(getChordNotes('E', 'diminished', false)).toEqual(['E', 'G', 'Bb']);
    });

    it('应该正确计算七和弦', () => {
      expect(getChordNotes('C', 'major_seventh', true)).toEqual(['C', 'E', 'G', 'B']);
      expect(getChordNotes('C', 'minor_seventh', true)).toEqual(['C', 'Eb', 'G', 'Bb']);
      expect(getChordNotes('G', 'dominant_seventh', true)).toEqual(['G', 'B', 'D', 'F']);
      expect(getChordNotes('B', 'diminished_seventh', true)).toEqual(['B', 'D', 'F', 'Ab']);
    });

    it('无效和弦类型应该返回 null', () => {
      expect(getChordNotes('C', 'invalid', false)).toBeNull();
    });

    it('无效根音应该返回 null', () => {
      expect(getChordNotes('X', 'major', false)).toBeNull();
    });
  });

  describe('转位计算', () => {
    it('原位和弦应该保持不变', () => {
      expect(getInversion(['C', 'E', 'G'], 0)).toEqual(['C', 'E', 'G']);
    });

    it('第一转位应该正确计算', () => {
      expect(getInversion(['C', 'E', 'G'], 1)).toEqual(['E', 'G', 'C']);
    });

    it('第二转位应该正确计算', () => {
      expect(getInversion(['C', 'E', 'G'], 2)).toEqual(['G', 'C', 'E']);
    });

    it('七和弦转位应该正确计算', () => {
      const dom7 = ['G', 'B', 'D', 'F'];
      expect(getInversion(dom7, 0)).toEqual(['G', 'B', 'D', 'F']);
      expect(getInversion(dom7, 1)).toEqual(['B', 'D', 'F', 'G']);
      expect(getInversion(dom7, 2)).toEqual(['D', 'F', 'G', 'B']);
      expect(getInversion(dom7, 3)).toEqual(['F', 'G', 'B', 'D']);
    });
  });

  describe('错因标签定义', () => {
    it('应该包含所有必要的错因标签', () => {
      expect(ERROR_TAGS).toHaveProperty('wrong_key');
      expect(ERROR_TAGS).toHaveProperty('missed_accidental');
      expect(ERROR_TAGS).toHaveProperty('wrong_degree');
      expect(ERROR_TAGS).toHaveProperty('missing_note');
      expect(ERROR_TAGS).toHaveProperty('wrong_inversion');
      expect(ERROR_TAGS).toHaveProperty('wrong_cadence');
      expect(ERROR_TAGS).toHaveProperty('wrong_roman_numeral');
      expect(ERROR_TAGS).toHaveProperty('wrong_chord_type');
    });

    it('每个错因标签应该包含必要的字段', () => {
      Object.values(ERROR_TAGS).forEach((tag) => {
        expect(tag).toHaveProperty('label');
        expect(tag).toHaveProperty('description');
        expect(tag).toHaveProperty('category');
      });
    });
  });

  describe('错因分析', () => {
    describe('音阶音级识别错误分析', () => {
      it('应该正确识别调性错误', () => {
        const question = { type: 'scale_identification' };
        const userAnswer = { key: 'D', degree: 3, note: 'F#' };
        const correctAnswer = { key: 'C', degree: 3, note: 'E' };
        
        const errors = analyzeError(question, userAnswer, correctAnswer);
        expect(errors).toContain('wrong_key');
      });

      it('应该正确识别级数错误', () => {
        const question = { type: 'scale_identification' };
        const userAnswer = { key: 'C', degree: 4, note: 'F' };
        const correctAnswer = { key: 'C', degree: 3, note: 'E' };
        
        const errors = analyzeError(question, userAnswer, correctAnswer);
        expect(errors).toContain('wrong_degree');
      });

      it('应该同时识别调性和级数错误', () => {
        const question = { type: 'scale_identification' };
        const userAnswer = { key: 'D', degree: 4, note: 'G' };
        const correctAnswer = { key: 'C', degree: 3, note: 'E' };
        
        const errors = analyzeError(question, userAnswer, correctAnswer);
        expect(errors).toContain('wrong_key');
        expect(errors).toContain('wrong_degree');
      });
    });

    describe('和弦构成错误分析', () => {
      it('应该正确识别和弦类型错误', () => {
        const question = { type: 'chord_construction' };
        const userAnswer = { chordType: 'minor', notes: ['C', 'Eb', 'G'] };
        const correctAnswer = { chordType: 'major', notes: ['C', 'E', 'G'] };
        
        const errors = analyzeError(question, userAnswer, correctAnswer);
        expect(errors).toContain('wrong_chord_type');
      });

      it('应该正确识别和弦音漏音', () => {
        const question = { type: 'chord_construction' };
        const userAnswer = { chordType: 'major', notes: ['C', 'G'] };
        const correctAnswer = { chordType: 'major', notes: ['C', 'E', 'G'] };
        
        const errors = analyzeError(question, userAnswer, correctAnswer);
        expect(errors).toContain('missing_note');
      });
    });

    describe('转位错误分析', () => {
      it('应该正确识别转位判断错误', () => {
        const question = { type: 'inversion' };
        const userAnswer = { inversion: 0, bassNote: 'C' };
        const correctAnswer = { inversion: 1, bassNote: 'E' };
        
        const errors = analyzeError(question, userAnswer, correctAnswer);
        expect(errors).toContain('wrong_inversion');
      });
    });

    describe('罗马数字错误分析', () => {
      it('应该正确识别罗马数字错误', () => {
        const question = { type: 'roman_numeral' };
        const userAnswer = { romanNumeral: 'IV', function: '下属功能' };
        const correctAnswer = { romanNumeral: 'V', function: '属功能' };
        
        const errors = analyzeError(question, userAnswer, correctAnswer);
        expect(errors).toContain('wrong_roman_numeral');
      });
    });

    describe('终止式错误分析', () => {
      it('应该正确识别终止式类型错误', () => {
        const question = { type: 'cadence' };
        const userAnswer = { cadenceType: 'plagal', progression: ['IV', 'I'] };
        const correctAnswer = { cadenceType: 'authentic', progression: ['V', 'I'] };
        
        const errors = analyzeError(question, userAnswer, correctAnswer);
        expect(errors).toContain('wrong_cadence');
      });
    });
  });
});

describe('实际场景测试', () => {
  describe('常见题目测试', () => {
    it('C 大调各级音应该正确', () => {
      const cMajor = getScaleDegrees('C', 'major');
      expect(cMajor[0]).toBe('C');
      expect(cMajor[1]).toBe('D');
      expect(cMajor[2]).toBe('E');
      expect(cMajor[3]).toBe('F');
      expect(cMajor[4]).toBe('G');
      expect(cMajor[5]).toBe('A');
      expect(cMajor[6]).toBe('B');
    });

    it('C 大调各级三和弦应该正确', () => {
      expect(getChordNotes('C', 'major', false)).toEqual(['C', 'E', 'G']);
      expect(getChordNotes('D', 'minor', false)).toEqual(['D', 'F', 'A']);
      expect(getChordNotes('E', 'minor', false)).toEqual(['E', 'G', 'B']);
      expect(getChordNotes('F', 'major', false)).toEqual(['F', 'A', 'C']);
      expect(getChordNotes('G', 'major', false)).toEqual(['G', 'B', 'D']);
      expect(getChordNotes('A', 'minor', false)).toEqual(['A', 'C', 'E']);
      expect(getChordNotes('B', 'diminished', false)).toEqual(['B', 'D', 'F']);
    });

    it('G 属七和弦应该正确', () => {
      const gDom7 = getChordNotes('G', 'dominant_seventh', true);
      expect(gDom7).toEqual(['G', 'B', 'D', 'F']);
      
      expect(getInversion(gDom7, 0)).toEqual(['G', 'B', 'D', 'F']);
      expect(getInversion(gDom7, 1)).toEqual(['B', 'D', 'F', 'G']);
      expect(getInversion(gDom7, 2)).toEqual(['D', 'F', 'G', 'B']);
      expect(getInversion(gDom7, 3)).toEqual(['F', 'G', 'B', 'D']);
    });
  });

  describe('实际答题场景测试', () => {
    it('学生把 C 大调 III 级音当成 D 应该被标记为级数错误', () => {
      const question = { type: 'scale_identification' };
      const userAnswer = { key: 'C', degree: 2, note: 'D' };
      const correctAnswer = { key: 'C', degree: 3, note: 'E' };
      
      const errors = analyzeError(question, userAnswer, correctAnswer);
      expect(errors).toContain('wrong_degree');
      expect(errors).not.toContain('wrong_key');
    });

    it('学生把 G 大调当成 C 大调应该被标记为调性错误', () => {
      const question = { type: 'scale_identification' };
      const userAnswer = { key: 'G', degree: 5, note: 'D' };
      const correctAnswer = { key: 'C', degree: 3, note: 'E' };
      
      const errors = analyzeError(question, userAnswer, correctAnswer);
      expect(errors).toContain('wrong_key');
    });

    it('学生把大三和弦当成小三和弦应该被标记为和弦类型错误', () => {
      const question = { type: 'chord_construction' };
      const userAnswer = { chordType: 'minor', notes: ['C', 'Eb', 'G'] };
      const correctAnswer = { chordType: 'major', notes: ['C', 'E', 'G'] };
      
      const errors = analyzeError(question, userAnswer, correctAnswer);
      expect(errors).toContain('wrong_chord_type');
    });

    it('学生把 V -> I 当成 IV -> I 应该被标记为终止式错误', () => {
      const question = { type: 'cadence' };
      const userAnswer = { cadenceType: 'plagal' };
      const correctAnswer = { cadenceType: 'authentic' };
      
      const errors = analyzeError(question, userAnswer, correctAnswer);
      expect(errors).toContain('wrong_cadence');
    });
  });
});
