const db = require('../database/db');

class ErrorCodeService {
  static async create(data, operator = 'system') {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get('SELECT MAX(version) as max_version FROM error_codes WHERE error_code = ? AND api_path = ?',
          [data.error_code, data.api_path],
          (err, row) => {
            const version = row ? (row.max_version || 0) + 1 : 1;
            
            const stmt = db.prepare(`
              INSERT INTO error_codes (error_code, api_path, user_message, debug_message, troubleshooting, team_id, status, version)
              VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
            `);
            
            stmt.run(
              data.error_code,
              data.api_path,
              data.user_message,
              data.debug_message || '',
              data.troubleshooting || '',
              data.team_id || null,
              version,
              function(err) {
                if (err) return reject(err);
                
                const historyStmt = db.prepare(`
                  INSERT INTO change_history (error_code_id, action, old_value, new_value, operator, reason)
                  VALUES (?, ?, ?, ?, ?, ?)
                `);
                historyStmt.run(this.lastID, 'create', null, JSON.stringify(data), operator, '创建错误码');
                historyStmt.finalize();
                
                resolve({ id: this.lastID, version });
              }
            );
            stmt.finalize();
          }
        );
      });
    });
  }

  static async findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT e.*, t.name as team_name 
        FROM error_codes e 
        LEFT JOIN teams t ON e.team_id = t.id 
        WHERE 1=1
      `;
      const params = [];

      if (filters.error_code) {
        query += ' AND e.error_code LIKE ?';
        params.push(`%${filters.error_code}%`);
      }
      if (filters.api_path) {
        query += ' AND e.api_path LIKE ?';
        params.push(`%${filters.api_path}%`);
      }
      if (filters.status) {
        query += ' AND e.status = ?';
        params.push(filters.status);
      }
      if (filters.team_id) {
        query += ' AND e.team_id = ?';
        params.push(filters.team_id);
      }

      query += ' ORDER BY e.created_at DESC';

      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT e.*, t.name as team_name, t.leader as team_leader, t.email as team_email
        FROM error_codes e 
        LEFT JOIN teams t ON e.team_id = t.id 
        WHERE e.id = ?
      `, [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  static async getHistory(id) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM change_history 
        WHERE error_code_id = ? 
        ORDER BY created_at DESC
      `, [id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getMappings(id) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM call_mapping 
        WHERE error_code_id = ? 
        ORDER BY created_at DESC
      `, [id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async updateStatus(id, newStatus, operator, reason = '') {
    const validTransitions = {
      'draft': ['pending_approval', 'merged'],
      'pending_approval': ['approved', 'rejected', 'draft'],
      'approved': ['deprecated', 'merged'],
      'rejected': ['draft'],
      'deprecated': [],
      'merged': []
    };

    const errorCode = await this.findById(id);
    if (!errorCode) throw new Error('错误码不存在');

    const currentStatus = errorCode.status;
    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`不允许从 ${currentStatus} 变更到 ${newStatus}`);
    }

    return new Promise((resolve, reject) => {
      db.run(`
        UPDATE error_codes 
        SET status = ?, updated_at = CURRENT_TIMESTAMP,
            approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
            approved_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END
        WHERE id = ?
      `, [newStatus, newStatus, operator, newStatus, id], (err) => {
        if (err) return reject(err);

        const historyStmt = db.prepare(`
          INSERT INTO change_history (error_code_id, action, old_value, new_value, operator, reason)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        historyStmt.run(id, 'status_change', currentStatus, newStatus, operator, reason);
        historyStmt.finalize();

        resolve({ success: true, newStatus });
      });
    });
  }

  static async mergeCodes(sourceIds, targetCodeData, operator) {
    const target = await this.create(targetCodeData, operator);
    
    for (const sourceId of sourceIds) {
      const source = await this.findById(sourceId);
      if (source) {
        await new Promise((resolve, reject) => {
          db.run(`
            UPDATE error_codes 
            SET status = 'merged', merged_from = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [source.error_code, sourceId], (err) => {
            if (err) return reject(err);

            const historyStmt = db.prepare(`
              INSERT INTO change_history (error_code_id, action, old_value, new_value, operator, reason)
              VALUES (?, ?, ?, ?, ?, ?)
            `);
            historyStmt.run(sourceId, 'merge', source.status, 'merged', operator, `归并到 ${targetCodeData.error_code}`);
            historyStmt.finalize();
            resolve();
          });
        });
      }
    }

    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE error_codes 
        SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [operator, target.id], resolve);
    });

    return { targetId: target.id, mergedCount: sourceIds.length };
  }

  static async addMapping(errorCodeId, mappingData) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO call_mapping (error_code_id, source_system, target_code, mapping_rule)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(errorCodeId, mappingData.source_system, mappingData.target_code, mappingData.mapping_rule,
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
      stmt.finalize();
    });
  }

  static async exportAll(filters = {}) {
    const errorCodes = await this.findAll(filters);
    
    for (const ec of errorCodes) {
      ec.history = await this.getHistory(ec.id);
      ec.mappings = await this.getMappings(ec.id);
      ec.status_explanation = this.getStatusExplanation(ec);
    }
    
    return errorCodes;
  }

  static getStatusExplanation(ec) {
    const explanations = {
      'draft': '草稿状态，正在编辑中，未提交审批',
      'pending_approval': `待审批状态，由 ${ec.team_name || '未知团队'} 负责人审批中`,
      'approved': `已审批通过，审批人: ${ec.approved_by || '未知'}，时间: ${ec.approved_at || '未知'}`,
      'rejected': '已驳回，需要修改后重新提交',
      'deprecated': '已废弃，不再推荐使用',
      'merged': `已归并，从 ${ec.merged_from || '其他错误码'} 合并而来`
    };
    
    return explanations[ec.status] || '未知状态';
  }

  static async getTeams() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM teams ORDER BY name', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async logApiRequest(endpoint, method, requestBody, responseBody, responsibleNode, statusCode) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO api_requests (endpoint, method, request_body, response_body, responsible_node, status_code)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        endpoint,
        method,
        JSON.stringify(requestBody),
        JSON.stringify(responseBody),
        responsibleNode,
        statusCode,
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
      stmt.finalize();
    });
  }

  static async getApiRequests() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM api_requests ORDER BY created_at DESC LIMIT 100', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

module.exports = ErrorCodeService;
