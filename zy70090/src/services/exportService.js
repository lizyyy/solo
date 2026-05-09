const fs = require('fs');
const path = require('path');
const pool = require('../database/pool');
const { ApiError } = require('../utils/response');
const config = require('../config/config');
const OperationLogService = require('./operationLogService');
const XLSX = require('xlsx');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const STATUS_MAP = {
  'seized': '扣押中',
  'sealed': '封存中',
  'transferred': '已移交',
  'returned_pending': '待审批退还',
  'returned': '已退还'
};

class ExportService {
  static async createExportTask(req, exportType, exportFormat, criteria = {}) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO export_records 
         (export_type, export_format, export_criteria, requested_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [exportType, exportFormat, JSON.stringify(criteria), req.operator.id]
      );

      const exportRecord = result.rows[0];

      await client.query(
        `INSERT INTO background_jobs 
         (job_type, job_name, payload, priority)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          'export',
          `导出${exportType === 'ledger' ? '台账' : '照片汇总'} - ${exportFormat.toUpperCase()}`,
          JSON.stringify({
            export_id: exportRecord.id,
            export_type: exportType,
            export_format: exportFormat,
            criteria: criteria,
            operator_id: req.operator.id
          }),
          0
        ]
      );

      await OperationLogService.log(
        req,
        'export',
        'export_record',
        exportRecord.id,
        null,
        {
          export_type: exportType,
          export_format: exportFormat,
          criteria: criteria
        },
        `创建导出任务: 类型 ${exportType}, 格式 ${exportFormat}`
      );

      await client.query('COMMIT');

      return {
        export_id: exportRecord.id,
        status: 'processing',
        message: '导出任务已创建，正在后台处理中'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async executeExport(exportId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const exportResult = await client.query(
        'SELECT * FROM export_records WHERE id = $1',
        [exportId]
      );

      if (exportResult.rows.length === 0) {
        throw new ApiError('导出记录不存在', 404, 'EXPORT_NOT_FOUND');
      }

      const exportRecord = exportResult.rows[0];
      const criteria = exportRecord.export_criteria || {};

      let data;
      if (exportRecord.export_type === 'ledger') {
        data = await this.getLedgerData(criteria);
      } else if (exportRecord.export_type === 'photos') {
        data = await this.getPhotoSummaryData(criteria);
      } else {
        throw new ApiError('不支持的导出类型', 400, 'INVALID_EXPORT_TYPE');
      }

      const exportDir = path.resolve(config.upload.dir, 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${exportRecord.export_type}_${timestamp}.${exportRecord.export_format}`;
      const filePath = path.join(exportDir, fileName);

      let fileSize = 0;

      if (exportRecord.export_format === 'csv') {
        fileSize = await this.exportToCsv(data, filePath, exportRecord.export_type);
      } else if (exportRecord.export_format === 'excel' || exportRecord.export_format === 'xlsx') {
        fileSize = await this.exportToExcel(data, filePath, exportRecord.export_type);
      } else {
        throw new ApiError('不支持的导出格式', 400, 'INVALID_EXPORT_FORMAT');
      }

      await client.query(
        `UPDATE export_records 
         SET status = 'completed', file_path = $1, file_size = $2,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [filePath, fileSize, exportId]
      );

      await client.query('COMMIT');

      return {
        success: true,
        file_path: filePath,
        file_size: fileSize
      };
    } catch (error) {
      await client.query('ROLLBACK');
      
      await pool.query(
        `UPDATE export_records 
         SET status = 'failed', error_message = $1
         WHERE id = $2`,
        [error.message, exportId]
      );
      
      throw error;
    } finally {
      client.release();
    }
  }

  static async getLedgerData(criteria) {
    const conditions = ['si.is_deleted = FALSE'];
    const params = [];
    let paramIndex = 1;

    if (criteria.case_number) {
      conditions.push(`si.case_number ILIKE $${paramIndex}`);
      params.push(`%${criteria.case_number}%`);
      paramIndex++;
    }

    if (criteria.current_status) {
      conditions.push(`si.current_status = $${paramIndex}`);
      params.push(criteria.current_status);
      paramIndex++;
    }

    if (criteria.start_date) {
      conditions.push(`si.seized_date >= $${paramIndex}`);
      params.push(criteria.start_date);
      paramIndex++;
    }

    if (criteria.end_date) {
      conditions.push(`si.seized_date <= $${paramIndex}`);
      params.push(criteria.end_date);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query(
      `SELECT si.id, si.case_number, si.case_name, si.seized_date, si.item_name,
              si.item_description, si.quantity, si.unit, si.estimated_value,
              si.seized_location, si.seized_by, si.seized_department,
              si.item_owner_name, si.item_owner_id_card, si.item_owner_phone,
              si.current_status, si.is_photo_verified, si.photo_required,
              si.photo_uploaded, si.created_at,
              o1.real_name as created_by_name
       FROM seized_items si
       LEFT JOIN operators o1 ON si.created_by = o1.id
       ${whereClause}
       ORDER BY si.created_at DESC`,
      params
    );

    return result.rows.map(item => ({
      案件编号: item.case_number,
      案件名称: item.case_name,
      扣押日期: this.formatDate(item.seized_date),
      物品名称: item.item_name,
      物品描述: item.item_description || '',
      数量: item.quantity,
      单位: item.unit || '',
      估值: item.estimated_value || 0,
      扣押地点: item.seized_location || '',
      扣押人: item.seized_by,
      扣押部门: item.seized_department || '',
      所有人: item.item_owner_name || '',
      所有人身份证: item.item_owner_id_card || '',
      所有人电话: item.item_owner_phone || '',
      当前状态: STATUS_MAP[item.current_status] || item.current_status,
      照片校验: item.is_photo_verified ? '已校验' : '未校验',
      需照片数: item.photo_required,
      已上传照片: item.photo_uploaded,
      创建时间: this.formatDate(item.created_at),
      创建人: item.created_by_name || ''
    }));
  }

  static async getPhotoSummaryData(criteria) {
    const conditions = ['1=1'];
    const params = [];
    let paramIndex = 1;

    if (criteria.start_date) {
      conditions.push(`ip.upload_time >= $${paramIndex}`);
      params.push(criteria.start_date);
      paramIndex++;
    }

    if (criteria.end_date) {
      conditions.push(`ip.upload_time <= $${paramIndex}`);
      params.push(criteria.end_date);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query(
      `SELECT ip.id, si.case_number, si.item_name, ip.photo_type,
              ip.file_name, ip.file_size, ip.is_verified, ip.upload_time,
              o.real_name as uploaded_by_name
       FROM item_photos ip
       JOIN seized_items si ON ip.seized_item_id = si.id
       LEFT JOIN operators o ON ip.uploaded_by = o.id
       ${whereClause}
       ORDER BY ip.upload_time DESC`,
      params
    );

    return result.rows.map(item => ({
      案件编号: item.case_number,
      物品名称: item.item_name,
      照片类型: this.getPhotoTypeName(item.photo_type),
      文件名: item.file_name,
      文件大小: this.formatFileSize(item.file_size),
      是否校验: item.is_verified ? '已校验' : '未校验',
      上传时间: this.formatDate(item.upload_time),
      上传人: item.uploaded_by_name || ''
    }));
  }

  static getPhotoTypeName(type) {
    const types = {
      'seized': '扣押时',
      'sealed': '封存时',
      'transferred': '移交时',
      'returned': '退还时'
    };
    return types[type] || type;
  }

  static formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static async exportToCsv(data, filePath, exportType) {
    if (data.length === 0) {
      fs.writeFileSync(filePath, '暂无数据');
      return 0;
    }

    const headers = Object.keys(data[0]).map(key => ({
      id: key,
      title: key
    }));

    const csvWriter = createCsvWriter({
      path: filePath,
      header: headers
    });

    await csvWriter.writeRecords(data);
    
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  static async exportToExcel(data, filePath, exportType) {
    if (data.length === 0) {
      data = [{ 提示: '暂无数据' }];
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, exportType === 'ledger' ? '扣押台账' : '照片汇总');
    XLSX.writeFile(workbook, filePath);

    const stats = fs.statSync(filePath);
    return stats.size;
  }

  static async getExportStatus(exportId) {
    const result = await pool.query(
      `SELECT er.*, o.real_name as requested_by_name
       FROM export_records er
       LEFT JOIN operators o ON er.requested_by = o.id
       WHERE er.id = $1`,
      [exportId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('导出记录不存在', 404, 'EXPORT_NOT_FOUND');
    }

    return result.rows[0];
  }

  static async listExports(filters = {}, page = 1, pageSize = 20) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.export_type) {
      conditions.push(`er.export_type = $${paramIndex}`);
      params.push(filters.export_type);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`er.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.requested_by) {
      conditions.push(`er.requested_by = $${paramIndex}`);
      params.push(filters.requested_by);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM export_records er ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * pageSize;
    const exportsResult = await pool.query(
      `SELECT er.id, er.export_type, er.export_format, er.status,
              er.file_size, er.created_at, er.completed_at,
              o.real_name as requested_by_name
       FROM export_records er
       LEFT JOIN operators o ON er.requested_by = o.id
       ${whereClause}
       ORDER BY er.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return {
      exports: exportsResult.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  static async retryExport(req, exportId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const exportResult = await client.query(
        'SELECT * FROM export_records WHERE id = $1',
        [exportId]
      );

      if (exportResult.rows.length === 0) {
        throw new ApiError('导出记录不存在', 404, 'EXPORT_NOT_FOUND');
      }

      const exportRecord = exportResult.rows[0];

      if (exportRecord.status === 'completed') {
        return {
          export_id: exportId,
          status: 'completed',
          message: '该导出已成功完成，无需重试'
        };
      }

      await client.query(
        `UPDATE export_records 
         SET status = 'processing', error_message = NULL, completed_at = NULL
         WHERE id = $1`,
        [exportId]
      );

      await client.query(
        `INSERT INTO background_jobs 
         (job_type, job_name, payload, priority)
         VALUES ($1, $2, $3, $4)`,
        [
          'export',
          `重试导出 - ${exportRecord.export_format.toUpperCase()}`,
          JSON.stringify({
            export_id: exportId,
            export_type: exportRecord.export_type,
            export_format: exportRecord.export_format,
            criteria: exportRecord.export_criteria,
            operator_id: req.operator.id,
            is_retry: true
          }),
          1
        ]
      );

      await OperationLogService.log(
        req,
        'export_retry',
        'export_record',
        exportId,
        { status: exportRecord.status },
        { status: 'processing' },
        `重试导出任务: 类型 ${exportRecord.export_type}`
      );

      await client.query('COMMIT');

      return {
        export_id: exportId,
        status: 'processing',
        message: '导出重试任务已创建，正在后台处理中'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = ExportService;
