import { Router, Request, Response } from 'express';
import { CanteenService, AssignMealRequest, ChangeMealRequest, UpdateDeliveryRequest, CreateFollowUpRequest } from '../services/canteen-service';
import { BatchService, BatchProcessor } from '../services/batch-service';
import { BatchOperationType } from '../entities/BatchOperation';
import { ReportService, ReportFilters } from '../services/report-service';
import { AuditService } from '../services/audit-service';
import { AuditEntity, AuditAction } from '../entities/AuditLog';
import { QueryRunner } from 'typeorm';

const router = Router();

router.get('/elders', async (req: Request, res: Response) => {
  try {
    const elders = await CanteenService.getElders({
      name: req.query.name as string,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined
    });
    res.json(elders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/elders', async (req: Request, res: Response) => {
  try {
    const elder = await CanteenService.createElder(req.body, req.auditContext);
    res.status(201).json(elder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/elders/:id', async (req: Request, res: Response) => {
  try {
    const elder = await CanteenService.getElder(req.params.id);
    if (!elder) {
      res.status(404).json({ error: '老人不存在' });
      return;
    }
    res.json(elder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/meals', async (req: Request, res: Response) => {
  try {
    const meals = await CanteenService.getMeals({
      date: req.query.date ? new Date(req.query.date as string) : undefined,
      type: req.query.type as string
    });
    res.json(meals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/meals', async (req: Request, res: Response) => {
  try {
    const meal = await CanteenService.createMeal(req.body, req.auditContext);
    res.status(201).json(meal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/meals/:id', async (req: Request, res: Response) => {
  try {
    const meal = await CanteenService.getMeal(req.params.id);
    if (!meal) {
      res.status(404).json({ error: '餐食不存在' });
      return;
    }
    res.json(meal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/assignments/check-conflict', async (req: Request, res: Response) => {
  try {
    const { elderId, mealId } = req.query;
    if (!elderId || !mealId) {
      res.status(400).json({ error: '缺少 elderId 或 mealId' });
      return;
    }
    const result = await CanteenService.checkMealConflict(elderId as string, mealId as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/assignments', async (req: Request, res: Response) => {
  try {
    const assignment = await CanteenService.assignMeal(req.body as AssignMealRequest, req.auditContext);
    res.status(201).json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/assignments', async (req: Request, res: Response) => {
  try {
    const assignments = await CanteenService.getAssignments({
      elderId: req.query.elderId as string,
      mealId: req.query.mealId as string,
      status: req.query.status as any,
      hasConflicts: req.query.hasConflicts === 'true' ? true : req.query.hasConflicts === 'false' ? false : undefined,
      assignedBy: req.query.assignedBy as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    });
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/assignments/:id', async (req: Request, res: Response) => {
  try {
    const assignment = await CanteenService.getAssignment(req.params.id);
    if (!assignment) {
      res.status(404).json({ error: '配餐记录不存在' });
      return;
    }
    res.json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/assignments/:id/changes', async (req: Request, res: Response) => {
  try {
    const changes = await CanteenService.getMealChanges(req.params.id);
    res.json(changes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/meal-changes', async (req: Request, res: Response) => {
  try {
    const change = await CanteenService.changeMeal(req.body as ChangeMealRequest, req.auditContext);
    res.status(201).json(change);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/deliveries', async (req: Request, res: Response) => {
  try {
    const delivery = await CanteenService.updateDelivery(req.body as UpdateDeliveryRequest, req.auditContext);
    res.status(201).json(delivery);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/deliveries', async (req: Request, res: Response) => {
  try {
    const deliveries = await CanteenService.getDeliveries({
      status: req.query.status as any,
      deliveryPerson: req.query.deliveryPerson as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    });
    res.json(deliveries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/deliveries/:id', async (req: Request, res: Response) => {
  try {
    const delivery = await CanteenService.getDelivery(req.params.id);
    if (!delivery) {
      res.status(404).json({ error: '配送记录不存在' });
      return;
    }
    res.json(delivery);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/follow-ups', async (req: Request, res: Response) => {
  try {
    const followUp = await CanteenService.createFollowUp(req.body as CreateFollowUpRequest, req.auditContext);
    res.status(201).json(followUp);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/follow-ups', async (req: Request, res: Response) => {
  try {
    const followUps = await CanteenService.getFollowUps({
      assignmentId: req.query.assignmentId as string,
      satisfaction: req.query.satisfaction as any,
      conductedBy: req.query.conductedBy as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    });
    res.json(followUps);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/follow-ups/:id', async (req: Request, res: Response) => {
  try {
    const followUp = await CanteenService.getFollowUp(req.params.id);
    if (!followUp) {
      res.status(404).json({ error: '回访记录不存在' });
      return;
    }
    res.json(followUp);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch/assign-meals', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;

    const processor: BatchProcessor<AssignMealRequest> = {
      validateItem: async (item) => {
        if (!item.elderId || !item.mealId) {
          throw new Error('缺少 elderId 或 mealId');
        }
      },
      processItem: async (item, _index, queryRunner: QueryRunner) => {
        return await CanteenService.assignMeal(item, req.auditContext, queryRunner);
      }
    };

    const result = await BatchService.execute(
      BatchOperationType.MEAL_ASSIGN,
      items,
      processor,
      req.auditContext
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batch/operations', async (req: Request, res: Response) => {
  try {
    const operations = await BatchService.getOperations({
      type: req.query.type as any,
      status: req.query.status as any,
      operatedBy: req.query.operatedBy as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    });
    res.json(operations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batch/operations/:id', async (req: Request, res: Response) => {
  try {
    const operation = await BatchService.getOperation(req.params.id);
    if (!operation) {
      res.status(404).json({ error: '批量操作记录不存在' });
      return;
    }
    res.json(operation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/report/summary', async (req: Request, res: Response) => {
  try {
    const summary = await ReportService.generateReportSummary(req.body as ReportFilters);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/report/export', async (req: Request, res: Response) => {
  try {
    const buffer = await ReportService.exportToExcel(req.body as ReportFilters, req.auditContext);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="canteen-report-${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const logs = await AuditService.queryLogs({
      entity: req.query.entity as any,
      action: req.query.action as any,
      operator: req.query.operator as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
      entityId: req.query.entityId as string
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;