const { run, get, all } = require('./database');
const { generateId, now } = require('./models');
const moment = require('moment');

class OperationLogService {
  static async log(operationType, entityType, entityId, operator, originalInput, processingBasis, result, status, errorMessage = null) {
    const logId = generateId();
    await run(`
      INSERT INTO operation_logs (
        id, operation_type, entity_type, entity_id, operator,
        original_input, processing_basis, result, status, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      logId,
      operationType,
      entityType,
      entityId,
      operator,
      JSON.stringify(originalInput),
      JSON.stringify(processingBasis),
      JSON.stringify(result),
      status,
      errorMessage,
      now()
    ]);
    return logId;
  }

  static async getLogs(entityType, entityId) {
    return await all(`
      SELECT * FROM operation_logs
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `, [entityType, entityId]);
  }

  static async getAllFailedLogs() {
    return await all(`
      SELECT * FROM operation_logs
      WHERE status = 'failed'
      ORDER BY created_at DESC
    `);
  }
}

class DatasetVersionService {
  static async create(data, operator) {
    const id = generateId();
    const { dataset_name, version, publisher, change_summary, change_details } = data;
    
    try {
      await run(`
        INSERT INTO dataset_versions (
          id, dataset_name, version, status, publisher, change_summary, change_details, created_at, updated_at
        ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `, [id, dataset_name, version, publisher, change_summary, change_details || null, now(), now()]);
      
      await OperationLogService.log(
        'create', 'dataset_version', id, operator,
        data, { rule: 'create_dataset_version' },
        { id, status: 'draft' }, 'success'
      );
      
      return { success: true, id };
    } catch (error) {
      await OperationLogService.log(
        'create', 'dataset_version', id, operator,
        data, { rule: 'create_dataset_version' },
        null, 'failed', error.message
      );
      return { success: false, error: error.message };
    }
  }

  static async publish(id, operator) {
    const version = await this.getById(id);
    if (!version) {
      await OperationLogService.log(
        'publish', 'dataset_version', id, operator,
        { id }, { rule: 'publish_dataset_version' },
        null, 'failed', 'Dataset version not found'
      );
      return { success: false, error: 'Dataset version not found' };
    }

    if (version.status !== 'draft') {
      await OperationLogService.log(
        'publish', 'dataset_version', id, operator,
        { id }, { rule: 'publish_dataset_version', currentStatus: version.status },
        null, 'failed', 'Only draft versions can be published'
      );
      return { success: false, error: 'Only draft versions can be published' };
    }

    try {
      await run(`
        UPDATE dataset_versions
        SET status = 'published', publish_time = ?, updated_at = ?
        WHERE id = ?
      `, [now(), now(), id]);
      
      await OperationLogService.log(
        'publish', 'dataset_version', id, operator,
        { id }, { rule: 'publish_dataset_version', previousStatus: version.status },
        { status: 'published' }, 'success'
      );
      
      return { success: true };
    } catch (error) {
      await OperationLogService.log(
        'publish', 'dataset_version', id, operator,
        { id }, { rule: 'publish_dataset_version' },
        null, 'failed', error.message
      );
      return { success: false, error: error.message };
    }
  }

  static async getById(id) {
    return await get('SELECT * FROM dataset_versions WHERE id = ?', [id]);
  }

  static async getAll(filters = {}) {
    let query = 'SELECT * FROM dataset_versions WHERE 1=1';
    const params = [];
    
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.dataset_name) {
      query += ' AND dataset_name = ?';
      params.push(filters.dataset_name);
    }
    
    query += ' ORDER BY created_at DESC';
    return await all(query, params);
  }

  static async manualCorrect(id, data, operator) {
    const { updates, correction_reason } = data;
    const version = await this.getById(id);
    
    if (!version) {
      return { success: false, error: 'Dataset version not found' };
    }

    const allowedFields = ['change_summary', 'change_details', 'publisher'];
    const updateFields = [];
    const updateValues = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }
    
    if (updateFields.length === 0) {
      return { success: false, error: 'No valid fields to update' };
    }

    updateValues.push(now(), id);
    
    try {
      await run(`
        UPDATE dataset_versions
        SET ${updateFields.join(', ')}, updated_at = ?
        WHERE id = ?
      `, updateValues);
      
      await OperationLogService.log(
        'manual_correct', 'dataset_version', id, operator,
        data, { rule: 'manual_correction', correction_reason },
        { updates }, 'success'
      );
      
      return { success: true };
    } catch (error) {
      await OperationLogService.log(
        'manual_correct', 'dataset_version', id, operator,
        data, { rule: 'manual_correction' },
        null, 'failed', error.message
      );
      return { success: false, error: error.message };
    }
  }
}

class DownstreamProjectService {
  static async create(data, operator) {
    const id = generateId();
    const { project_name, owner, contact_email, description } = data;
    
    try {
      await run(`
        INSERT INTO downstream_projects (id, project_name, owner, contact_email, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, project_name, owner, contact_email || null, description || null, now()]);
      
      await OperationLogService.log(
        'create', 'downstream_project', id, operator,
        data, { rule: 'create_downstream_project' },
        { id }, 'success'
      );
      
      return { success: true, id };
    } catch (error) {
      await OperationLogService.log(
        'create', 'downstream_project', id, operator,
        data, { rule: 'create_downstream_project' },
        null, 'failed', error.message
      );
      return { success: false, error: error.message };
    }
  }

  static async getById(id) {
    return await get('SELECT * FROM downstream_projects WHERE id = ?', [id]);
  }

  static async getAll(activeOnly = true) {
    let query = 'SELECT * FROM downstream_projects';
    if (activeOnly) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY created_at DESC';
    return await all(query);
  }
}

class AcknowledgmentService {
  static async create(data, operator) {
    const id = generateId();
    const { dataset_version_id, project_id, assignee, deadline } = data;
    
    const datasetVersion = await DatasetVersionService.getById(dataset_version_id);
    if (!datasetVersion) {
      await OperationLogService.log(
        'create', 'acknowledgment', id, operator,
        data, { rule: 'create_acknowledgment' },
        null, 'failed', 'Dataset version not found'
      );
      return { success: false, error: 'Dataset version not found' };
    }

    const project = await DownstreamProjectService.getById(project_id);
    if (!project) {
      await OperationLogService.log(
        'create', 'acknowledgment', id, operator,
        data, { rule: 'create_acknowledgment' },
        null, 'failed', 'Downstream project not found'
      );
      return { success: false, error: 'Downstream project not found' };
    }

    try {
      await run(`
        INSERT INTO acknowledgments (
          id, dataset_version_id, project_id, assignee, status, deadline, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
      `, [id, dataset_version_id, project_id, assignee, deadline || null, now(), now()]);
      
      await OperationLogService.log(
        'create', 'acknowledgment', id, operator,
        data, { rule: 'create_acknowledgment' },
        { id, status: 'pending' }, 'success'
      );
      
      return { success: true, id };
    } catch (error) {
      await OperationLogService.log(
        'create', 'acknowledgment', id, operator,
        data, { rule: 'create_acknowledgment' },
        null, 'failed', error.message
      );
      return { success: false, error: error.message };
    }
  }

  static async acknowledge(id, data, operator) {
    const { acknowledgment_note } = data;
    const ack = await this.getById(id);
    
    if (!ack) {
      await OperationLogService.log(
        'acknowledge', 'acknowledgment', id, operator,
        data, { rule: 'acknowledge_version' },
        null, 'failed', 'Acknowledgment not found'
      );
      return { success: false, error: 'Acknowledgment not found' };
    }

    if (ack.status !== 'pending') {
      await OperationLogService.log(
        'acknowledge', 'acknowledgment', id, operator,
        data, { rule: 'acknowledge_version', currentStatus: ack.status },
        null, 'failed', 'Only pending acknowledgments can be acknowledged'
      );
      return { success: false, error: 'Only pending acknowledgments can be acknowledged' };
    }

    try {
      await run(`
        UPDATE acknowledgments
        SET status = 'acknowledged', acknowledged_at = ?, acknowledgment_note = ?, updated_at = ?
        WHERE id = ?
      `, [now(), acknowledgment_note || null, now(), id]);
      
      await OperationLogService.log(
        'acknowledge', 'acknowledgment', id, operator,
        data, { rule: 'acknowledge_version', previousStatus: ack.status },
        { status: 'acknowledged' }, 'success'
      );
      
      return { success: true };
    } catch (error) {
      await OperationLogService.log(
        'acknowledge', 'acknowledgment', id, operator,
        data, { rule: 'acknowledge_version' },
        null, 'failed', error.message
      );
      return { success: false, error: error.message };
    }
  }

  static async markTimeout(id, operator) {
    const ack = await this.getById(id);
    
    if (!ack) {
      return { success: false, error: 'Acknowledgment not found' };
    }

    if (ack.status !== 'pending') {
      return { success: false, error: 'Only pending acknowledgments can be marked as timeout' };
    }

    try {
      await run(`
        UPDATE acknowledgments
        SET status = 'timeout', updated_at = ?
        WHERE id = ?
      `, [now(), id]);
      
      await OperationLogService.log(
        'mark_timeout', 'acknowledgment', id, operator,
        { id }, { rule: 'acknowledgment_timeout' },
        { status: 'timeout' }, 'success'
      );
      
      return { success: true };
    } catch (error) {
      await OperationLogService.log(
        'mark_timeout', 'acknowledgment', id, operator,
        { id }, { rule: 'acknowledgment_timeout' },
        null, 'failed', error.message
      );
      return { success: false, error: error.message };
    }
  }

  static async getById(id) {
    return await get('SELECT * FROM acknowledgments WHERE id = ?', [id]);
  }

  static async getAll(filters = {}) {
    let query = 'SELECT * FROM acknowledgments WHERE 1=1';
    const params = [];
    
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.dataset_version_id) {
      query += ' AND dataset_version_id = ?';
      params.push(filters.dataset_version_id);
    }
    if (filters.project_id) {
      query += ' AND project_id = ?';
      params.push(filters.project_id);
    }
    if (filters.assignee) {
      query += ' AND assignee = ?';
      params.push(filters.assignee);
    }
    
    query += ' ORDER BY created_at DESC';
    return await all(query, params);
  }

  static async getDetails(id) {
    return await get(`
      SELECT 
        a.*,
        dv.dataset_name,
        dv.version as dataset_version,
        dv.change_summary,
        p.project_name
      FROM acknowledgments a
      JOIN dataset_versions dv ON a.dataset_version_id = dv.id
      JOIN downstream_projects p ON a.project_id = p.id
      WHERE a.id = ?
    `, [id]);
  }

  static async manualCorrect(id, data, operator) {
    const { updates, correction_reason } = data;
    const ack = await this.getById(id);
    
    if (!ack) {
      return { success: false, error: 'Acknowledgment not found' };
    }

    const allowedFields = ['assignee', 'deadline', 'acknowledgment_note', 'status'];
    const updateFields = [];
    const updateValues = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }
    
    if (updateFields.length === 0) {
      return { success: false, error: 'No valid fields to update' };
    }

    updateValues.push(now(), id);
    
    try {
      await run(`
        UPDATE acknowledgments
        SET ${updateFields.join(', ')}, updated_at = ?
        WHERE id = ?
      `, updateValues);
      
      await OperationLogService.log(
        'manual_correct', 'acknowledgment', id, operator,
        data, { rule: 'manual_correction', correction_reason },
        { updates }, 'success'
      );
      
      return { success: true };
    } catch (error) {
      await OperationLogService.log(
        'manual_correct', 'acknowledgment', id, operator,
        data, { rule: 'manual_correction' },
        null, 'failed', error.message
      );
      return { success: false, error: error.message };
    }
  }
}

class RollbackRequestService {
  static async create(data, operator) {
    const id = generateId();
    const { dataset_version_id, project_id, requester, reason } = data;
    
    const datasetVersion = await DatasetVersionService.getById(dataset_version_id);
    if (!datasetVersion) {
      return { success: false, error: 'Dataset version not found' };
    }

    const project = await DownstreamProjectService.getById(project_id);
    if (!project) {
      return { success: false, error: 'Downstream project not found' };
    }

    try {
      await run(`
        INSERT INTO rollback_requests (
          id, dataset_version_id, project_id, requester, reason, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      `, [id, dataset_version_id, project_id, requester, reason, now(), now()]);
      
      await OperationLogService.log(
        'create', 'rollback_request', id, operator,
        data, { rule: 'create_rollback_request' },
        { id, status: 'pending' }, 'success'
      );
      
      return { success: true, id };
    } catch (error) {
      await OperationLogService.log(
        'create', 'rollback_request', id, operator,
        data, { rule: 'create_rollback_request' },
        null, 'failed', error.message
      );
      return { success: false, error: error.message };
    }
  }

  static async approve(id, data, operator) {
    const { approver, approval_note, approved } = data;
    const request = await this.getById(id);
    
    if (!request) {
      await OperationLogService.log(
        'approve', 'rollback_request', id, operator,
        data, { rule: 'approve_rollback' },
        null, 'failed', 'Rollback request not found'
      );
      return { success: false, error: 'Rollback request not found' };
    }

    if (request.status !== 'pending') {
      await OperationLogService.log(
        'approve', 'rollback_request', id, operator,
        data, { rule: 'approve_rollback', currentStatus: request.status },
        null, 'failed', 'Only pending requests can be approved'
      );
      return { success: false, error: 'Only pending requests can be approved' };
    }

    const newStatus = approved ? 'approved' : 'rejected';
    
    try {
      await run(`
        UPDATE rollback_requests
        SET status = ?, approver = ?, approval_note = ?, approved_at = ?, updated_at = ?
        WHERE id = ?
      `, [newStatus, approver, approval_note || null, now(), now(), id]);
      
      await OperationLogService.log(
        'approve', 'rollback_request', id, operator,
        data, { rule: 'approve_rollback', previousStatus: request.status },
        { status: newStatus }, 'success'
      );
      
      return { success: true };
    } catch (error) {
      await OperationLogService.log(
        'approve', 'rollback_request', id, operator,
        data, { rule: 'approve_rollback' },
        null, 'failed', error.message
      );
      return { success: false, error: error.message };
    }
  }

  static async getById(id) {
    return await get('SELECT * FROM rollback_requests WHERE id = ?', [id]);
  }

  static async getAll(filters = {}) {
    let query = 'SELECT * FROM rollback_requests WHERE 1=1';
    const params = [];
    
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.dataset_version_id) {
      query += ' AND dataset_version_id = ?';
      params.push(filters.dataset_version_id);
    }
    if (filters.project_id) {
      query += ' AND project_id = ?';
      params.push(filters.project_id);
    }
    
    query += ' ORDER BY created_at DESC';
    return await all(query, params);
  }

  static async getDetails(id) {
    return await get(`
      SELECT 
        rr.*,
        dv.dataset_name,
        dv.version as dataset_version,
        p.project_name
      FROM rollback_requests rr
      JOIN dataset_versions dv ON rr.dataset_version_id = dv.id
      JOIN downstream_projects p ON rr.project_id = p.id
      WHERE rr.id = ?
    `, [id]);
  }
}

class ReportService {
  static async generateAcknowledgmentReport(datasetVersionId, generatedBy) {
    const datasetVersion = await DatasetVersionService.getById(datasetVersionId);
    if (!datasetVersion) {
      return { success: false, error: 'Dataset version not found' };
    }

    const acknowledgments = await all(`
      SELECT 
        a.*,
        p.project_name,
        p.owner as project_owner
      FROM acknowledgments a
      JOIN downstream_projects p ON a.project_id = p.id
      WHERE a.dataset_version_id = ?
    `, [datasetVersionId]);

    const stats = {
      total: acknowledgments.length,
      acknowledged: acknowledgments.filter(a => a.status === 'acknowledged').length,
      pending: acknowledgments.filter(a => a.status === 'pending').length,
      timeout: acknowledgments.filter(a => a.status === 'timeout').length
    };

    const reportData = {
      dataset_version: datasetVersion,
      stats,
      acknowledgments
    };

    const reportId = generateId();
    await run(`
      INSERT INTO acknowledgment_reports (id, dataset_version_id, report_type, generated_at, generated_by, report_data)
      VALUES (?, ?, 'acknowledgment', ?, ?, ?)
    `, [reportId, datasetVersionId, now(), generatedBy, JSON.stringify(reportData)]);

    await OperationLogService.log(
      'generate_report', 'acknowledgment_report', reportId, generatedBy,
      { datasetVersionId }, { rule: 'generate_acknowledgment_report' },
      { reportId, stats }, 'success'
    );

    return { success: true, reportId, reportData };
  }

  static async getReport(reportId) {
    const report = await get('SELECT * FROM acknowledgment_reports WHERE id = ?', [reportId]);
    if (report) {
      report.report_data = JSON.parse(report.report_data);
    }
    return report;
  }

  static async exportToCSV(datasetVersionId) {
    const result = await this.generateAcknowledgmentReport(datasetVersionId, 'export_job');
    if (!result.success) {
      return result;
    }
    
    return { success: true, data: result.reportData };
  }
}

module.exports = {
  OperationLogService,
  DatasetVersionService,
  DownstreamProjectService,
  AcknowledgmentService,
  RollbackRequestService,
  ReportService
};
