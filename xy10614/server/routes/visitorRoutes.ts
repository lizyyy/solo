import express, { Request, Response } from 'express';
import { visitorService } from '../services/VisitorService';
import { store } from '../database/store';
import { APIResponse } from '../../shared/types';

const router = express.Router();

router.post('/visitors', (req: Request, res: Response) => {
  try {
    const { data, operator, operatorRole } = req.body;
    const visitor = visitorService.createVisitor(data, operator, operatorRole);
    res.json({ success: true, data: visitor } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/visitors/:id', (req: Request, res: Response) => {
  try {
    const visitor = store.getVisitor(req.params.id);
    if (!visitor) {
      return res.status(404).json({ success: false, error: '访客记录不存在' } as APIResponse);
    }
    res.json({ success: true, data: visitor } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/visitors', (req: Request, res: Response) => {
  try {
    const visitors = store.getAllVisitors();
    res.json({ success: true, data: visitors } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/host-confirm', (req: Request, res: Response) => {
  try {
    const { confirmed, operator, operatorRole, rejectReason } = req.body;
    const confirmation = visitorService.hostConfirm(req.params.id, confirmed, operator, operatorRole, rejectReason);
    res.json({ success: true, data: confirmation } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/plate-entry', (req: Request, res: Response) => {
  try {
    const { plateNumber, operator, operatorRole } = req.body;
    const entry = visitorService.verifyPlateEntry(req.params.id, plateNumber, operator, operatorRole);
    res.json({ success: true, data: entry } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/generate-qrcode', (req: Request, res: Response) => {
  try {
    const { operator, operatorRole } = req.body;
    const qrcode = visitorService.generateQRCode(req.params.id, operator, operatorRole);
    res.json({ success: true, data: qrcode } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/scan-qrcode', (req: Request, res: Response) => {
  try {
    const { qrcode, operator, operatorRole } = req.body;
    const result = visitorService.scanQRCode(req.params.id, qrcode, operator, operatorRole);
    res.json({ success: true, data: result } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/checkout', (req: Request, res: Response) => {
  try {
    const { checkoutType, operator, operatorRole } = req.body;
    const checkout = visitorService.checkout(req.params.id, checkoutType, operator, operatorRole);
    res.json({ success: true, data: checkout } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/visitors/:id/manual-review', (req: Request, res: Response) => {
  try {
    const { approved, operator, operatorRole, reason } = req.body;
    const visitor = visitorService.manualReview(req.params.id, approved, operator, operatorRole, reason);
    res.json({ success: true, data: visitor } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/visitors/:id/timeline', (req: Request, res: Response) => {
  try {
    const timeline = visitorService.getTimeline(req.params.id);
    res.json({ success: true, data: timeline } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/blacklist', (req: Request, res: Response) => {
  try {
    const { visitorName, visitorPhone, visitorIdCard, reason, addedBy, operatorRole } = req.body;
    const record = visitorService.addToBlacklist(visitorName, visitorPhone, visitorIdCard, reason, addedBy, operatorRole);
    res.json({ success: true, data: record } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.delete('/blacklist/:id', (req: Request, res: Response) => {
  try {
    const { removedBy, operatorRole, reason } = req.body;
    const record = visitorService.removeFromBlacklist(req.params.id, removedBy, operatorRole, reason);
    if (!record) {
      return res.status(404).json({ success: false, error: '黑名单记录不存在' } as APIResponse);
    }
    res.json({ success: true, data: record } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/blacklist', (req: Request, res: Response) => {
  try {
    const blacklist = store.getAllBlacklist();
    res.json({ success: true, data: blacklist } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.post('/security-report', (req: Request, res: Response) => {
  try {
    const { reportDate, generatedBy, operatorRole } = req.body;
    const report = visitorService.generateSecurityReport(reportDate, generatedBy, operatorRole);
    res.json({ success: true, data: report } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

router.get('/security-reports', (req: Request, res: Response) => {
  try {
    const reports = store.getAllSecurityReports();
    res.json({ success: true, data: reports } as APIResponse);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message } as APIResponse);
  }
});

export default router;
