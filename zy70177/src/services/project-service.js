const { runAsync, getAsync, allAsync } = require('../database/database');
const BUSINESS_RULES = require('../rules/business-rules');
const { auditService, TABLE_NAMES } = require('./audit-service');

const projectService = {
  createProject: async (data) => {
    const result = await runAsync(
      `INSERT INTO projects (name, code, client, amount, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)`,
      [data.name, data.code, data.client, data.amount, data.start_date, data.end_date || null]
    );
    
    const createdProject = await getAsync('SELECT * FROM projects WHERE id = ?', [result.lastID]);
    await auditService.logCreate(TABLE_NAMES.PROJECTS, result.lastID, data.user_id || 'system', createdProject);
    
    return createdProject;
  },

  getAllProjects: async () => {
    return await allAsync('SELECT * FROM projects ORDER BY created_at DESC');
  },

  getProjectById: async (id) => {
    return await getAsync('SELECT * FROM projects WHERE id = ?', [id]);
  },

  updateProject: async (id, data) => {
    const oldProject = await getAsync('SELECT * FROM projects WHERE id = ?', [id]);
    
    await runAsync(
      `UPDATE projects SET name = ?, code = ?, client = ?, amount = ?, start_date = ?, end_date = ?, updated_at = datetime('now') WHERE id = ?`,
      [data.name, data.code, data.client, data.amount, data.start_date, data.end_date || null, id]
    );
    
    const updatedProject = await getAsync('SELECT * FROM projects WHERE id = ?', [id]);
    await auditService.logUpdate(TABLE_NAMES.PROJECTS, id, data.user_id || 'system', oldProject, updatedProject);
    
    return updatedProject;
  },

  deleteProject: async (id) => {
    const oldProject = await getAsync('SELECT * FROM projects WHERE id = ?', [id]);
    await auditService.logDelete(TABLE_NAMES.PROJECTS, id, 'system', oldProject);
    return await runAsync('DELETE FROM projects WHERE id = ?', [id]);
  }
};

module.exports = projectService;
