import { Router, Request, Response } from 'express';
import { createObjectCsvStringifier } from 'csv-writer';
import {
  createAdjustment,
  updateAdjustmentStatus,
  getAdjustmentById,
  listAdjustments,
  getAdjustmentHistories,
  withdrawAdjustment,
  importAdjustments,
  getAllAdjustmentsForExport
} from '../services/adjustmentService';
import { AdjustmentStatus, OperationSource } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response, next) => {
  try {
    const result = await createAdjustment({
      ...req.body,
      operationSource: req.body.operationSource || OperationSource.API
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const { userId, status, page, pageSize } = req.query;
    const result = await listAdjustments({
      userId: userId as string,
      status: status as AdjustmentStatus,
      page: page ? parseInt(page as string, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/export', async (req: Request, res: Response, next) => {
  try {
    const data = await getAllAdjustmentsForExport();
    
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'userId', title: '用户ID' },
        { id: 'userName', title: '用户姓名' },
        { id: 'oldDepartmentId', title: '原部门ID' },
        { id: 'oldDepartmentName', title: '原部门名称' },
        { id: 'newDepartmentId', title: '新部门ID' },
        { id: 'newDepartmentName', title: '新部门名称' },
        { id: 'dataScope', title: '数据范围' },
        { id: 'retainOldDataAccess', title: '保留旧部门数据权限' },
        { id: 'status', title: '状态' },
        { id: 'operatorId', title: '操作者ID' },
        { id: 'operatorName', title: '操作者姓名' },
        { id: 'operationSource', title: '操作来源' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '更新时间' },
        { id: 'effectiveAt', title: '生效时间' },
        { id: 'remark', title: '备注' }
      ]
    });
    
    const records = data.map(item => ({
      ...item,
      retainOldDataAccess: item.retainOldDataAccess ? '是' : '否'
    }));
    
    const csv = '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="organization_adjustments.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const result = await getAdjustmentById(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/histories', async (req: Request, res: Response, next) => {
  try {
    const result = await getAdjustmentHistories(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req: Request, res: Response, next) => {
  try {
    const result = await updateAdjustmentStatus(req.params.id, {
      ...req.body,
      operationSource: req.body.operationSource || OperationSource.API
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/withdraw', async (req: Request, res: Response, next) => {
  try {
    const { operatorId, operatorName, remark } = req.body;
    const result = await withdrawAdjustment(
      req.params.id,
      operatorId,
      operatorName,
      OperationSource.API,
      remark
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/import', async (req: Request, res: Response, next) => {
  try {
    const { data, operatorId, operatorName } = req.body;
    const result = await importAdjustments(data, operatorId, operatorName);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
