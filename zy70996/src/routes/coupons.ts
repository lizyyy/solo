import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';

const router = Router();

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { coupons, operator } = req.body;

    if (!Array.isArray(coupons)) {
      return res.status(400).json({ error: '券码数据必须是数组格式' });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const c of coupons) {
      try {
        const coupon = await prisma.coupon.create({
          data: {
            id: c.id || `coupon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            code: c.code,
            batchId: c.batchId,
          },
        });
        results.push({ code: c.code, success: true, coupon });
        successCount++;
      } catch (error: any) {
        results.push({ code: c.code, success: false, error: error.message });
        failCount++;
      }
    }

    await prisma.importHistory.create({
      data: {
        id: `import_${Date.now()}`,
        type: 'COUPON',
        fileName: 'api_import',
        recordCount: coupons.length,
        successCount,
        failCount,
        operator: operator || 'system',
        batchId: coupons[0]?.batchId,
      },
    });

    res.json({
      success: true,
      total: coupons.length,
      successCount,
      failCount,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { batchId, status, employeeId } = req.query;
    const where: any = {};
    if (batchId) where.batchId = batchId;
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;

    const coupons = await prisma.coupon.findMany({
      where,
      include: {
        batch: true,
        employee: true,
      },
    });
    res.json(coupons);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { batchId, count, prefix, operator } = req.body;

    if (!batchId || !count) {
      return res.status(400).json({ error: '缺少必要参数: batchId, count' });
    }

    const coupons = [];
    for (let i = 0; i < count; i++) {
      const code = `${prefix || ''}${Date.now()}${i.toString().padStart(4, '0')}`;
      coupons.push({
        id: `coupon_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
        code,
        batchId,
      });
    }

    let createdCount = 0;
    for (const coupon of coupons) {
      try {
        await prisma.coupon.create({ data: coupon });
        createdCount++;
      } catch (e) {}
    }
    const result = { count: createdCount };

    await prisma.importHistory.create({
      data: {
        id: `import_${Date.now()}`,
        type: 'COUPON_GENERATE',
        fileName: 'auto_generate',
        recordCount: count,
        successCount: result.count,
        failCount: count - result.count,
        operator: operator || 'system',
        batchId,
      },
    });

    res.json({
      success: true,
      generated: result.count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
