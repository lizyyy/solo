const { query } = require('../config/database');
const { TASK_STATUS, CANDIDATE_STATUS, BACKGROUND_CHECK_TIMEOUT_HOURS, MAX_RETRY_TIMES, RISK_LEVEL } = require('../config/constants');
const StateMachine = require('./state-machine');
const AuditLogger = require('../utils/audit-logger');

class BackgroundCheckService {
  static async createTask(candidateData, taskData, actor = null) {
    const client = await query('BEGIN');

    try {
      const candidateResult = await query(
        `INSERT INTO candidates (name, email, phone, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [candidateData.name, candidateData.email, candidateData.phone, CANDIDATE_STATUS.PENDING]
      );
      const candidate = candidateResult.rows[0];

      const taskResult = await query(
        `INSERT INTO background_check_tasks (candidate_id, status, description)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [candidate.id, TASK_STATUS.DRAFT, taskData.description]
      );
      const task = taskResult.rows[0];

      await AuditLogger.log({
        taskId: task.id,
        candidateId: candidate.id,
        action: 'TASK_CREATED',
        actor,
        actorType: actor ? 'user' : 'system',
        oldStatus: null,
        newStatus: TASK_STATUS.DRAFT,
        details: { candidate: candidateData, task: taskData },
      });

      await query('COMMIT');
      return { candidate, task };
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  static async submitMaterialRequirement(taskId, materials, actor = null) {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    if (!StateMachine.canTransition(task.status, TASK_STATUS.PENDING_MATERIALS)) {
      throw new Error(`Cannot submit material requirement from status: ${task.status}`);
    }

    await this.updateTaskStatus(taskId, TASK_STATUS.PENDING_MATERIALS, actor, {
      required_materials: materials,
    });

    return this.getTaskWithDetails(taskId);
  }

  static async submitMaterials(taskId, materials, actor = null) {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    const allowedStatuses = [TASK_STATUS.PENDING_MATERIALS, TASK_STATUS.CONFLICT];
    if (!allowedStatuses.includes(task.status)) {
      throw new Error(`Cannot submit materials from status: ${task.status}`);
    }

    const client = await query('BEGIN');
    try {
      for (const material of materials) {
        await query(
          `UPDATE material_versions 
           SET is_latest = FALSE 
           WHERE task_id = $1 AND material_type = $2 AND is_latest = TRUE`,
          [taskId, material.material_type]
        );

        const existingMaterials = await query(
          `SELECT COALESCE(MAX(version), 0) as max_version 
           FROM material_versions 
           WHERE task_id = $1 AND material_type = $2`,
          [taskId, material.material_type]
        );
        const newVersion = (existingMaterials.rows[0].max_version || 0) + 1;

        await query(
          `INSERT INTO material_versions 
           (task_id, version, material_type, file_name, file_url, uploaded_by, notes, is_latest)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
          [taskId, newVersion, material.material_type, material.file_name, 
           material.file_url, actor, material.notes]
        );
      }

      await this.updateTaskStatus(taskId, TASK_STATUS.MATERIALS_SUBMITTED, actor, {
        materials_submitted: materials.map(m => m.material_type),
      });

      await query('COMMIT');
      return this.getTaskWithDetails(taskId);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  static async sendToThirdParty(taskId, providerName, actor = null) {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    const allowedStatuses = [TASK_STATUS.MATERIALS_SUBMITTED, TASK_STATUS.CONFLICT, TASK_STATUS.TIMEOUT];
    if (!allowedStatuses.includes(task.status)) {
      throw new Error(`Cannot send to third party from status: ${task.status}`);
    }

    if (task.status === TASK_STATUS.TIMEOUT && task.retry_count >= MAX_RETRY_TIMES) {
      throw new Error(`Max retry count (${MAX_RETRY_TIMES}) exceeded`);
    }

    const timeoutAt = new Date(Date.now() + BACKGROUND_CHECK_TIMEOUT_HOURS * 60 * 60 * 1000);
    const retryCount = task.status === TASK_STATUS.TIMEOUT ? task.retry_count + 1 : task.retry_count;

    await query(
      `UPDATE background_check_tasks 
       SET status = $1, 
           third_party_provider = $2, 
           timeout_at = $3,
           retry_count = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [TASK_STATUS.SENT_TO_THIRD_PARTY, providerName, timeoutAt, retryCount, taskId]
    );

    await AuditLogger.log({
      taskId,
      candidateId: task.candidate_id,
      action: 'SENT_TO_THIRD_PARTY',
      actor,
      actorType: actor ? 'user' : 'system',
      oldStatus: task.status,
      newStatus: TASK_STATUS.SENT_TO_THIRD_PARTY,
      details: { provider: providerName, timeout_at: timeoutAt, retry_count: retryCount },
    });

    return this.getTaskWithDetails(taskId);
  }

  static async handleThirdPartyCallback(taskId, callbackData, actor = null) {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    if (task.status !== TASK_STATUS.SENT_TO_THIRD_PARTY) {
      throw new Error(`Cannot process callback from status: ${task.status}`);
    }

    const client = await query('BEGIN');
    try {
      await query(
        `INSERT INTO third_party_receipts 
         (task_id, provider_name, reference_id, receipt_type, status, raw_data, summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [taskId, task.third_party_provider, callbackData.reference_id, 
         callbackData.receipt_type, callbackData.status, 
         callbackData.raw_data || {}, callbackData.summary]
      );

      const hasConflict = callbackData.conflicts && callbackData.conflicts.length > 0;
      const newStatus = hasConflict ? TASK_STATUS.CONFLICT : TASK_STATUS.THIRD_PARTY_RECEIVED;

      await this.updateTaskStatus(taskId, newStatus, actor, {
        callback: callbackData,
        has_conflict: hasConflict,
      });

      if (hasConflict) {
        for (const conflict of callbackData.conflicts) {
          await this.addRiskTag(taskId, {
            tag_name: conflict.type,
            risk_level: conflict.severity || RISK_LEVEL.MEDIUM,
            description: conflict.description,
            source: 'third_party',
          }, actor);
        }
      }

      if (!hasConflict) {
        await this.updateTaskStatus(taskId, TASK_STATUS.PENDING_REVIEW, actor, {
          note: 'Auto-transitioned to pending review',
        });
      }

      await query('COMMIT');
      return this.getTaskWithDetails(taskId);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  static async makeDecision(taskId, decision, reason, actor = null) {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    if (task.status !== TASK_STATUS.PENDING_REVIEW) {
      throw new Error(`Cannot make decision from status: ${task.status}`);
    }

    if (!['approved', 'rejected'].includes(decision)) {
      throw new Error('Decision must be either "approved" or "rejected"');
    }

    const client = await query('BEGIN');
    try {
      await query(
        `UPDATE background_check_tasks 
         SET status = $1, decision = $2, decision_reason = $3, 
             decided_by = $4, decided_at = NOW(), updated_at = NOW()
         WHERE id = $5`,
        [TASK_STATUS.COMPLETED, decision, reason, actor, taskId]
      );

      const candidateStatus = decision === 'approved' 
        ? CANDIDATE_STATUS.APPROVED 
        : CANDIDATE_STATUS.REJECTED;
      
      await query(
        `UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2`,
        [candidateStatus, task.candidate_id]
      );

      await AuditLogger.log({
        taskId,
        candidateId: task.candidate_id,
        action: 'DECISION_MADE',
        actor,
        actorType: 'user',
        oldStatus: task.status,
        newStatus: TASK_STATUS.COMPLETED,
        details: { decision, reason, candidate_status: candidateStatus },
      });

      await query('COMMIT');
      return this.getTaskWithDetails(taskId);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  static async cancelTask(taskId, reason, actor = null) {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    const terminalStatuses = [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED];
    if (terminalStatuses.includes(task.status)) {
      throw new Error(`Cannot cancel task in status: ${task.status}`);
    }

    const client = await query('BEGIN');
    try {
      await query(
        `UPDATE background_check_tasks 
         SET status = $1, cancelled_by = $2, cancelled_at = NOW(), 
             cancelled_reason = $3, updated_at = NOW()
         WHERE id = $4`,
        [TASK_STATUS.CANCELLED, actor, reason, taskId]
      );

      await query(
        `UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2`,
        [CANDIDATE_STATUS.CANCELLED, task.candidate_id]
      );

      await AuditLogger.log({
        taskId,
        candidateId: task.candidate_id,
        action: 'TASK_CANCELLED',
        actor,
        actorType: actor ? 'user' : 'system',
        oldStatus: task.status,
        newStatus: TASK_STATUS.CANCELLED,
        details: { reason },
      });

      await query('COMMIT');
      return this.getTaskWithDetails(taskId);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  static async handleTimeout(taskId) {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    if (task.status !== TASK_STATUS.SENT_TO_THIRD_PARTY) {
      throw new Error(`Cannot timeout task in status: ${task.status}`);
    }

    await this.updateTaskStatus(taskId, TASK_STATUS.TIMEOUT, null, {
      note: 'Third party response timeout',
      timeout_at: task.timeout_at,
    });

    return this.getTaskWithDetails(taskId);
  }

  static async addRiskTag(taskId, tagData, actor = null) {
    const result = await query(
      `INSERT INTO risk_tags 
       (task_id, tag_name, risk_level, description, source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [taskId, tagData.tag_name, tagData.risk_level, tagData.description, 
       tagData.source || 'manual', actor]
    );

    await AuditLogger.log({
      taskId,
      action: 'RISK_TAG_ADDED',
      actor,
      actorType: actor ? 'user' : 'system',
      details: { risk_tag: result.rows[0] },
    });

    return result.rows[0];
  }

  static async resolveRiskTag(tagId, resolutionNotes, actor) {
    const result = await query(
      `UPDATE risk_tags 
       SET resolved = TRUE, resolved_at = NOW(), resolved_by = $1, resolution_notes = $2
       WHERE id = $3
       RETURNING *`,
      [actor, resolutionNotes, tagId]
    );

    if (result.rows.length === 0) {
      throw new Error('Risk tag not found');
    }

    await AuditLogger.log({
      taskId: result.rows[0].task_id,
      action: 'RISK_TAG_RESOLVED',
      actor,
      actorType: 'user',
      details: { tag_id: tagId, resolution_notes: resolutionNotes },
    });

    return result.rows[0];
  }

  static async getTaskById(taskId) {
    const result = await query(
      `SELECT * FROM background_check_tasks WHERE id = $1`,
      [taskId]
    );
    return result.rows[0];
  }

  static async getTaskWithDetails(taskId) {
    const taskResult = await query(
      `SELECT t.*, c.name as candidate_name, c.email as candidate_email, 
              c.status as candidate_status, c.phone as candidate_phone
       FROM background_check_tasks t
       JOIN candidates c ON t.candidate_id = c.id
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return null;
    }

    const task = taskResult.rows[0];

    const [materials, receipts, risks, auditLog] = await Promise.all([
      query(
        `SELECT * FROM material_versions WHERE task_id = $1 ORDER BY material_type, version DESC`,
        [taskId]
      ),
      query(
        `SELECT * FROM third_party_receipts WHERE task_id = $1 ORDER BY created_at DESC`,
        [taskId]
      ),
      query(
        `SELECT * FROM risk_tags WHERE task_id = $1 ORDER BY created_at DESC`,
        [taskId]
      ),
      AuditLogger.getTaskAuditLog(taskId),
    ]);

    return {
      ...task,
      materials: materials.rows,
      third_party_receipts: receipts.rows,
      risk_tags: risks.rows,
      audit_log: auditLog,
    };
  }

  static async getTasksByStatus(status) {
    const result = await query(
      `SELECT t.*, c.name as candidate_name, c.email as candidate_email
       FROM background_check_tasks t
       JOIN candidates c ON t.candidate_id = c.id
       WHERE t.status = $1
       ORDER BY t.created_at DESC`,
      [status]
    );
    return result.rows;
  }

  static async getTimeoutTasks() {
    const result = await query(
      `SELECT * FROM background_check_tasks 
       WHERE status = $1 AND timeout_at < NOW()`,
      [TASK_STATUS.SENT_TO_THIRD_PARTY]
    );
    return result.rows;
  }

  static async updateTaskStatus(taskId, newStatus, actor, details = {}) {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    if (!StateMachine.canTransition(task.status, newStatus)) {
      throw new Error(`Invalid state transition: ${task.status} -> ${newStatus}`);
    }

    await query(
      `UPDATE background_check_tasks SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, taskId]
    );

    const candidateStatus = StateMachine.mapTaskStatusToCandidateStatus(newStatus);
    if (candidateStatus) {
      await query(
        `UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2`,
        [candidateStatus, task.candidate_id]
      );
    }

    await AuditLogger.log({
      taskId,
      candidateId: task.candidate_id,
      action: 'STATUS_CHANGED',
      actor,
      actorType: actor ? 'user' : 'system',
      oldStatus: task.status,
      newStatus,
      details,
    });
  }
}

module.exports = BackgroundCheckService;
