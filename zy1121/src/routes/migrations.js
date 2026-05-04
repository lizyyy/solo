const express = require('express');
const Joi = require('joi');
const Project = require('../models/project');
const Migration = require('../models/migration');
const MigrationParser = require('../services/migrationParser');
const { asyncHandler, NotFoundError, BadRequestError, ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

const migrationSchema = Joi.object({
  version: Joi.string().min(1).max(50).required(),
  name: Joi.string().min(1).max(200).required(),
  up_sql: Joi.string().required(),
  down_sql: Joi.string().allow('').allow(null).optional(),
  dependencies: Joi.array().items(Joi.string()).optional(),
  description: Joi.string().max(500).allow('').optional()
});

const importSchema = Joi.object({
  migrations: Joi.array().items(
    Joi.object({
      version: Joi.string().min(1).max(50).required(),
      name: Joi.string().min(1).max(200).required(),
      up_sql: Joi.string().required(),
      down_sql: Joi.string().allow('').allow(null).optional(),
      dependencies: Joi.array().items(Joi.string()).optional(),
      description: Joi.string().max(500).allow('').optional()
    })
  ).required(),
  replace_existing: Joi.boolean().optional().default(false)
});

const parseFileSchema = Joi.object({
  content: Joi.string().required(),
  version: Joi.string().min(1).max(50).optional(),
  name: Joi.string().min(1).max(200).optional()
});

router.get('/:projectId', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const migrations = await Migration.findByProject(req.params.projectId);
  const applied = await Migration.getAppliedMigrations(req.params.projectId);
  
  const appliedIds = new Set(applied.map(m => m.id));
  
  const migrationsWithStatus = migrations.map(m => ({
    ...m,
    status: appliedIds.has(m.id) ? 'applied' : 'pending',
    applied_at: applied.find(a => a.id === m.id)?.applied_at
  }));
  
  res.json({
    success: true,
    data: {
      migrations: migrationsWithStatus,
      summary: {
        total: migrations.length,
        applied: applied.length,
        pending: migrations.length - applied.length
      }
    }
  });
}));

router.get('/:projectId/:migrationId', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const migration = await Migration.findById(req.params.migrationId);
  
  if (!migration || migration.project_id !== req.params.projectId) {
    throw new NotFoundError(`Migration with id ${req.params.migrationId} not found`);
  }
  
  const applied = await Migration.getAppliedMigrations(req.params.projectId);
  const isApplied = applied.some(m => m.id === migration.id);
  
  const analysis = MigrationParser.analyzeMigration(migration);
  
  res.json({
    success: true,
    data: {
      migration: {
        ...migration,
        status: isApplied ? 'applied' : 'pending',
        applied_at: applied.find(a => a.id === migration.id)?.applied_at
      },
      analysis
    }
  });
}));

router.post('/:projectId', asyncHandler(async (req, res) => {
  const { error, value } = migrationSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', error.details);
  }
  
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const existing = await Migration.findByVersion(req.params.projectId, value.version);
  if (existing) {
    throw new BadRequestError(
      `Migration version "${value.version}" already exists in project`,
      'DUPLICATE_VERSION'
    );
  }
  
  const migration = await Migration.create(
    req.params.projectId,
    value.version,
    value.name,
    value.up_sql,
    value.down_sql || null,
    value.dependencies || [],
    value.description || ''
  );
  
  res.status(201).json({
    success: true,
    data: {
      migration
    }
  });
}));

router.put('/:projectId/:migrationId', asyncHandler(async (req, res) => {
  const updateSchema = Joi.object({
    name: Joi.string().min(1).max(200).optional(),
    up_sql: Joi.string().optional(),
    down_sql: Joi.string().allow('').allow(null).optional(),
    dependencies: Joi.array().items(Joi.string()).optional(),
    description: Joi.string().max(500).allow('').optional()
  });
  
  const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', error.details);
  }
  
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const migration = await Migration.findById(req.params.migrationId);
  
  if (!migration || migration.project_id !== req.params.projectId) {
    throw new NotFoundError(`Migration with id ${req.params.migrationId} not found`);
  }
  
  const updated = await Migration.update(req.params.migrationId, value);
  
  res.json({
    success: true,
    data: {
      migration: updated
    }
  });
}));

router.delete('/:projectId/:migrationId', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const migration = await Migration.findById(req.params.migrationId);
  
  if (!migration || migration.project_id !== req.params.projectId) {
    throw new NotFoundError(`Migration with id ${req.params.migrationId} not found`);
  }
  
  const applied = await Migration.getAppliedMigrations(req.params.projectId);
  if (applied.some(m => m.id === migration.id)) {
    throw new BadRequestError(
      'Cannot delete an applied migration',
      'MIGRATION_APPLIED'
    );
  }
  
  const deleted = await Migration.delete(req.params.migrationId);
  
  res.json({
    success: true,
    data: {
      message: `Migration version ${migration.version} deleted successfully`,
      deleted_count: deleted
    }
  });
}));

router.post('/:projectId/import', asyncHandler(async (req, res) => {
  const { error, value } = importSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', error.details);
  }
  
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const results = await Migration.batchImport(req.params.projectId, value.migrations);
  
  const imported = results.filter(r => r.status === 'imported');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');
  
  res.json({
    success: errors.length === 0,
    data: {
      imported_count: imported.length,
      skipped_count: skipped.length,
      error_count: errors.length,
      results,
      imported,
      skipped,
      errors
    }
  });
}));

router.post('/:projectId/parse', asyncHandler(async (req, res) => {
  const { error, value } = parseFileSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', error.details);
  }
  
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const { upSql, downSql } = MigrationParser.extractUpDownFromFile(value.content);
  const upStatements = MigrationParser.parseSqlContent(upSql);
  const downStatements = MigrationParser.parseSqlContent(downSql || '');
  
  const tempMigration = {
    up_sql: upSql,
    down_sql: downSql,
    version: value.version || 'parsed',
    name: value.name || 'parsed migration',
    id: 'temp'
  };
  
  const analysis = MigrationParser.analyzeMigration(tempMigration);
  
  res.json({
    success: true,
    data: {
      up_sql: upSql,
      down_sql: downSql,
      up_statements: upStatements.length,
      down_statements: downStatements.length,
      analysis: {
        has_destructive_up: analysis.has_destructive_up,
        has_risky_up: analysis.has_risky_up,
        has_down: analysis.has_down,
        up_operations: analysis.up_statements.map(s => s.type),
        down_operations: analysis.down_statements.map(s => s.type)
      }
    }
  });
}));

router.post('/:projectId/validate', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.projectId} not found`);
  }
  
  const validation = await MigrationParser.validateMigrations(req.params.projectId);
  
  res.json({
    success: true,
    data: validation
  });
}));

module.exports = router;
