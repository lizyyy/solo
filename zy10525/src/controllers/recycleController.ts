import { Request, Response } from 'express';
import { recycleService } from '../services/recycleService';
import { exportService } from '../services/exportService';
import { CreateRecycleRequest, StatusTransitionRequest, ManualCorrectionRequest, ExceptionHandleRequest, QueryRecycleRequest } from '../types';

export const createRecycle = (req: Request, res: Response) => {
  try {
    const request: CreateRecycleRequest = req.body;
    const record = recycleService.create(request);
    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getRecycleById = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = recycleService.findById(id);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const queryRecycle = (req: Request, res: Response) => {
  try {
    const query: QueryRecycleRequest = req.query as any;
    const result = recycleService.query(query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const transitionStatus = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: StatusTransitionRequest = req.body;
    
    const record = recycleService.transitionStatus(id, request);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const handleException = (req: Request, res: Response) => {
  try {
    const { id, exceptionId } = req.params;
    const request: ExceptionHandleRequest = req.body;
    
    const record = recycleService.handleException(id, exceptionId, request);
    if (!record) {
      return res.status(404).json({ error: 'Record or exception not found' });
    }
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const manualCorrection = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: ManualCorrectionRequest = req.body;
    
    const record = recycleService.manualCorrection(id, request);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportRecycle = (req: Request, res: Response) => {
  try {
    const { type = 'detail' } = req.query;
    const records = recycleService.getAllForExport();
    
    let csv: string;
    let filename: string;
    
    if (type === 'statistics') {
      csv = exportService.exportStatistics(records);
      filename = `gray-config-recycle-statistics-${Date.now()}.csv`;
    } else {
      csv = exportService.exportToCSV(records);
      filename = `gray-config-recycle-detail-${Date.now()}.csv`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateHitTenants = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenants } = req.body;
    
    const record = recycleService.updateHitTenants(id, tenants);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const triggerExpirationCheck = (req: Request, res: Response) => {
  try {
    recycleService.checkExpirations();
    res.json({ message: 'Expiration check completed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const triggerReminders = (req: Request, res: Response) => {
  try {
    recycleService.sendReminders();
    res.json({ message: 'Reminders sent' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
