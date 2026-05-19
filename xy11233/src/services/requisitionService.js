const { Op } = require('sequelize');
const {
  Requisition,
  RequisitionItem,
  Reagent,
  Inventory,
  ApprovalRecord,
  User
} = require('../models');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../config/logger');

function generateOrderNo(prefix) {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${timestamp}${random}`;
}

class RequisitionService {
  async createRequisition(data, operator) {
    const { applicant_id, applicant_name, department, purpose, experiment_name, items, urgent = false } = data;

    if (!items || items.length === 0) {
      throw new Error('申领单至少需要包含一项试剂');
    }

    const requisition_no = generateOrderNo('RQ');

    const requisition = await Requisition.create({
      requisition_no,
      applicant_id,
      applicant_name,
      department,
      purpose,
      experiment_name,
      urgent,
      total_items: items.length,
      status: Requisition.REQUISITION_STATUSES.DRAFT
    });

    const requisitionItems = [];
    for (const item of items) {
      const reagent = await Reagent.findByPk(item.reagent_id);
      if (!reagent) {
        throw new Error(`试剂ID ${item.reagent_id} 不存在`);
      }

      if (item.quantity <= 0) {
        throw new Error(`试剂 ${reagent.name} 申领数量必须大于0`);
      }

      if (reagent.max_quantity_per_apply && item.quantity > reagent.max_quantity_per_apply) {
        throw new Error(`试剂 ${reagent.name} 单次最大申领量为 ${reagent.max_quantity_per_apply}`);
      }

      requisitionItems.push({
        requisition_id: requisition.id,
        reagent_id: item.reagent_id,
        reagent_code: reagent.reagent_code,
        reagent_name: reagent.name,
        hazard_level: reagent.hazard_level,
        unit: reagent.unit,
        requested_quantity: item.quantity,
        status: RequisitionItem.ITEM_STATUSES.PENDING
      });
    }

    await RequisitionItem.bulkCreate(requisitionItems);

    await createAuditLog({
      action: 'create',
      module: 'requisition',
      recordId: requisition.id,
      recordNo: requisition_no,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      afterData: requisition.toJSON(),
      description: `创建申领单 ${requisition_no}`
    });

    return requisition;
  }

  async submitRequisition(id, operator) {
    const requisition = await Requisition.findByPk(id, {
      include: [{ model: RequisitionItem, as: 'items' }]
    });

    if (!requisition) {
      throw new Error('申领单不存在');
    }

    if (requisition.status !== Requisition.REQUISITION_STATUSES.DRAFT) {
      throw new Error('只有草稿状态的申领单可以提交');
    }

    const hasHazardous = requisition.items.some(item => 
      item.hazard_level !== Reagent.HAZARD_LEVELS.LEVEL_4
    );

    let approver = null;
    if (hasHazardous || requisition.urgent) {
      approver = await User.findOne({
        where: { role: { [Op.in]: [User.ROLES.ADMIN, User.ROLES.LAB_MANAGER] } }
      });
    } else {
      approver = await User.findOne({
        where: { role: User.ROLES.TEACHER }
      });
    }

    await requisition.update({
      status: Requisition.REQUISITION_STATUSES.PENDING,
      current_approver_id: approver?.id,
      current_approver_name: approver?.name,
      submitted_at: new Date()
    });

    await createAuditLog({
      action: 'submit',
      module: 'requisition',
      recordId: requisition.id,
      recordNo: requisition.requisition_no,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      beforeData: requisition.toJSON(),
      afterData: requisition.toJSON(),
      description: `提交申领单 ${requisition.requisition_no}`
    });

    return requisition;
  }

  async approveRequisition(id, data, operator) {
    const { approved_quantity, reason, next_approver_id, item_id } = data;

    const requisition = await Requisition.findByPk(id);
    if (!requisition) {
      throw new Error('申领单不存在');
    }

    if (requisition.status !== Requisition.REQUISITION_STATUSES.PENDING) {
      throw new Error('只有待审批状态的申领单可以审批');
    }

    const isFinal = !next_approver_id;
    const nextApprover = next_approver_id ? await User.findByPk(next_approver_id) : null;

    await ApprovalRecord.create({
      requisition_id: id,
      requisition_item_id: item_id,
      approver_id: operator.id,
      approver_name: operator.name,
      approver_role: operator.role,
      action: ApprovalRecord.APPROVAL_ACTIONS.APPROVE,
      approved_quantity,
      reason,
      next_approver_id,
      next_approver_name: nextApprover?.name,
      is_final: isFinal
    });

    if (item_id) {
      const item = await RequisitionItem.findByPk(item_id);
      await item.update({
        approved_quantity: approved_quantity || item.requested_quantity,
        status: RequisitionItem.ITEM_STATUSES.APPROVED
      });
    } else {
      const items = await RequisitionItem.findAll({ where: { requisition_id: id } });
      for (const item of items) {
        await item.update({
          approved_quantity: approved_quantity || item.requested_quantity,
          status: RequisitionItem.ITEM_STATUSES.APPROVED
        });
      }
    }

    if (isFinal) {
      await requisition.update({
        status: Requisition.REQUISITION_STATUSES.APPROVED,
        approved_at: new Date()
      });
    } else if (nextApprover) {
      await requisition.update({
        current_approver_id: nextApprover.id,
        current_approver_name: nextApprover.name
      });
    }

    await createAuditLog({
      action: 'approve',
      module: 'requisition',
      recordId: requisition.id,
      recordNo: requisition.requisition_no,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      description: `审批申领单 ${requisition.requisition_no}`
    });

    return requisition;
  }

  async rejectRequisition(id, data, operator) {
    const { reason, item_id } = data;

    const requisition = await Requisition.findByPk(id);
    if (!requisition) {
      throw new Error('申领单不存在');
    }

    await ApprovalRecord.create({
      requisition_id: id,
      requisition_item_id: item_id,
      approver_id: operator.id,
      approver_name: operator.name,
      approver_role: operator.role,
      action: ApprovalRecord.APPROVAL_ACTIONS.REJECT,
      reason,
      is_final: true
    });

    if (item_id) {
      const item = await RequisitionItem.findByPk(item_id);
      await item.update({ status: RequisitionItem.ITEM_STATUSES.REJECTED });
    } else {
      await RequisitionItem.update(
        { status: RequisitionItem.ITEM_STATUSES.REJECTED },
        { where: { requisition_id: id } }
      );
      await requisition.update({
        status: Requisition.REQUISITION_STATUSES.REJECTED,
        rejected_at: new Date()
      });
    }

    await createAuditLog({
      action: 'reject',
      module: 'requisition',
      recordId: requisition.id,
      recordNo: requisition.requisition_no,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      description: `驳回申领单 ${requisition.requisition_no}`
    });

    return requisition;
  }

  async getRequisitionDetail(id) {
    return await Requisition.findByPk(id, {
      include: [
        { model: RequisitionItem, as: 'items' },
        { model: ApprovalRecord, as: 'approvals' }
      ]
    });
  }

  async listRequisitions(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.applicant_id) where.applicant_id = filters.applicant_id;
    if (filters.current_approver_id) where.current_approver_id = filters.current_approver_id;

    return await Requisition.findAll({
      where,
      include: [{ model: RequisitionItem, as: 'items' }],
      order: [['created_at', 'DESC']]
    });
  }
}

module.exports = new RequisitionService();
