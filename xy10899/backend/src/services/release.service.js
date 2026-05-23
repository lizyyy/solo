const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

const DEFAULT_CHECK_ITEMS = [
  { category: '文档', name: '技术方案评审', description: '技术方案已完成评审并归档' },
  { category: '文档', name: '用户手册更新', description: '用户操作手册已更新至最新版本' },
  { category: '迁移', name: '数据库迁移脚本', description: '数据库迁移脚本已编写并测试' },
  { category: '迁移', name: '回滚脚本验证', description: '数据库回滚脚本已验证可行' },
  { category: '告警', name: '监控大盘配置', description: '相关业务监控大盘已配置完成' },
  { category: '告警', name: '告警规则设置', description: '告警规则和通知渠道已设置' },
  { category: '预案', name: '回滚预案', description: '回滚预案已制定并全员周知' },
  { category: '预案', name: '灰度发布方案', description: '灰度发布方案已确认' }
];

class ReleaseService {
  async createRelease(data) {
    const { version, title, description, createdBy, scheduledAt } = data;
    const releaseId = uuidv4();

    await db.run(
      `INSERT INTO releases (id, version, title, description, created_by, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [releaseId, version, title, description, createdBy, scheduledAt]
    );

    const checkItems = [];
    for (const item of DEFAULT_CHECK_ITEMS) {
      const checkItemId = uuidv4();
      await db.run(
        `INSERT INTO check_items (id, release_id, category, name, description)
         VALUES (?, ?, ?, ?, ?)`,
        [checkItemId, releaseId, item.category, item.name, item.description]
      );
      checkItems.push({ id: checkItemId, ...item });
    }

    await this.logOperation(releaseId, null, 'create', createdBy, '创建发布版本');

    return { id: releaseId, version, title, checkItems };
  }

  async getReleases(filters = {}) {
    let query = 'SELECT * FROM releases WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';

    return await db.all(query, params);
  }

  async getReleaseDetail(id) {
    const release = await db.get('SELECT * FROM releases WHERE id = ?', [id]);
    if (!release) return null;

    const checkItems = await db.all(
      'SELECT * FROM check_items WHERE release_id = ? ORDER BY category, created_at',
      [id]
    );

    const blockReasons = await db.all(
      'SELECT * FROM block_reasons WHERE release_id = ? ORDER BY created_at DESC',
      [id]
    );

    const exemptions = await db.all(
      'SELECT * FROM exemptions WHERE release_id = ? ORDER BY created_at DESC',
      [id]
    );

    const logs = await db.all(
      'SELECT * FROM operation_logs WHERE release_id = ? ORDER BY created_at DESC LIMIT 50',
      [id]
    );

    return {
      ...release,
      checkItems,
      blockReasons,
      exemptions,
      operationLogs: logs
    };
  }

  async updateCheckItemStatus(releaseId, checkItemId, status, operator, result = '') {
    const checkItem = await db.get(
      'SELECT * FROM check_items WHERE id = ? AND release_id = ?',
      [checkItemId, releaseId]
    );
    if (!checkItem) throw new Error('检查项不存在');

    if (checkItem.status === status) {
      return { message: '状态未变化', skipped: true };
    }

    await db.run(
      `UPDATE check_items SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, result, checkItemId]
    );

    await this.logOperation(
      releaseId,
      checkItemId,
      'update_status',
      operator,
      `更新状态: ${checkItem.status} -> ${status}${result ? `，结果: ${result}` : ''}`
    );

    await this.recalculateReadinessScore(releaseId);

    return { success: true };
  }

  async updateCheckItemAssignee(releaseId, checkItemId, assignee, operator) {
    const checkItem = await db.get(
      'SELECT * FROM check_items WHERE id = ? AND release_id = ?',
      [checkItemId, releaseId]
    );
    if (!checkItem) throw new Error('检查项不存在');

    await db.run(
      `UPDATE check_items SET assignee = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [assignee, checkItemId]
    );

    await this.logOperation(
      releaseId,
      checkItemId,
      'update_assignee',
      operator,
      `设置责任人: ${checkItem.assignee || '未设置'} -> ${assignee || '未设置'}`
    );

    return { success: true };
  }

  async compensateCheckItem(releaseId, checkItemId, reason, operator) {
    const checkItem = await db.get(
      'SELECT * FROM check_items WHERE id = ? AND release_id = ?',
      [checkItemId, releaseId]
    );
    if (!checkItem) throw new Error('检查项不存在');

    const oldStatus = checkItem.status;
    await db.run(
      `UPDATE check_items SET status = 'passed', result = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [`手动补偿：${reason}`, checkItemId]
    );

    await this.logOperation(
      releaseId,
      checkItemId,
      'compensate',
      operator,
      `手动补偿，原因: ${reason}，原状态: ${oldStatus}`
    );

    await this.recalculateReadinessScore(releaseId);

    return { success: true };
  }

  async addBlockReason(releaseId, checkItemId, reason, reporter) {
    const blockId = uuidv4();
    await db.run(
      `INSERT INTO block_reasons (id, release_id, check_item_id, reason, reporter)
       VALUES (?, ?, ?, ?, ?)`,
      [blockId, releaseId, checkItemId, reason, reporter]
    );

    if (checkItemId) {
      await db.run(
        `UPDATE check_items SET status = 'blocked', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [checkItemId]
      );
    }

    await this.logOperation(releaseId, checkItemId, 'block', reporter, reason);

    return { id: blockId };
  }

  async resolveBlockReason(blockId, resolver) {
    const block = await db.get('SELECT * FROM block_reasons WHERE id = ?', [blockId]);
    if (!block) throw new Error('阻塞记录不存在');

    await db.run(
      `UPDATE block_reasons SET resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [resolver, blockId]
    );

    if (block.check_item_id) {
      const otherBlocks = await db.all(
        `SELECT COUNT(*) as count FROM block_reasons
         WHERE check_item_id = ? AND resolved = 0`,
        [block.check_item_id]
      );

      if (otherBlocks[0].count === 0) {
        await db.run(
          `UPDATE check_items SET status = 'pending', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [block.check_item_id]
        );
      }
    }

    await this.logOperation(block.release_id, block.check_item_id, 'resolve', resolver, '解除阻塞');

    return { success: true };
  }

  async applyExemption(releaseId, checkItemId, reason, applicant) {
    const exemptionId = uuidv4();
    await db.run(
      `INSERT INTO exemptions (id, release_id, check_item_id, reason, applicant)
       VALUES (?, ?, ?, ?, ?)`,
      [exemptionId, releaseId, checkItemId, reason, applicant]
    );

    await this.logOperation(releaseId, checkItemId, 'apply_exemption', applicant, reason);

    return { id: exemptionId };
  }

  async approveExemption(exemptionId, approver) {
    const exemption = await db.get('SELECT * FROM exemptions WHERE id = ?', [exemptionId]);
    if (!exemption) throw new Error('豁免申请不存在');

    await db.run(
      `UPDATE exemptions SET status = 'approved', approver = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [approver, exemptionId]
    );

    if (exemption.check_item_id) {
      await db.run(
        `UPDATE check_items SET status = 'exempted', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [exemption.check_item_id]
      );
    }

    await this.logOperation(exemption.release_id, exemption.check_item_id, 'approve_exemption', approver, '豁免审批通过');

    await this.recalculateReadinessScore(exemption.release_id);

    return { success: true };
  }

  async updateReleaseStatus(releaseId, status, operator) {
    const validStatuses = ['draft', 'in_progress', 'ready', 'published', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error('无效的状态值');
    }

    await db.run(
      `UPDATE releases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, releaseId]
    );

    await this.logOperation(releaseId, null, 'status_change', operator, `状态变更为: ${status}`);

    return { success: true };
  }

  async recalculateReadinessScore(releaseId) {
    const checkItems = await db.all(
      'SELECT status FROM check_items WHERE release_id = ?',
      [releaseId]
    );

    if (checkItems.length === 0) return 0;

    const passed = checkItems.filter(item => 
      item.status === 'passed' || item.status === 'exempted'
    ).length;

    const score = Math.round((passed / checkItems.length) * 100);

    await db.run(
      'UPDATE releases SET readiness_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [score, releaseId]
    );

    return score;
  }

  async logOperation(releaseId, checkItemId, action, operator, details) {
    const logId = uuidv4();
    await db.run(
      `INSERT INTO operation_logs (id, release_id, check_item_id, action, operator, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, releaseId, checkItemId, action, operator, details]
    );
  }

  async exportReleaseData(releaseId) {
    const release = await this.getReleaseDetail(releaseId);
    if (!release) throw new Error('发布版本不存在');

    return release;
  }
}

module.exports = new ReleaseService();
