const releaseService = require('../services/release.service');
const { Parser } = require('json2csv');

class ReleaseController {
  async createRelease(req, res) {
    try {
      const { version, title, description, createdBy, scheduledAt } = req.body;

      if (!version || !title || !createdBy) {
        return res.status(400).json({
          error: '缺少必填字段',
          message: 'version、title 和 createdBy 为必填项'
        });
      }

      const result = await releaseService.createRelease({
        version,
        title,
        description,
        createdBy,
        scheduledAt
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: '创建发布版本失败',
        message: error.message
      });
    }
  }

  async getReleases(req, res) {
    try {
      const { status } = req.query;
      const releases = await releaseService.getReleases({ status });

      res.json({
        success: true,
        data: releases
      });
    } catch (error) {
      res.status(500).json({
        error: '获取发布列表失败',
        message: error.message
      });
    }
  }

  async getReleaseDetail(req, res) {
    try {
      const { id } = req.params;
      const release = await releaseService.getReleaseDetail(id);

      if (!release) {
        return res.status(404).json({
          error: '发布版本不存在',
          message: `未找到 ID 为 ${id} 的发布版本`
        });
      }

      res.json({
        success: true,
        data: release
      });
    } catch (error) {
      res.status(500).json({
        error: '获取发布详情失败',
        message: error.message
      });
    }
  }

  async updateCheckItemStatus(req, res) {
    try {
      const { releaseId, checkItemId } = req.params;
      const { status, operator, result } = req.body;

      if (!status || !operator) {
        return res.status(400).json({
          error: '缺少必填字段',
          message: 'status 和 operator 为必填项'
        });
      }

      const validStatuses = ['pending', 'in_progress', 'passed', 'failed', 'blocked', 'exempted'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: '无效状态',
          message: `状态必须是: ${validStatuses.join(', ')}`
        });
      }

      const response = await releaseService.updateCheckItemStatus(
        releaseId,
        checkItemId,
        status,
        operator,
        result
      );

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      res.status(500).json({
        error: '更新检查项状态失败',
        message: error.message
      });
    }
  }

  async updateCheckItemAssignee(req, res) {
    try {
      const { releaseId, checkItemId } = req.params;
      const { assignee, operator } = req.body;

      if (!operator) {
        return res.status(400).json({
          error: '缺少必填字段',
          message: 'operator 为必填项'
        });
      }

      const result = await releaseService.updateCheckItemAssignee(
        releaseId,
        checkItemId,
        assignee,
        operator
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: '更新责任人失败',
        message: error.message
      });
    }
  }

  async compensateCheckItem(req, res) {
    try {
      const { releaseId, checkItemId } = req.params;
      const { reason, operator } = req.body;

      if (!reason || !operator) {
        return res.status(400).json({
          error: '缺少必填字段',
          message: 'reason 和 operator 为必填项'
        });
      }

      const result = await releaseService.compensateCheckItem(
        releaseId,
        checkItemId,
        reason,
        operator
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: '手动补偿失败',
        message: error.message
      });
    }
  }

  async addBlockReason(req, res) {
    try {
      const { releaseId } = req.params;
      const { checkItemId, reason, reporter } = req.body;

      if (!reason || !reporter) {
        return res.status(400).json({
          error: '缺少必填字段',
          message: 'reason 和 reporter 为必填项'
        });
      }

      const result = await releaseService.addBlockReason(
        releaseId,
        checkItemId,
        reason,
        reporter
      );

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: '添加阻塞原因失败',
        message: error.message
      });
    }
  }

  async resolveBlockReason(req, res) {
    try {
      const { blockId } = req.params;
      const { resolver } = req.body;

      if (!resolver) {
        return res.status(400).json({
          error: '缺少必填字段',
          message: 'resolver 为必填项'
        });
      }

      const result = await releaseService.resolveBlockReason(blockId, resolver);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: '解除阻塞失败',
        message: error.message
      });
    }
  }

  async applyExemption(req, res) {
    try {
      const { releaseId } = req.params;
      const { checkItemId, reason, applicant } = req.body;

      if (!reason || !applicant) {
        return res.status(400).json({
          error: '缺少必填字段',
          message: 'reason 和 applicant 为必填项'
        });
      }

      const result = await releaseService.applyExemption(
        releaseId,
        checkItemId,
        reason,
        applicant
      );

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: '申请豁免失败',
        message: error.message
      });
    }
  }

  async approveExemption(req, res) {
    try {
      const { exemptionId } = req.params;
      const { approver } = req.body;

      if (!approver) {
        return res.status(400).json({
          error: '缺少必填字段',
          message: 'approver 为必填项'
        });
      }

      const result = await releaseService.approveExemption(exemptionId, approver);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: '审批豁免失败',
        message: error.message
      });
    }
  }

  async updateReleaseStatus(req, res) {
    try {
      const { releaseId } = req.params;
      const { status, operator } = req.body;

      if (!status || !operator) {
        return res.status(400).json({
          error: '缺少必填字段',
          message: 'status 和 operator 为必填项'
        });
      }

      const result = await releaseService.updateReleaseStatus(releaseId, status, operator);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: '更新发布状态失败',
        message: error.message
      });
    }
  }

  async exportRelease(req, res) {
    try {
      const { id } = req.params;
      const release = await releaseService.exportReleaseData(id);

      const fields = [
        { label: '版本', value: 'version' },
        { label: '标题', value: 'title' },
        { label: '状态', value: 'status' },
        { label: '就绪评分', value: 'readiness_score' },
        { label: '创建人', value: 'created_by' },
        { label: '创建时间', value: 'created_at' }
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse([release]);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=release-${release.version}-${Date.now()}.csv`
      );

      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({
        error: '导出失败',
        message: error.message
      });
    }
  }

  async exportReleaseDetail(req, res) {
    try {
      const { id } = req.params;
      const release = await releaseService.exportReleaseData(id);

      const checkItems = release.checkItems.map(item => ({
        category: item.category,
        name: item.name,
        status: item.status,
        result: item.result || ''
      }));

      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(checkItems);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=release-checkitems-${release.version}-${Date.now()}.csv`
      );

      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({
        error: '导出失败',
        message: error.message
      });
    }
  }
}

module.exports = new ReleaseController();
