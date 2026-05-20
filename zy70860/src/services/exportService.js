const { Parser } = require('json2csv');
const MaterialRecord = require('../models/MaterialRecord');
const QueryService = require('./queryService');

class ExportService {
  static async exportToCSV(filters, options = {}) {
    try {
      const queryResult = await QueryService.queryRecords(filters, {
        ...options,
        page: 1,
        pageSize: 10000
      });

      if (!queryResult.success) {
        return queryResult;
      }

      const records = queryResult.data.records;

      const fields = [
        { label: '记录ID', value: 'recordId' },
        { label: '抢修单号', value: 'orderNumber' },
        { label: '车辆ID', value: 'vehicleId' },
        { label: '班组', value: 'teamName' },
        { label: '物料编码', value: 'materialCode' },
        { label: '物料名称', value: 'materialName' },
        { label: '规格', value: 'specification' },
        { label: '单位', value: 'unit' },
        { label: '申请数量', value: 'requestedQuantity' },
        { label: '实际数量', value: 'actualQuantity' },
        { label: '退回数量', value: 'returnedQuantity' },
        { label: '批次号', value: 'batchNumber' },
        { label: '仓库', value: 'warehouse' },
        { label: '记录类型', value: 'recordType' },
        { label: '状态', value: 'status' },
        { label: '申请人', value: 'applicant' },
        { label: '申请时间', value: 'applicationTime' },
        { label: '处理人', value: 'handler' },
        { label: '处理时间', value: 'handleTime' },
        { label: '原因', value: 'reason' },
        { label: '拒绝原因', value: 'rejectionReason' },
        { label: '退回原因', value: 'returnReason' },
        { label: '备注', value: 'remarks' },
        { label: '是否有异常', value: 'hasException' },
        { label: '异常类型', value: 'exceptionType' },
        { label: '异常原因', value: 'exceptionReason' },
        { label: '异常处理人', value: 'exceptionHandler' },
        { label: '异常时间', value: 'exceptionTime' },
        { label: '创建时间', value: 'createdAt' },
        { label: '更新时间', value: 'updatedAt' }
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(records);

      return {
        success: true,
        data: csv,
        filename: `material_records_${Date.now()}.csv`,
        count: records.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async exportByOrderNumber(orderNumber) {
    try {
      const result = await QueryService.queryByOrderNumber(orderNumber);
      if (!result.success) {
        return result;
      }

      const fields = [
        { label: '记录ID', value: 'recordId' },
        { label: '抢修单号', value: 'orderNumber' },
        { label: '班组', value: 'teamName' },
        { label: '物料编码', value: 'materialCode' },
        { label: '物料名称', value: 'materialName' },
        { label: '规格', value: 'specification' },
        { label: '单位', value: 'unit' },
        { label: '申请数量', value: 'requestedQuantity' },
        { label: '实际数量', value: 'actualQuantity' },
        { label: '退回数量', value: 'returnedQuantity' },
        { label: '批次号', value: 'batchNumber' },
        { label: '状态', value: 'status' },
        { label: '申请人', value: 'applicant' },
        { label: '申请时间', value: 'applicationTime' },
        { label: '是否有异常', value: 'hasException' }
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(result.data.records);

      return {
        success: true,
        data: csv,
        filename: `order_${orderNumber}_${Date.now()}.csv`,
        count: result.data.count
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async exportByTeamName(teamName, dateRange = {}) {
    try {
      const result = await QueryService.queryByTeamName(teamName, dateRange);
      if (!result.success) {
        return result;
      }

      const fields = [
        { label: '记录ID', value: 'recordId' },
        { label: '抢修单号', value: 'orderNumber' },
        { label: '班组', value: 'teamName' },
        { label: '物料编码', value: 'materialCode' },
        { label: '物料名称', value: 'materialName' },
        { label: '规格', value: 'specification' },
        { label: '单位', value: 'unit' },
        { label: '申请数量', value: 'requestedQuantity' },
        { label: '实际数量', value: 'actualQuantity' },
        { label: '批次号', value: 'batchNumber' },
        { label: '状态', value: 'status' },
        { label: '申请时间', value: 'applicationTime' },
        { label: '是否有异常', value: 'hasException' }
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(result.data.records);

      return {
        success: true,
        data: csv,
        filename: `team_${teamName}_${Date.now()}.csv`,
        count: result.data.count
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async exportByBatchNumber(batchNumber) {
    try {
      const result = await QueryService.queryByBatchNumber(batchNumber);
      if (!result.success) {
        return result;
      }

      const fields = [
        { label: '记录ID', value: 'recordId' },
        { label: '抢修单号', value: 'orderNumber' },
        { label: '班组', value: 'teamName' },
        { label: '物料编码', value: 'materialCode' },
        { label: '物料名称', value: 'materialName' },
        { label: '单位', value: 'unit' },
        { label: '申请数量', value: 'requestedQuantity' },
        { label: '实际数量', value: 'actualQuantity' },
        { label: '退回数量', value: 'returnedQuantity' },
        { label: '批次号', value: 'batchNumber' },
        { label: '状态', value: 'status' },
        { label: '申请时间', value: 'applicationTime' },
        { label: '是否有异常', value: 'hasException' }
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(result.data.records);

      return {
        success: true,
        data: csv,
        filename: `batch_${batchNumber}_${Date.now()}.csv`,
        count: result.data.count
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async exportReport(recordId) {
    try {
      const result = await QueryService.getCompleteReport(recordId);
      if (!result.success) {
        return result;
      }

      const data = result.data;
      
      const reportContent = [];
      reportContent.push('自来水抢修物资领用报告');
      reportContent.push('=' .repeat(50));
      reportContent.push('');
      
      reportContent.push('一、基本信息');
      reportContent.push('-' .repeat(30));
      reportContent.push(`记录ID: ${data.basicInfo.recordId}`);
      reportContent.push(`抢修单号: ${data.basicInfo.orderNumber}`);
      reportContent.push(`物料编码: ${data.basicInfo.materialCode}`);
      reportContent.push(`物料名称: ${data.basicInfo.materialName}`);
      reportContent.push(`规格: ${data.basicInfo.specification}`);
      reportContent.push(`单位: ${data.basicInfo.unit}`);
      reportContent.push(`申请数量: ${data.basicInfo.requestedQuantity}`);
      reportContent.push(`实际数量: ${data.basicInfo.actualQuantity}`);
      reportContent.push(`退回数量: ${data.basicInfo.returnedQuantity}`);
      reportContent.push(`批次号: ${data.basicInfo.batchNumber}`);
      reportContent.push(`仓库: ${data.basicInfo.warehouse}`);
      reportContent.push(`记录类型: ${data.basicInfo.recordType}`);
      reportContent.push(`当前状态: ${data.basicInfo.status}`);
      reportContent.push(`申请人: ${data.basicInfo.applicant}`);
      reportContent.push(`申请时间: ${data.basicInfo.applicationTime}`);
      reportContent.push(`处理人: ${data.basicInfo.handler}`);
      reportContent.push(`处理时间: ${data.basicInfo.handleTime}`);
      reportContent.push(`原因: ${data.basicInfo.reason}`);
      reportContent.push(`拒绝原因: ${data.basicInfo.rejectionReason || '-'}`);
      reportContent.push(`退回原因: ${data.basicInfo.returnReason || '-'}`);
      reportContent.push('');

      if (data.repairOrder) {
        reportContent.push('二、抢修单信息');
        reportContent.push('-' .repeat(30));
        reportContent.push(`抢修类型: ${data.repairOrder.repairType}`);
        reportContent.push(`地点: ${data.repairOrder.location}`);
        reportContent.push(`描述: ${data.repairOrder.description}`);
        reportContent.push(`优先级: ${data.repairOrder.priority}`);
        reportContent.push(`报告人: ${data.repairOrder.reporter}`);
        reportContent.push(`报告时间: ${data.repairOrder.reportTime}`);
        reportContent.push(`负责人: ${data.repairOrder.responsiblePerson}`);
        reportContent.push('');
      }

      if (data.vehicle) {
        reportContent.push('三、车辆信息');
        reportContent.push('-' .repeat(30));
        reportContent.push(`车辆ID: ${data.vehicle.vehicleId}`);
        reportContent.push(`车牌号: ${data.vehicle.plateNumber}`);
        reportContent.push(`班组: ${data.vehicle.teamName}`);
        reportContent.push(`驾驶员: ${data.vehicle.driver}`);
        reportContent.push(`随车人员: ${data.vehicle.crewMembers.join(', ')}`);
        reportContent.push('');
      }

      if (data.inventory) {
        reportContent.push('四、库存信息');
        reportContent.push('-' .repeat(30));
        reportContent.push(`物料编码: ${data.inventory.materialCode}`);
        reportContent.push(`物料名称: ${data.inventory.materialName}`);
        reportContent.push(`当前库存: ${data.inventory.quantity} ${data.inventory.unit}`);
        reportContent.push(`批次号: ${data.inventory.batchNumber}`);
        reportContent.push(`仓库: ${data.inventory.warehouse}`);
        reportContent.push(`库存状态: ${data.inventory.status}`);
        reportContent.push('');
      }

      reportContent.push('五、审计追踪');
      reportContent.push('-' .repeat(30));
      data.auditTrail.forEach((log, index) => {
        reportContent.push(`${index + 1}. 操作: ${log.action}`);
        reportContent.push(`   操作人: ${log.operator}`);
        reportContent.push(`   操作时间: ${log.operateTime}`);
        reportContent.push(`   状态变化: ${log.previousStatus || '-'} -> ${log.newStatus}`);
        reportContent.push(`   原因: ${log.reason || '-'}`);
        reportContent.push('');
      });

      if (data.exceptions.length > 0) {
        reportContent.push('六、异常记录');
        reportContent.push('-' .repeat(30));
        data.exceptions.forEach((ex, index) => {
          reportContent.push(`${index + 1}. 异常类型: ${ex.exceptionType}`);
          reportContent.push(`   数量差异: ${ex.quantity}`);
          reportContent.push(`   原因: ${ex.reason}`);
          reportContent.push(`   处理人: ${ex.handler}`);
          reportContent.push(`   处理时间: ${ex.handleTime}`);
          reportContent.push(`   处理状态: ${ex.status}`);
          if (ex.resolution) {
            reportContent.push(`   解决方案: ${ex.resolution}`);
          }
          reportContent.push('');
        });
      }

      reportContent.push('七、放行说明');
      reportContent.push('-' .repeat(30));
      
      const statusDesc = {
        'pending': '待处理 - 等待审核',
        'processing': '处理中 - 正在审核',
        'approved': '已放行 - 审核通过，已发放物资',
        'rejected': '已拒绝 - 申请被拒绝，请查看拒绝原因',
        'returned': '退回修改 - 需要补充信息或修改后重新提交',
        'completed': '已完成 - 流程结束'
      };
      reportContent.push(`当前状态说明: ${statusDesc[data.basicInfo.status] || data.basicInfo.status}`);
      
      if (data.basicInfo.handler) {
        reportContent.push(`最终处理人: ${data.basicInfo.handler}`);
      }
      if (data.basicInfo.handleTime) {
        reportContent.push(`最终处理时间: ${data.basicInfo.handleTime}`);
      }
      if (data.basicInfo.reason) {
        reportContent.push(`处理说明: ${data.basicInfo.reason}`);
      }

      return {
        success: true,
        data: reportContent.join('\n'),
        filename: `report_${recordId}_${Date.now()}.txt`,
        recordId: recordId
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async exportExceptionLogs(filters = {}) {
    try {
      const result = await QueryService.getExceptionLogs(filters);
      if (!result.success) {
        return result;
      }

      const fields = [
        { label: '日志ID', value: 'logId' },
        { label: '记录ID', value: 'recordId' },
        { label: '抢修单号', value: 'orderNumber' },
        { label: '异常类型', value: 'exceptionType' },
        { label: '物料编码', value: 'materialCode' },
        { label: '物料名称', value: 'materialName' },
        { label: '批次号', value: 'batchNumber' },
        { label: '数量', value: 'quantity' },
        { label: '预期数量', value: 'expectedQuantity' },
        { label: '实际数量', value: 'actualQuantity' },
        { label: '原因', value: 'reason' },
        { label: '处理人', value: 'handler' },
        { label: '处理时间', value: 'handleTime' },
        { label: '状态', value: 'status' },
        { label: '解决方案', value: 'resolution' },
        { label: '解决人', value: 'resolvedBy' },
        { label: '解决时间', value: 'resolvedTime' }
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(result.data);

      return {
        success: true,
        data: csv,
        filename: `exception_logs_${Date.now()}.csv`,
        count: result.data.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ExportService;
