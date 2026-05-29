import { Router, type Request, type Response } from 'express';
import type { Report } from '../../src/types';

const router = Router();

let mockReports: Report[] = [];

const generateId = () => Math.random().toString(36).substring(2, 11);

router.get('/', (req: Request, res: Response) => {
  const { type, generatedBy, page = 1, pageSize = 20 } = req.query;
  
  let result = [...mockReports];
  
  if (type) {
    const types = String(type).split(',');
    result = result.filter(r => types.includes(r.type));
  }
  
  if (generatedBy) {
    result = result.filter(r => r.generatedBy === String(generatedBy));
  }
  
  result.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  
  const total = result.length;
  const start = (Number(page) - 1) * Number(pageSize);
  const end = start + Number(pageSize);
  const paginated = result.slice(start, end);
  
  res.json({
    success: true,
    data: paginated,
    pagination: {
      page: Number(page),
      pageSize: Number(pageSize),
      total,
      totalPages: Math.ceil(total / Number(pageSize)),
    },
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const report = mockReports.find(r => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({
      success: false,
      error: 'Report not found',
    });
  }
  res.json({
    success: true,
    data: report,
  });
});

router.post('/', (req: Request, res: Response) => {
  const { type, title, generatedBy = '当前用户', flagIds, summary } = req.body;
  
  const newReport: Report = {
    id: `report-${generateId()}`,
    title: title || `${type === 'cleanup' ? '清理' : type === 'risk' ? '风险' : '扫描'}报告 - ${new Date().toLocaleDateString('zh-CN')}`,
    type,
    generatedAt: new Date().toISOString(),
    generatedBy,
    summary,
    flagIds: flagIds || [],
  };
  
  mockReports = [newReport, ...mockReports];
  
  res.status(201).json({
    success: true,
    data: newReport,
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const index = mockReports.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Report not found',
    });
  }
  const deleted = mockReports[index];
  mockReports = mockReports.filter(r => r.id !== req.params.id);
  res.json({
    success: true,
    data: deleted,
  });
});

router.get('/:id/export', (req: Request, res: Response) => {
  const report = mockReports.find(r => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({
      success: false,
      error: 'Report not found',
    });
  }
  
  const { format = 'json' } = req.query;
  
  if (format === 'xlsx') {
    res.json({
      success: true,
      message: 'Excel export would be generated here',
      data: report,
    });
  } else {
    res.json({
      success: true,
      data: report,
    });
  }
});

router.get('/statistics', (req: Request, res: Response) => {
  const byType: Record<string, number> = {
    cleanup: 0,
    risk: 0,
    scan: 0,
  };
  
  mockReports.forEach(r => {
    byType[r.type]++;
  });
  
  const totalSafeToDelete = mockReports.reduce((sum, r) => sum + r.summary.safeToDelete, 0);
  const totalNeedVerification = mockReports.reduce((sum, r) => sum + r.summary.needVerification, 0);
  const totalBlockers = mockReports.reduce((sum, r) => sum + r.summary.blockers, 0);
  
  const byGenerator: Record<string, number> = {};
  mockReports.forEach(r => {
    byGenerator[r.generatedBy] = (byGenerator[r.generatedBy] || 0) + 1;
  });
  
  res.json({
    success: true,
    data: {
      byType,
      totalReports: mockReports.length,
      totalSafeToDelete,
      totalNeedVerification,
      totalBlockers,
      byGenerator,
    },
  });
});

export default router;
