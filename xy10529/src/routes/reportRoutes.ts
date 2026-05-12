import { Router, Request, Response } from 'express';
import { benefitService } from '../services/benefitService';

const router = Router();

router.get('/export', (req: Request, res: Response) => {
  const { memberId, benefitId, format } = req.query;

  const result = benefitService.exportReport({
    memberId: memberId as string,
    benefitId: benefitId as string
  });

  if (format === 'csv' && result.success && result.data) {
    const headers = Object.keys(result.data[0] || {}).join(',');
    const rows = result.data.map((row: any) => 
      Object.values(row).map(val => {
        const str = String(val);
        return str.includes(',') || str.includes('"') 
          ? `"${str.replace(/"/g, '""')}"` 
          : str;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=benefit_report.csv');
    return res.send('\uFEFF' + csv);
  }

  res.json(result);
});

router.get('/all', (req: Request, res: Response) => {
  const data = benefitService.getAllData();
  res.json({
    success: true,
    data,
    message: '查询成功'
  });
});

export { router as reportRouter };
