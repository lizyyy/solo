const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');

class ResumeDeduplicator {
  constructor(options = {}) {
    this.options = {
      phoneField: options.phoneField || '手机号',
      emailField: options.emailField || '邮箱',
      nameField: options.nameField || '姓名',
      sourceField: options.sourceField || '来源渠道',
      idField: options.idField || '简历编号'
    };
    
    this.resumes = [];
    this.channels = new Map();
    this.blacklist = new Set();
    this.errors = [];
  }

  normalizePhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '');
  }

  normalizeEmail(email) {
    if (!email) return '';
    return String(email).toLowerCase().trim();
  }

  async loadResumes(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      let lineNumber = 0;
      
      fs.createReadStream(filePath, { encoding: 'utf-8' })
        .pipe(csv())
        .on('headers', (headers) => {
          this.validateHeaders(headers, '简历文件');
        })
        .on('data', (data) => {
          lineNumber++;
          try {
            const record = {
              ...data,
              _lineNumber: lineNumber,
              _normalizedPhone: this.normalizePhone(data[this.options.phoneField]),
              _normalizedEmail: this.normalizeEmail(data[this.options.emailField]),
              _source: '简历文件'
            };
            results.push(record);
          } catch (e) {
            this.errors.push({
              type: '解析错误',
              line: lineNumber,
              file: '简历文件',
              message: e.message,
              data: JSON.stringify(data)
            });
          }
        })
        .on('end', () => {
          this.resumes = results;
          resolve(results);
        })
        .on('error', (err) => {
          reject(new Error(`读取简历文件失败: ${err.message}`));
        });
    });
  }

  async loadChannels(filePath) {
    return new Promise((resolve, reject) => {
      const results = new Map();
      let lineNumber = 0;
      
      fs.createReadStream(filePath, { encoding: 'utf-8' })
        .pipe(csv())
        .on('data', (data) => {
          lineNumber++;
          try {
            const channelName = data['渠道名称'] || data['name'] || Object.values(data)[0];
            const priority = parseInt(data['优先级'] || data['priority'] || 0, 10);
            results.set(channelName, { priority, ...data });
          } catch (e) {
            this.errors.push({
              type: '解析错误',
              line: lineNumber,
              file: '渠道表',
              message: e.message,
              data: JSON.stringify(data)
            });
          }
        })
        .on('end', () => {
          this.channels = results;
          resolve(results);
        })
        .on('error', (err) => {
          reject(new Error(`读取渠道表失败: ${err.message}`));
        });
    });
  }

  async loadBlacklist(filePath) {
    return new Promise((resolve, reject) => {
      const results = new Set();
      let lineNumber = 0;
      
      fs.createReadStream(filePath, { encoding: 'utf-8' })
        .pipe(csv())
        .on('data', (data) => {
          lineNumber++;
          try {
            const phone = this.normalizePhone(data['手机号'] || data['phone'] || Object.values(data)[0]);
            const email = this.normalizeEmail(data['邮箱'] || data['email'] || Object.values(data)[0]);
            if (phone) results.add(`phone:${phone}`);
            if (email) results.add(`email:${email}`);
          } catch (e) {
            this.errors.push({
              type: '解析错误',
              line: lineNumber,
              file: '黑名单',
              message: e.message,
              data: JSON.stringify(data)
            });
          }
        })
        .on('end', () => {
          this.blacklist = results;
          resolve(results);
        })
        .on('error', (err) => {
          reject(new Error(`读取黑名单失败: ${err.message}`));
        });
    });
  }

  validateHeaders(headers, fileName) {
    const required = [this.options.phoneField, this.options.emailField, this.options.nameField];
    const missing = required.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      throw new Error(`${fileName}缺少必要字段: ${missing.join(', ')}`);
    }
  }

  findDuplicates() {
    const phoneGroups = new Map();
    const emailGroups = new Map();
    const duplicates = [];
    const processedIndices = new Set();
    
    this.resumes.forEach((resume, index) => {
      const phone = resume._normalizedPhone;
      const email = resume._normalizedEmail;
      
      if (phone) {
        if (!phoneGroups.has(phone)) phoneGroups.set(phone, []);
        phoneGroups.get(phone).push(index);
      }
      
      if (email) {
        if (!emailGroups.has(email)) emailGroups.set(email, []);
        emailGroups.get(email).push(index);
      }
    });
    
    phoneGroups.forEach((indices, phone) => {
      if (indices.length > 1) {
        const unprocessedIndices = indices.filter(i => !processedIndices.has(i));
        if (unprocessedIndices.length > 1) {
          unprocessedIndices.forEach(i => processedIndices.add(i));
          duplicates.push(this.createDuplicateGroup(unprocessedIndices, '手机号重复', phone));
        }
      }
    });
    
    emailGroups.forEach((indices, email) => {
      if (indices.length > 1) {
        const unprocessedIndices = indices.filter(i => !processedIndices.has(i));
        if (unprocessedIndices.length > 1) {
          unprocessedIndices.forEach(i => processedIndices.add(i));
          duplicates.push(this.createDuplicateGroup(unprocessedIndices, '邮箱重复', email));
        }
      }
    });
    
    return duplicates;
  }

  createDuplicateGroup(indices, matchType, matchValue) {
    const resumes = indices.map(i => this.resumes[i]);
    
    const blacklisted = resumes.filter(r => {
      const phoneKey = `phone:${r._normalizedPhone}`;
      const emailKey = `email:${r._normalizedEmail}`;
      return this.blacklist.has(phoneKey) || this.blacklist.has(emailKey);
    });
    
    const withPhone = resumes.filter(r => r._normalizedPhone);
    const withEmail = resumes.filter(r => r._normalizedEmail);
    
    resumes.forEach((r, idx) => {
      r._groupIndex = idx;
      r._hasPhone = !!r._normalizedPhone;
      r._hasEmail = !!r._normalizedEmail;
      r._isBlacklisted = blacklisted.some(b => b === r);
      r._channelPriority = this.getChannelPriority(r[this.options.sourceField]);
    });
    
    resumes.sort((a, b) => {
      if (a._isBlacklisted !== b._isBlacklisted) return a._isBlacklisted ? 1 : -1;
      if (a._hasPhone !== b._hasPhone) return b._hasPhone ? 1 : -1;
      if (a._hasEmail !== b._hasEmail) return b._hasEmail ? 1 : -1;
      return b._channelPriority - a._channelPriority;
    });
    
    const primary = resumes[0];
    const duplicates = resumes.slice(1);
    
    return {
      matchType,
      matchValue,
      totalCount: resumes.length,
      blacklistedCount: blacklisted.length,
      phoneMissingCount: resumes.length - withPhone.length,
      emailMissingCount: resumes.length - withEmail.length,
      primary: {
        id: primary[this.options.idField] || 'N/A',
        line: primary._lineNumber,
        name: primary[this.options.nameField],
        phone: primary[this.options.phoneField],
        email: primary[this.options.emailField],
        source: primary[this.options.sourceField],
        reason: this.selectPrimaryReason(primary, duplicates)
      },
      duplicates: duplicates.map(d => ({
        id: d[this.options.idField] || 'N/A',
        line: d._lineNumber,
        name: d[this.options.nameField],
        phone: d[this.options.phoneField],
        email: d[this.options.emailField],
        source: d[this.options.sourceField],
        suggestion: d._isBlacklisted ? '删除(黑名单)' : '合并到主记录'
      })),
      allResumes: resumes
    };
  }

  getChannelPriority(channelName) {
    if (!channelName) return 0;
    const channel = this.channels.get(channelName);
    return channel ? channel.priority : 0;
  }

  selectPrimaryReason(primary, duplicates) {
    const reasons = [];
    if (primary._isBlacklisted) {
      reasons.push('黑名单但优先级最高');
    } else {
      if (primary._hasPhone && duplicates.some(d => !d._hasPhone)) {
        reasons.push('有完整手机号');
      }
      if (primary._hasEmail && duplicates.some(d => !d._hasEmail)) {
        reasons.push('有完整邮箱');
      }
      if (primary._channelPriority > 0) {
        reasons.push('渠道优先级高');
      }
    }
    return reasons.length > 0 ? reasons.join('; ') : '按出现顺序选择';
  }

  async generateReport(outputPath) {
    const duplicates = this.findDuplicates();
    
    const suggestionRecords = [];
    duplicates.forEach((group, groupIdx) => {
      const groupId = `GROUP_${String(groupIdx + 1).padStart(3, '0')}`;
      
      suggestionRecords.push({
        组编号: groupId,
        匹配类型: group.matchType,
        匹配值: group.matchValue,
        记录类型: '主记录',
        简历编号: group.primary.id,
        行号: group.primary.line,
        姓名: group.primary.name,
        手机号: group.primary.phone,
        邮箱: group.primary.email,
        来源渠道: group.primary.source,
        处理建议: '保留为主记录',
        选择理由: group.primary.reason,
        备注: `组内共${group.totalCount}条记录，${group.blacklistedCount}条黑名单`
      });
      
      group.duplicates.forEach((dup) => {
        suggestionRecords.push({
          组编号: groupId,
          匹配类型: group.matchType,
          匹配值: group.matchValue,
          记录类型: '重复记录',
          简历编号: dup.id,
          行号: dup.line,
          姓名: dup.name,
          手机号: dup.phone,
          邮箱: dup.email,
          来源渠道: dup.source,
          处理建议: dup.suggestion,
          选择理由: '',
          备注: ''
        });
      });
    });
    
    const errorRecords = this.errors.map(err => ({
      组编号: 'ERROR',
      匹配类型: err.type,
      匹配值: '',
      记录类型: '错误记录',
      简历编号: '',
      行号: err.line,
      姓名: '',
      手机号: '',
      邮箱: '',
      来源渠道: err.file,
      处理建议: '需要人工核查',
      选择理由: err.message,
      备注: err.data
    }));
    
    const allRecords = [...suggestionRecords, ...errorRecords];
    
    const csvWriter = createCsvWriter({
      path: outputPath,
      header: [
        { id: '组编号', title: '组编号' },
        { id: '匹配类型', title: '匹配类型' },
        { id: '匹配值', title: '匹配值' },
        { id: '记录类型', title: '记录类型' },
        { id: '简历编号', title: '简历编号' },
        { id: '行号', title: '行号' },
        { id: '姓名', title: '姓名' },
        { id: '手机号', title: '手机号' },
        { id: '邮箱', title: '邮箱' },
        { id: '来源渠道', title: '来源渠道' },
        { id: '处理建议', title: '处理建议' },
        { id: '选择理由', title: '选择理由' },
        { id: '备注', title: '备注' }
      ],
      encoding: 'utf-8'
    });
    
    await csvWriter.writeRecords(allRecords);
    
    return {
      totalResumes: this.resumes.length,
      duplicateGroups: duplicates.length,
      duplicateRecords: duplicates.reduce((sum, g) => sum + g.totalCount, 0),
      errors: this.errors.length,
      blacklisted: this.blacklist.size,
      suggestionFile: outputPath,
      details: {
        总简历数: this.resumes.length,
        重复组数: duplicates.length,
        涉及重复记录数: duplicates.reduce((sum, g) => sum + g.totalCount, 0),
        错误记录数: this.errors.length,
        黑名单条目数: this.blacklist.size,
        手机号缺失数: this.resumes.filter(r => !r._normalizedPhone).length,
        邮箱缺失数: this.resumes.filter(r => !r._normalizedEmail).length
      }
    };
  }
}

module.exports = ResumeDeduplicator;