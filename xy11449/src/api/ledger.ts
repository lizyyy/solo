import { Router, Request, Response } from 'express';
import { DataSource, Role, ViewFilter, FaultStatus } from '../models/types';
import { importData } from '../importers';
import { LedgerService } from '../services/ledgerService';
import { ExportService } from '../services/exportService';
import * as path from 'path';

const router = Router();

const getClientIp = (req: Request): string => {
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const getOperatorInfo = (req: Request) => {
  const operator = req.headers['x-operator'] as string || 'system';
  const role = (req.headers['x-role'] as Role) || Role.ADMIN;
  return { operator, role: role as Role, ip: getClientIp(req) };
};

router.post('/import/:source', async (req: Request, res: Response) => {
  try {
    const source = req.params.source as DataSource;
    const { data, sourceName } = req.body;
    const { operator } = getOperatorInfo(req);

    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'data 必须是数组' });
    }

    const importResult = await importData(source, data, sourceName || 'api_import', operator);
    
    res.json({
      success: true,
      importResult
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.get('/records', (req: Request, res: Response) => {
  try {
    const filter: ViewFilter = {};
    
    if (req.query.status) filter.status = req.query.status as any;
    if (req.query.faultStatus) filter.faultStatus = req.query.faultStatus as any;
    if (req.query.area) filter.area = req.query.area as string;
    if (req.query.pileId) filter.pileId = req.query.pileId as string;
    if (req.query.startDate && req.query.endDate) {
      filter.dateRange = {
        start: req.query.startDate as string,
        end: req.query.endDate as string
      };
    }

    const records = LedgerService.listRecords(filter);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.get('/records/:id', (req: Request, res: Response) => {
  try {
    const { role } = getOperatorInfo(req);
    const details = ExportService.getRecordForView(req.params.id, role);
    
    if (!details) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    res.json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.get('/records/:id/diff', (req: Request, res: Response) => {
  try {
    const changes = LedgerService.getChangeDiff(req.params.id);
    res.json({ success: true, data: changes });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.get('/records/:id/audit', (req: Request, res: Response) => {
  try {
    const audits = LedgerService.getAuditTrail(req.params.id);
    res.json({ success: true, data: audits });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.post('/records/:id/submit', (req: Request, res: Response) => {
  try {
    const { operator, role, ip } = getOperatorInfo(req);
    const record = LedgerService.submitRecord(req.params.id, operator, role, ip);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.post('/records/:id/reject', (req: Request, res: Response) => {
  try {
    const { operator, role, ip } = getOperatorInfo(req);
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: '驳回原因必填' });
    }
    const record = LedgerService.rejectRecord(req.params.id, operator, role, reason, ip);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.post('/records/:id/confirm', (req: Request, res: Response) => {
  try {
    const { operator, role, ip } = getOperatorInfo(req);
    const record = LedgerService.secondaryConfirm(req.params.id, operator, role, ip);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.post('/records/:id/freeze', (req: Request, res: Response) => {
  try {
    const { operator, role, ip } = getOperatorInfo(req);
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: '冻结原因必填' });
    }
    const record = LedgerService.freezeRecord(req.params.id, operator, role, reason, ip);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.post('/records/:id/withdraw', (req: Request, res: Response) => {
  try {
    const { operator, role, ip } = getOperatorInfo(req);
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: '撤回原因必填' });
    }
    const record = LedgerService.withdrawToDraft(req.params.id, operator, role, reason, ip);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.patch('/records/:id', (req: Request, res: Response) => {
  try {
    const { operator, role, ip } = getOperatorInfo(req);
    const { updates, reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: '修改原因必填' });
    }
    const record = LedgerService.manualUpdate(req.params.id, operator, role, updates, reason, ip);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.patch('/records/:id/fault-status', (req: Request, res: Response) => {
  try {
    const { operator, role, ip } = getOperatorInfo(req);
    const { faultStatus, reason, endTime } = req.body;
    if (!faultStatus || !reason) {
      return res.status(400).json({ success: false, error: 'faultStatus 和 reason 必填' });
    }
    const record = LedgerService.updateFaultStatus(
      req.params.id, 
      faultStatus as FaultStatus, 
      operator, 
      role, 
      reason, 
      endTime,
      ip
    );
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.get('/statistics', (req: Request, res: Response) => {
  try {
    const filter: ViewFilter = {};
    if (req.query.area) filter.area = req.query.area as string;
    if (req.query.startDate && req.query.endDate) {
      filter.dateRange = {
        start: req.query.startDate as string,
        end: req.query.endDate as string
      };
    }

    const stats = LedgerService.getStatistics(filter);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.get('/report', (req: Request, res: Response) => {
  try {
    const filter: ViewFilter = {};
    if (req.query.area) filter.area = req.query.area as string;
    if (req.query.startDate && req.query.endDate) {
      filter.dateRange = {
        start: req.query.startDate as string,
        end: req.query.endDate as string
      };
    }

    const report = ExportService.generateReport(filter);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.post('/export', (req: Request, res: Response) => {
  try {
    const { role } = getOperatorInfo(req);
    const { options, filter } = req.body;
    
    const exportDir = path.join(process.cwd(), 'data', 'exported');
    const filePath = ExportService.exportToFile(options, exportDir, filter, role);
    
    res.json({ 
      success: true, 
      data: { 
        filePath,
        downloadUrl: `/api/download/${path.basename(filePath)}`
      } 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

export default router;
