const express = require('express');
const Joi = require('joi');
const Project = require('../models/project');
const PlanGenerator = require('../services/planGenerator');
const ExecutionService = require('../services/executionService');
const { asyncHandler, NotFoundError, BadRequestError, ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

const applySchema = Joi.object({
  target_version: Joi.string().optional(),
  dry_run: Joi.boolean().optional().default(true),
  force: Joi.boolean().optional().default(false)
});

const rollbackSchema = Joi.object({
  target_version: Joi.string().optional(),
  steps: Joi.number().integer().min(1).optional(),
  dry_run: Joi.boolean().optional().default(true),
  force: Joi.boolean().optional().default(false)
});

router.post('/:projectId/plan', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const direction = req.query.direction || 'up';
  const targetVersion = req.query.target_version;
  const steps = req.query.steps ? parseInt(req.query.steps) : null;
  
  let plan;
  
  if (direction === 'down') {
    plan = await PlanGenerator.generateRollbackPlan(
      req.params.projectId,
      targetVersion,
      steps
    );
  } else {
    plan = await PlanGenerator.generateApplyPlan(
      req.params.projectId,
      targetVersion
    );
  }
  
  const validation = await PlanGenerator.validatePlan(plan);
  
  res.json({
    success: true,
    data: {
      plan,
      validation
    }
  });
}));

router.post('/:projectId/apply', asyncHandler(async (req, res) => {
  const { error, value } = applySchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', error.details);
  }
  
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const plan = await PlanGenerator.generateApplyPlan(
    req.params.projectId,
    value.target_version
  );
  
  if (plan.total_count === 0) {
    res.json({
      success: true,
      data: {
        message: 'No migrations to apply',
        plan: plan,
        dry_run_result: null
      }
    });
    return;
  }
  
  if (value.dry_run) {
    const dryRunResult = await ExecutionService.dryRunApply(
      req.params.projectId,
      plan
    );
    
    res.json({
      success: true,
      data: {
        message: 'Dry run completed',
        is_dry_run: true,
        plan: plan,
        dry_run_result: {
          success: dryRunResult.success,
          errors: dryRunResult.errors,
          warnings: dryRunResult.warnings,
          migration_count: dryRunResult.migration_results.length,
          failed_migrations: dryRunResult.migration_results.filter(r => !r.success).map(r => r.version)
        }
      }
    });
    return;
  }
  
  const dryRunResult = await ExecutionService.dryRunApply(
    req.params.projectId,
    plan
  );
  
  if (!dryRunResult.success && !value.force) {
    res.status(422).json({
      success: false,
      error: {
        message: 'Dry run failed. Use force: true to override or fix the issues.',
        code: 'DRY_RUN_FAILED',
        dry_run_errors: dryRunResult.errors,
        dry_run_warnings: dryRunResult.warnings
      }
    });
    return;
  }
  
  const result = await ExecutionService.applyMigrations(
    req.params.projectId,
    plan,
    { force: value.force }
  );
  
  res.json({
    success: result.success,
    data: {
      ...result,
      plan: plan,
      dry_run_warnings: dryRunResult.warnings
    }
  });
}));

router.post('/:projectId/rollback', asyncHandler(async (req, res) => {
  const { error, value } = rollbackSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', error.details);
  }
  
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const plan = await PlanGenerator.generateRollbackPlan(
    req.params.projectId,
    value.target_version,
    value.steps
  );
  
  if (plan.total_count === 0) {
    res.json({
      success: true,
      data: {
        message: 'No migrations to rollback',
        plan: plan,
        dry_run_result: null
      }
    });
    return;
  }
  
  if (value.dry_run) {
    const dryRunResult = await ExecutionService.dryRunRollback(
      req.params.projectId,
      plan
    );
    
    res.json({
      success: true,
      data: {
        message: 'Dry run completed',
        is_dry_run: true,
        plan: plan,
        dry_run_result: {
          success: dryRunResult.success,
          errors: dryRunResult.errors,
          warnings: dryRunResult.warnings,
          migration_count: dryRunResult.migration_results.length,
          failed_migrations: dryRunResult.migration_results.filter(r => !r.success).map(r => r.version)
        }
      }
    });
    return;
  }
  
  const dryRunResult = await ExecutionService.dryRunRollback(
    req.params.projectId,
    plan
  );
  
  if (!dryRunResult.success && !value.force) {
    res.status(422).json({
      success: false,
      error: {
        message: 'Dry run failed. Use force: true to override or fix the issues.',
        code: 'DRY_RUN_FAILED',
        dry_run_errors: dryRunResult.errors,
        dry_run_warnings: dryRunResult.warnings
      }
    });
    return;
  }
  
  const result = await ExecutionService.rollbackMigrations(
    req.params.projectId,
    plan,
    { force: value.force }
  );
  
  res.json({
    success: result.success,
    data: {
      ...result,
      plan: plan,
      dry_run_warnings: dryRunResult.warnings
    }
  });
}));

router.get('/:projectId/check', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const healthCheck = await ExecutionService.checkProjectHealth(req.params.projectId);
  const migrationValidation = await PlanGenerator.generateMigrationReport(req.params.projectId);
  
  res.json({
    success: true,
    data: {
      health_check: {
        foreign_keys_enabled: healthCheck.database_state.foreign_keys_enabled,
        tables: healthCheck.database_state.tables.length,
        health_issues: healthCheck.health_check.warnings.length,
        critical_count: healthCheck.health_check.critical_count,
        high_count: healthCheck.health_check.high_count,
        medium_count: healthCheck.health_check.medium_count,
        low_count: healthCheck.health_check.low_count
      },
      migration_validation: {
        valid: healthCheck.migration_validation.valid,
        errors: healthCheck.migration_validation.errors,
        warnings: healthCheck.migration_validation.warnings
      },
      migration_report: migrationValidation
    }
  });
}));

router.get('/:projectId/export', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const format = req.query.format || 'json';
  const report = await ExecutionService.exportReport(req.params.projectId, format);
  
  if (format === 'json') {
    res.json({
      success: true,
      data: JSON.parse(report.content)
    });
  } else {
    res.set('Content-Type', report.contentType);
    res.set('Content-Disposition', `attachment; filename="migration-report.${report.format}"`);
    res.send(report.content);
  }
}));

router.get('/:projectId/preview-export', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const format = req.query.format || 'json';
  const report = await ExecutionService.exportReport(req.params.projectId, format);
  
  res.json({
    success: true,
    data: {
      format: report.format,
      content_type: report.contentType,
      preview: report.content.substring(0, 5000),
      total_length: report.content.length
    }
  });
}));

module.exports = router;
