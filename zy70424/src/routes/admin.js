const express = require('express');
const { CacheManager, RollbackManager, FailedItem, SearchReport } = require('../models');

const router = express.Router();

router.post('/cache/refresh', async (req, res) => {
  try {
    const { department, authPaths, ttl } = req.body;

    if (!department || !authPaths || !Array.isArray(authPaths)) {
      return res.status(400).json({
        code: 'INVALID_REFRESH_PARAMS',
        message: '刷新参数无效',
        details: {
          required: ['department', 'authPaths'],
          authPathsMustBeArray: true
        }
      });
    }

    const cacheKey = `dept:${department}:auth_paths`;
    await CacheManager.refresh(cacheKey, authPaths, ttl);

    res.json({
      code: 'CACHE_REFRESHED',
      message: '缓存刷新成功',
      data: {
        cacheKey,
        department,
        pathsCount: authPaths.length,
        ttl: ttl || 300000
      }
    });

  } catch (error) {
    res.status(500).json({
      code: 'CACHE_REFRESH_FAILED',
      message: '缓存刷新失败',
      details: { error: error.message }
    });
  }
});

router.get('/cache/status', async (req, res) => {
  try {
    const { department } = req.query;
    if (!department) {
      return res.status(400).json({
        code: 'DEPARTMENT_REQUIRED',
        message: '请指定部门'
      });
    }

    const cacheKey = `dept:${department}:auth_paths`;
    const isStale = await CacheManager.isStale(cacheKey);
    const value = await CacheManager.get(cacheKey);

    res.json({
      code: 'SUCCESS',
      data: {
        cacheKey,
        department,
        isStale,
        hasValue: !!value,
        pathsCount: value ? value.length : 0
      }
    });

  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/rollback/candidates', async (req, res) => {
  try {
    const { operationType, criteria } = req.body;

    if (!operationType || !criteria) {
      return res.status(400).json({
        code: 'MISSING_CRITERIA',
        message: '请指定操作类型和筛选条件'
      });
    }

    const candidates = await RollbackManager.generateCandidates(operationType, criteria);

    res.json({
      code: 'CANDIDATES_GENERATED',
      message: '候选清单已生成，请确认后执行',
      data: {
        candidateId: candidates.id,
        operationType: candidates.operationType,
        itemsCount: candidates.items.length,
        items: candidates.items.map(item => ({
          id: item.id,
          title: item.title,
          risk: item.risk,
          impact: item.impact
        }))
      },
      warning: '请仔细核对候选清单，执行后数据将不可恢复！'
    });

  } catch (error) {
    res.status(500).json({
      code: 'GENERATE_CANDIDATES_FAILED',
      message: '生成候选清单失败',
      details: { error: error.message }
    });
  }
});

router.get('/rollback/candidates', async (req, res) => {
  try {
    const candidates = await RollbackManager.getCandidates();
    res.json({
      code: 'SUCCESS',
      data: candidates,
      total: candidates.length
    });
  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/rollback/execute', async (req, res) => {
  try {
    const { candidateId, approved } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        code: 'CANDIDATE_ID_REQUIRED',
        message: '请指定候选清单ID'
      });
    }

    if (!approved) {
      return res.status(400).json({
        code: 'APPROVAL_REQUIRED',
        message: '必须确认审批才能执行回滚操作',
        details: { setApprovedToTrue: '请设置 approved: true 确认操作' }
      });
    }

    const result = await RollbackManager.executeRollback(candidateId);

    res.json({
      code: 'ROLLBACK_EXECUTED',
      message: '回滚操作执行成功',
      data: {
        candidateId: result.id,
        executedAt: result.executedAt,
        affectedCount: result.items.length
      }
    });

  } catch (error) {
    res.status(400).json({
      code: 'ROLLBACK_FAILED',
      message: error.message,
      details: { candidateId: req.body.candidateId }
    });
  }
});

router.get('/failed-items', async (req, res) => {
  try {
    const { handled } = req.query;
    let items = await FailedItem.getAll();

    if (handled !== undefined) {
      items = items.filter(item => item.handled === (handled === 'true'));
    }

    res.json({
      code: 'SUCCESS',
      data: items,
      total: items.length,
      summary: {
        pending: items.filter(i => !i.handled).length,
        handled: items.filter(i => i.handled).length
      }
    });

  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/search-reports', async (req, res) => {
  try {
    const { searchTerm, recordId, recordTitle, matchedContent, confidence } = req.body;

    if (!searchTerm || !recordId) {
      return res.status(400).json({
        code: 'MISSING_REQUIRED_FIELDS',
        message: '缺少必填字段'
      });
    }

    const report = await SearchReport.createReport({
      searchTerm,
      recordId,
      recordTitle,
      matchedContent,
      confidence
    });

    res.status(201).json({
      code: 'REPORT_CREATED',
      message: '搜索报告已创建',
      data: {
        reportId: report.id,
        exportSummary: SearchReport.generateExportSummary(report)
      }
    });

  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/search-reports', async (req, res) => {
  try {
    const reports = await SearchReport.getAll();
    res.json({
      code: 'SUCCESS',
      data: reports,
      total: reports.length,
      exportSummaries: reports.map(r => SearchReport.generateExportSummary(r))
    });
  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/search-reports/:id/review', async (req, res) => {
  try {
    const { reviewStatus, reviewComment, reviewer } = req.body;
    const reports = await SearchReport.getAll();
    const report = reports.find(r => r.id === req.params.id);

    if (!report) {
      return res.status(404).json({
        code: 'REPORT_NOT_FOUND',
        message: '搜索报告不存在'
      });
    }

    report.reviewStatus = reviewStatus;
    report.reviewComment = reviewComment;
    report.reviewer = reviewer;

    await require('../utils/storage').writeJSON('search-reports.json', reports);

    res.json({
      code: 'REVIEW_COMPLETED',
      message: '复核完成',
      data: {
        reportId: report.id,
        reviewStatus,
        exportSummary: SearchReport.generateExportSummary(report)
      }
    });

  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
