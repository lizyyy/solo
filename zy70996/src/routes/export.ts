import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { createObjectCsvStringifier } from 'csv-writer';

const router = Router();

router.get('/collection', async (req: Request, res: Response) => {
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

    let filteredRecords = records as any[];
    if (employeeStatus) {
      filteredRecords = records.filter((r: any) => r.employee && r.employee.status === employeeStatus);
    }

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'recordId', title: '记录ID' },
        { id: 'employeeId', title: '员工工号' },
        { id: 'employeeName', title: '员工姓名' },
        { id: 'department', title: '部门' },
        { id: 'employeeStatus', title: '员工状态' },
        { id: 'batchId', title: '批次ID' },
        { id: 'batchName', title: '批次名称' },
        { id: 'benefitType', title: '福利类型' },
        { id: 'method', title: '领取方式' },
        { id: 'status', title: '处理状态' },
        { id: 'proxyEmployeeName', title: '代领人姓名' },
        { id: 'proxyEmployeeId', title: '代领人工号' },
        { id: 'couponCode', title: '券码' },
        { id: 'reason', title: '备注' },
        { id: 'rejectionReason', title: '拒绝/退回原因' },
        { id: 'handledBy', title: '处理人' },
        { id: 'handledAt', title: '处理时间' },
        { id: 'sourceType', title: '数据来源' },
        { id: 'sourceId', title: '来源标识' },
        { id: 'createdAt', title: '创建时间' },
      ],
    });

    const csvData = filteredRecords.map((r: any) => ({
      recordId: r.id,
      employeeId: r.employee?.id || '',
      employeeName: r.employee?.name || '',
      department: r.employee?.department || '',
      employeeStatus: r.employee?.status || '',
      batchId: r.batch.id,
      batchName: r.batch.name,
      benefitType: r.batch.benefitType,
      method: r.method === 'SELF' ? '本人领取' : r.method === 'PROXY' ? '代领' : '邮寄',
      status: r.status === 'PENDING' ? '待处理' :
              r.status === 'APPROVED' ? '已通过' :
              r.status === 'REJECTED' ? '已拒绝' :
              r.status === 'RETURNED' ? '已退回' : '已代领',
      proxyEmployeeName: r.proxyEmployee?.name || '',
      proxyEmployeeId: r.proxyEmployee?.id || '',
      couponCode: r.coupon?.code || '',
      reason: r.reason || '',
      rejectionReason: r.rejectionReason || '',
      handledBy: r.handledBy || '',
      handledAt: r.handledAt ? r.handledAt.toISOString() : '',
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      createdAt: r.createdAt.toISOString(),
    }));

    const csvString = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(csvData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="collection_records_${Date.now()}.csv"`);
    res.setHeader('X-Total-Count', filteredRecords.length.toString());
    res.send('\ufeff' + csvString);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/collection/:id/trace', async (req: Request, res: Response) => {
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

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'item', title: '项目' },
        { id: 'content', title: '内容' },
      ],
    });

    const rec: any = record;

    const rows: any[] = [];
    rows.push({ item: '记录ID', content: rec.id });
    rows.push({ item: '员工工号', content: rec.employee.id });
    rows.push({ item: '员工姓名', content: rec.employee.name });
    rows.push({ item: '部门', content: rec.employee.department });
    rows.push({ item: '员工状态', content: rec.employee.status === 'ACTIVE' ? '在职' : '离职' });
    rows.push({ item: '批次ID', content: rec.batch.id });
    rows.push({ item: '批次名称', content: rec.batch.name });
    rows.push({ item: '福利类型', content: rec.batch.benefitType });
    rows.push({
      item: '领取方式',
      content: rec.method === 'SELF' ? '本人领取' : rec.method === 'PROXY' ? '代领' : '邮寄',
    });

    if (rec.proxyEmployee) {
      rows.push({ item: '代领人工号', content: rec.proxyEmployee.id });
      rows.push({ item: '代领人姓名', content: rec.proxyEmployee.name });
      rows.push({ item: '代领人部门', content: rec.proxyEmployee.department });
    }

    rows.push({
      item: '当前状态',
      content: rec.status === 'PENDING' ? '待处理' :
               rec.status === 'APPROVED' ? '已通过' :
               rec.status === 'REJECTED' ? '已拒绝' :
               rec.status === 'RETURNED' ? '已退回' : '已代领',
    });
    rows.push({ item: '数据来源', content: rec.sourceType });
    rows.push({ item: '来源标识', content: rec.sourceId });
    rows.push({ item: '创建时间', content: rec.createdAt.toISOString() });

    if (rec.handledBy) {
      rows.push({ item: '处理人', content: rec.handledBy });
      rows.push({ item: '处理时间', content: rec.handledAt?.toISOString() || '' });
    }

    if (rec.rejectionReason) {
      rows.push({ item: '拒绝/退回原因', content: rec.rejectionReason });
    }

    if (rec.reason) {
      rows.push({ item: '备注', content: rec.reason });
    }

    rows.push({ item: '', content: '' });
    rows.push({ item: '=== 操作历史 ===', content: '' });

    rec.auditLogs.forEach((log: any, index: number) => {
      rows.push({ item: `操作 ${index + 1} - ${log.action}`, content: '' });
      rows.push({ item: '  操作人', content: log.operator });
      rows.push({ item: '  操作时间', content: log.createdAt.toISOString() });
      if (log.oldStatus) rows.push({ item: '  原状态', content: log.oldStatus });
      if (log.newStatus) rows.push({ item: '  新状态', content: log.newStatus });
      if (log.reason) rows.push({ item: '  原因', content: log.reason });
      if (log.details) rows.push({ item: '  详情', content: log.details });
    });

    const csvString = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="trace_${record.id}.csv"`);
    res.send('\ufeff' + csvString);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/import-history', async (req: Request, res: Response) => {
  try {
    const history = await prisma.importHistory.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: '导入ID' },
        { id: 'type', title: '导入类型' },
        { id: 'fileName', title: '文件名' },
        { id: 'recordCount', title: '总记录数' },
        { id: 'successCount', title: '成功数' },
        { id: 'failCount', title: '失败数' },
        { id: 'operator', title: '操作人' },
        { id: 'createdAt', title: '导入时间' },
        { id: 'batchId', title: '关联批次' },
      ],
    });

    const csvData = history.map(h => ({
      id: h.id,
      type: h.type,
      fileName: h.fileName,
      recordCount: h.recordCount,
      successCount: h.successCount,
      failCount: h.failCount,
      operator: h.operator,
      createdAt: h.createdAt.toISOString(),
      batchId: h.batchId || '',
    }));

    const csvString = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(csvData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="import_history_${Date.now()}.csv"`);
    res.send('\ufeff' + csvString);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
