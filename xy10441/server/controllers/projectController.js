const pool = require('../config/database');

const getProjects = async (req, res) => {
  try {
    const { customer_id, keyword, status } = req.query;
    let query = `
      SELECT p.*, c.name as customer_name, c.contact_person,
             (SELECT COUNT(*) FROM proposal_versions WHERE project_id = p.id) as version_count,
             (SELECT COUNT(*) FROM proposal_versions WHERE project_id = p.id AND is_confirmed = TRUE) as confirmed_count
      FROM projects p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE 1=1
    `;
    let params = [];
    let paramIndex = 1;
    
    if (customer_id) {
      query += ` AND p.customer_id = $${paramIndex++}`;
      params.push(customer_id);
    }
    
    if (status) {
      query += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (keyword) {
      query += ` AND (p.name ILIKE $${paramIndex++} OR c.name ILIKE $${paramIndex++})`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    query += ` ORDER BY p.updated_at DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const projectResult = await pool.query(`
      SELECT p.*, c.name as customer_name, c.contact_person, c.contact_phone, c.contact_email
      FROM projects p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE p.id = $1
    `, [id]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: '项目不存在' });
    }
    
    const project = projectResult.rows[0];
    
    const versionsResult = await pool.query(`
      SELECT pv.*,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM quotation_items WHERE proposal_version_id = pv.id) as item_count,
             (SELECT COUNT(*) FROM attachments WHERE proposal_version_id = pv.id AND is_required = TRUE) as required_attachments,
             (SELECT COUNT(*) FROM attachments WHERE proposal_version_id = pv.id AND is_required = TRUE AND file_path IS NOT NULL) as uploaded_required_attachments
      FROM proposal_versions pv
      LEFT JOIN users u ON pv.created_by = u.id
      WHERE pv.project_id = $1
      ORDER BY pv.created_at DESC
    `, [id]);
    
    project.versions = versionsResult.rows;
    res.json(project);
  } catch (error) {
    console.error('获取项目详情失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const createProject = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { customer_id, name, description } = req.body;
    
    const projectResult = await client.query(
      `INSERT INTO projects (customer_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [customer_id, name, description, req.user.id]
    );
    
    const project = projectResult.rows[0];
    
    await client.query(`
      INSERT INTO proposal_versions (project_id, version_number, version_name, created_by)
      VALUES ($1, '1.0', '初始版本', $2)
    `, [project.id, req.user.id]);
    
    await client.query('COMMIT');
    res.status(201).json(project);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('创建项目失败:', error);
    res.status(500).json({ error: '服务器错误' });
  } finally {
    client.release();
  }
};

const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    
    const result = await pool.query(
      `UPDATE projects SET name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [name, description, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '项目不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('更新项目失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const deleteProject = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    const confirmedVersions = await client.query(
      `SELECT COUNT(*) as count FROM proposal_versions WHERE project_id = $1 AND is_confirmed = TRUE`,
      [id]
    );
    
    if (parseInt(confirmedVersions.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '该项目下存在已确认的方案版本，无法删除' });
    }
    
    await client.query('DELETE FROM attachments WHERE proposal_version_id IN (SELECT id FROM proposal_versions WHERE project_id = $1)', [id]);
    await client.query('DELETE FROM quotation_items WHERE proposal_version_id IN (SELECT id FROM proposal_versions WHERE project_id = $1)', [id]);
    await client.query('DELETE FROM scope_changes WHERE proposal_version_id IN (SELECT id FROM proposal_versions WHERE project_id = $1)', [id]);
    await client.query('DELETE FROM confirmations WHERE proposal_version_id IN (SELECT id FROM proposal_versions WHERE project_id = $1)', [id]);
    await client.query('DELETE FROM version_reference WHERE source_version_id IN (SELECT id FROM proposal_versions WHERE project_id = $1) OR target_version_id IN (SELECT id FROM proposal_versions WHERE project_id = $1)', [id]);
    await client.query('DELETE FROM proposal_versions WHERE project_id = $1', [id]);
    
    const result = await client.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '项目不存在' });
    }
    
    await client.query('COMMIT');
    res.json({ message: '项目删除成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('删除项目失败:', error);
    res.status(500).json({ error: '服务器错误' });
  } finally {
    client.release();
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
};