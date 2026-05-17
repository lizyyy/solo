import express, { Request, Response } from 'express';
import { appealService } from '../services/appealService';
import { CreateAppealRequest, UpdateStatusRequest, ManualCorrectionRequest, QueryParams } from '../types';

const router = express.Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const request: CreateAppealRequest = req.body;

    if (!request.reportName || !request.snapshotDate || !request.appellant || !request.appealReason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: reportName, snapshotDate, appellant, appealReason'
      });
    }

    if (!request.metricValues || Object.keys(request.metricValues).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'metricValues cannot be empty'
      });
    }

    const result = await appealService.createAppeal(request);

    res.status(result.isDuplicate ? 200 : 201).json({
      success: true,
      data: {
        appeal: result.appeal,
        isDuplicate: result.isDuplicate
      }
    });
  } catch (error: any) {
    console.error('Error creating appeal:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      rawInput: req.body
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const appeal = await appealService.getAppealById(req.params.id);

    if (!appeal) {
      return res.status(404).json({
        success: false,
        error: 'Appeal not found'
      });
    }

    res.json({
      success: true,
      data: appeal
    });
  } catch (error: any) {
    console.error('Error getting appeal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const params: QueryParams = {
      reportName: req.query.reportName as string,
      snapshotDate: req.query.snapshotDate as string,
      status: req.query.status as any,
      appellant: req.query.appellant as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined
    };

    const result = await appealService.queryAppeals(params);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: params.page || 1,
        pageSize: params.pageSize || 20
      }
    });
  } catch (error: any) {
    console.error('Error querying appeals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const request: UpdateStatusRequest = req.body;

    if (!request.status || !request.operator) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: status, operator'
      });
    }

    const updatedAppeal = await appealService.updateStatus(req.params.id, request);

    res.json({
      success: true,
      data: updatedAppeal
    });
  } catch (error: any) {
    console.error('Error updating appeal status:', error);
    if (error.message === 'Appeal not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    if (error.message.includes('Invalid status transition')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/correction', async (req: Request, res: Response) => {
  try {
    const request: ManualCorrectionRequest = req.body;

    if (!request.correctedValues || !request.correctedBy || !request.correctionReason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: correctedValues, correctedBy, correctionReason'
      });
    }

    const correction = await appealService.manualCorrection(req.params.id, request);

    res.status(201).json({
      success: true,
      data: correction
    });
  } catch (error: any) {
    console.error('Error creating correction:', error);
    if (error.message === 'Appeal not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    if (error.message.includes('Correction can only be performed')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/corrections', async (req: Request, res: Response) => {
  try {
    const corrections = await appealService.getCorrectionsByAppealId(req.params.id);

    res.json({
      success: true,
      data: corrections
    });
  } catch (error: any) {
    console.error('Error getting corrections:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/report', async (req: Request, res: Response) => {
  try {
    const { generatedBy } = req.body;
    const report = await appealService.generateExplanationReport(req.params.id, generatedBy);

    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error: any) {
    console.error('Error generating report:', error);
    if (error.message === 'Appeal not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/report', async (req: Request, res: Response) => {
  try {
    const report = await appealService.getReportByAppealId(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found, please generate one first'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    console.error('Error getting report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const exportData = await appealService.exportAppealData(req.params.id);

    res.json({
      success: true,
      data: exportData
    });
  } catch (error: any) {
    console.error('Error exporting appeal data:', error);
    if (error.message === 'Appeal not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/snapshot', async (req: Request, res: Response) => {
  try {
    const appeal = await appealService.getAppealById(req.params.id);

    if (!appeal) {
      return res.status(404).json({
        success: false,
        error: 'Appeal not found'
      });
    }

    const snapshot = await appealService.getSnapshotById(appeal.snapshotId);

    res.json({
      success: true,
      data: snapshot
    });
  } catch (error: any) {
    console.error('Error getting snapshot:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
