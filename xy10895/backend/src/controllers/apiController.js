const { allAsync, getAsync, runAsync } = require('../config/database');
const { canTransitionStatus, checkOwnerExists, createChangeLog } = require('../rules/businessRules');

const getApiList = async (req, res) => {
  try {
    const { search, status, method, permission_level, owner_id, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT a.*, o.name as owner_name, o.email as owner_email,
             (SELECT COUNT(*) FROM favorites WHERE api_id = a.id) as favorite_count,
             (SELECT COUNT(*) FROM example_requests WHERE api_id = a.id AND is_active = 1) as example_count
      FROM api_entries a 
      LEFT JOIN owners o ON a.owner_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (a.name LIKE ? OR a.description LIKE ? OR a.endpoint LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (status) {
      query += ` AND a.status = ?`;
      params.push(status);
    }
    if (method) {
      query += ` AND a.method = ?`;
      params.push(method);
    }
    if (permission_level) {
      query += ` AND a.permission_level = ?`;
      params.push(permission_level);
    }
    if (owner_id) {
      query += ` AND a.owner_id = ?`;
      params.push(owner_id);
    }

    const offset = (page - 1) * limit;
    query += ` ORDER BY a.updated_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const items = await allAsync(query, params);

    const countQuery = `SELECT COUNT(*) as total FROM api_entries WHERE 1=1`;
    const countResult = await getAsync(countQuery);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API list',
      details: error.message
    });
  }
};

const getApiDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const api = await getAsync(`
      SELECT a.*, o.name as owner_name, o.email as owner_email, o.department as owner_department
      FROM api_entries a 
      LEFT JOIN owners o ON a.owner_id = o.id
      WHERE a.id = ?
    `, [id]);

    if (!api) {
      return res.status(404).json({
        success: false,
        error: 'API entry not found'
      });
    }

    const [permissions, examples, changeLogs] = await Promise.all([
      allAsync('SELECT * FROM permission_requirements WHERE api_id = ?', [id]),
      allAsync('SELECT * FROM example_requests WHERE api_id = ? AND is_active = 1 ORDER BY created_at DESC', [id]),
      allAsync('SELECT * FROM change_logs WHERE api_id = ? ORDER BY created_at DESC', [id])
    ]);

    res.json({
      success: true,
      data: {
        ...api,
        permissions,
        examples,
        changeLogs
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API detail',
      details: error.message
    });
  }
};

const createApiEntry = async (req, res) => {
  try {
    const { name, description, endpoint, method, owner_id, permission_level, version } = req.body;

    if (owner_id) {
      const ownerExists = await checkOwnerExists(owner_id);
      if (!ownerExists) {
        return res.status(400).json({
          success: false,
          error: 'Specified owner does not exist'
        });
      }
    }

    const result = await runAsync(
      `INSERT INTO api_entries (name, description, endpoint, method, owner_id, permission_level, version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description, endpoint, method, owner_id, permission_level, version]
    );

    await createChangeLog(
      result.lastID,
      'create',
      null,
      JSON.stringify(req.body),
      req.body.changed_by || 'system',
      'API entry created'
    );

    const newApi = await getAsync('SELECT * FROM api_entries WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      data: newApi
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create API entry',
      details: error.message
    });
  }
};

const updateApiStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_status, changed_by, reason } = req.body;

    const currentApi = await getAsync('SELECT status FROM api_entries WHERE id = ?', [id]);
    if (!currentApi) {
      return res.status(404).json({
        success: false,
        error: 'API entry not found'
      });
    }

    if (!canTransitionStatus(currentApi.status, new_status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status transition',
        details: `Cannot transition from ${currentApi.status} to ${new_status}`
      });
    }

    await runAsync(
      'UPDATE api_entries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [new_status, id]
    );

    await createChangeLog(
      id,
      'status_change',
      currentApi.status,
      new_status,
      changed_by,
      reason
    );

    const updatedApi = await getAsync('SELECT * FROM api_entries WHERE id = ?', [id]);

    res.json({
      success: true,
      data: updatedApi
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update API status',
      details: error.message
    });
  }
};

const addExampleRequest = async (req, res) => {
  try {
    const { apiId } = req.params;
    const { title, request_body, response_body, headers } = req.body;

    const apiExists = await getAsync('SELECT id FROM api_entries WHERE id = ?', [apiId]);
    if (!apiExists) {
      return res.status(404).json({
        success: false,
        error: 'API entry not found'
      });
    }

    const result = await runAsync(
      `INSERT INTO example_requests (api_id, title, request_body, response_body, headers)
       VALUES (?, ?, ?, ?, ?)`,
      [apiId, title, request_body, response_body, headers]
    );

    await createChangeLog(
      apiId,
      'example_add',
      null,
      title,
      req.body.changed_by || 'system',
      `Added example: ${title}`
    );

    const newExample = await getAsync('SELECT * FROM example_requests WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      data: newExample
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add example request',
      details: error.message
    });
  }
};

module.exports = {
  getApiList,
  getApiDetail,
  createApiEntry,
  updateApiStatus,
  addExampleRequest
};
