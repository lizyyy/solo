const db = require('../database/connection');

class ProjectService {
  async createProject(name, description = '') {
    const existing = await db.get('SELECT id FROM projects WHERE name = ?', [name]);
    if (existing) {
      throw new Error(`项目已存在: ${name}`);
    }

    const result = await db.run(`
      INSERT INTO projects (name, description) VALUES (?, ?)
    `, [name, description]);

    return await this.getProject(result.lastID);
  }

  async getProject(id) {
    return await db.get('SELECT * FROM projects WHERE id = ?', [id]);
  }

  async getProjectByName(name) {
    return await db.get('SELECT * FROM projects WHERE name = ?', [name]);
  }

  async listProjects() {
    return await db.all('SELECT * FROM projects ORDER BY created_at DESC');
  }

  async createScene(projectId, name, sceneCode = '', description = '') {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`项目不存在: ${projectId}`);
    }

    const existing = await db.get(`
      SELECT id FROM scenes WHERE project_id = ? AND name = ?
    `, [projectId, name]);
    if (existing) {
      throw new Error(`场景已存在于该项目: ${name}`);
    }

    const result = await db.run(`
      INSERT INTO scenes (project_id, name, scene_code, description)
      VALUES (?, ?, ?, ?)
    `, [projectId, name, sceneCode, description]);

    return await this.getScene(result.lastID);
  }

  async getScene(id) {
    return await db.get(`
      SELECT s.*, p.name as project_name
      FROM scenes s
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE s.id = ?
    `, [id]);
  }

  async listScenes(projectId = null) {
    let sql = `
      SELECT s.*, p.name as project_name
      FROM scenes s
      LEFT JOIN projects p ON s.project_id = p.id
    `;
    const params = [];

    if (projectId) {
      sql += ' WHERE s.project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY s.created_at DESC';

    return await db.all(sql, params);
  }

  async getProjectStats(projectId) {
    const luts = await db.all(`
      SELECT status, COUNT(*) as count
      FROM lut_records
      WHERE project_id = ?
      GROUP BY status
    `, [projectId]);

    const scenes = await db.all(`
      SELECT id, name FROM scenes WHERE project_id = ?
    `, [projectId]);

    const stats = {
      total: 0,
      byStatus: {},
      scenes: scenes
    };

    for (const lut of luts) {
      stats.total += lut.count;
      stats.byStatus[lut.status] = lut.count;
    }

    return stats;
  }
}

module.exports = new ProjectService();
