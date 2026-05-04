const path = require('path');
const config = require('../config');

class VoicePartValidator {
  constructor() {
    this.voiceParts = config.validators.voiceParts;
    this.rules = {
      女高: ['女高', 'soprano', '高音部'],
      女低: ['女低', 'alto', '低音部', '女中音'],
      男高: ['男高', 'tenor', '男高音'],
      男低: ['男低', 'bass', '男低音']
    };
  }
  
  detectVoicePart(filename) {
    const lowerName = filename.toLowerCase();
    for (const [part, keywords] of Object.entries(this.rules)) {
      for (const keyword of keywords) {
        if (lowerName.includes(keyword.toLowerCase())) {
          return part;
        }
      }
    }
    return null;
  }
  
  extractScoreFiles(files) {
    const scoreFiles = [];
    for (const file of files) {
      if (path.extname(file.name).toLowerCase() === '.pdf') {
        const voicePart = this.detectVoicePart(file.name);
        if (voicePart) {
          scoreFiles.push({
            ...file,
            voicePart
          });
        }
      }
    }
    return scoreFiles;
  }
  
  validate(files) {
    const risks = [];
    const scoreFiles = this.extractScoreFiles(files);
    
    const foundParts = new Set(scoreFiles.map(f => f.voicePart));
    const missingParts = this.voiceParts.filter(p => !foundParts.has(p));
    const extraParts = [];
    
    for (const part of foundParts) {
      if (!this.voiceParts.includes(part)) {
        extraParts.push(part);
      }
    }
    
    if (missingParts.length > 0) {
      risks.push({
        type: 'voice_part',
        severity: 'critical',
        category: '完整性',
        message: `缺少分声部乐谱: ${missingParts.join(', ')}`,
        details: {
          expected: this.voiceParts,
          found: Array.from(foundParts),
          missing: missingParts
        }
      });
    }
    
    if (extraParts.length > 0) {
      risks.push({
        type: 'voice_part',
        severity: 'warning',
        category: '完整性',
        message: `发现未预期的声部: ${extraParts.join(', ')}`,
        details: {
          expected: this.voiceParts,
          found: Array.from(foundParts),
          extra: extraParts
        }
      });
    }
    
    const partCounts = {};
    for (const file of scoreFiles) {
      partCounts[file.voicePart] = (partCounts[file.voicePart] || 0) + 1;
    }
    
    for (const [part, count] of Object.entries(partCounts)) {
      if (count > 1) {
        const duplicateFiles = scoreFiles.filter(f => f.voicePart === part).map(f => f.name);
        risks.push({
          type: 'voice_part',
          severity: 'warning',
          category: '一致性',
          message: `${part}声部存在 ${count} 个乐谱文件，请确认版本`,
          file_path: duplicateFiles[0],
          details: {
            part,
            count,
            files: duplicateFiles
          }
        });
      }
    }
    
    if (scoreFiles.length === 0) {
      risks.push({
        type: 'voice_part',
        severity: 'critical',
        category: '完整性',
        message: '未找到任何分声部乐谱文件',
        details: {
          expected: this.voiceParts,
          found: []
        }
      });
    }
    
    return {
      valid: risks.filter(r => r.severity === 'critical').length === 0,
      risks,
      scoreFiles,
      foundParts: Array.from(foundParts),
      missingParts
    };
  }
}

module.exports = VoicePartValidator;
