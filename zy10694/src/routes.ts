import express, { Request, Response } from 'express';
import { extensionService } from './service';
import { CreateExtensionRequest, ExtensionStatus } from './types';

export const router = express.Router();

router.use(express.json());

router.post('/extensions', async (req: Request, res: Response) => {
  try {
    const request: CreateExtensionRequest = req.body;
    const extension = await extensionService.createExtension(request);
    res.status(201).json({
      success: true,
      data: extension
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/extensions', async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.status) {
      filters.status = req.query.status as ExtensionStatus;
    }
    if (req.query.caller) {
      filters.caller = req.query.caller as string;
    }
    if (req.query.apiPath) {
      filters.apiPath = req.query.apiPath as string;
    }

    const extensions = await extensionService.listExtensions(filters);
    res.json({
      success: true,
      data: extensions
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/extensions/:id', async (req: Request, res: Response) => {
  try {
    const extension = await extensionService.getExtension(req.params.id);
    if (!extension) {
      return res.status(404).json({
        success: false,
        error: '延期记录不存在'
      });
    }
    res.json({
      success: true,
      data: extension
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/extensions/:id/approve', async (req: Request, res: Response) => {
  try {
    const { approvedBy } = req.body;
    if (!approvedBy) {
      return res.status(400).json({
        success: false,
        error: '审批人不能为空'
      });
    }

    const extension = await extensionService.approveExtension(req.params.id, approvedBy);
    res.json({
      success: true,
      data: extension
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/extensions/:id/reject', async (req: Request, res: Response) => {
  try {
    const { approvedBy } = req.body;
    if (!approvedBy) {
      return res.status(400).json({
        success: false,
        error: '审批人不能为空'
      });
    }

    const extension = await extensionService.rejectExtension(req.params.id, approvedBy);
    res.json({
      success: true,
      data: extension
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/extensions/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const extension = await extensionService.withdrawExtension(req.params.id);
    res.json({
      success: true,
      data: extension
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/sync-check', async (req: Request, res: Response) => {
  try {
    const { apiPath, caller } = req.query;
    if (!apiPath) {
      return res.status(400).json({
        success: false,
        error: 'apiPath不能为空'
      });
    }

    const results = await extensionService.checkSyncStatus(
      apiPath as string,
      caller as string | undefined
    );
    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/unsynced', async (req: Request, res: Response) => {
  try {
    const extensions = await extensionService.getUnsyncedExtensions();
    res.json({
      success: true,
      data: extensions
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';
    const filters: any = {};
    if (req.query.status) {
      filters.status = req.query.status as ExtensionStatus;
    }
    if (req.query.caller) {
      filters.caller = req.query.caller as string;
    }

    const content = await extensionService.exportExtensions(format as any, filters);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="deprecation-extensions.csv"');
    } else {
      res.setHeader('Content-Type', 'application/json');
    }

    res.send(content);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/expiring', async (req: Request, res: Response) => {
  try {
    const daysBefore = parseInt(req.query.daysBefore as string) || 7;
    const extensions = await extensionService.getExpiringExtensions(daysBefore);
    res.json({
      success: true,
      data: extensions
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.patch('/extensions/:id/sync-status', async (req: Request, res: Response) => {
  try {
    const { syncStatus, syncMessage } = req.body;
    if (!syncStatus || !['synced', 'pending', 'failed'].includes(syncStatus)) {
      return res.status(400).json({
        success: false,
        error: 'syncStatus必须是synced、pending或failed'
      });
    }

    const extension = await extensionService.updateSyncStatus(
      req.params.id,
      syncStatus,
      syncMessage
    );
    res.json({
      success: true,
      data: extension
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
