const express = require('express');
const Joi = require('joi');
const Project = require('../models/project');
const Migration = require('../models/migration');
const ExecutionHistory = require('../models/executionHistory');
const { asyncHandler, NotFoundError, BadRequestError, ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

const createProjectSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('').optional(),
  db_path: Joi.string().min(1).required()
});

const updateProjectSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).allow('').optional(),
  db_path: Joi.string().min(1).optional()
});

router.get('/', asyncHandler(async (req, res) => {
  const projects = await Project.findAll();
  
  res.json({
    success: true,
    data: {
      projects: projects
    }
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.id} not found`);
  }
  
  const migrations = await Migration.findByProject(req.params.id);
  const applied = await Migration.getAppliedMigrations(req.params.id);
  const history = await ExecutionHistory.findByProject(req.params.id);
  
  res.json({
    success: true,
    data: {
      project,
      migration_summary: {
        total: migrations.length,
        applied: applied.length,
        pending: migrations.length - applied.length,
        current_version: applied.length > 0 ? applied[applied.length - 1].version : null
      },
      recent_executions: history.slice(0, 10)
    }
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { error, value } = createProjectSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', error.details);
  }
  
  const existing = await Project.findByName(value.name);
  if (existing) {
    throw new BadRequestError(`Project with name "${value.name}" already exists`, 'PROJECT_EXISTS');
  }
  
  const project = await Project.create(
    value.name,
    value.db_path,
    value.description || ''
  );
  
  res.status(201).json({
    success: true,
    data: {
      project
    }
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { error, value } = updateProjectSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', error.details);
  }
  
  const existing = await Project.findById(req.params.id);
  if (!existing) {
    throw new NotFoundError(`Project with id ${req.params.id} not found`);
  }
  
  if (value.name && value.name !== existing.name) {
    const nameConflict = await Project.findByName(value.name);
    if (nameConflict) {
      throw new BadRequestError(`Project with name "${value.name}" already exists`, 'PROJECT_EXISTS');
    }
  }
  
  const updated = await Project.update(req.params.id, value);
  
  res.json({
    success: true,
    data: {
      project: updated
    }
  });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await Project.findById(req.params.id);
  if (!existing) {
    throw new NotFoundError(`Project with id ${req.params.id} not found`);
  }
  
  const deleted = await Project.delete(req.params.id);
  
  res.json({
    success: true,
    data: {
      message: `Project "${existing.name}" deleted successfully`,
      deleted_count: deleted
    }
  });
}));

router.get('/:id/migrations', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.id} not found`);
  }
  
  const allMigrations = await Migration.findByProject(req.params.id);
  const applied = await Migration.getAppliedMigrations(req.params.id);
  const pending = await Migration.getPendingMigrations(req.params.id);
  
  const appliedIds = new Set(applied.map(m => m.id));
  
  const migrationsWithStatus = allMigrations.map(m => ({
    ...m,
    status: appliedIds.has(m.id) ? 'applied' : 'pending',
    applied_at: applied.find(a => a.id === m.id)?.applied_at
  }));
  
  res.json({
    success: true,
    data: {
      migrations: migrationsWithStatus,
      summary: {
        total: allMigrations.length,
        applied: applied.length,
        pending: pending.length
      }
    }
  });
}));

router.get('/:id/history', asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new NotFoundError(`Project with id ${req.params.id} not found`);
  }
  
  const history = await ExecutionHistory.findByProject(req.params.id);
  const limit = parseInt(req.query.limit) || 50;
  
  res.json({
    success: true,
    data: {
      history: history.slice(0, limit),
      total: history.length
    }
  });
}));

module.exports = router;
