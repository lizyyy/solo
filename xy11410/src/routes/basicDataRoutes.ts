import { Router, Request, Response } from 'express';
import { basicDataService } from '../services/BasicDataService';
import { validationService } from '../services/ValidationService';

const router = Router();

router.post('/franchises', async (req: Request, res: Response) => {
  try {
    const franchise = await basicDataService.importFranchise(req.body);
    res.json({ success: true, data: franchise });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/franchises', async (req: Request, res: Response) => {
  try {
    const list = await basicDataService.getFranchiseList();
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/materials', async (req: Request, res: Response) => {
  try {
    const material = await basicDataService.importMaterial(req.body);
    res.json({ success: true, data: material });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/materials', async (req: Request, res: Response) => {
  try {
    const list = await basicDataService.getMaterialList();
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/orders', async (req: Request, res: Response) => {
  try {
    const result = await basicDataService.importOrder(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/orders', async (req: Request, res: Response) => {
  try {
    const result = await basicDataService.getOrderList({
      franchiseId: req.query.franchiseId as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/loss-records', async (req: Request, res: Response) => {
  try {
    const result = await basicDataService.importLossRecord(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/loss-records', async (req: Request, res: Response) => {
  try {
    const result = await basicDataService.getLossRecordList({
      franchiseId: req.query.franchiseId as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/headquarters-prices', async (req: Request, res: Response) => {
  try {
    const price = await basicDataService.importHeadquartersPrice(req.body);
    res.json({ success: true, data: price });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/refund-records', async (req: Request, res: Response) => {
  try {
    const refund = await basicDataService.importRefundRecord(req.body);
    res.json({ success: true, data: refund });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/refund-records', async (req: Request, res: Response) => {
  try {
    const result = await basicDataService.getRefundRecordList({
      franchiseId: req.query.franchiseId as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/failed-records', async (req: Request, res: Response) => {
  try {
    const records = await validationService.getFailedRecords(
      req.query.sourceType as string,
      req.query.isResolved === 'true'
    );
    res.json({ success: true, data: records });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/failed-records/:id/resolve', async (req: Request, res: Response) => {
  try {
    const success = await validationService.resolveFailedRecord(
      req.params.id,
      req.body.remark
    );
    res.json({ success, data: { resolved: success } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
