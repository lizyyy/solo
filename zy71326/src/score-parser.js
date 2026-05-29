const fs = require('fs');
const path = require('path');
const { normalizeNote, parseChord } = require('./music-theory');

class ScoreParser {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  parseFile(filePath) {
    this.errors = [];
    this.warnings = [];
    
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (ext === '.json') {
        return this.parseJSON(content, filePath);
      } else if (ext === '.txt' || ext === '.md') {
        return this.parseText(content, filePath);
      } else {
        return this.parseAuto(content, filePath);
      }
    } catch (err) {
      this.errors.push({
        type: 'file_read_error',
        message: `无法读取文件: ${err.message}`,
        file: filePath,
        line: null
      });
      return null;
    }
  }

  parseJSON(content, filePath = 'unknown') {
    try {
      const data = JSON.parse(content);
      return this.validateAndNormalize(data, filePath);
    } catch (err) {
      const match = err.message.match(/position (\d+)/);
      let line = null;
      if (match) {
        const position = parseInt(match[1], 10);
        line = content.substring(0, position).split('\n').length;
      }
      this.errors.push({
        type: 'json_parse_error',
        message: `JSON解析失败: ${err.message}`,
        file: filePath,
        line
      });
      return null;
    }
  }

  parseText(content, filePath = 'unknown') {
    const lines = content.split('\n');
    const score = {
      title: '',
      originalKey: 'C',
      parts: [],
      metadata: {}
    };

    let currentPart = null;
    let currentSection = null;
    let currentMeasure = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      if (!trimmed) continue;

      if (trimmed.startsWith('# ')) {
        score.title = trimmed.substring(2).trim();
        continue;
      }

      const keyMatch = trimmed.match(/^调号[:：]\s*([A-G][#b]?m?)/i);
      if (keyMatch) {
        score.originalKey = keyMatch[1];
        continue;
      }

      const partMatch = trimmed.match(/^##\s+(.+)$/);
      if (partMatch) {
        const partName = partMatch[1].trim();
        currentPart = {
          name: partName,
          sections: []
        };
        score.parts.push(currentPart);
        currentSection = null;
        continue;
      }

      const sectionMatch = trimmed.match(/^###\s+(.+)$/);
      if (sectionMatch && currentPart) {
        const sectionName = sectionMatch[1].trim();
        currentSection = {
          name: sectionName,
          measures: [],
          chords: [],
          lyrics: []
        };
        currentPart.sections.push(currentSection);
        currentMeasure = null;
        continue;
      }

      if (currentSection) {
        if (trimmed.startsWith('|')) {
          const measureData = this.parseMeasureLine(trimmed, lineNum, filePath);
          if (measureData) {
            currentSection.measures.push(measureData);
          }
          continue;
        }

        if (trimmed.match(/^[A-G][#b]?/)) {
          const chordData = this.parseChordLine(trimmed, lineNum, filePath);
          if (chordData) {
            currentSection.chords.push(chordData);
          }
          continue;
        }

        if (trimmed.startsWith('"') || trimmed.match(/[\u4e00-\u9fa5]/)) {
          currentSection.lyrics.push({
            text: trimmed,
            line: lineNum,
            file: filePath
          });
          continue;
        }
      }

      this.warnings.push({
        type: 'unrecognized_line',
        message: `无法识别的内容格式，已跳过`,
        file: filePath,
        line: lineNum,
        content: trimmed.substring(0, 50)
      });
    }

    if (score.parts.length === 0) {
      this.errors.push({
        type: 'no_parts_found',
        message: '未找到任何声部数据，请检查文件格式是否正确',
        file: filePath,
        line: null
      });
      return null;
    }

    return this.validateAndNormalize(score, filePath);
  }

  parseAuto(content, filePath) {
    if (content.trim().startsWith('{')) {
      return this.parseJSON(content, filePath);
    }
    return this.parseText(content, filePath);
  }

  parseMeasureLine(line, lineNum, filePath) {
    try {
      const parts = line.split('|').filter(p => p.trim());
      const notes = parts.map(p => p.trim().split(/\s+/)).flat();
      
      return {
        notes: notes.map(n => {
          const normalized = normalizeNote(n);
          if (!normalized) {
            this.warnings.push({
              type: 'invalid_note',
              message: `音符 "${n}" 格式可能有误，已保留原值`,
              file: filePath,
              line: lineNum
            });
          }
          return { original: n, normalized };
        }),
        line: lineNum
      };
    } catch (err) {
      this.errors.push({
        type: 'measure_parse_error',
        message: `解析小节失败: ${err.message}`,
        file: filePath,
        line: lineNum
      });
      return null;
    }
  }

  parseChordLine(line, lineNum, filePath) {
    const chords = line.split(/\s+/);
    return {
      chords: chords.map(c => {
        const parsed = parseChord(c);
        if (!parsed || parsed.unparsed) {
          this.warnings.push({
            type: 'invalid_chord',
            message: `和弦 "${c}" 格式可能有误，已保留原值`,
            file: filePath,
            line: lineNum
          });
        }
        return { original: c, parsed };
      }),
      line: lineNum
    };
  }

  validateAndNormalize(score, filePath) {
    const errors = [];

    if (!score.title) {
      this.warnings.push({
        type: 'missing_title',
        message: '未找到曲谱标题',
        file: filePath,
        line: null
      });
      score.title = '未命名曲谱';
    }

    if (!score.originalKey) {
      this.warnings.push({
        type: 'missing_key',
        message: '未指定原调，默认使用C调',
        file: filePath,
        line: null
      });
      score.originalKey = 'C';
    }

    if (!score.parts || !Array.isArray(score.parts)) {
      errors.push({
        type: 'invalid_parts',
        message: '声部数据格式不正确',
        file: filePath,
        line: null
      });
    } else if (score.parts.length === 0) {
      this.warnings.push({
        type: 'empty_parts',
        message: '未包含任何声部',
        file: filePath,
        line: null
      });
    } else {
      score.parts.forEach((part, partIndex) => {
        if (!part.name) {
          this.warnings.push({
            type: 'unnamed_part',
            message: `第 ${partIndex + 1} 个声部未命名`,
            file: filePath,
            line: null
          });
          part.name = `声部 ${partIndex + 1}`;
        }

        if (!part.sections || !Array.isArray(part.sections)) {
          part.sections = [];
        }

        part.sections.forEach((section, secIndex) => {
          if (!section.name) {
            section.name = `段落 ${secIndex + 1}`;
          }
          if (!section.measures) section.measures = [];
          if (!section.chords) section.chords = [];
          if (!section.lyrics) section.lyrics = [];

          section.measures = section.measures.map((measure, measIndex) => {
            if (measure.notes && Array.isArray(measure.notes)) {
              return {
                notes: measure.notes.map(n => {
                  if (typeof n === 'string') {
                    return { original: n, normalized: normalizeNote(n) };
                  }
                  return n;
                }),
                line: measure.line
              };
            }
            return measure;
          });

          section.chords = section.chords.map((chordLine, chordIndex) => {
            if (chordLine.chords && Array.isArray(chordLine.chords)) {
              return {
                chords: chordLine.chords.map(c => {
                  if (typeof c === 'string') {
                    return { original: c, parsed: parseChord(c) };
                  }
                  return c;
                }),
                line: chordLine.line
              };
            }
            return chordLine;
          });
        });
      });
    }

    if (errors.length > 0) {
      errors.forEach(e => this.errors.push(e));
      return null;
    }

    return score;
  }

  getErrors() {
    return this.errors;
  }

  getWarnings() {
    return this.warnings;
  }
}

module.exports = ScoreParser;
