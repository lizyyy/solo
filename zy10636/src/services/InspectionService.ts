import { InspectionRecordModel } from '../models/InspectionRecord';
import { InspectionStatus, FlowType, OperationType, ApiResponse, InspectionRecord } from '../types';

export class InspectionService {
  static REQUIRED_MATERIALS = [
    '补录时间异常说明文档',
    '现场巡检照片（带时间戳）',
    '设备运行日志截图',
    '主管领导签字确认扫描件',
    '巡检记录仪导出视频片段'
  ];

  static validateSupplementTime(supplementDate: string, discoveredDate: string): boolean {
    const supplementTime = new Date(supplementDate).getTime();
    const discoveredTime = new Date(discoveredDate).getTime();
    return supplementTime >= discoveredTime;
  }

  static async createMissedRecord(params: {
    planId: string;
    deviceId: string;
    inspectorId: string;
    planDate: string;
    supplementReason: string;
    discoveredDate: string;
    createdBy: string;
    createdByName: string;
  }): Promise<ApiResponse<InspectionRecord>> {
    try {
      const record = await InspectionRecordModel.create({
        planId: params.planId,
        deviceId: params.deviceId,
        inspectorId: params.inspectorId,
        planDate: params.planDate,
        supplementReason: params.supplementReason,
        discoveredDate: params.discoveredDate,
        status: InspectionStatus.MISSED_PENDING,
        flowType: FlowType.NORMAL,
        createdBy: params.createdBy
      });

      await InspectionRecordModel.addHistory({
        recordId: record.id,
        operationType: OperationType.CREATE,
        operatorId: params.createdBy,
        operatorName: params.createdByName,
        newStatus: InspectionStatus.MISSED_PENDING,
        remarks: '创建漏检补录记录',
        operationTime: new Date().toISOString()
      });

      return {
        success: true,
        data: record,
        message: '漏检补录记录创建成功'
      };
    } catch (error) {
      return {
        success: false,
        message: `创建失败: ${(error as Error).message}`
      };
    }
  }

  static async submitSupplement(params: {
    recordId: string;
    actualInspectionDate: string;
    supplementDate: string;
    inspectionResults: Record<string, string>;
    attachmentUrls?: string[];
    operatorId: string;
    operatorName: string;
    remarks?: string;
  }): Promise<ApiResponse<InspectionRecord>> {
    try {
      const record = await InspectionRecordModel.findById(params.recordId);
      if (!record) {
        return { success: false, message: '记录不存在' };
      }

      if (record.status !== InspectionStatus.MISSED_PENDING && record.status !== InspectionStatus.REJECTED) {
        return { success: false, message: '当前状态不允许提交补录' };
      }

      if (!this.validateSupplementTime(params.supplementDate, record.discoveredDate!)) {
        await InspectionRecordModel.update(params.recordId, {
          status: InspectionStatus.MANUAL_REVIEW,
          flowType: FlowType.MANUAL_REVIEW,
          requiredMaterials: this.REQUIRED_MATERIALS
        });

        await InspectionRecordModel.addHistory({
          recordId: params.recordId,
          operationType: OperationType.SUBMIT_REVIEW,
          operatorId: params.operatorId,
          operatorName: params.operatorName,
          previousStatus: record.status,
          newStatus: InspectionStatus.MANUAL_REVIEW,
          remarks: '补录时间早于发现时间，进入人工复核流程',
          operationTime: new Date().toISOString()
        });

        const updatedRecord = await InspectionRecordModel.findById(params.recordId);
        return {
          success: false,
          data: updatedRecord,
          message: '补录时间异常，已转入人工复核流程',
          errorCode: 'TIME_CONFLICT',
          requiredMaterials: this.REQUIRED_MATERIALS
        };
      }

      const flowType = record.status === InspectionStatus.REJECTED ? FlowType.REJECTION : FlowType.NORMAL;
      
      await InspectionRecordModel.update(params.recordId, {
        actualInspectionDate: params.actualInspectionDate,
        supplementDate: params.supplementDate,
        inspectionResults: params.inspectionResults,
        attachmentUrls: params.attachmentUrls,
        status: InspectionStatus.SUPPLEMENTED,
        flowType,
        remarks: params.remarks
      });

      await InspectionRecordModel.addHistory({
        recordId: params.recordId,
        operationType: OperationType.SUPPLEMENT,
        operatorId: params.operatorId,
        operatorName: params.operatorName,
        previousStatus: record.status,
        newStatus: InspectionStatus.SUPPLEMENTED,
        remarks: '提交补录信息',
        operationTime: new Date().toISOString()
      });

      const updatedRecord = await InspectionRecordModel.findById(params.recordId);
      return {
        success: true,
        data: updatedRecord,
        message: '补录提交成功'
      };
    } catch (error) {
      return {
        success: false,
        message: `提交失败: ${(error as Error).message}`
      };
    }
  }

  static async confirmRecord(params: {
    recordId: string;
    operatorId: string;
    operatorName: string;
    remarks?: string;
  }): Promise<ApiResponse<InspectionRecord>> {
    try {
      const record = await InspectionRecordModel.findById(params.recordId);
      if (!record) {
        return { success: false, message: '记录不存在' };
      }

      if (record.status !== InspectionStatus.SUPPLEMENTED) {
        return { success: false, message: '当前状态不允许确认' };
      }

      await InspectionRecordModel.update(params.recordId, {
        status: InspectionStatus.CONFIRMED
      });

      await InspectionRecordModel.addHistory({
        recordId: params.recordId,
        operationType: OperationType.CONFIRM,
        operatorId: params.operatorId,
        operatorName: params.operatorName,
        previousStatus: record.status,
        newStatus: InspectionStatus.CONFIRMED,
        remarks: params.remarks || '确认补录记录',
        operationTime: new Date().toISOString()
      });

      const updatedRecord = await InspectionRecordModel.findById(params.recordId);
      return {
        success: true,
        data: updatedRecord,
        message: '确认成功'
      };
    } catch (error) {
      return {
        success: false,
        message: `确认失败: ${(error as Error).message}`
      };
    }
  }

  static async rejectRecord(params: {
    recordId: string;
    operatorId: string;
    operatorName: string;
    remarks: string;
  }): Promise<ApiResponse<InspectionRecord>> {
    try {
      const record = await InspectionRecordModel.findById(params.recordId);
      if (!record) {
        return { success: false, message: '记录不存在' };
      }

      if (record.status !== InspectionStatus.SUPPLEMENTED) {
        return { success: false, message: '当前状态不允许驳回' };
      }

      await InspectionRecordModel.update(params.recordId, {
        status: InspectionStatus.REJECTED,
        flowType: FlowType.REJECTION
      });

      await InspectionRecordModel.addHistory({
        recordId: params.recordId,
        operationType: OperationType.REJECT,
        operatorId: params.operatorId,
        operatorName: params.operatorName,
        previousStatus: record.status,
        newStatus: InspectionStatus.REJECTED,
        remarks: params.remarks,
        operationTime: new Date().toISOString()
      });

      const updatedRecord = await InspectionRecordModel.findById(params.recordId);
      return {
        success: true,
        data: updatedRecord,
        message: '驳回成功'
      };
    } catch (error) {
      return {
        success: false,
        message: `驳回失败: ${(error as Error).message}`
      };
    }
  }

  static async approveManualReview(params: {
    recordId: string;
    operatorId: string;
    operatorName: string;
    remarks?: string;
  }): Promise<ApiResponse<InspectionRecord>> {
    try {
      const record = await InspectionRecordModel.findById(params.recordId);
      if (!record) {
        return { success: false, message: '记录不存在' };
      }

      if (record.status !== InspectionStatus.MANUAL_REVIEW) {
        return { success: false, message: '当前状态不允许审批' };
      }

      await InspectionRecordModel.update(params.recordId, {
        status: InspectionStatus.SUPPLEMENTED,
        requiredMaterials: undefined
      });

      await InspectionRecordModel.addHistory({
        recordId: params.recordId,
        operationType: OperationType.APPROVE_REVIEW,
        operatorId: params.operatorId,
        operatorName: params.operatorName,
        previousStatus: record.status,
        newStatus: InspectionStatus.SUPPLEMENTED,
        remarks: params.remarks || '人工复核通过',
        operationTime: new Date().toISOString()
      });

      const updatedRecord = await InspectionRecordModel.findById(params.recordId);
      return {
        success: true,
        data: updatedRecord,
        message: '人工复核通过'
      };
    } catch (error) {
      return {
        success: false,
        message: `审批失败: ${(error as Error).message}`
      };
    }
  }

  static async getRecordDetail(id: string): Promise<ApiResponse<InspectionRecord>> {
    try {
      const record = await InspectionRecordModel.findById(id);
      if (!record) {
        return { success: false, message: '记录不存在' };
      }
      return {
        success: true,
        data: record,
        message: '查询成功'
      };
    } catch (error) {
      return {
        success: false,
        message: `查询失败: ${(error as Error).message}`
      };
    }
  }

  static async getRecordList(params?: {
    status?: InspectionStatus;
    flowType?: FlowType;
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<{ list: InspectionRecord[]; total: number }>> {
    try {
      const result = await InspectionRecordModel.findAll(params);
      return {
        success: true,
        data: result,
        message: '查询成功'
      };
    } catch (error) {
      return {
        success: false,
        message: `查询失败: ${(error as Error).message}`
      };
    }
  }

  static async getOperationHistory(recordId: string): Promise<ApiResponse> {
    try {
      const history = await InspectionRecordModel.getHistory(recordId);
      return {
        success: true,
        data: history,
        message: '查询成功'
      };
    } catch (error) {
      return {
        success: false,
        message: `查询失败: ${(error as Error).message}`
      };
    }
  }
}
