import { Router, Request, Response } from 'express';
import { groupingService } from '../services/GroupingService';
import { GroupStatus, SourceSystem } from '../models/types';

const router = Router();

router.post('/create', (req: Request, res: Response) => {
  try {
    const { tenantId, sourceSystems } = req.body;

    const validation = groupingService.validateInput(req.body);
    if (!validation.valid) {
      const failedGroup = groupingService.createFailedTenantGroup(
        (tenantId as string) || 'unknown',
        (sourceSystems as SourceSystem[]) || [],
        req.body,
        validation.errors
      );

      return res.status(400).json({
        success: false,
        groupId: failedGroup.groupId,
        requestId: failedGroup.requestId,
        errors: validation.errors
      });
    }

    const group = groupingService.createTenantGroup(
      tenantId,
      sourceSystems as SourceSystem[],
      req.body
    );

    res.json({
      success: true,
      data: {
        groupId: group.groupId,
        requestId: group.requestId,
        status: group.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.post('/:groupId/merge-rules', (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const mergedRules = groupingService.mergeRules(groupId);

    res.json({
      success: true,
      data: {
        groupId,
        mergedRuleCount: mergedRules.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.post('/:groupId/calculate', (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { tenantAttributes } = req.body;

    const hitResults = groupingService.calculateHit(groupId, tenantAttributes);

    const group = groupingService.getTenantGroup(groupId);

    res.json({
      success: true,
      data: {
        groupId,
        finalResult: group?.finalResult,
        status: group?.status,
        hitResultCount: hitResults.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.get('/:groupId', (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const group = groupingService.getTenantGroup(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: '分组不存在'
      });
    }

    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.get('/tenant/:tenantId', (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const groups = groupingService.getTenantGroupsByTenantId(tenantId);

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.get('/', (_req: Request, res: Response) => {
  try {
    const groups = groupingService.getAllTenantGroups();

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.put('/:groupId/status', (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { status } = req.body;

    if (!Object.values(GroupStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的状态值'
      });
    }

    const group = groupingService.advanceStatus(groupId, status);

    res.json({
      success: true,
      data: {
        groupId: group.groupId,
        status: group.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.post('/:groupId/exception', (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { errorMessage } = req.body;

    const group = groupingService.handleException(groupId, errorMessage);

    res.json({
      success: true,
      data: {
        groupId: group.groupId,
        status: group.status,
        errorMessage: group.errorMessage
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.post('/:groupId/adjust', (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { operator, newResult, reason } = req.body;

    const group = groupingService.manualAdjustment(
      groupId,
      operator,
      newResult,
      reason
    );

    res.json({
      success: true,
      data: {
        groupId: group.groupId,
        finalResult: group.finalResult,
        adjustmentCount: group.adjustmentRecords.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.post('/:groupId/recalculate', (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { tenantAttributes } = req.body;

    const hitResults = groupingService.recalculateAfterAdjustment(
      groupId,
      tenantAttributes
    );

    const group = groupingService.getTenantGroup(groupId);

    res.json({
      success: true,
      data: {
        groupId,
        finalResult: group?.finalResult,
        hitResultCount: hitResults.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.post('/:groupId/report', (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;

    const report = groupingService.generateReport(groupId);

    res.json({
      success: true,
      data: {
        reportId: report.reportId,
        groupId: report.groupId,
        finalResult: report.finalResult
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.get('/report/:reportId/export', (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    const csvContent = groupingService.exportReport(reportId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="group-report-${reportId}.csv"`
    );
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

export default router;
