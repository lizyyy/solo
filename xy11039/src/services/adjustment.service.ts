import moment from 'moment';
import {
  AdjustmentRecord,
  NextActionItem,
  AdjustmentStatus,
  AdjustmentType,
  ReconciliationStatus,
  RentalStatus,
  ApiResponse
} from '../types';
import { db } from '../store/database';

class AdjustmentService {
  generateAdjustmentNo(): string {
    const dateStr = moment().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ADJ-${dateStr}-${random}`;
  }

  async validateBeforeAdjustment(rentalId: string, newEquipmentId: string): Promise<{
    valid: boolean;
    nextActions: NextActionItem[];
    requiredMaterials: string[];
  }> {
    const nextActions: NextActionItem[] = [];
    const requiredMaterials: string[] = [];

    const rental = db.getRentalById(rentalId);
    if (!rental) {
      return {
        valid: false,
        nextActions: [{
          action: '查询租借记录',
          priority: 'HIGH',
          description: '未找到对应的租借记录，请确认租借单号是否正确',
          requiredMaterial: '租借单号'
        }],
        requiredMaterials: ['租借单号']
      };
    }

    const oldEquipment = db.getEquipmentById(rental.equipmentId);
    if (!oldEquipment) {
      return {
        valid: false,
        nextActions: [{
          action: '检查装备信息',
          priority: 'HIGH',
          description: '原租借装备信息不存在，请检查数据完整性',
          requiredMaterial: '原装备RFID标签'
        }],
        requiredMaterials: ['原装备RFID标签']
      };
    }

    const newEquipment = db.getEquipmentById(newEquipmentId);
    if (!newEquipment) {
      return {
        valid: false,
        nextActions: [{
          action: '检查新装备信息',
          priority: 'HIGH',
          description: '新调码装备信息不存在，请检查装备编号',
          requiredMaterial: '新装备RFID标签'
        }],
        requiredMaterials: ['新装备RFID标签']
      };
    }

    if (newEquipment.currentStatus !== RentalStatus.AVAILABLE) {
      nextActions.push({
        action: '确认新装备可用性',
        priority: 'HIGH',
        description: `新装备当前状态为【${newEquipment.currentStatus}】，可能无法正常租借`,
        requiredMaterial: '新装备状态确认单'
      });
      requiredMaterials.push('新装备状态确认单');
    }

    if (oldEquipment.currentStatus !== RentalStatus.RENTED) {
      nextActions.push({
        action: '确认原装备状态',
        priority: 'HIGH',
        description: `原装备当前状态为【${oldEquipment.currentStatus}】，与租借记录状态不一致`,
        requiredMaterial: '原装备状态核查表'
      });
      requiredMaterials.push('原装备状态核查表');
    }

    const adjustmentCount = db.getAdjustmentsByRentalId(rentalId).length;
    if (adjustmentCount >= 3) {
      nextActions.push({
        action: '多次调码审批',
        priority: 'MEDIUM',
        description: `该租借记录已进行${adjustmentCount}次调码，需店长额外审批`,
        requiredMaterial: '多次调码审批表'
      });
      requiredMaterials.push('多次调码审批表');
    }

    return {
      valid: true,
      nextActions,
      requiredMaterials
    };
  }

  detectOldEquipmentInventoryIssue(rentalId: string, adjustmentId: string): {
    hasIssue: boolean;
    nextActions: NextActionItem[];
    requiredMaterials: string[];
  } {
    const adjustment = db.getAdjustmentById(adjustmentId);
    if (!adjustment) {
      return { hasIssue: false, nextActions: [], requiredMaterials: [] };
    }

    const nextActions: NextActionItem[] = [];
    const requiredMaterials: string[] = [];

    if (adjustment.oldEquipmentReturnStatus !== 'RETURNED') {
      nextActions.push({
        action: '追回未归还装备',
        priority: 'HIGH',
        description: `原装备【${adjustment.oldEquipmentCode}】尚未归还，请立即联系客户追回或办理赔偿手续`,
        requiredMaterial: '装备追回记录单',
        deadline: moment().add(24, 'hours').format('YYYY-MM-DD HH:mm:ss')
      });
      requiredMaterials.push('装备追回记录单');

      nextActions.push({
        action: '更新库存台账',
        priority: 'HIGH',
        description: '原装备未归还，需在库存系统中标注异常状态',
        requiredMaterial: '库存异常审批表'
      });
      requiredMaterials.push('库存异常审批表');
    }

    const oldEquipment = db.getEquipmentById(adjustment.oldEquipmentId);
    if (oldEquipment && oldEquipment.currentStatus !== RentalStatus.AVAILABLE) {
      if (oldEquipment.currentStatus === RentalStatus.RENTED) {
        nextActions.push({
          action: '修正装备状态',
          priority: 'HIGH',
          description: `原装备【${oldEquipment.equipmentCode}】系统状态仍为租借中，需修正为可用或维修状态`,
          requiredMaterial: '装备状态变更审批表'
        });
        requiredMaterials.push('装备状态变更审批表');
      }
    }

    return {
      hasIssue: nextActions.length > 0,
      nextActions,
      requiredMaterials
    };
  }

  checkReconciliationConsistency(rentalId: string): {
    consistent: boolean;
    nextActions: NextActionItem[];
    requiredMaterials: string[];
  } {
    const rental = db.getRentalById(rentalId);
    if (!rental) {
      return { consistent: false, nextActions: [], requiredMaterials: [] };
    }

    const nextActions: NextActionItem[] = [];
    const requiredMaterials: string[] = [];

    const adjustments = db.getAdjustmentsByRentalId(rentalId);
    const totalAdjustments = adjustments.length;

    if (rental.adjustmentCount !== totalAdjustments) {
      nextActions.push({
        action: '修正调码计数',
        priority: 'HIGH',
        description: `租借记录调码次数【${rental.adjustmentCount}】与实际调码记录数【${totalAdjustments}】不一致`,
        requiredMaterial: '对账差异调整表'
      });
      requiredMaterials.push('对账差异调整表');
    }

    let expectedTotal = rental.dailyRate * 1;
    adjustments.forEach(adj => {
      expectedTotal += adj.additionalCharge;
    });

    if (rental.totalAmount && Math.abs(rental.totalAmount - expectedTotal) > 0.01) {
      nextActions.push({
        action: '核实费用明细',
        priority: 'MEDIUM',
        description: `系统计算总费用【${expectedTotal}元】与记录总费用【${rental.totalAmount}元】存在差异`,
        requiredMaterial: '费用明细核对表'
      });
      requiredMaterials.push('费用明细核对表');
    }

    adjustments.forEach(adj => {
      if (!adj.oldEquipmentInventoryVerified) {
        nextActions.push({
          action: '确认旧装备入库',
          priority: 'MEDIUM',
          description: `调码记录【${adj.adjustmentNo}】的旧装备入库尚未核实`,
          requiredMaterial: '装备入库确认单'
        });
        requiredMaterials.push('装备入库确认单');
      }

      if (!adj.reconciliationVerified) {
        nextActions.push({
          action: '完成对账确认',
          priority: 'LOW',
          description: `调码记录【${adj.adjustmentNo}】尚未完成对账确认`,
          requiredMaterial: '调码对账确认表'
        });
        requiredMaterials.push('调码对账确认表');
      }
    });

    return {
      consistent: nextActions.length === 0,
      nextActions,
      requiredMaterials
    };
  }

  async createAdjustment(createData: {
    rentalRecordId: string;
    adjustmentType: AdjustmentType;
    newEquipmentId: string;
    adjustmentReason: string;
    additionalCharge: number;
    depositAdjustment: number;
    rentalPointCode: string;
    rentalPointName: string;
    operatorId: string;
    operatorName: string;
  }): Promise<ApiResponse<AdjustmentRecord>> {
    const validation = await this.validateBeforeAdjustment(
      createData.rentalRecordId,
      createData.newEquipmentId
    );

    const rental = db.getRentalById(createData.rentalRecordId);
    if (!rental) {
      return {
        success: false,
        message: '租借记录不存在',
        errorCode: 'RENTAL_NOT_FOUND',
        nextActions: validation.nextActions,
        requiredMaterials: validation.requiredMaterials
      };
    }

    const oldEquipment = db.getEquipmentById(rental.equipmentId);
    const newEquipment = db.getEquipmentById(createData.newEquipmentId);

    if (!oldEquipment || !newEquipment) {
      return {
        success: false,
        message: '装备信息不完整',
        errorCode: 'EQUIPMENT_NOT_FOUND',
        nextActions: validation.nextActions,
        requiredMaterials: validation.requiredMaterials
      };
    }

    const adjustmentNo = this.generateAdjustmentNo();
    const adjustment = db.createAdjustment({
      adjustmentNo,
      rentalRecordId: createData.rentalRecordId,
      rentalNo: rental.rentalNo,
      customerId: rental.customerId,
      customerCode: rental.customerCode,
      customerName: rental.customerName,
      adjustmentType: createData.adjustmentType,
      oldEquipmentId: oldEquipment.id,
      oldEquipmentCode: oldEquipment.equipmentCode,
      oldEquipmentType: oldEquipment.type,
      oldEquipmentBrand: oldEquipment.brand,
      oldEquipmentSize: oldEquipment.size,
      oldEquipmentSizeCm: oldEquipment.sizeCm,
      oldEquipmentReturnStatus: 'NOT_RETURNED',
      newEquipmentId: newEquipment.id,
      newEquipmentCode: newEquipment.equipmentCode,
      newEquipmentType: newEquipment.type,
      newEquipmentBrand: newEquipment.brand,
      newEquipmentSize: newEquipment.size,
      newEquipmentSizeCm: newEquipment.sizeCm,
      newEquipmentIssueDate: moment().format('YYYY-MM-DD HH:mm:ss'),
      adjustmentReason: createData.adjustmentReason,
      adjustmentDate: moment().format('YYYY-MM-DD HH:mm:ss'),
      additionalCharge: createData.additionalCharge,
      depositAdjustment: createData.depositAdjustment,
      status: AdjustmentStatus.DRAFT,
      rentalPointCode: createData.rentalPointCode,
      rentalPointName: createData.rentalPointName,
      operatorId: createData.operatorId,
      operatorName: createData.operatorName,
      oldEquipmentInventoryVerified: false,
      reconciliationVerified: false,
      requiredMaterials: validation.requiredMaterials,
      nextActionItems: validation.nextActions
    });

    db.updateRental(createData.rentalRecordId, {
      equipmentId: newEquipment.id,
      equipmentCode: newEquipment.equipmentCode,
      equipmentType: newEquipment.type,
      equipmentBrand: newEquipment.brand,
      equipmentSize: newEquipment.size,
      equipmentSizeCm: newEquipment.sizeCm,
      hasAdjustment: true,
      adjustmentCount: rental.adjustmentCount + 1
    });

    db.updateEquipment(newEquipment.id, {
      currentStatus: RentalStatus.RENTED
    });

    db.createInventoryLog({
      equipmentId: newEquipment.id,
      equipmentCode: newEquipment.equipmentCode,
      actionType: 'ADJUSTMENT_OUT',
      quantity: 1,
      referenceNo: adjustmentNo,
      referenceType: 'ADJUSTMENT',
      location: createData.rentalPointName,
      operatorId: createData.operatorId,
      operatorName: createData.operatorName
    });

    return {
      success: true,
      data: adjustment,
      message: '调码记录创建成功',
      nextActions: validation.nextActions,
      requiredMaterials: validation.requiredMaterials
    };
  }

  async submitForReview(adjustmentId: string, reviewerId: string, reviewerName: string): Promise<ApiResponse<AdjustmentRecord>> {
    const adjustment = db.getAdjustmentById(adjustmentId);
    if (!adjustment) {
      return {
        success: false,
        message: '调码记录不存在',
        errorCode: 'ADJUSTMENT_NOT_FOUND'
      };
    }

    if (adjustment.status !== AdjustmentStatus.DRAFT) {
      return {
        success: false,
        message: `当前状态【${adjustment.status}】不允许提交审核`,
        errorCode: 'INVALID_STATUS'
      };
    }

    const inventoryCheck = this.detectOldEquipmentInventoryIssue(adjustment.rentalRecordId, adjustmentId);
    const reconciliationCheck = this.checkReconciliationConsistency(adjustment.rentalRecordId);

    const allNextActions = [...adjustment.nextActionItems, ...inventoryCheck.nextActions, ...reconciliationCheck.nextActions];
    const allRequiredMaterials = [...new Set([...adjustment.requiredMaterials, ...inventoryCheck.requiredMaterials, ...reconciliationCheck.requiredMaterials])];

    const updated = db.updateAdjustment(adjustmentId, {
      status: AdjustmentStatus.PENDING_REVIEW,
      reviewerId,
      reviewerName,
      nextActionItems: allNextActions,
      requiredMaterials: allRequiredMaterials
    });

    return {
      success: true,
      data: updated,
      message: '已提交审核，请关注边界问题处理进度',
      nextActions: allNextActions,
      requiredMaterials: allRequiredMaterials
    };
  }

  async approveAdjustment(adjustmentId: string, reviewRemarks?: string): Promise<ApiResponse<AdjustmentRecord>> {
    const adjustment = db.getAdjustmentById(adjustmentId);
    if (!adjustment) {
      return {
        success: false,
        message: '调码记录不存在',
        errorCode: 'ADJUSTMENT_NOT_FOUND'
      };
    }

    if (adjustment.status !== AdjustmentStatus.PENDING_REVIEW) {
      return {
        success: false,
        message: `当前状态【${adjustment.status}】不允许审核`,
        errorCode: 'INVALID_STATUS'
      };
    }

    const inventoryCheck = this.detectOldEquipmentInventoryIssue(adjustment.rentalRecordId, adjustmentId);
    const reconciliationCheck = this.checkReconciliationConsistency(adjustment.rentalRecordId);

    const allNextActions = [...inventoryCheck.nextActions, ...reconciliationCheck.nextActions];
    const allRequiredMaterials = [...new Set([...inventoryCheck.requiredMaterials, ...reconciliationCheck.requiredMaterials])];

    const updated = db.updateAdjustment(adjustmentId, {
      status: AdjustmentStatus.APPROVED,
      reviewDate: moment().format('YYYY-MM-DD HH:mm:ss'),
      reviewRemarks,
      nextActionItems: allNextActions,
      requiredMaterials: allRequiredMaterials
    });

    return {
      success: true,
      data: updated,
      message: inventoryCheck.hasIssue ? '审核通过，但存在旧装备未回库问题，请及时处理' : '审核通过',
      nextActions: allNextActions,
      requiredMaterials: allRequiredMaterials
    };
  }

  async confirmOldEquipmentReturned(adjustmentId: string): Promise<ApiResponse<AdjustmentRecord>> {
    const adjustment = db.getAdjustmentById(adjustmentId);
    if (!adjustment) {
      return {
        success: false,
        message: '调码记录不存在',
        errorCode: 'ADJUSTMENT_NOT_FOUND'
      };
    }

    const updated = db.updateAdjustment(adjustmentId, {
      oldEquipmentReturnStatus: 'RETURNED',
      oldEquipmentReturnDate: moment().format('YYYY-MM-DD HH:mm:ss'),
      oldEquipmentInventoryVerified: true
    });

    db.updateEquipment(adjustment.oldEquipmentId, {
      currentStatus: RentalStatus.AVAILABLE
    });

    db.createInventoryLog({
      equipmentId: adjustment.oldEquipmentId,
      equipmentCode: adjustment.oldEquipmentCode,
      actionType: 'ADJUSTMENT_IN',
      quantity: 1,
      referenceNo: adjustment.adjustmentNo,
      referenceType: 'ADJUSTMENT_RETURN',
      location: adjustment.rentalPointName,
      operatorId: adjustment.operatorId,
      operatorName: adjustment.operatorName
    });

    const reconciliationCheck = this.checkReconciliationConsistency(adjustment.rentalRecordId);

    return {
      success: true,
      data: updated,
      message: '旧装备已确认归还入库',
      nextActions: reconciliationCheck.nextActions,
      requiredMaterials: reconciliationCheck.requiredMaterials
    };
  }

  async completeAdjustment(adjustmentId: string): Promise<ApiResponse<AdjustmentRecord>> {
    const adjustment = db.getAdjustmentById(adjustmentId);
    if (!adjustment) {
      return {
        success: false,
        message: '调码记录不存在',
        errorCode: 'ADJUSTMENT_NOT_FOUND'
      };
    }

    if (adjustment.oldEquipmentReturnStatus !== 'RETURNED') {
      const inventoryCheck = this.detectOldEquipmentInventoryIssue(adjustment.rentalRecordId, adjustmentId);
      return {
        success: false,
        message: '旧装备尚未归还，无法完成调码',
        errorCode: 'EQUIPMENT_NOT_RETURNED',
        nextActions: inventoryCheck.nextActions,
        requiredMaterials: inventoryCheck.requiredMaterials
      };
    }

    const reconciliationCheck = this.checkReconciliationConsistency(adjustment.rentalRecordId);
    if (!reconciliationCheck.consistent) {
      return {
        success: false,
        message: '对账一致性检查未通过',
        errorCode: 'RECONCILIATION_FAILED',
        nextActions: reconciliationCheck.nextActions,
        requiredMaterials: reconciliationCheck.requiredMaterials
      };
    }

    const updated = db.updateAdjustment(adjustmentId, {
      status: AdjustmentStatus.COMPLETED,
      reconciliationVerified: true
    });

    return {
      success: true,
      data: updated,
      message: '调码已完成'
    };
  }

  getAdjustmentDetail(adjustmentId: string): ApiResponse<AdjustmentRecord> {
    const adjustment = db.getAdjustmentById(adjustmentId);
    if (!adjustment) {
      return {
        success: false,
        message: '调码记录不存在',
        errorCode: 'ADJUSTMENT_NOT_FOUND'
      };
    }

    const inventoryCheck = this.detectOldEquipmentInventoryIssue(adjustment.rentalRecordId, adjustmentId);
    const reconciliationCheck = this.checkReconciliationConsistency(adjustment.rentalRecordId);

    const allNextActions = [...adjustment.nextActionItems, ...inventoryCheck.nextActions, ...reconciliationCheck.nextActions];
    const allRequiredMaterials = [...new Set([...adjustment.requiredMaterials, ...inventoryCheck.requiredMaterials, ...reconciliationCheck.requiredMaterials])];

    return {
      success: true,
      data: {
        ...adjustment,
        nextActionItems: allNextActions,
        requiredMaterials: allRequiredMaterials
      },
      message: '查询成功',
      nextActions: allNextActions,
      requiredMaterials: allRequiredMaterials
    };
  }

  getAdjustmentList(params: {
    page?: number;
    pageSize?: number;
    status?: AdjustmentStatus;
    rentalPointCode?: string;
    customerName?: string;
  }): {
    data: AdjustmentRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    let adjustments = db.getAllAdjustments();

    if (params.status) {
      adjustments = adjustments.filter(a => a.status === params.status);
    }

    if (params.rentalPointCode) {
      adjustments = adjustments.filter(a => a.rentalPointCode === params.rentalPointCode);
    }

    if (params.customerName) {
      adjustments = adjustments.filter(a => a.customerName.includes(params.customerName as string));
    }

    adjustments = adjustments.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = adjustments.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = adjustments.slice(start, start + pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages
    };
  }
}

export const adjustmentService = new AdjustmentService();
