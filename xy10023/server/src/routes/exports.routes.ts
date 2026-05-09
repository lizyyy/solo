import { Router } from 'express';
import path from 'path';
import { requireAgent, requireSupervisor, AuthenticatedRequest } from '../middlewares/auth.middleware';
import exportService, { ExportFormat, ExportOptions } from '../services/export.service';
import taskQueueService from '../services/taskQueue.service';
import logger from '../utils/logger';

const router = Router();

taskQueueService.registerHandler('export:generate', async (data) => {
  const options = data.options as ExportOptions;
  const result = await exportService.createExport(options);
  return { success: true, data: result };
});

router.post('/', requireSupervisor, async (req: AuthenticatedRequest, res) => {
  try {
    const { format, type, filters, includeDetails, includeEvents } = req.body;

    if (!format || !type) {
      res.status(400).json({
        error: 'MISSING_PARAMS',
        message: 'Format and type are required',
      });
      return;
    }

    const validFormats: ExportFormat[] = ['excel', 'markdown', 'pdf'];
    if (!validFormats.includes(format)) {
      res.status(400).json({
        error: 'INVALID_FORMAT',
        message: 'Invalid format. Must be: excel, markdown, or pdf',
      });
      return;
    }

    const validTypes: ExportOptions['type'][] = ['tickets', 'followups', 'events', 'comprehensive'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        error: 'INVALID_TYPE',
        message: 'Invalid type. Must be: tickets, followups, events, or comprehensive',
      });
      return;
    }

    const job = await taskQueueService.addTask('exports', 'export:generate', {
      taskType: 'export:generate',
      data: {
        options: {
          format,
          type,
          filters: filters && {
            ...filters,
            startDate: filters.startDate ? new Date(filters.startDate) : undefined,
            endDate: filters.endDate ? new Date(filters.endDate) : undefined,
          },
          includeDetails,
          includeEvents,
        },
      },
    });

    res.status(202).json({
      message: 'Export job started',
      jobId: job.id,
    });
  } catch (error) {
    logger.error('Create export failed:', error);
    res.status(500).json({
      error: 'EXPORT_FAILED',
      message: 'Failed to start export job',
    });
  }
});

router.get('/status/:jobId', requireAgent, async (req, res) => {
  try {
    const status = await taskQueueService.getJobStatus('exports', req.params.jobId);
    
    if (!status) {
      res.status(404).json({
        error: 'JOB_NOT_FOUND',
        message: 'Export job not found',
      });
      return;
    }

    res.json(status);
  } catch (error) {
    logger.error('Get export status failed:', error);
    res.status(500).json({
      error: 'STATUS_FAILED',
      message: 'Failed to get export job status',
    });
  }
});

router.get('/download/:filename', requireAgent, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = await exportService.getExportFilePath(filename);

    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.md': 'text/markdown',
      '.pdf': 'application/pdf',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.download(filePath, filename);
  } catch (error) {
    logger.error('Download export failed:', error);
    res.status(404).json({
      error: 'FILE_NOT_FOUND',
      message: 'Export file not found or expired',
    });
  }
});

router.get('/queue/metrics', requireSupervisor, async (req, res) => {
  try {
    const metrics = await taskQueueService.getQueueMetrics('exports');
    res.json(metrics);
  } catch (error) {
    logger.error('Get queue metrics failed:', error);
    res.status(500).json({
      error: 'METRICS_FAILED',
      message: 'Failed to get queue metrics',
    });
  }
});

export default router;
