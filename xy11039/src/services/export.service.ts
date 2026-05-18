import { Parser } from 'json2csv';
import {
  AdjustmentRecord,
  AdjustmentStatus,
  ApiResponse
} from '../types';
import { db } from '../store/database';
import { adjustmentService } from './adjustment.service';

class ExportService {
  private exportFields = [
    { label: '调码单号', value: 'adjustmentNo' },
    { label: '租借单号', value: 'rentalNo' },
    { label: '客户编号', value: 'customerCode' },
    { label: '客户姓名', value: 'customerName' },
    { label: '调码类型', value: 'adjustmentType' },
    { label: '调码原因', value: 'adjustmentReason' },
    { label: '调码日期', value: 'adjustmentDate' },
    { label: '原装备编号', value: 'oldEquipmentCode' },
    { label: '原装备类型', value: 'oldEquipmentType' },
    { label: '原装备品牌', value: 'oldEquipmentBrand' },
    { label: '原装备尺寸', value: 'oldEquipmentSize' },
    { label: '原装备尺寸CM', value: 'oldEquipmentSizeCm' },
    { label: '旧装备归还状态', value: 'oldEquipmentReturnStatus' },
    { label: '旧装备归还日期', value: 'oldEquipmentReturnDate' },
    { label: '新装备编号', value: 'newEquipmentCode' },
    { label: '新装备类型', value: 'newEquipmentType' },
    { label: '新装备品牌', value: 'newEquipmentBrand' },
    { label: '新装备尺寸', value: 'newEquipmentSize' },
    { label: '新装备尺寸CM', value: 'newEquipmentSizeCm' },
    { label: '新装备发放日期', value: 'newEquipmentIssueDate' },
    { label: '附加费用', value: 'additionalCharge' },
    { label: '押金调整', value: 'depositAdjustment' },
    { label: '状态', value: 'status' },
    { label: '租赁点代码', value: 'rentalPointCode' },
    { label: '租赁点名称', value: 'rentalPointName' },
    { label: '操作员ID', value: 'operatorId' },
    { label: '操作员姓名', value: 'operatorName' },
    { label: '审核人ID', value: 'reviewerId' },
    { label: '审核人姓名', value: 'reviewerName' },
    { label: '审核日期', value: 'reviewDate' },
    { label: '审核备注', value: 'reviewRemarks' },
    { label: '旧装备库存是否核实', value: 'oldEquipmentInventoryVerified' },
    { label: '对账是否核实', value: 'reconciliationVerified' },
    { label: '对账备注', value: 'reconciliationRemarks' },
    { label: '所需材料', value: 'requiredMaterials' },
    { label: '创建时间', value: 'createdAt' },
    { label: '更新时间', value: 'updatedAt' }
  ];

  exportAdjustmentsToCSV(params: {
    status?: AdjustmentStatus;
    rentalPointCode?: string;
    startDate?: string;
    endDate?: string;
  }): ApiResponse<string> {
    let adjustments = db.getAllAdjustments();

    if (params.status) {
      adjustments = adjustments.filter(a => a.status === params.status);
    }

    if (params.rentalPointCode) {
      adjustments = adjustments.filter(a => a.rentalPointCode === params.rentalPointCode);
    }

    if (params.startDate) {
      adjustments = adjustments.filter(a => a.adjustmentDate >= (params.startDate as string));
    }

    if (params.endDate) {
      adjustments = adjustments.filter(a => a.adjustmentDate <= (params.endDate as string));
    }

    adjustments = adjustments.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const enrichedAdjustments = adjustments.map(adj => {
      const detailResult = adjustmentService.getAdjustmentDetail(adj.id);
      return {
        ...adj,
        requiredMaterials: detailResult.data?.requiredMaterials?.join('; ') || '',
        oldEquipmentInventoryVerified: adj.oldEquipmentInventoryVerified ? '是' : '否',
        reconciliationVerified: adj.reconciliationVerified ? '是' : '否'
      };
    });

    try {
      const parser = new Parser({ fields: this.exportFields });
      const csv = parser.parse(enrichedAdjustments);

      return {
        success: true,
        data: csv,
        message: `成功导出${enrichedAdjustments.length}条调码记录`,
        nextActions: [],
        requiredMaterials: []
      };
    } catch (error) {
      return {
        success: false,
        message: 'CSV导出失败',
        errorCode: 'EXPORT_ERROR'
      };
    }
  }

  getExportStatistics(params: {
    startDate?: string;
    endDate?: string;
    rentalPointCode?: string;
  }): ApiResponse<any> {
    let adjustments = db.getAllAdjustments();

    if (params.rentalPointCode) {
      adjustments = adjustments.filter(a => a.rentalPointCode === params.rentalPointCode);
    }

    if (params.startDate) {
      adjustments = adjustments.filter(a => a.adjustmentDate >= (params.startDate as string));
    }

    if (params.endDate) {
      adjustments = adjustments.filter(a => a.adjustmentDate <= (params.endDate as string));
    }

    const totalCount = adjustments.length;
    const completedCount = adjustments.filter(a => a.status === AdjustmentStatus.COMPLETED).length;
    const pendingReviewCount = adjustments.filter(a => a.status === AdjustmentStatus.PENDING_REVIEW).length;
    const draftCount = adjustments.filter(a => a.status === AdjustmentStatus.DRAFT).length;
    const approvedCount = adjustments.filter(a => a.status === AdjustmentStatus.APPROVED).length;

    const oldEquipmentNotReturnedCount = adjustments.filter(a =>
      a.oldEquipmentReturnStatus !== 'RETURNED'
    ).length;

    const inventoryNotVerifiedCount = adjustments.filter(a =>
      !a.oldEquipmentInventoryVerified
    ).length;

    const reconciliationNotVerifiedCount = adjustments.filter(a =>
      !a.reconciliationVerified
    ).length;

    const totalAdditionalCharge = adjustments.reduce((sum, a) => sum + a.additionalCharge, 0);

    const adjustmentTypeStats = adjustments.reduce((acc: any, a) => {
      acc[a.adjustmentType] = (acc[a.adjustmentType] || 0) + 1;
      return acc;
    }, {});

    return {
      success: true,
      data: {
        totalCount,
        completedCount,
        pendingReviewCount,
        draftCount,
        approvedCount,
        oldEquipmentNotReturnedCount,
        inventoryNotVerifiedCount,
        reconciliationNotVerifiedCount,
        totalAdditionalCharge,
        adjustmentTypeStats,
        exportDate: new Date().toISOString(),
        dateRange: {
          start: params.startDate,
          end: params.endDate
        }
      },
      message: '统计数据获取成功'
    };
  }
}

export const exportService = new ExportService();
