const ExtensionDAO = require('../dao/extension.dao');
const TenantDAO = require('../dao/tenant.dao');

const STATUS_MAP = {
  TRIAL_ACTIVE: 'trial_active',
  EXTENSION_PENDING: 'extension_pending',
  EXTENSION_APPROVED: 'extension_approved',
  CONVERTED: 'converted'
};

const STATUS_LABELS = {
  'trial_active': '试用中',
  'extension_pending': '延期申请',
  'extension_approved': '已延期',
  'converted': '已转正'
};

class ExtensionService {
  static async createExtension(data) {
    const tenant = await TenantDAO.findById(data.tenant_id);
    if (!tenant) {
      throw new Error('租户不存在，请先创建租户信息');
    }

    const pendingExtensions = await ExtensionDAO.findPendingByTenantId(data.tenant_id);
    if (pendingExtensions.length > 0) {
      const existing = pendingExtensions[0];
      const error = new Error('该租户已有待审批的延期申请');
      error.code = 'DUPLICATE_PENDING_REQUEST';
      error.nextSteps = {
        requiredMaterials: [
          '1. 与现有申请人 ' + existing.salesperson_name + ' 沟通确认申请内容',
          '2. 如需修改，请由原申请人撤销当前申请后重新提交',
          '3. 如需多人协作，请补充销售协作说明并附内部审批邮件截图',
          '4. 紧急情况请联系销售总监进行特殊审批'
        ],
        contactInfo: {
          existingApplicant: existing.salesperson_name,
          applicantId: existing.salesperson_id,
          existingExtensionNo: existing.extension_no
        }
      };
      throw error;
    }

    const result = await ExtensionDAO.create(data);

    await ExtensionDAO.addHistory(
      result.id,
      'CREATE',
      null,
      data.status || 'extension_pending',
      data.salesperson_id,
      data.salesperson_name,
      '创建延期申请'
    );

    return result;
  }

  static async approveExtension(id, approverId, approverName, comment) {
    const extension = await ExtensionDAO.findById(id);
    if (!extension) {
      throw new Error('延期申请不存在');
    }

    if (extension.status !== 'extension_pending') {
      throw new Error('只有待审批状态的申请可以审批');
    }

    await ExtensionDAO.updateStatus(id, 'extension_approved', approverId, approverName, comment);

    await ExtensionDAO.addHistory(
      id,
      'APPROVE',
      'extension_pending',
      'extension_approved',
      approverId,
      approverName,
      comment || '审批通过'
    );

    return { success: true };
  }

  static async rejectExtension(id, approverId, approverName, comment) {
    const extension = await ExtensionDAO.findById(id);
    if (!extension) {
      throw new Error('延期申请不存在');
    }

    if (extension.status !== 'extension_pending') {
      throw new Error('只有待审批状态的申请可以审批');
    }

    await ExtensionDAO.updateStatus(id, 'trial_active', approverId, approverName, comment);

    await ExtensionDAO.addHistory(
      id,
      'REJECT',
      'extension_pending',
      'trial_active',
      approverId,
      approverName,
      comment || '审批驳回'
    );

    return { success: true };
  }

  static async convertToPaid(id, operatorId, operatorName, comment) {
    const extension = await ExtensionDAO.findById(id);
    if (!extension) {
      throw new Error('记录不存在');
    }

    if (extension.status !== 'extension_approved' && extension.status !== 'trial_active') {
      throw new Error('只有试用中或已延期状态可以转正');
    }

    await ExtensionDAO.updateStatus(id, 'converted', operatorId, operatorName, comment);

    await ExtensionDAO.addHistory(
      id,
      'CONVERT',
      extension.status,
      'converted',
      operatorId,
      operatorName,
      comment || '转为付费客户'
    );

    return { success: true };
  }

  static async getExtensionDetail(id) {
    const extension = await ExtensionDAO.findById(id);
    if (!extension) {
      throw new Error('记录不存在');
    }

    const history = await ExtensionDAO.getHistory(id);

    return {
      ...extension,
      status_label: STATUS_LABELS[extension.status],
      history: history.map(h => ({
        ...h,
        old_status_label: h.old_status ? STATUS_LABELS[h.old_status] : null,
        new_status_label: STATUS_LABELS[h.new_status]
      }))
    };
  }

  static async getExtensionList(filters = {}) {
    const list = await ExtensionDAO.findAll(filters);
    return list.map(item => ({
      ...item,
      status_label: STATUS_LABELS[item.status]
    }));
  }

  static async exportToCSV(filters = {}) {
    const list = await this.getExtensionList(filters);
    return list.map(item => ({
      申请编号: item.extension_no,
      租户ID: item.tenant_id,
      租户名称: item.tenant_name,
      原试用截止: item.original_trial_end_date,
      申请延期天数: item.requested_extension_days,
      新试用截止: item.new_trial_end_date,
      延期理由: item.extension_reason,
      销售备注: item.sales_notes || '',
      申请人: item.salesperson_name,
      状态: STATUS_LABELS[item.status],
      审批人: item.approver_name || '',
      审批意见: item.approval_comment || '',
      创建时间: item.created_at
    }));
  }

  static async importBatch(batchNo, rows) {
    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawData = JSON.stringify(row);

      try {
        if (!row.tenant_id || !row.extension_reason || !row.salesperson_id) {
          throw new Error('缺少必填字段: tenant_id, extension_reason, salesperson_id');
        }

        const result = await this.createExtension(row);
        await ExtensionDAO.createImportRecord(batchNo, i + 1, rawData, null, 'success');
        results.push({ row: i + 1, success: true, ...result });
      } catch (error) {
        await ExtensionDAO.createImportRecord(batchNo, i + 1, rawData, error.message, 'failed');
        results.push({ row: i + 1, success: false, error: error.message });
      }
    }

    return results;
  }
}

module.exports = ExtensionService;
