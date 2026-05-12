const archiveService = require('../services/archiveService');
const archiveRepository = require('../repositories/archiveRepository');
const statsRepository = require('../repositories/statsRepository');
const sampleRepository = require('../repositories/sampleRepository');

class ArchiveController {
  async submitSlowRequest(req, res) {
    try {
      const { body } = req;

      if (!body.request_url || !body.http_method || !body.response_time_ms) {
        return res.status(400).json({
          error: '缺少必需字段',
          required: ['request_url', 'http_method', 'response_time_ms'],
        });
      }

      const result = await archiveService.processSlowRequest(body, body.operator || 'system');

      res.status(201).json({
        success: true,
        data: {
          archive_id: result.archive.id,
          sample_id: result.sample.id,
          category: result.archive.category,
          status: result.archive.status,
          is_new: result.is_new,
          is_recurrence: result.is_recurrence,
          confidence: result.analysis.confidence,
          evidence: result.analysis.evidence,
          all_matches: result.analysis.all_matches,
        },
      });
    } catch (error) {
      console.error('提交慢请求失败:', error);
      res.status(500).json({
        error: '提交慢请求失败',
        message: error.message,
      });
    }
  }

  async getArchive(req, res) {
    try {
      const { id } = req.params;
      const details = await archiveService.getArchiveWithDetails(id);

      if (!details) {
        return res.status(404).json({ error: '归档记录不存在' });
      }

      const similarSamples = details.archive.category !== 'unknown' 
        ? await sampleRepository.findSimilarSamples({
            response_time_ms: details.samples[0]?.response_time_ms || 0,
            api_path: details.archive.api_path,
            http_method: details.archive.http_method,
          })
        : [];

      res.json({
        success: true,
        data: {
          archive: details.archive,
          samples: details.samples,
          history: details.history,
          similar_history: similarSamples,
        },
      });
    } catch (error) {
      console.error('获取归档详情失败:', error);
      res.status(500).json({
        error: '获取归档详情失败',
        message: error.message,
      });
    }
  }

  async listArchives(req, res) {
    try {
      const { status, category, api_path } = req.query;
      const archives = await archiveRepository.findAll({
        status,
        category,
        api_path,
      });

      res.json({
        success: true,
        data: archives,
        total: archives.length,
      });
    } catch (error) {
      console.error('获取归档列表失败:', error);
      res.status(500).json({
        error: '获取归档列表失败',
        message: error.message,
      });
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, operator, comment } = req.body;

      if (!status) {
        return res.status(400).json({ error: '缺少 status 字段' });
      }

      const updatedArchive = await archiveService.updateArchiveStatus(
        id,
        status,
        operator || 'unknown',
        comment || ''
      );

      res.json({
        success: true,
        data: updatedArchive,
      });
    } catch (error) {
      console.error('更新状态失败:', error);
      if (error.message === '归档记录不存在') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({
        error: '更新状态失败',
        message: error.message,
      });
    }
  }

  async updateNotes(req, res) {
    try {
      const { id } = req.params;
      const { notes, operator } = req.body;

      if (notes === undefined) {
        return res.status(400).json({ error: '缺少 notes 字段' });
      }

      const updatedArchive = await archiveService.updateArchiveNotes(
        id,
        notes,
        operator || 'unknown'
      );

      res.json({
        success: true,
        data: updatedArchive,
      });
    } catch (error) {
      console.error('更新备注失败:', error);
      if (error.message === '归档记录不存在') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({
        error: '更新备注失败',
        message: error.message,
      });
    }
  }

  async assignResponsible(req, res) {
    try {
      const { id } = req.params;
      const { responsible, operator } = req.body;

      if (!responsible) {
        return res.status(400).json({ error: '缺少 responsible 字段' });
      }

      const updatedArchive = await archiveService.assignResponsible(
        id,
        responsible,
        operator || 'unknown'
      );

      res.json({
        success: true,
        data: updatedArchive,
      });
    } catch (error) {
      console.error('分配负责人失败:', error);
      if (error.message === '归档记录不存在') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({
        error: '分配负责人失败',
        message: error.message,
      });
    }
  }

  async markFalsePositive(req, res) {
    try {
      const { id } = req.params;
      const { operator, comment } = req.body;

      const updatedArchive = await archiveService.updateArchiveStatus(
        id,
        'false_positive',
        operator || 'unknown',
        comment || '标记为误报'
      );

      res.json({
        success: true,
        data: updatedArchive,
      });
    } catch (error) {
      console.error('标记误报失败:', error);
      if (error.message === '归档记录不存在') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({
        error: '标记误报失败',
        message: error.message,
      });
    }
  }

  async getSimilarByTraceId(req, res) {
    try {
      const { trace_id } = req.params;
      const similarSamples = await archiveService.findSimilarByTraceId(trace_id);

      res.json({
        success: true,
        data: similarSamples,
        total: similarSamples.length,
      });
    } catch (error) {
      console.error('查询相似历史失败:', error);
      res.status(500).json({
        error: '查询相似历史失败',
        message: error.message,
      });
    }
  }
}

module.exports = new ArchiveController();
