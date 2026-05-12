const crypto = require('crypto');
const archiveRepository = require('../repositories/archiveRepository');
const sampleRepository = require('../repositories/sampleRepository');
const historyRepository = require('../repositories/historyRepository');
const db = require('../config/database');

class ArchiveService {
  constructor() {
    this.CATEGORIES = {
      DATABASE_SLOW: 'database_slow',
      DOWNSTREAM_SLOW: 'downstream_slow',
      CACHE_PENETRATION: 'cache_penetration',
      PARAMETER_ERROR: 'parameter_error',
      UNKNOWN: 'unknown',
    };
    this.DUPLICATE_TIME_WINDOW_MS = 5 * 60 * 1000; // 5分钟内的相同请求视为重复
  }

  normalizeApiPath(url) {
    if (!url) return '/';
    try {
      const pathname = new URL(url, 'http://localhost').pathname;
      return pathname;
    } catch {
      return url;
    }
  }

  analyzeCategory(sampleData) {
    const { sql_summaries, external_deps, request_body, response_time_ms } = sampleData;

    const sqlTime = sql_summaries?.reduce((sum, sql) => sum + (sql.execution_time_ms || 0), 0) || 0;
    const downstreamTime = external_deps?.reduce((sum, dep) => sum + (dep.execution_time_ms || 0), 0) || 0;

    const sqlRatio = sqlTime / (response_time_ms || 1);
    const downstreamRatio = downstreamTime / (response_time_ms || 1);

    const matchedCategories = [];

    if (sqlRatio >= 0.5 || (sql_summaries && sql_summaries.some(sql => (sql.execution_time_ms || 0) >= 1000))) {
      matchedCategories.push({
        category: this.CATEGORIES.DATABASE_SLOW,
        confidence: Math.min(sqlRatio * 1.5, 0.95),
        evidence: {
          total_sql_time: sqlTime,
          sql_count: sql_summaries?.length || 0,
          slow_sqls: sql_summaries?.filter(sql => (sql.execution_time_ms || 0) >= 1000) || [],
        },
      });
    }

    if (downstreamRatio >= 0.5 || (external_deps && external_deps.some(dep => (dep.execution_time_ms || 0) >= 500))) {
      matchedCategories.push({
        category: this.CATEGORIES.DOWNSTREAM_SLOW,
        confidence: Math.min(downstreamRatio * 1.5, 0.95),
        evidence: {
          total_downstream_time: downstreamTime,
          dep_count: external_deps?.length || 0,
          slow_deps: external_deps?.filter(dep => (dep.execution_time_ms || 0) >= 500) || [],
        },
      });
    }

    if (this.detectCachePenetration(sampleData)) {
      matchedCategories.push({
        category: this.CATEGORIES.CACHE_PENETRATION,
        confidence: 0.7,
        evidence: {
          reason: '检测到可能的缓存穿透 - 大量相同参数或无效参数的重复请求',
        },
      });
    }

    if (this.detectParameterError(request_body)) {
      matchedCategories.push({
        category: this.CATEGORIES.PARAMETER_ERROR,
        confidence: 0.8,
        evidence: {
          reason: '检测到可能的参数异常',
        },
      });
    }

    if (matchedCategories.length === 0) {
      return {
        category: this.CATEGORIES.UNKNOWN,
        confidence: 0.5,
        evidence: {
          reason: '无法自动分类，需要人工分析',
        },
        all_matches: [],
      };
    }

    matchedCategories.sort((a, b) => b.confidence - a.confidence);

    return {
      category: matchedCategories[0].category,
      confidence: matchedCategories[0].confidence,
      evidence: matchedCategories[0].evidence,
      all_matches: matchedCategories,
    };
  }

  detectCachePenetration(sampleData) {
    const { request_body, request_url } = sampleData;
    const idPatterns = [/id=([^&]*)/, /\/(\d+)/, /uuid=([^&]*)/];
    const suspiciousPatterns = ['-1', '0', 'null', 'undefined', ' '];

    for (const pattern of idPatterns) {
      const match = (request_url || '').match(pattern) || JSON.stringify(request_body || '').match(pattern);
      if (match && suspiciousPatterns.includes(match[1])) {
        return true;
      }
    }

    return false;
  }

  detectParameterError(requestBody) {
    if (!requestBody) return false;

    const bodyStr = JSON.stringify(requestBody);
    const errorPatterns = [
      /undefined|null|NaN/i,
      /''|""/,
      /-\d+/,
    ];

    return errorPatterns.some(pattern => pattern.test(bodyStr));
  }

  generateSampleHash(sampleData) {
    const normalizedData = {
      api_path: this.normalizeApiPath(sampleData.request_url),
      http_method: sampleData.http_method,
      request_body: this.normalizeRequestBody(sampleData.request_body),
    };

    return crypto
      .createHash('md5')
      .update(JSON.stringify(normalizedData))
      .digest('hex');
  }

  normalizeRequestBody(body) {
    if (!body) return {};

    const normalized = {};
    const fieldsToKeep = ['action', 'type', 'status', 'page', 'size', 'limit', 'offset', 'filter'];

    for (const key of Object.keys(body)) {
      if (fieldsToKeep.includes(key.toLowerCase())) {
        normalized[key] = body[key];
      }
    }

    return normalized;
  }

  async processSlowRequest(sampleData, operator = 'system') {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      const apiPath = this.normalizeApiPath(sampleData.request_url);
      const httpMethod = sampleData.http_method || 'GET';

      let existingArchive = await archiveRepository.findByApiPath(apiPath, httpMethod);

      const analysis = this.analyzeCategory(sampleData);

      const isNewArchive = !existingArchive;
      const isRecurrence = existingArchive && existingArchive.status === 'resolved';

      if (!existingArchive) {
        existingArchive = await archiveRepository.create({
          api_path: apiPath,
          http_method: httpMethod,
          category: analysis.category,
          status: 'pending',
        });

        await historyRepository.create({
          archive_id: existingArchive.id,
          action: 'archive_created',
          old_value: null,
          new_value: JSON.stringify({
            api_path: apiPath,
            http_method: httpMethod,
            category: analysis.category,
          }),
          operator,
          comment: '首次发现慢请求，自动创建归档',
        });
      } else {
        const currentCategory = existingArchive.category;
        
        if (analysis.category !== currentCategory && analysis.confidence > 0.7) {
          await archiveRepository.update(existingArchive.id, {
            category: analysis.category,
            status: isRecurrence ? 'pending' : existingArchive.status,
          });

          await historyRepository.create({
            archive_id: existingArchive.id,
            action: 'category_change',
            old_value: currentCategory,
            new_value: analysis.category,
            operator,
            comment: `根据新样本重新分类，置信度: ${analysis.confidence}`,
          });
        } else if (isRecurrence) {
          await archiveRepository.update(existingArchive.id, {
            status: 'pending',
          });

          await historyRepository.create({
            archive_id: existingArchive.id,
            action: 'status_change',
            old_value: 'resolved',
            new_value: 'pending',
            operator,
            comment: '问题复发，状态重置为待看',
          });
        }

        await archiveRepository.incrementOccurrence(existingArchive.id);
      }

      const sample = await sampleRepository.create({
        ...sampleData,
        archive_id: existingArchive.id,
      });

      await client.query('COMMIT');

      return {
        archive: await archiveRepository.findById(existingArchive.id),
        sample,
        analysis,
        is_new: isNewArchive,
        is_recurrence: isRecurrence,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateArchiveStatus(archiveId, newStatus, operator, comment = '') {
    const archive = await archiveRepository.findById(archiveId);
    if (!archive) {
      throw new Error('归档记录不存在');
    }

    const oldStatus = archive.status;
    const validStatuses = ['pending', 'processing', 'resolved', 'false_positive'];

    if (!validStatuses.includes(newStatus)) {
      throw new Error(`无效的状态: ${newStatus}`);
    }

    const updatedArchive = await archiveRepository.update(archiveId, {
      status: newStatus,
    });

    await historyRepository.create({
      archive_id: archiveId,
      action: 'status_change',
      old_value: oldStatus,
      new_value: newStatus,
      operator,
      comment,
    });

    return updatedArchive;
  }

  async updateArchiveNotes(archiveId, notes, operator) {
    const archive = await archiveRepository.findById(archiveId);
    if (!archive) {
      throw new Error('归档记录不存在');
    }

    const updatedArchive = await archiveRepository.update(archiveId, {
      notes,
    });

    await historyRepository.create({
      archive_id: archiveId,
      action: 'note_update',
      old_value: archive.notes,
      new_value: notes,
      operator,
      comment: '更新处理备注',
    });

    return updatedArchive;
  }

  async assignResponsible(archiveId, responsible, operator) {
    const archive = await archiveRepository.findById(archiveId);
    if (!archive) {
      throw new Error('归档记录不存在');
    }

    const oldResponsible = archive.responsible;
    const updatedArchive = await archiveRepository.update(archiveId, {
      responsible,
      status: 'processing',
    });

    await historyRepository.create({
      archive_id: archiveId,
      action: 'responsible_change',
      old_value: oldResponsible,
      new_value: responsible,
      operator,
      comment: '分配负责人，状态更新为处理中',
    });

    return updatedArchive;
  }

  async getArchiveWithDetails(archiveId) {
    const archive = await archiveRepository.findById(archiveId);
    if (!archive) {
      return null;
    }

    const samples = await sampleRepository.findByArchiveId(archiveId);
    const history = await historyRepository.findByArchiveId(archiveId);

    return {
      archive,
      samples,
      history,
    };
  }

  async findSimilarByTraceId(traceId) {
    if (!traceId) {
      return [];
    }
    return await sampleRepository.findByTraceId(traceId);
  }
}

module.exports = new ArchiveService();
