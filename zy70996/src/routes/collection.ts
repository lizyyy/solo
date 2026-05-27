import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { createAuditLog } from '../utils/audit';
import csv from 'csv-parser';
import { PassThrough } from 'stream';

const router = Router();

async function validateCollection(employeeId: string, batchId: string, proxyEmployeeId?: string) {
  const issues: { type: string; message: string }[] = [];

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    issues.push({ type: 'EMPLOYEE_NOT_FOUND', message: `员工 ${employeeId} 不存在` });
    return { valid: false, issues, employee: null };
  }

  if (employee.status !== 'ACTIVE') {
    issues.push({
      type: 'EMPLOYEE_INACTIVE',
      message: `员工 ${employee.name} (${employeeId}) 已离职，状态: ${employee.status}`,
    });
  }

  const existingRecord = await prisma.collectionRecord.findFirst({
    where: {
      employeeId,
      batchId,
      status: { in: ['APPROVED', 'PROXIED'] },
    },
  });

  if (existingRecord) {
    issues.push({
      type: 'DUPLICATE_COLLECTION',
      message: `员工 ${employee.name} 已在该批次领取过，记录ID: ${existingRecord.id}`,
    });
  }

  const batch = await prisma.benefitBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    issues.push({ type: 'BATCH_NOT_FOUND', message: `批次 ${batchId} 不存在` });
  } else if (batch.status !== 'ACTIVE') {
    issues.push({ type: 'BATCH_INACTIVE', message: `批次 ${batch.name} 已关闭` });
  }

  if (proxyEmployeeId) {
    const proxyEmployee = await prisma.employee.findUnique({ where: { id: proxyEmployeeId } });
    if (!proxyEmployee) {
      issues.push({ type: 'PROXY_NOT_FOUND', message: `代领人 ${proxyEmployeeId} 不存在` });
    } else if (proxyEmployee.status !== 'ACTIVE') {
      issues.push({ type: 'PROXY_INACTIVE', message: `代领人 ${proxyEmployee.name} 已离职` });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    employee,
    batch,
  };
}

router.post('/import/csv', async (req: Request, res: Response) => {
  try {
    const { batchId, operator, csvContent } = req.body;

    if (!batchId || !csvContent) {
      return res.status(400).json({ error: '缺少必要参数: batchId, csvContent' });
    }

    const batch = await prisma.benefitBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const results: any[] = [];
    const stream = new PassThrough();
    stream.end(csvContent);

    const records: any[] = [];
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data: any) => records.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    let successCount = 0;
    let failCount = 0;
    const sourceId = `csv_import_${Date.now()}`;

    for (const row of records) {
      try {
        const employeeId = row.employeeId || row.工号 || row.id;
        const method = (row.method || row.领取方式 || 'SELF').toUpperCase();
        const proxyEmployeeId = row.proxyEmployeeId || row.代领人工号;
        const couponCode = row.couponCode || row.券码;
        const reason = row.reason || row.备注;

        if (!employeeId) {
          results.push({ row, success: false, error: '缺少员工ID' });
          failCount++;
          continue;
        }

        const validation = await validateCollection(employeeId, batchId, proxyEmployeeId);

        let recordMethod: string = 'SELF';
        if (method === 'PROXY' || method === '代领') recordMethod = 'PROXY';
        else if (method === 'MAIL' || method === '邮寄') recordMethod = 'MAIL';

        let status: string = 'PENDING';
        let rejectionReason: string | undefined;

        const inactiveIssue = validation.issues.find(i => i.type === 'EMPLOYEE_INACTIVE');
        const duplicateIssue = validation.issues.find(i => i.type === 'DUPLICATE_COLLECTION');

        if (inactiveIssue) {
          status = 'REJECTED';
          rejectionReason = inactiveIssue.message;
        } else if (duplicateIssue) {
          status = 'REJECTED';
          rejectionReason = duplicateIssue.message;
        }

        let couponId: string | undefined;
        if (couponCode) {
          const coupon = await prisma.coupon.findFirst({
            where: { code: couponCode, batchId, status: 'AVAILABLE' },
          });
          if (coupon) {
            couponId = coupon.id;
          }
        }

        const record = await prisma.collectionRecord.create({
          data: {
            id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            employeeId,
            batchId,
            method: recordMethod,
            status,
            proxyEmployeeId: recordMethod === 'PROXY' ? proxyEmployeeId : undefined,
            couponId,
            reason,
            rejectionReason,
            handledBy: status !== 'PENDING' ? operator : undefined,
            handledAt: status !== 'PENDING' ? new Date() : undefined,
            sourceType: 'CSV',
            sourceId,
          },
        });

        if (couponId && status === 'APPROVED') {
          await prisma.coupon.update({
            where: { id: couponId },
            data: {
              status: 'USED',
              employeeId,
              usedAt: new Date(),
              collectionRecordId: record.id,
            },
          });
        }

        await createAuditLog(
          record.id,
          status === 'REJECTED' ? 'IMPORT_REJECTED' : 'IMPORTED',
          operator,
          undefined,
          status,
          rejectionReason,
          JSON.stringify({ row, issues: validation.issues })
        );

        results.push({
          row,
          success: true,
          recordId: record.id,
          status,
          issues: validation.issues,
        });
        successCount++;
      } catch (error: any) {
        results.push({ row, success: false, error: error.message });
        failCount++;
      }
    }

    await prisma.importHistory.create({
      data: {
        id: sourceId,
        type: 'COLLECTION_CSV',
        fileName: 'api_csv_import',
        recordCount: records.length,
        successCount,
        failCount,
        operator: operator || 'system',
        batchId,
      },
    });

    res.json({
      success: true,
      total: records.length,
      successCount,
      failCount,
      sourceId,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { employeeId, batchId, method, proxyEmployeeId, couponId, reason, operator } = req.body;

    if (!employeeId || !batchId) {
      return res.status(400).json({ error: '缺少必要参数: employeeId, batchId' });
    }

    const validation = await validateCollection(employeeId, batchId, proxyEmployeeId);

    if (validation.issues.length > 0) {
      return res.status(400).json({
        error: '校验失败',
        issues: validation.issues,
      });
    }

    const recordMethod = method || 'SELF';
    const record = await prisma.collectionRecord.create({
      data: {
        id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        employeeId,
        batchId,
        method: recordMethod,
        status: 'PENDING',
        proxyEmployeeId: recordMethod === 'PROXY' ? proxyEmployeeId : undefined,
        couponId,
        reason,
        sourceType: 'MANUAL',
        sourceId: `manual_${Date.now()}`,
      },
    });

    await createAuditLog(
      record.id,
      'CREATED',
      operator || 'system',
      undefined,
      'PENDING',
      reason,
      JSON.stringify(req.body)
    );

    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { operator, reason } = req.body;
    const recordId = req.params.id;

    const record = await prisma.collectionRecord.findUnique({
      where: { id: recordId },
      include: { employee: true, batch: true },
    });

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    if (record.employee && record.employee.status !== 'ACTIVE') {
      return res.status(400).json({ error: '员工已离职，无法批准' });
    }

    const updated = await prisma.collectionRecord.update({
      where: { id: recordId },
      data: {
        status: 'APPROVED',
        handledBy: operator,
        handledAt: new Date(),
      },
    });

    if (record.couponId) {
      await prisma.coupon.update({
        where: { id: record.couponId },
        data: {
          status: 'USED',
          employeeId: record.employeeId,
          usedAt: new Date(),
          collectionRecordId: record.id,
        },
      });
    }

    await createAuditLog(
      recordId,
      'APPROVED',
      operator,
      record.status,
      'APPROVED',
      reason,
      undefined
    );

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { operator, reason } = req.body;
    const recordId = req.params.id;

    const record = await prisma.collectionRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const updated = await prisma.collectionRecord.update({
      where: { id: recordId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        handledBy: operator,
        handledAt: new Date(),
      },
    });

    await createAuditLog(
      recordId,
      'REJECTED',
      operator,
      record.status,
      'REJECTED',
      reason,
      undefined
    );

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/return', async (req: Request, res: Response) => {
  try {
    const { operator, reason } = req.body;
    const recordId = req.params.id;

    const record = await prisma.collectionRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const updated = await prisma.collectionRecord.update({
      where: { id: recordId },
      data: {
        status: 'RETURNED',
        rejectionReason: reason,
        handledBy: operator,
        handledAt: new Date(),
      },
    });

    await createAuditLog(
      recordId,
      'RETURNED',
      operator,
      record.status,
      'RETURNED',
      reason,
      '退回修改，需要补充材料'
    );

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      employeeStatus,
      batchId,
      method,
      status,
      employeeId,
      sourceType,
      startDate,
      endDate,
    } = req.query;

    const where: any = {};

    if (batchId) where.batchId = batchId;
    if (method) where.method = method;
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    if (sourceType) where.sourceType = sourceType;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const records = await prisma.collectionRecord.findMany({
      where,
      include: {
        employee: true,
        batch: true,
        proxyEmployee: true,
        coupon: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let filteredRecords = records;
    if (employeeStatus) {
      filteredRecords = records.filter((r: any) => r.employee && r.employee.status === employeeStatus);
    }

    res.json({
      total: filteredRecords.length,
      records: filteredRecords,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const record = await prisma.collectionRecord.findUnique({
      where: { id: req.params.id },
      include: {
        employee: true,
        batch: true,
        proxyEmployee: true,
        coupon: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/trace', async (req: Request, res: Response) => {
  try {
    const record = await prisma.collectionRecord.findUnique({
      where: { id: req.params.id },
      include: {
        employee: true,
        batch: true,
        proxyEmployee: true,
        auditLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const trace = {
      recordId: record.id,
      employee: {
        id: record.employee?.id,
        name: record.employee?.name,
        department: record.employee?.department,
        status: record.employee?.status,
      },
      batch: {
        id: record.batch.id,
        name: record.batch.name,
        benefitType: record.batch.benefitType,
      },
      method: record.method,
      currentStatus: record.status,
      source: {
        type: record.sourceType,
        id: record.sourceId,
      },
      proxy: record.proxyEmployee
        ? {
            id: record.proxyEmployee.id,
            name: record.proxyEmployee.name,
            department: record.proxyEmployee.department,
          }
        : null,
      history: record.auditLogs.map(log => ({
        action: log.action,
        oldStatus: log.oldStatus,
        newStatus: log.newStatus,
        reason: log.reason,
        operator: log.operator,
        time: log.createdAt,
        details: log.details,
      })),
      finalDecision: {
        status: record.status,
        reason: record.rejectionReason || record.reason,
        handledBy: record.handledBy,
        handledAt: record.handledAt,
      },
    };

    res.json(trace);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
