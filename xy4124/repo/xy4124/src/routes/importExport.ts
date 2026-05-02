import { Router, Request, Response } from 'express';
import {
  parseSchedulesCSV,
  BasicCSVValidator,
  generateRiskCSV,
  generateSchedulesCSV,
  generateHandoverReport,
  HandoverReportData,
} from '../importExport';
import {
  ProjectionService,
} from '../services/projectionService';
import {
  AuditLogRepository,
} from '../storage';
import {
  ScheduleCreateInput,
  AuditAction,
  AuditEntityType,
  CheckStatus,
} from '../models';

const router = Router();
const projectionService = new ProjectionService();
const auditRepo = new AuditLogRepository();
const csvValidator = new BasicCSVValidator();

router.post('/schedules/import', async (req: Request, res: Response) => {
  try {
    const csvContent = req.body.csv || (typeof req.body === 'string' ? req.body : '');
    
    if (!csvContent || csvContent.trim() === '') {
      return res.status(400).json({ error: 'CSV content is required' });
    }
    
    const actor = req.headers['x-actor'] as string || 'api';
    
    const parseResult = await parseSchedulesCSV(csvContent);
    
    if (parseResult.errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV解析失败',
        errors: parseResult.errors,
      });
    }
    
    const importedSchedules: Array<{
      row: number;
      scheduleId: string;
      checkResult: any;
    }> = [];
    const failedRows: Array<{
      row: number;
      errors: any[];
      warnings: any[];
    }> = [];
    
    for (let i = 0; i < parseResult.rows.length; i++) {
      const row = parseResult.rows[i];
      const rowNumber = i + 1;
      
      const validation = csvValidator.validateRow(row, rowNumber);
      
      if (validation.errors.length > 0 || !validation.scheduleInput) {
        failedRows.push({
          row: rowNumber,
          errors: validation.errors,
          warnings: validation.warnings,
        });
        continue;
      }
      
      try {
        const result = await projectionService.createSchedule(
          validation.scheduleInput as ScheduleCreateInput,
          actor
        );
        
        importedSchedules.push({
          row: rowNumber,
          scheduleId: result.schedule.scheduleId,
          checkResult: {
            overallStatus: result.checkResult.overallStatus,
            issues: result.checkResult.checks.filter(c => c.status !== CheckStatus.PASS),
          },
        });
      } catch (error) {
        failedRows.push({
          row: rowNumber,
          errors: [{
            field: 'general',
            message: (error as Error).message,
          }],
          warnings: [],
        });
      }
    }
    
    const totalRows = parseResult.rows.length;
    const importedCount = importedSchedules.length;
    const failedCount = failedRows.length;
    
    auditRepo.create({
      action: AuditAction.IMPORT,
      entityType: AuditEntityType.SCHEDULE,
      entityId: 'batch_import',
      actor,
      actorRole: 'operator',
      success: importedCount > 0,
      details: {
        totalRows,
        importedCount,
        failedCount,
      },
    });
    
    const hasBlockingIssues = importedSchedules.some(s => 
      s.checkResult.overallStatus === CheckStatus.BLOCK
    );
    
    res.status(importedCount > 0 ? 200 : 400).json({
      success: importedCount > 0,
      summary: {
        totalRows,
        imported: importedCount,
        failed: failedCount,
        hasBlockingIssues,
      },
      imported: importedSchedules,
      failed: failedRows,
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

router.get('/schedules/export', (req: Request, res: Response) => {
  const start = req.query.start as string;
  const end = req.query.end as string;
  
  let schedules;
  if (start && end) {
    schedules = projectionService.getSchedulesByDateRange(start, end);
  } else {
    schedules = projectionService.getAllSchedules();
  }
  
  const csv = generateSchedulesCSV(schedules);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=schedules_${new Date().toISOString().split('T')[0]}.csv`);
  
  res.send('\uFEFF' + csv);
});

router.get('/risks/export', async (req: Request, res: Response) => {
  const start = req.query.start as string;
  const end = req.query.end as string;
  const actor = req.headers['x-actor'] as string;
  
  let schedules;
  if (start && end) {
    schedules = projectionService.getSchedulesByDateRange(start, end);
  } else {
    schedules = projectionService.getAllSchedules();
  }
  
  const dateRange = start && end ? { start, end } : undefined;
  const checkResults = await projectionService.checkAllSchedules(dateRange, actor);
  
  const filmVersions = projectionService.getFilmVersions();
  const auditoriums = projectionService.getAuditoriums();
  
  const filmVersionMap = new Map();
  for (const fv of filmVersions) {
    filmVersionMap.set(`${fv.filmId}-${fv.versionId}`, fv);
  }
  
  const auditoriumMap = new Map();
  for (const a of auditoriums) {
    auditoriumMap.set(a.auditoriumId, a);
  }
  
  const simplifiedCheckResults = new Map();
  for (const [scheduleId, result] of checkResults) {
    simplifiedCheckResults.set(scheduleId, {
      status: result.overallStatus,
      checks: result.checks,
    });
  }
  
  const csv = generateRiskCSV(
    schedules,
    filmVersionMap,
    auditoriumMap,
    simplifiedCheckResults
  );
  
  auditRepo.create({
    action: AuditAction.EXPORT,
    entityType: AuditEntityType.SCHEDULE,
    entityId: 'risk_export',
    actor: actor || 'api',
    actorRole: 'operator',
    success: true,
    details: {
      scheduleCount: schedules.length,
      riskCount: Array.from(checkResults.values()).filter(r => r.overallStatus !== CheckStatus.PASS).length,
    },
  });
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=risk_report_${new Date().toISOString().split('T')[0]}.csv`);
  
  res.send('\uFEFF' + (csv || ''));
});

router.get('/handover-report', async (req: Request, res: Response) => {
  const reportDate = req.query.date as string || new Date().toISOString().split('T')[0];
  const actor = req.headers['x-actor'] as string || 'api';
  
  const startOfDay = new Date(reportDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(reportDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const schedules = projectionService.getSchedulesByDateRange(
    startOfDay.toISOString(),
    endOfDay.toISOString()
  );
  
  const checkResults = await projectionService.checkAllSchedules({
    start: startOfDay.toISOString(),
    end: endOfDay.toISOString(),
  }, actor);
  
  const filmVersions = projectionService.getFilmVersions();
  const auditoriums = projectionService.getAuditoriums();
  const kdms = projectionService.getKDMs();
  
  const filmVersionMap = new Map();
  for (const fv of filmVersions) {
    filmVersionMap.set(`${fv.filmId}-${fv.versionId}`, fv);
  }
  
  const auditoriumMap = new Map();
  for (const a of auditoriums) {
    auditoriumMap.set(a.auditoriumId, a);
  }
  
  const latestChecks = new Map();
  
  const reportData: HandoverReportData = {
    reportDate,
    generatedAt: new Date().toISOString(),
    generatedBy: actor,
    schedules,
    filmVersions: filmVersionMap,
    auditoriums: auditoriumMap,
    kdms,
    checkResults,
    latestChecks,
  };
  
  const markdown = generateHandoverReport(reportData);
  
  auditRepo.create({
    action: AuditAction.EXPORT,
    entityType: AuditEntityType.SCHEDULE,
    entityId: 'handover_report',
    actor,
    actorRole: 'operator',
    success: true,
    details: {
      reportDate,
      scheduleCount: schedules.length,
    },
  });
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=handover_report_${reportDate}.md`);
  
  res.send(markdown);
});

export { router as importExportRouter };
