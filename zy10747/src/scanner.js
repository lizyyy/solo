const fs = require('fs');
const path = require('path');

class ExamRetakeScanner {
  constructor(options = {}) {
    this.certExpireDays = options.certExpireDays || 365;
    this.currentDate = options.currentDate ? new Date(options.currentDate) : new Date();
    this.errors = [];
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  isCertExpired(certDate) {
    if (!certDate) return true;
    const cert = this.parseDate(certDate);
    if (!cert) return true;
    const diffTime = this.currentDate.getTime() - cert.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > this.certExpireDays;
  }

  hasRetaken(record) {
    return record.hasRetaken === true || record.retakeCount >= 1;
  }

  hasSubjectConflict(records, currentRecord) {
    return records.some(r => 
      r.studentId === currentRecord.studentId &&
      r.subject === currentRecord.subject &&
      r.examId !== currentRecord.examId &&
      r.status === 'passed'
    );
  }

  isEligibleForRetake(record, allRecords) {
    const reasons = [];

    if (record.status !== 'failed') {
      reasons.push('考试状态非不及格');
    }

    if (this.isCertExpired(record.certDate)) {
      reasons.push('证明已过期');
    }

    if (this.hasRetaken(record)) {
      reasons.push('已补考');
    }

    if (this.hasSubjectConflict(allRecords, record)) {
      reasons.push('科目冲突（该科目已通过）');
    }

    return {
      eligible: reasons.length === 0,
      reasons
    };
  }

  loadRecordsFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.json') {
        return JSON.parse(content);
      } else if (ext === '.csv') {
        return this.parseCSV(content);
      } else {
        throw new Error(`不支持的文件格式: ${ext}`);
      }
    } catch (error) {
      this.errors.push({
        file: filePath,
        error: error.message
      });
      return [];
    }
  }

  parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const record = {};
      
      headers.forEach((header, idx) => {
        let value = values[idx] || '';
        if (value === 'true' || value === 'false') {
          value = value === 'true';
        } else if (!isNaN(value) && value !== '') {
          value = Number(value);
        }
        record[header] = value;
      });
      
      records.push(record);
    }

    return records;
  }

  scan(directory) {
    this.errors = [];
    const allRecords = [];
    
    if (!fs.existsSync(directory)) {
      throw new Error(`目录不存在: ${directory}`);
    }

    const files = fs.readdirSync(directory)
      .filter(f => ['.json', '.csv'].includes(path.extname(f).toLowerCase()))
      .map(f => path.join(directory, f));

    files.forEach(file => {
      const records = this.loadRecordsFromFile(file);
      records.forEach(r => {
        r.sourceFile = path.basename(file);
        allRecords.push(r);
      });
    });

    const results = allRecords.map(record => {
      const { eligible, reasons } = this.isEligibleForRetake(record, allRecords);
      return {
        examId: record.examId || '',
        studentId: record.studentId || '',
        studentName: record.studentName || '',
        subject: record.subject || '',
        score: record.score || 0,
        status: record.status || '',
        certDate: record.certDate || '',
        retakeCount: record.retakeCount || 0,
        hasRetaken: record.hasRetaken || false,
        sourceFile: record.sourceFile,
        eligibleForRetake: eligible,
        ineligibilityReasons: reasons
      };
    });

    return this.sortResults(results);
  }

  sortResults(results) {
    return results.sort((a, b) => {
      if (a.studentId !== b.studentId) {
        return a.studentId.localeCompare(b.studentId);
      }
      if (a.subject !== b.subject) {
        return a.subject.localeCompare(b.subject);
      }
      return (a.examId || '').localeCompare(b.examId || '');
    });
  }

  generateReport(results) {
    const eligible = results.filter(r => r.eligibleForRetake);
    const ineligible = results.filter(r => !r.eligibleForRetake);

    const lines = [];
    lines.push('='.repeat(60));
    lines.push('         考试记录补考资格扫描报告');
    lines.push('='.repeat(60));
    lines.push(`生成时间: ${this.currentDate.toISOString().split('T')[0]}`);
    lines.push(`总记录数: ${results.length}`);
    lines.push(`可补考人数: ${eligible.length}`);
    lines.push(`不可补考人数: ${ineligible.length}`);
    lines.push('');

    lines.push('--- 可恢复补考资格列表 ---');
    if (eligible.length === 0) {
      lines.push('(无符合条件的记录)');
    } else {
      eligible.forEach((r, idx) => {
        lines.push(`${idx + 1}. [${r.studentId}] ${r.studentName} - ${r.subject}`);
        lines.push(`   分数: ${r.score} | 证明日期: ${r.certDate || '无'} | 来源: ${r.sourceFile}`);
      });
    }
    lines.push('');

    lines.push('--- 不可补考明细 (按原因分类) ---');
    
    const reasonGroups = {};
    ineligible.forEach(r => {
      r.ineligibilityReasons.forEach(reason => {
        if (!reasonGroups[reason]) reasonGroups[reason] = [];
        reasonGroups[reason].push(r);
      });
    });

    Object.keys(reasonGroups).sort().forEach(reason => {
      lines.push(`\n【${reason}】(${reasonGroups[reason].length}人)`);
      reasonGroups[reason].forEach(r => {
        lines.push(`  - [${r.studentId}] ${r.studentName} - ${r.subject} (来源: ${r.sourceFile})`);
      });
    });

    if (this.errors.length > 0) {
      lines.push('\n--- 文件处理错误 ---');
      this.errors.forEach(e => {
        lines.push(`  - ${e.file}: ${e.error}`);
      });
    }

    lines.push('');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  generateJSONReport(results) {
    return {
      generatedAt: this.currentDate.toISOString(),
      summary: {
        total: results.length,
        eligible: results.filter(r => r.eligibleForRetake).length,
        ineligible: results.filter(r => !r.eligibleForRetake).length
      },
      errors: this.errors,
      results: results
    };
  }
}

module.exports = ExamRetakeScanner;
