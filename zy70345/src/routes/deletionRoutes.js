const express = require('express');
const router = express.Router();

const {
  createDeletionRequest,
  getRequestById,
  getRequestsByCustomer,
  getAllRequests,
  updateRequestStatus,
  incrementRetryCount,
  canRetry,
  markAsCompleted
} = require('../services/requestService');

const {
  scanUserData,
  saveScanResults,
  getScanResultsByRequest
} = require('../services/scanService');

const {
  analyzeDeletionEligibility,
  updateScanResultsWithAnalysis,
  getDeletionSummary
} = require('../services/ruleEngine');

const {
  prepareDeletionPlan,
  createExecutionRecords,
  executeAll,
  getExecutionResults,
  retryFailedExecutions
} = require('../services/executionService');

const {
  createCertificate,
  getCertificateById,
  getCertificateByNumber,
  getCertificateByRequest
} = require('../services/certificateService');

const config = require('../config');

router.post('/requests', (req, res) => {
  try {
    const { customer_id, request_type, data_scope, verification_info } = req.body;

    if (!customer_id || !verification_info) {
      return res.status(400).json({
        error: '参数缺失',
        message: '必须提供 customer_id 和 verification_info'
      });
    }

    const result = createDeletionRequest(customer_id, {
      request_type: request_type || 'full_deletion',
      data_scope: data_scope || 'all_data',
      verification_info
    });

    if (!result.success) {
      return res.status(403).json({
        success: false,
        error: '身份验证失败',
        reason: result.reason
      });
    }

    res.status(201).json({
      success: true,
      message: '删除请求已创建',
      request: result.request,
      next_steps: [
        'GET /api/deletion/requests/:id/scan - 扫描客户数据',
        'POST /api/deletion/requests/:id/analyze - 分析删除 eligibility',
        'POST /api/deletion/requests/:id/execute - 执行删除',
        'POST /api/deletion/requests/:id/complete - 完成并生成证明'
      ]
    });
  } catch (error) {
    if (error.message.includes('已存在')) {
      return res.status(409).json({
        success: false,
        error: '重复请求',
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
});

router.get('/requests', (req, res) => {
  try {
    const { customer_id } = req.query;
    let requests;

    if (customer_id) {
      requests = getRequestsByCustomer(customer_id);
    } else {
      requests = getAllRequests();
    }

    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
});

router.get('/requests/:id', (req, res) => {
  try {
    const { id } = req.params;
    const request = getRequestById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: '请求不存在',
        message: `删除请求 ${id} 不存在`
      });
    }

    const scanResults = getScanResultsByRequest(id);
    const summary = getDeletionSummary(id);
    const executions = getExecutionResults(id);
    const certificate = getCertificateByRequest(id);

    res.json({
      success: true,
      request,
      summary,
      scan_results: scanResults,
      executions,
      certificate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
});

router.get('/requests/:id/scan', (req, res) => {
  try {
    const { id } = req.params;
    const request = getRequestById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: '请求不存在',
        message: `删除请求 ${id} 不存在`
      });
    }

    const existingScans = getScanResultsByRequest(id);
    if (existingScans.length > 0) {
      return res.json({
        success: true,
        message: '数据已扫描，使用现有结果',
        scanned_count: existingScans.length,
        scan_results: existingScans
      });
    }

    updateRequestStatus(id, 'scanning');

    const scannedData = scanUserData(request.customer_id);
    const saved = saveScanResults(id, scannedData);

    updateRequestStatus(id, 'scanned');

    res.json({
      success: true,
      message: '数据扫描完成',
      scanned_count: saved.count,
      scan_results: getScanResultsByRequest(id)
    });
  } catch (error) {
    updateRequestStatus(req.params.id, 'failed', error.message);
    res.status(500).json({
      success: false,
      error: '扫描失败',
      message: error.message
    });
  }
});

router.post('/requests/:id/analyze', (req, res) => {
  try {
    const { id } = req.params;
    const request = getRequestById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: '请求不存在',
        message: `删除请求 ${id} 不存在`
      });
    }

    const scanResults = getScanResultsByRequest(id);
    if (scanResults.length === 0) {
      return res.status(400).json({
        success: false,
        error: '数据未扫描',
        message: '请先执行数据扫描：GET /api/deletion/requests/:id/scan'
      });
    }

    const existingAnalysis = scanResults.find(r => r.retention_reason !== null);
    if (existingAnalysis) {
      const summary = getDeletionSummary(id);
      return res.json({
        success: true,
        message: '已存在分析结果',
        summary,
        deletable_items: scanResults.filter(r => r.can_delete === 1),
        retained_items: scanResults.filter(r => r.can_delete === 0)
      });
    }

    updateRequestStatus(id, 'analyzing');

    const analysis = analyzeDeletionEligibility(id);
    updateScanResultsWithAnalysis(analysis);

    const summary = getDeletionSummary(id);
    const updatedResults = getScanResultsByRequest(id);

    updateRequestStatus(id, 'analyzed');

    res.json({
      success: true,
      message: '删除 eligibility 分析完成',
      summary,
      deletable_items: updatedResults.filter(r => r.can_delete === 1),
      retained_items: updatedResults.filter(r => r.can_delete === 0)
    });
  } catch (error) {
    updateRequestStatus(req.params.id, 'failed', error.message);
    res.status(500).json({
      success: false,
      error: '分析失败',
      message: error.message
    });
  }
});

router.post('/requests/:id/execute', (req, res) => {
  try {
    const { id } = req.params;
    const request = getRequestById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: '请求不存在',
        message: `删除请求 ${id} 不存在`
      });
    }

    if (request.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: '请求已完成',
        message: '该删除请求已完成，不能重复执行'
      });
    }

    const existingExecutions = getExecutionResults(id);
    if (existingExecutions.length > 0) {
      const completedExecutions = existingExecutions.filter(e => e.status === 'completed');
      if (completedExecutions.length === existingExecutions.length) {
        return res.json({
          success: true,
          message: '删除操作已全部完成，请执行完成步骤',
          executions: existingExecutions
        });
      }

      const failedExecutions = existingExecutions.filter(e => e.status === 'failed');
      if (failedExecutions.length > 0) {
        if (!canRetry(id)) {
          return res.status(400).json({
            success: false,
            error: '重试次数已耗尽',
            message: `已达到最大重试次数（${request.max_retries}次）`,
            failed_executions: failedExecutions
          });
        }

        incrementRetryCount(id);
        const retryResult = retryFailedExecutions(id);

        if (retryResult.allSuccess) {
          return res.json({
            success: true,
            message: `重试成功（${retryResult.retryCount} 项）`,
            retry_count: retryResult.retryCount,
            results: retryResult.results
          });
        } else {
          updateRequestStatus(id, 'failed', '部分删除执行失败');
          return res.status(500).json({
            success: false,
            error: '重试后仍有失败项',
            message: `重试后仍有 ${retryResult.results.filter(r => r.status === 'failed').length} 项失败`,
            results: retryResult.results
          });
        }
      }
    }

    updateRequestStatus(id, 'executing');

    const plan = prepareDeletionPlan(id);
    createExecutionRecords(id, plan);

    const result = executeAll(id);

    if (result.allSuccess) {
      updateRequestStatus(id, 'executed');
      res.json({
        success: true,
        message: '删除执行完成',
        execution_count: result.results.length,
        results: result.results
      });
    } else {
      updateRequestStatus(id, 'failed', '部分删除执行失败');
      res.status(500).json({
        success: false,
        error: '执行失败',
        message: `有 ${result.results.filter(r => r.status === 'failed').length} 项操作失败`,
        results: result.results,
        next_step: '可以重试：POST /api/deletion/requests/:id/execute'
      });
    }
  } catch (error) {
    updateRequestStatus(req.params.id, 'failed', error.message);
    res.status(500).json({
      success: false,
      error: '执行失败',
      message: error.message
    });
  }
});

router.post('/requests/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const request = getRequestById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: '请求不存在',
        message: `删除请求 ${id} 不存在`
      });
    }

    if (request.status === 'completed') {
      const certificate = getCertificateByRequest(id);
      return res.json({
        success: true,
        message: '请求已完成',
        certificate
      });
    }

    if (request.status !== 'executed') {
      return res.status(400).json({
        success: false,
        error: '执行未完成',
        message: '请先执行删除操作：POST /api/deletion/requests/:id/execute'
      });
    }

    const certificate = createCertificate(id);
    markAsCompleted(id, certificate.certificate_id);

    res.json({
      success: true,
      message: '删除请求已完成，证明已生成',
      certificate_number: certificate.certificate_number,
      certificate_id: certificate.certificate_id,
      compliance_view: certificate.compliance_view,
      customer_view: certificate.customer_view
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '完成失败',
      message: error.message
    });
  }
});

router.get('/certificates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { view = 'compliance' } = req.query;

    let certificate;
    
    if (id.startsWith(config.CERTIFICATE_PREFIX)) {
      certificate = getCertificateByNumber(id);
    } else {
      certificate = getCertificateById(id);
    }

    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: '证明不存在',
        message: `删除证明 ${id} 不存在`
      });
    }

    if (view === 'customer') {
      res.json({
        success: true,
        certificate: certificate.customer_view
      });
    } else {
      res.json({
        success: true,
        certificate: certificate.compliance_view,
        certificate_number: certificate.certificate_number
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '查询失败',
      message: error.message
    });
  }
});

router.get('/compliance/dashboard', (req, res) => {
  try {
    const requests = getAllRequests();
    const statistics = {
      total: requests.length,
      by_status: {},
      recent_requests: []
    };

    requests.forEach(request => {
      if (!statistics.by_status[request.status]) {
        statistics.by_status[request.status] = 0;
      }
      statistics.by_status[request.status]++;
    });

    statistics.recent_requests = requests.slice(0, 10).map(request => {
      const summary = getDeletionSummary(request.id);
      return {
        ...request,
        summary
      };
    });

    res.json({
      success: true,
      statistics,
      requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '查询失败',
      message: error.message
    });
  }
});

module.exports = router;
