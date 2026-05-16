const db = require('../database/db');
const crypto = require('crypto');

class ScoringService {
  generateBatchId() {
    return 'BATCH_' + crypto.randomUUID().substring(0, 8).toUpperCase();
  }

  calculateRiskLevel(totalDeduction) {
    if (totalDeduction >= 30) return 'high';
    if (totalDeduction >= 15) return 'medium';
    return 'low';
  }

  normalizeSupplierDir(dirPath) {
    if (!dirPath) return '';
    let normalized = dirPath.trim();
    normalized = normalized.replace(/[\\/]+/g, '/');
    normalized = normalized.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_./-]/g, '');
    if (normalized.startsWith('/')) {
      normalized = normalized.substring(1);
    }
    return normalized;
  }

  validateZipPath(zipPath) {
    const errors = [];
    
    if (!zipPath || zipPath.trim() === '') {
      errors.push('压缩包路径为空');
    } else {
      if (/[<>:"|?*]/.test(zipPath)) {
        errors.push('压缩包路径包含非法字符: < > : " | ? *');
      }
      if (zipPath.length > 255) {
        errors.push('压缩包路径长度超过255字符限制');
      }
      if (!zipPath.toLowerCase().endsWith('.zip')) {
        errors.push('压缩包路径不是有效的.zip文件');
      }
      if (zipPath.includes('..')) {
        errors.push('压缩包路径包含目录遍历字符(..)');
      }
    }
    
    return errors;
  }

  async getReviewSamples() {
    return await db.all('SELECT * FROM review_samples ORDER BY id');
  }

  async performScoring(scoringData) {
    const { supplier_name, zip_path, sample_results, supplier_dir } = scoringData;
    
    const batchId = this.generateBatchId();
    const supplierDirBefore = supplier_dir || '';
    const supplierDirAfter = this.normalizeSupplierDir(supplier_dir);

    const zipPathErrors = this.validateZipPath(zip_path);
    
    if (zipPathErrors.length > 0) {
      return await this.createExceptionRecord(
        batchId,
        supplier_name,
        supplierDirBefore,
        supplierDirAfter,
        zip_path,
        'zip_path_validation',
        zipPathErrors.join('; '),
        JSON.stringify({ zip_path, supplier_dir })
      );
    }

    return await this.createSuccessRecord(
      batchId,
      supplier_name,
      supplierDirBefore,
      supplierDirAfter,
      zip_path,
      sample_results
    );
  }

  async createExceptionRecord(batchId, supplierName, supplierDirBefore, supplierDirAfter, zipPath, exceptionType, errorMessage, inputData) {
    const result = await db.run(
      `INSERT INTO scoring_records 
       (batch_id, supplier_name, supplier_dir_before, supplier_dir_after, zip_path, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [batchId, supplierName, supplierDirBefore, supplierDirAfter, zipPath, 'failed', errorMessage]
    );

    await db.run(
      `INSERT INTO exception_records 
       (record_id, exception_type, error_message, input_data)
       VALUES (?, ?, ?, ?)`,
      [result.lastID, exceptionType, errorMessage, inputData]
    );

    return {
      success: false,
      batch_id: batchId,
      status: 'failed',
      error: errorMessage,
      supplier_dir_before: supplierDirBefore,
      supplier_dir_after: supplierDirAfter,
      input_data: JSON.parse(inputData)
    };
  }

  async createSuccessRecord(batchId, supplierName, supplierDirBefore, supplierDirAfter, zipPath, sampleResults) {
    const samples = await this.getReviewSamples();
    const scoreItems = [];
    let totalDeduction = 0;

    for (const sampleResult of sampleResults) {
      const sample = samples.find(s => s.id === sampleResult.sample_id);
      if (sample && sampleResult.result === 'fail') {
        const deduction = sample.deduction_points || 10;
        totalDeduction += deduction;
        scoreItems.push({
          sample_id: sample.id,
          sample_name: sample.name,
          deduction_reason: sample.description,
          deduction_points: deduction,
          risk_level: sample.risk_level
        });
      }
    }

    const totalScore = Math.max(0, 100 - totalDeduction);
    const riskLevel = this.calculateRiskLevel(totalDeduction);
    const materialSummary = this.generateMaterialSummary(scoreItems, samples);
    const conclusion = this.generateConclusion(totalScore, riskLevel, scoreItems);

    const result = await db.run(
      `INSERT INTO scoring_records 
       (batch_id, supplier_name, supplier_dir_before, supplier_dir_after, zip_path, 
        total_score, risk_level, status, material_summary, conclusion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batchId, supplierName, supplierDirBefore, supplierDirAfter, zipPath,
       totalScore, riskLevel, 'success', materialSummary, conclusion]
    );

    const insertScoreItem = db.prepare(
      `INSERT INTO score_items 
       (record_id, sample_id, sample_name, deduction_reason, deduction_points, risk_level)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    for (const item of scoreItems) {
      insertScoreItem.run(
        result.lastID,
        item.sample_id,
        item.sample_name,
        item.deduction_reason,
        item.deduction_points,
        item.risk_level
      );
    }
    insertScoreItem.finalize();

    return {
      success: true,
      batch_id: batchId,
      status: 'success',
      total_score: totalScore,
      risk_level: riskLevel,
      supplier_dir_before: supplierDirBefore,
      supplier_dir_after: supplierDirAfter,
      score_items: scoreItems,
      material_summary: materialSummary,
      conclusion: conclusion
    };
  }

  generateMaterialSummary(scoreItems, samples) {
    const failedCount = scoreItems.length;
    const totalCount = samples.length;
    
    if (failedCount === 0) {
      return `所有${totalCount}个审核样本全部通过，未发现违规内容。`;
    }
    
    const highRiskCount = scoreItems.filter(i => i.risk_level === 'high').length;
    const mediumRiskCount = scoreItems.filter(i => i.risk_level === 'medium').length;
    
    return `共审核${totalCount}个样本，发现${failedCount}个不合规项。` +
           `其中高风险${highRiskCount}项，中风险${mediumRiskCount}项。`;
  }

  generateConclusion(totalScore, riskLevel, scoreItems) {
    const riskDesc = {
      'high': '高风险，建议立即整改',
      'medium': '中风险，建议限期整改',
      'low': '低风险，建议关注改进'
    };

    let conclusion = `最终评分：${totalScore}分，风险等级：${riskDesc[riskLevel] || riskLevel}。`;

    if (scoreItems.length > 0) {
      conclusion += `主要扣分项包括：` + scoreItems.map(item => 
        `${item.sample_name}(-${item.deduction_points}分)`
      ).join('、') + '。';
    }

    return conclusion;
  }

  async getScoringRecord(batchId) {
    const record = await db.get(
      'SELECT * FROM scoring_records WHERE batch_id = ?',
      [batchId]
    );

    if (!record) {
      return null;
    }

    const scoreItems = await db.all(
      'SELECT * FROM score_items WHERE record_id = ?',
      [record.id]
    );

    const exception = await db.get(
      'SELECT * FROM exception_records WHERE record_id = ?',
      [record.id]
    );

    return {
      ...record,
      score_items: scoreItems,
      exception: exception
    };
  }

  async getAllRecords(filters = {}) {
    let sql = 'SELECT * FROM scoring_records WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.risk_level) {
      sql += ' AND risk_level = ?';
      params.push(filters.risk_level);
    }

    if (filters.supplier_name) {
      sql += ' AND supplier_name LIKE ?';
      params.push(`%${filters.supplier_name}%`);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }

    const records = await db.all(sql, params);
    
    for (const record of records) {
      const scoreItems = await db.all(
        'SELECT * FROM score_items WHERE record_id = ?',
        [record.id]
      );
      record.score_items = scoreItems;

      const exception = await db.get(
        'SELECT * FROM exception_records WHERE record_id = ?',
        [record.id]
      );
      record.exception = exception;
    }

    return records;
  }
}

module.exports = new ScoringService();
