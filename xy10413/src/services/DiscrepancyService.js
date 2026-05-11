const { DiscrepancyHandling, InspectionResult, ArrivalNote, ArrivalNoteItem, PurchaseOrderItem, PurchaseOrder } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');

class DiscrepancyService {
  static async createHandling(inspectionResultId, handlingType, quantity, notes, requiresApproval = true) {
    const inspectionResult = await InspectionResult.findByPk(inspectionResultId);
    if (!inspectionResult) {
      throw new Error('验收结果不存在');
    }

    if (inspectionResult.discrepancyType === 'none' && handlingType !== 'normal') {
      throw new Error('无差异只能选择正常处理');
    }

    const existing = await DiscrepancyHandling.findOne({
      where: { inspectionResultId }
    });
    if (existing) {
      throw new Error('该验收结果已存在差异处理');
    }

    const handling = await DiscrepancyHandling.create({
      inspectionResultId,
      handlingType,
      quantity,
      approvalStatus: requiresApproval ? 'pending' : 'approved',
      notes
    });

    return handling;
  }

  static async approve(handlingId, approverId, approverName, approved, notes) {
    const handling = await DiscrepancyHandling.findByPk(handlingId);
    if (!handling) {
      throw new Error('差异处理不存在');
    }

    if (handling.approvalStatus !== 'pending') {
      throw new Error('该差异处理已审批');
    }

    await DiscrepancyHandling.update({
      approvalStatus: approved ? 'approved' : 'rejected',
      approverId,
      approverName,
      approvalTime: moment().toDate(),
      notes: notes || handling.notes
    }, { where: { id: handlingId } });

    return await DiscrepancyHandling.findByPk(handlingId);
  }

  static async canStockIn(inspectionResultId) {
    const handling = await DiscrepancyHandling.findOne({
      where: { inspectionResultId }
    });

    if (!handling) {
      return {
        canStockIn: false,
        reason: '未创建差异处理记录'
      };
    }

    if (handling.approvalStatus !== 'approved') {
      return {
        canStockIn: false,
        reason: '差异处理未通过审批'
      };
    }

    if (handling.handlingType === 'reject') {
      return {
        canStockIn: false,
        reason: '该差异已被拒收，不允许入库'
      };
    }

    return {
      canStockIn: true,
      quantity: handling.quantity
    };
  }

  static async listPending() {
    return await DiscrepancyHandling.findAll({
      where: { approvalStatus: 'pending' },
      include: [
        { 
          model: InspectionResult,
          include: [
            { 
              model: ArrivalNoteItem,
              include: [
                { model: ArrivalNote, include: [PurchaseOrder] }
              ]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  static async getSupplierStatistics(supplierId = null) {
    const where = {};
    if (supplierId) {
      where['$InspectionResult.ArrivalNoteItem.ArrivalNote.supplierId$'] = supplierId;
    }

    const handlings = await DiscrepancyHandling.findAll({
      where,
      include: [
        {
          model: InspectionResult,
          include: [
            {
              model: ArrivalNoteItem,
              include: [
                {
                  model: ArrivalNote,
                  include: [
                    PurchaseOrder,
                    { model: PurchaseOrder, attributes: ['supplierId'] }
                  ]
                },
                {
                  model: PurchaseOrderItem
                }
              ]
            }
          ]
        }
      ]
    });

    const stats = {};

    for (const handling of handlings) {
      const inspection = handling.InspectionResult;
      const arrivalNote = inspection?.ArrivalNoteItem?.ArrivalNote;
      const poItem = inspection?.ArrivalNoteItem?.PurchaseOrderItem;
      
      if (!arrivalNote || !poItem) continue;

      const supplierId = arrivalNote.supplierId;
      if (!stats[supplierId]) {
        stats[supplierId] = {
          supplierId,
          discrepancyCount: 0,
          totalAmount: 0,
          shortages: 0,
          overages: 0,
          specMismatches: 0,
          pendingApproval: 0
        };
      }

      if (inspection.discrepancyType !== 'none') {
        stats[supplierId].discrepancyCount++;
        
        const impactAmount = parseFloat(handling.quantity) * parseFloat(poItem.unitPrice);
        stats[supplierId].totalAmount += impactAmount;

        if (inspection.discrepancyType === 'shortage') {
          stats[supplierId].shortages++;
        } else if (inspection.discrepancyType === 'overage') {
          stats[supplierId].overages++;
        } else if (inspection.discrepancyType === 'spec_mismatch') {
          stats[supplierId].specMismatches++;
        }
      }

      if (handling.approvalStatus === 'pending') {
        stats[supplierId].pendingApproval++;
      }
    }

    return Object.values(stats);
  }

  static async getAuditTrail(inspectionResultId) {
    const handling = await DiscrepancyHandling.findOne({
      where: { inspectionResultId },
      include: [
        {
          model: InspectionResult
        }
      ]
    });

    if (!handling) {
      return null;
    }

    return {
      inspectorId: handling.InspectionResult.inspectorId,
      inspectorName: handling.InspectionResult.inspectorName,
      inspectionTime: handling.InspectionResult.inspectionTime,
      approverId: handling.approverId,
      approverName: handling.approverName,
      approvalTime: handling.approvalTime,
      approvalStatus: handling.approvalStatus,
      handlingType: handling.handlingType,
      notes: handling.notes
    };
  }
}

module.exports = DiscrepancyService;
