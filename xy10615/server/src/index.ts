import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { store } from './store';
import { initSampleData } from './sampleData';
import { lineChangeService } from './services/lineChangeService';
import { moldInspectionService } from './services/moldInspectionService';
import { materialKittingService } from './services/materialKittingService';
import { firstArticleService } from './services/firstArticleService';
import { qualificationService } from './services/qualificationService';
import { missingItemService } from './services/missingItemService';
import { exportService } from './services/exportService';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

function successResponse(res: Response, data: any, requestId: string) {
  res.json({
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString()
  });
}

function errorResponse(res: Response, code: string, message: string, requestId: string, status: number = 400) {
  res.status(status).json({
    success: false,
    error: {
      code,
      message
    },
    requestId,
    timestamp: new Date().toISOString()
  });
}

app.get('/api/health', (req: Request, res: Response) => {
  successResponse(res, { status: 'ok', message: '制造换线准备齐套系统运行正常' }, (req as any).requestId);
});

app.get('/api/plans', (req: Request, res: Response) => {
  try {
    const plans = lineChangeService.getAllPlans();
    successResponse(res, plans, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取计划列表失败', (req as any).requestId, 500);
  }
});

app.get('/api/plans/:id', (req: Request, res: Response) => {
  try {
    const plan = lineChangeService.getPlan(req.params.id);
    if (!plan) {
      return errorResponse(res, 'NOT_FOUND', '计划不存在', (req as any).requestId, 404);
    }
    successResponse(res, plan, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取计划失败', (req as any).requestId, 500);
  }
});

app.post('/api/plans', (req: Request, res: Response) => {
  try {
    const { operator, operatorId, ...data } = req.body;
    const requestId = (req as any).requestId;
    
    if (!data.planNo || !data.line || !data.productCode || !data.plannedStartTime || !data.plannedEndTime) {
      return errorResponse(res, 'VALIDATION_ERROR', '缺少必填字段', requestId);
    }

    const plan = lineChangeService.createPlan(
      { ...data, status: data.status || 'DRAFT' },
      operator || '系统',
      operatorId || 'SYS',
      requestId
    );
    successResponse(res, plan, requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '创建计划失败', (req as any).requestId, 500);
  }
});

app.put('/api/plans/:id', (req: Request, res: Response) => {
  try {
    const { operator, operatorId, ...updates } = req.body;
    const plan = lineChangeService.updatePlan(
      req.params.id,
      updates,
      operator || '系统',
      operatorId || 'SYS'
    );
    successResponse(res, plan, (req as any).requestId);
  } catch (error) {
    if ((error as Error).message === 'PLAN_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '计划不存在', (req as any).requestId, 404);
    }
    errorResponse(res, 'INTERNAL_ERROR', '更新计划失败', (req as any).requestId, 500);
  }
});

app.get('/api/plans/:id/history', (req: Request, res: Response) => {
  try {
    const history = store.getStatusHistoriesByEntity(req.params.id);
    successResponse(res, history, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取状态历史失败', (req as any).requestId, 500);
  }
});

app.get('/api/plans/:id/changelog', (req: Request, res: Response) => {
  try {
    const changelog = store.getChangeLogsByEntity(req.params.id);
    successResponse(res, changelog, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取变更记录失败', (req as any).requestId, 500);
  }
});

app.get('/api/mold-inspections', (req: Request, res: Response) => {
  try {
    const inspections = moldInspectionService.getAllInspections();
    successResponse(res, inspections, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取模具点检列表失败', (req as any).requestId, 500);
  }
});

app.get('/api/mold-inspections/:id', (req: Request, res: Response) => {
  try {
    const inspection = moldInspectionService.getInspection(req.params.id);
    if (!inspection) {
      return errorResponse(res, 'NOT_FOUND', '点检记录不存在', (req as any).requestId, 404);
    }
    successResponse(res, inspection, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取模具点检失败', (req as any).requestId, 500);
  }
});

app.get('/api/mold-inspections/plan/:planId', (req: Request, res: Response) => {
  try {
    const inspections = moldInspectionService.getInspectionsByPlan(req.params.planId);
    successResponse(res, inspections, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取模具点检列表失败', (req as any).requestId, 500);
  }
});

app.post('/api/mold-inspections', (req: Request, res: Response) => {
  try {
    const { operator, operatorId, ...data } = req.body;
    const requestId = (req as any).requestId;
    const inspection = moldInspectionService.createInspection(
      data,
      operator || '系统',
      operatorId || 'SYS',
      requestId
    );
    successResponse(res, inspection, requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '创建模具点检失败', (req as any).requestId, 500);
  }
});

app.put('/api/mold-inspections/:inspectionId/items/:itemId', (req: Request, res: Response) => {
  try {
    const { result, isPassed, checkedBy, checkedById } = req.body;
    const inspection = moldInspectionService.updateInspectionItem(
      req.params.inspectionId,
      req.params.itemId,
      result,
      isPassed,
      checkedBy || '系统',
      checkedById || 'SYS'
    );
    successResponse(res, inspection, (req as any).requestId);
  } catch (error) {
    if ((error as Error).message === 'INSPECTION_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '点检记录不存在', (req as any).requestId, 404);
    }
    if ((error as Error).message === 'ITEM_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '点检项不存在', (req as any).requestId, 404);
    }
    errorResponse(res, 'INTERNAL_ERROR', '更新点检项失败', (req as any).requestId, 500);
  }
});

app.post('/api/mold-inspections/:id/review', (req: Request, res: Response) => {
  try {
    const { reviewedBy, reviewedById, remark } = req.body;
    const inspection = moldInspectionService.reviewInspection(
      req.params.id,
      reviewedBy || '系统',
      reviewedById || 'SYS',
      remark
    );
    successResponse(res, inspection, (req as any).requestId);
  } catch (error) {
    if ((error as Error).message === 'INSPECTION_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '点检记录不存在', (req as any).requestId, 404);
    }
    if ((error as Error).message === 'INVALID_STATUS_FOR_REVIEW') {
      return errorResponse(res, 'INVALID_STATUS', '当前状态不允许复核', (req as any).requestId, 400);
    }
    errorResponse(res, 'INTERNAL_ERROR', '复核失败', (req as any).requestId, 500);
  }
});

app.get('/api/mold-inspections/:id/validate', (req: Request, res: Response) => {
  try {
    const result = moldInspectionService.validateInspection(req.params.id);
    successResponse(res, result, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '验证失败', (req as any).requestId, 500);
  }
});

app.get('/api/material-kittings', (req: Request, res: Response) => {
  try {
    const kittings = materialKittingService.getAllKittings();
    successResponse(res, kittings, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取物料齐套列表失败', (req as any).requestId, 500);
  }
});

app.get('/api/material-kittings/:id', (req: Request, res: Response) => {
  try {
    const kitting = materialKittingService.getKitting(req.params.id);
    if (!kitting) {
      return errorResponse(res, 'NOT_FOUND', '齐套记录不存在', (req as any).requestId, 404);
    }
    successResponse(res, kitting, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取物料齐套失败', (req as any).requestId, 500);
  }
});

app.get('/api/material-kittings/plan/:planId', (req: Request, res: Response) => {
  try {
    const kittings = materialKittingService.getKittingsByPlan(req.params.planId);
    successResponse(res, kittings, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取物料齐套列表失败', (req as any).requestId, 500);
  }
});

app.post('/api/material-kittings', (req: Request, res: Response) => {
  try {
    const { operator, operatorId, ...data } = req.body;
    const requestId = (req as any).requestId;
    const kitting = materialKittingService.createKitting(
      data,
      operator || '系统',
      operatorId || 'SYS',
      requestId
    );
    successResponse(res, kitting, requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '创建物料齐套失败', (req as any).requestId, 500);
  }
});

app.put('/api/material-kittings/:kittingId/items/:itemId', (req: Request, res: Response) => {
  try {
    const { actualQty, checkedBy, checkedById } = req.body;
    const kitting = materialKittingService.updateMaterialItem(
      req.params.kittingId,
      req.params.itemId,
      actualQty,
      checkedBy || '系统',
      checkedById || 'SYS'
    );
    successResponse(res, kitting, (req as any).requestId);
  } catch (error) {
    if ((error as Error).message === 'KITTING_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '齐套记录不存在', (req as any).requestId, 404);
    }
    if ((error as Error).message === 'ITEM_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '物料项不存在', (req as any).requestId, 404);
    }
    errorResponse(res, 'INTERNAL_ERROR', '更新物料项失败', (req as any).requestId, 500);
  }
});

app.get('/api/first-articles', (req: Request, res: Response) => {
  try {
    const inspections = firstArticleService.getAllInspections();
    successResponse(res, inspections, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取首件检验列表失败', (req as any).requestId, 500);
  }
});

app.get('/api/first-articles/:id', (req: Request, res: Response) => {
  try {
    const inspection = firstArticleService.getInspection(req.params.id);
    if (!inspection) {
      return errorResponse(res, 'NOT_FOUND', '首件检验记录不存在', (req as any).requestId, 404);
    }
    successResponse(res, inspection, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取首件检验失败', (req as any).requestId, 500);
  }
});

app.get('/api/first-articles/plan/:planId', (req: Request, res: Response) => {
  try {
    const inspections = firstArticleService.getInspectionsByPlan(req.params.planId);
    successResponse(res, inspections, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取首件检验列表失败', (req as any).requestId, 500);
  }
});

app.post('/api/first-articles', (req: Request, res: Response) => {
  try {
    const { operator, operatorId, ...data } = req.body;
    const requestId = (req as any).requestId;
    const inspection = firstArticleService.createInspection(
      data,
      operator || '系统',
      operatorId || 'SYS',
      requestId
    );
    successResponse(res, inspection, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '创建首件检验失败', (req as any).requestId, 500);
  }
});

app.put('/api/first-articles/:inspectionId/items/:itemId', (req: Request, res: Response) => {
  try {
    const { result, measuredValue, isPassed, checkedBy, checkedById } = req.body;
    const inspection = firstArticleService.updateInspectionItem(
      req.params.inspectionId,
      req.params.itemId,
      result,
      measuredValue,
      isPassed,
      checkedBy || '系统',
      checkedById || 'SYS'
    );
    successResponse(res, inspection, (req as any).requestId);
  } catch (error) {
    if ((error as Error).message === 'INSPECTION_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '首件检验记录不存在', (req as any).requestId, 404);
    }
    if ((error as Error).message === 'ITEM_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '检验项不存在', (req as any).requestId, 404);
    }
    errorResponse(res, 'INTERNAL_ERROR', '更新检验项失败', (req as any).requestId, 500);
  }
});

app.post('/api/first-articles/:id/review', (req: Request, res: Response) => {
  try {
    const { reviewedBy, reviewedById, remark } = req.body;
    const inspection = firstArticleService.reviewInspection(
      req.params.id,
      reviewedBy || '系统',
      reviewedById || 'SYS',
      remark
    );
    successResponse(res, inspection, (req as any).requestId);
  } catch (error) {
    if ((error as Error).message === 'INSPECTION_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '首件检验记录不存在', (req as any).requestId, 404);
    }
    if ((error as Error).message === 'INVALID_STATUS_FOR_REVIEW') {
      return errorResponse(res, 'INVALID_STATUS', '当前状态不允许复核', (req as any).requestId, 400);
    }
    errorResponse(res, 'INTERNAL_ERROR', '复核失败', (req as any).requestId, 500);
  }
});

app.get('/api/qualifications', (req: Request, res: Response) => {
  try {
    const qualifications = qualificationService.getAllQualifications();
    successResponse(res, qualifications, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取资质列表失败', (req as any).requestId, 500);
  }
});

app.get('/api/qualifications/person/:personId', (req: Request, res: Response) => {
  try {
    const qualifications = qualificationService.getQualificationsByPerson(req.params.personId);
    successResponse(res, qualifications, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取人员资质失败', (req as any).requestId, 500);
  }
});

app.get('/api/qualifications/person/:personId/valid', (req: Request, res: Response) => {
  try {
    const qualifications = qualificationService.getValidQualificationsByPerson(req.params.personId);
    successResponse(res, qualifications, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取有效资质失败', (req as any).requestId, 500);
  }
});

app.post('/api/qualifications', (req: Request, res: Response) => {
  try {
    const { operator, operatorId, requestId, ...data } = req.body;
    const qualification = qualificationService.addQualification(
      data,
      operator || '系统',
      operatorId || 'SYS',
      requestId || (req as any).requestId
    );
    successResponse(res, qualification, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '添加资质失败', (req as any).requestId, 500);
  }
});

app.put('/api/qualifications/:id', (req: Request, res: Response) => {
  try {
    const { operator, operatorId, ...updates } = req.body;
    const qualification = qualificationService.updateQualification(
      req.params.id,
      updates,
      operator || '系统',
      operatorId || 'SYS'
    );
    successResponse(res, qualification, (req as any).requestId);
  } catch (error) {
    if ((error as Error).message === 'QUALIFICATION_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '资质不存在', (req as any).requestId, 404);
    }
    errorResponse(res, 'INTERNAL_ERROR', '更新资质失败', (req as any).requestId, 500);
  }
});

app.post('/api/qualifications/:personId/check', (req: Request, res: Response) => {
  try {
    const { requiredTypes } = req.body;
    const result = qualificationService.checkPersonQualified(req.params.personId, requiredTypes);
    successResponse(res, result, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '资质检查失败', (req as any).requestId, 500);
  }
});

app.get('/api/missing-items', (req: Request, res: Response) => {
  try {
    const items = missingItemService.getAllMissingItems();
    successResponse(res, items, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取缺项清单失败', (req as any).requestId, 500);
  }
});

app.get('/api/missing-items/plan/:planId', (req: Request, res: Response) => {
  try {
    const items = missingItemService.getMissingItemsByPlan(req.params.planId);
    successResponse(res, items, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取缺项清单失败', (req as any).requestId, 500);
  }
});

app.post('/api/missing-items', (req: Request, res: Response) => {
  try {
    const requestId = (req as any).requestId;
    const item = missingItemService.addMissingItem(req.body, requestId);
    successResponse(res, item, requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '添加缺项失败', (req as any).requestId, 500);
  }
});

app.put('/api/missing-items/:id', (req: Request, res: Response) => {
  try {
    const { operator, operatorId, ...updates } = req.body;
    const item = missingItemService.updateMissingItem(
      req.params.id,
      updates,
      operator || '系统',
      operatorId || 'SYS'
    );
    successResponse(res, item, (req as any).requestId);
  } catch (error) {
    if ((error as Error).message === 'ITEM_NOT_FOUND') {
      return errorResponse(res, 'NOT_FOUND', '缺项不存在', (req as any).requestId, 404);
    }
    errorResponse(res, 'INTERNAL_ERROR', '更新缺项失败', (req as any).requestId, 500);
  }
});

app.get('/api/statistics', (req: Request, res: Response) => {
  try {
    const stats = {
      plans: lineChangeService.getStatistics(),
      moldInspections: moldInspectionService.getStatistics(),
      materialKittings: materialKittingService.getStatistics(),
      firstArticles: firstArticleService.getStatistics(),
      missingItems: missingItemService.getStatistics()
    };
    successResponse(res, stats, (req as any).requestId);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '获取统计数据失败', (req as any).requestId, 500);
  }
});

app.post('/api/export', (req: Request, res: Response) => {
  try {
    const { responsiblePerson, startDate, endDate, planId } = req.body;
    const buffer = exportService.exportToExcel({
      responsiblePerson,
      startDate,
      endDate,
      planId
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=line-change-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (error) {
    errorResponse(res, 'INTERNAL_ERROR', '导出失败', (req as any).requestId, 500);
  }
});

app.listen(PORT, () => {
  console.log(`制造换线准备齐套系统 - 后端服务启动成功`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API文档: http://localhost:${PORT}/api/health`);
  initSampleData();
});
