const path = require('path');
const CONFIG = require('./config');

class VideoRenamer {
  constructor() {
    this.results = {
      normal: [],
      abnormal: [],
      multiPart: [],
      typoFixed: []
    };
    this.processedFiles = new Set();
  }

  parseFilename(filename) {
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    
    const match = basename.match(CONFIG.NAMING_PATTERN.STANDARD);
    
    if (match) {
      return {
        success: true,
        date: match[CONFIG.NAMING_PATTERN.DATE_GROUP],
        courseName: match[CONFIG.NAMING_PATTERN.COURSE_NAME_GROUP],
        level: match[CONFIG.NAMING_PATTERN.LEVEL_GROUP],
        part: match[CONFIG.NAMING_PATTERN.PART_GROUP] || null,
        extension: ext,
        original: filename
      };
    }
    
    return {
      success: false,
      original: filename,
      reason: '文件名格式不符合规范'
    };
  }

  detectTypos(text) {
    const fixes = [];
    let corrected = text;
    
    for (const [typo, correct] of Object.entries(CONFIG.TYPO_CORRECTIONS)) {
      if (text.includes(typo)) {
        const regex = new RegExp(typo, 'g');
        corrected = corrected.replace(regex, correct);
        fixes.push({
          original: typo,
          corrected: correct,
          position: '文件名',
          confidence: this.calculateConfidence(typo, correct)
        });
      }
    }
    
    return { corrected, fixes };
  }

  calculateConfidence(typo, correct) {
    if (typo.length === correct.length) {
      let sameChars = 0;
      for (let i = 0; i < typo.length; i++) {
        if (typo[i] === correct[i]) sameChars++;
      }
      return sameChars / typo.length;
    }
    return 0.7;
  }

  generateStandardName(parsed, correctedCourseName = null) {
    const courseName = correctedCourseName || parsed.courseName;
    const parts = [
      parsed.date,
      courseName,
      parsed.level
    ];
    
    if (parsed.part) {
      parts.push(`P${parsed.part}`);
    }
    
    return `${parts.join('_')}${parsed.extension}`;
  }

  validateParsed(parsed) {
    const errors = [];
    
    if (!/^\d{6}$/.test(parsed.date)) {
      errors.push('日期格式无效，应为6位数字（如240519）');
    }
    
    if (!CONFIG.LEVELS.includes(parsed.level)) {
      errors.push(`难度等级 ${parsed.level} 不在有效范围内: ${CONFIG.LEVELS.join(', ')}`);
    }
    
    const isKnownCourse = CONFIG.COURSE_NAMES.some(c => 
      parsed.courseName.includes(c) || c.includes(parsed.courseName)
    );
    
    if (!isKnownCourse && parsed.courseName.length < 2) {
      errors.push('课程名称过短或不识别');
    }
    
    return errors;
  }

  processFile(filepath) {
    const filename = path.basename(filepath);
    const dir = path.dirname(filepath);
    
    if (this.processedFiles.has(filepath)) {
      return {
        skipped: true,
        reason: '文件已处理过（幂等性保护）'
      };
    }
    
    this.processedFiles.add(filepath);
    
    const ext = path.extname(filename).toLowerCase();
    if (!CONFIG.VIDEO_EXTENSIONS.includes(ext)) {
      this.results.abnormal.push({
        original: filename,
        path: filepath,
        type: '非视频文件',
        description: `文件扩展名 ${ext} 不在支持列表中`,
        suggestion: '确认是否为视频文件，或添加到支持扩展名列表'
      });
      return { skipped: true };
    }
    
    const parsed = this.parseFilename(filename);
    
    if (!parsed.success) {
      this.results.abnormal.push({
        original: filename,
        path: filepath,
        type: '命名格式错误',
        description: parsed.reason,
        suggestion: '请按照 日期_课程名_难度等级[_分段].扩展名 格式重命名'
      });
      return { error: parsed.reason };
    }
    
    const validationErrors = this.validateParsed(parsed);
    if (validationErrors.length > 0) {
      this.results.abnormal.push({
        original: filename,
        path: filepath,
        type: '内容验证失败',
        description: validationErrors.join('; '),
        suggestion: '修正对应字段后重新处理'
      });
      return { errors: validationErrors };
    }
    
    const { corrected, fixes } = this.detectTypos(parsed.courseName);
    
    if (fixes.length > 0) {
      fixes.forEach(fix => {
        this.results.typoFixed.push({
          ...fix,
          filename: filename
        });
      });
    }
    
    const newName = this.generateStandardName(parsed, corrected);
    
    this.results.normal.push({
      original: filename,
      newName: newName,
      path: filepath,
      date: parsed.date,
      courseName: corrected,
      level: parsed.level,
      part: parsed.part,
      status: fixes.length > 0 ? '已修正错别字' : '正常'
    });
    
    return {
      success: true,
      original: filename,
      newName: newName,
      typoFixed: fixes.length > 0
    };
  }

  detectMultiPartVideos() {
    const groups = new Map();
    
    this.results.normal.forEach(item => {
      const key = `${item.date}_${item.courseName}_${item.level}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    });
    
    groups.forEach((files, key) => {
      if (files.length > 1) {
        const hasParts = files.some(f => f.part);
        this.results.multiPart.push({
          lessonId: key,
          partCount: files.length,
          files: files.map(f => f.original).join('; '),
          pattern: hasParts ? '已分段命名' : '建议添加分段后缀 _P1, _P2 等',
          newNames: files.map(f => f.newName).join('; ')
        });
      }
    });
    
    return this.results.multiPart;
  }

  sortResults() {
    this.results.normal.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.courseName !== b.courseName) return a.courseName.localeCompare(b.courseName);
      if (a.level !== b.level) return a.level.localeCompare(b.level);
      return (a.part || '0').localeCompare(b.part || '0');
    });
    
    this.results.abnormal.sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.original.localeCompare(b.original);
    });
    
    this.results.multiPart.sort((a, b) => a.lessonId.localeCompare(b.lessonId));
    this.results.typoFixed.sort((a, b) => a.filename.localeCompare(b.filename));
  }

  getResults() {
    this.detectMultiPartVideos();
    this.sortResults();
    return this.results;
  }

  reset() {
    this.results = {
      normal: [],
      abnormal: [],
      multiPart: [],
      typoFixed: []
    };
    this.processedFiles.clear();
  }
}

module.exports = VideoRenamer;
