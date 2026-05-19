const db = require('../config/database');

class ErrorHandler {
  static async recordImportError(importType, rawData, rowNumber, errorMessage, suggestion = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO import_errors (import_type, raw_data, row_number, error_message, suggestion)
         VALUES (?, ?, ?, ?, ?)`,
        [importType, JSON.stringify(rawData), rowNumber, errorMessage, suggestion],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  static async getImportErrors(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM import_errors WHERE 1=1';
      const params = [];

      if (filters.import_type) {
        query += ' AND import_type = ?';
        params.push(filters.import_type);
      }
      if (filters.resolved !== undefined) {
        query += ' AND resolved = ?';
        params.push(filters.resolved ? 1 : 0);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows.forEach(row => {
            row.raw_data = JSON.parse(row.raw_data);
          });
          resolve(rows);
        }
      });
    });
  }

  static async resolveError(id, resolvedBy) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE import_errors SET resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [resolvedBy, id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ updated: this.changes });
          }
        }
      );
    });
  }

  static validateStopData(data, rowNumber) {
    const errors = [];
    
    if (!data.stop_id || data.stop_id.trim() === '') {
      errors.push('站点ID不能为空');
    }
    if (!data.stop_name || data.stop_name.trim() === '') {
      errors.push('站点名称不能为空');
    }
    if (!data.route_id || data.route_id.trim() === '') {
      errors.push('线路ID不能为空');
    }
    if (!data.scheduled_time) {
      errors.push('计划时间不能为空');
    }
    if (data.sequence === undefined || data.sequence === null || isNaN(data.sequence)) {
      errors.push('序号必须是数字');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors: errors.join('; '),
        suggestion: ErrorHandler.getStopDataSuggestion(data)
      };
    }

    return { valid: true };
  }

  static validateGPSData(data) {
    const errors = [];
    
    if (!data.device_id) {
      errors.push('设备ID不能为空');
    }
    if (!data.latitude || isNaN(data.latitude)) {
      errors.push('纬度必须是有效数字');
    }
    if (!data.longitude || isNaN(data.longitude)) {
      errors.push('经度必须是有效数字');
    }
    if (!data.timestamp) {
      errors.push('时间戳不能为空');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors: errors.join('; '),
        suggestion: ErrorHandler.getGPSDataSuggestion(data)
      };
    }

    return { valid: true };
  }

  static validateComplaintData(data) {
    const errors = [];
    
    if (!data.complaint_id) {
      errors.push('申诉ID不能为空');
    }
    if (!data.parent_name) {
      errors.push('家长姓名不能为空');
    }
    if (!data.student_name) {
      errors.push('学生姓名不能为空');
    }
    if (!data.complaint_type) {
      errors.push('申诉类型不能为空');
    }
    if (!data.complaint_time) {
      errors.push('申诉时间不能为空');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors: errors.join('; '),
        suggestion: ErrorHandler.getComplaintDataSuggestion(data)
      };
    }

    return { valid: true };
  }

  static getStopDataSuggestion(data) {
    const suggestions = [];
    if (!data.stop_id) suggestions.push('请填写站点唯一标识，如 ST001');
    if (!data.stop_name) suggestions.push('请填写站点名称，如 阳光花园南门');
    if (!data.route_id) suggestions.push('请填写线路ID，如 R001');
    if (!data.scheduled_time) suggestions.push('请填写计划到达时间，格式 HH:mm');
    if (isNaN(data.sequence)) suggestions.push('请填写站点在线路中的序号，从1开始');
    return suggestions.join('；');
  }

  static getGPSDataSuggestion(data) {
    const suggestions = [];
    if (!data.device_id) suggestions.push('请填写GPS设备ID');
    if (!data.latitude || isNaN(data.latitude)) suggestions.push('纬度应在 -90 到 90 之间');
    if (!data.longitude || isNaN(data.longitude)) suggestions.push('经度应在 -180 到 180 之间');
    if (!data.timestamp) suggestions.push('时间格式建议为 ISO 8601 或 YYYY-MM-DD HH:mm:ss');
    return suggestions.join('；');
  }

  static getComplaintDataSuggestion(data) {
    const suggestions = [];
    if (!data.complaint_id) suggestions.push('请生成申诉唯一标识，如 CPL20240101001');
    if (!data.parent_name) suggestions.push('请填写家长姓名');
    if (!data.student_name) suggestions.push('请填写学生姓名');
    if (!data.complaint_type) suggestions.push('申诉类型可选：late, no_stop, safety, other');
    if (!data.complaint_time) suggestions.push('请填写申诉发生时间');
    return suggestions.join('；');
  }
}

module.exports = ErrorHandler;
