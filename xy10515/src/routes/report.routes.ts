import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';
import * as reportService from '../services/report.service';

const router = Router();

router.post('/merchant-statement', async (req: Request, res: Response) => {
  const statement = await reportService.generateMerchantStatement(req.body);
  successResponse(res, statement, '获取商户对账单成功');
});

router.get('/settlement-detail/:settlementNo', async (req: Request, res: Response) => {
  const report = await reportService.generateSettlementDetailReport(req.params.settlementNo);
  successResponse(res, report, '获取结算明细成功');
});

router.get('/settlement-export/:settlementNo', async (req: Request, res: Response) => {
  const filePath = await reportService.exportSettlementDetailCSV(req.params.settlementNo);
  res.download(filePath, `settlement_${req.params.settlementNo}.csv`);
});

router.post('/summary', async (req: Request, res: Response) => {
  const report = await reportService.generateSummaryReport(req.body);
  successResponse(res, report, '获取汇总报告成功');
});

export default router;
