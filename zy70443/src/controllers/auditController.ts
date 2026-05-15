import { Request, Response } from 'express';
import {
  generateBatchId,
  auditCertificates,
  auditBusBookings,
  saveAuditBatch,
  getAuditBatch,
  getAuditResults,
  getAllAuditBatches,
} from '../services/auditService';
import {
  generateReportSummary,
  exportAnomaliesToCsv,
  exportFullReportToExcel,
  getAnomalyRecords,
} from '../services/reportService';
import { ApiResponse } from '../types';

export async function executeAudit(req: Request, res: Response) {
  try {
    const startTime = new Date();
    const batchId = generateBatchId();

    const certResult = await auditCertificates(batchId);
    const bookingResult = await auditBusBookings(batchId);

    const endTime = new Date();
    const executionTimeMs = endTime.getTime() - startTime.getTime();

    const batch = await saveAuditBatch(
      batchId,
      certResult.results,
      bookingResult.results,
      executionTimeMs,
      startTime.toISOString(),
      endTime.toISOString()
    );

    const report = await generateReportSummary(batchId);

    const response: ApiResponse = {
      success: true,
      code: 200,
      message: '审计执行完成',
      data: {
        batch,
        certificateSummary: certResult.summary,
        bookingSummary: bookingResult.summary,
        report,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      code: 500,
      message: '审计执行失败',
      errors: [
        {
          code: 'AUDIT_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : '未知错误',
        },
      ],
    };
    res.status(500).json(response);
  }
}

export async function getBatch(req: Request, res: Response) {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      const response: ApiResponse = {
        success: false,
        code: 400,
        message: '批次ID不能为空',
        errors: [
          {
            field: 'batchId',
            code: 'MISSING_PARAM',
            message: '批次ID是必填参数',
          },
        ],
      };
      return res.status(400).json(response);
    }

    const batch = await getAuditBatch(batchId);

    if (!batch) {
      const response: ApiResponse = {
        success: false,
        code: 404,
        message: '未找到指定的审计批次',
        errors: [
          {
            field: 'batchId',
            code: 'NOT_FOUND',
            message: `批次 ${batchId} 不存在`,
          },
        ],
      };
      return res.status(404).json(response);
    }

    const results = await getAuditResults(batchId);

    const response: ApiResponse = {
      success: true,
      code: 200,
      message: '获取审计批次成功',
      data: { batch, results },
    };

    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      code: 500,
      message: '获取审计批次失败',
      errors: [
        {
          code: 'GET_BATCH_ERROR',
          message: error instanceof Error ? error.message : '未知错误',
        },
      ],
    };
    res.status(500).json(response);
  }
}

export async function listBatches(req: Request, res: Response) {
  try {
    const batches = await getAllAuditBatches();

    const response: ApiResponse = {
      success: true,
      code: 200,
      message: '获取审计批次列表成功',
      data: { batches },
    };

    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      code: 500,
      message: '获取审计批次列表失败',
      errors: [
        {
          code: 'LIST_BATCHES_ERROR',
          message: error instanceof Error ? error.message : '未知错误',
        },
      ],
    };
    res.status(500).json(response);
  }
}

export async function getAnomalies(req: Request, res: Response) {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      const response: ApiResponse = {
        success: false,
        code: 400,
        message: '批次ID不能为空',
        errors: [
          {
            field: 'batchId',
            code: 'MISSING_PARAM',
            message: '批次ID是必填参数',
          },
        ],
      };
      return res.status(400).json(response);
    }

    const batch = await getAuditBatch(batchId);
    if (!batch) {
      const response: ApiResponse = {
        success: false,
        code: 404,
        message: '未找到指定的审计批次',
        errors: [
          {
            field: 'batchId',
            code: 'NOT_FOUND',
            message: `批次 ${batchId} 不存在`,
          },
        ],
      };
      return res.status(404).json(response);
    }

    const anomalies = await getAnomalyRecords(batchId);

    const response: ApiResponse = {
      success: true,
      code: 200,
      message: '获取异常记录成功',
      data: { anomalies, count: anomalies.length },
    };

    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      code: 500,
      message: '获取异常记录失败',
      errors: [
        {
          code: 'GET_ANOMALIES_ERROR',
          message: error instanceof Error ? error.message : '未知错误',
        },
      ],
    };
    res.status(500).json(response);
  }
}

export async function exportAnomalies(req: Request, res: Response) {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      const response: ApiResponse = {
        success: false,
        code: 400,
        message: '批次ID不能为空',
        errors: [
          {
            field: 'batchId',
            code: 'MISSING_PARAM',
            message: '批次ID是必填参数',
          },
        ],
      };
      return res.status(400).json(response);
    }

    const batch = await getAuditBatch(batchId);
    if (!batch) {
      const response: ApiResponse = {
        success: false,
        code: 404,
        message: '未找到指定的审计批次',
        errors: [
          {
            field: 'batchId',
            code: 'NOT_FOUND',
            message: `批次 ${batchId} 不存在`,
          },
        ],
      };
      return res.status(404).json(response);
    }

    const filePath = await exportAnomaliesToCsv(batchId);

    const response: ApiResponse = {
      success: true,
      code: 200,
      message: '异常记录导出成功',
      data: { filePath, downloadUrl: `/api/export/download?path=${encodeURIComponent(filePath)}` },
    };

    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      code: 500,
      message: '异常记录导出失败',
      errors: [
        {
          code: 'EXPORT_ANOMALIES_ERROR',
          message: error instanceof Error ? error.message : '未知错误',
        },
      ],
    };
    res.status(500).json(response);
  }
}

export async function exportReport(req: Request, res: Response) {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      const response: ApiResponse = {
        success: false,
        code: 400,
        message: '批次ID不能为空',
        errors: [
          {
            field: 'batchId',
            code: 'MISSING_PARAM',
            message: '批次ID是必填参数',
          },
        ],
      };
      return res.status(400).json(response);
    }

    const batch = await getAuditBatch(batchId);
    if (!batch) {
      const response: ApiResponse = {
        success: false,
        code: 404,
        message: '未找到指定的审计批次',
        errors: [
          {
            field: 'batchId',
            code: 'NOT_FOUND',
            message: `批次 ${batchId} 不存在`,
          },
        ],
      };
      return res.status(404).json(response);
    }

    const filePath = await exportFullReportToExcel(batchId);

    const response: ApiResponse = {
      success: true,
      code: 200,
      message: '完整报告导出成功',
      data: { filePath, downloadUrl: `/api/export/download?path=${encodeURIComponent(filePath)}` },
    };

    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      code: 500,
      message: '完整报告导出失败',
      errors: [
        {
          code: 'EXPORT_REPORT_ERROR',
          message: error instanceof Error ? error.message : '未知错误',
        },
      ],
    };
    res.status(500).json(response);
  }
}

export async function downloadExport(req: Request, res: Response) {
  try {
    const { path } = req.query;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        code: 400,
        message: '文件路径不能为空',
      });
    }

    const fs = require('fs');
    if (!fs.existsSync(path)) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: '文件不存在',
      });
    }

    res.download(path);
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: '文件下载失败',
    });
  }
}
