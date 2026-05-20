const Database = require('../db/database');
const { Parser } = require('json2csv');

class ExportService {
  static async getExportData(batchId) {
    const batch = await Database.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      throw new Error('批次不存在');
    }

    const inspectionRecords = await Database.all(
      'SELECT * FROM inspection_records WHERE batch_id = ?',
      [batchId]
    );

    const trialRunRecords = await Database.all(
      'SELECT * FROM trial_run_records WHERE batch_id = ?',
      [batchId]
    );

    const approvalRecords = await Database.all(
      'SELECT * FROM approval_records WHERE batch_id = ? ORDER BY approval_time',
      [batchId]
    );

    return {
      batch,
      inspectionRecords,
      trialRunRecords,
      approvalRecords
    };
  }

  static async generateCSV(batchId) {
    const data = await this.getExportData(batchId);
    const { batch, inspectionRecords, trialRunRecords, approvalRecords } = data;

    const inspectionData = inspectionRecords.map((r, i) => ({
      批次号: i === 0 ? batch.batch_no : '',
      缆车编号: i === 0 ? batch.cable_car_id : '',
      缆车名称: i === 0 ? batch.cable_car_name : '',
      检修日期: i === 0 ? batch.inspection_date : '',
      提交人: i === 0 ? batch.submitter : '',
      提交时间: i === 0 ? batch.submit_time : '',
      当前状态: i === 0 ? this.translateStatus(batch.status) : '',
      记录类型: '检修记录',
      检修项目: r.item_name,
      检修结果: this.translateResult(r.item_result),
      备注: r.remark,
      处理人: r.inspector,
      处理时间: r.inspection_time,
      最后处理人: i === inspectionRecords.length - 1 ? (batch.final_handler || '') : ''
    }));

    const trialData = trialRunRecords.map((r, i) => ({
      批次号: '',
      缆车编号: '',
      缆车名称: '',
      检修日期: '',
      提交人: '',
      提交时间: '',
      当前状态: '',
      记录类型: '试运行记录',
      检修项目: `试运行时长: ${r.run_duration}分钟, 载客量: ${r.passenger_count}人`,
      检修结果: this.translateResult(r.result),
      备注: r.abnormal_conditions,
      处理人: r.operator,
      处理时间: r.run_time,
      最后处理人: ''
    }));

    const approvalData = approvalRecords.map((r, i) => ({
      批次号: '',
      缆车编号: '',
      缆车名称: '',
      检修日期: '',
      提交人: '',
      提交时间: '',
      当前状态: '',
      记录类型: this.translateStage(r.stage) + '审批',
      检修项目: this.translateStage(r.stage) + '审批',
      检修结果: this.translateResult(r.approval_result),
      备注: r.comment,
      处理人: r.approver,
      处理时间: r.approval_time,
      最后处理人: i === approvalRecords.length - 1 ? (batch.final_handler || '') : ''
    }));

    const allData = [...inspectionData, ...trialData, ...approvalData];

    const fields = [
      '批次号', '缆车编号', '缆车名称', '检修日期', '提交人', '提交时间',
      '当前状态', '记录类型', '检修项目', '检修结果', '备注',
      '处理人', '处理时间', '最后处理人'
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(allData);
  }

  static translateStatus(status) {
    const statusMap = {
      'pending': '待处理',
      'inspecting': '检修中',
      'trialing': '试运行中',
      'approving': '审批中',
      'passed': '已通过',
      'rejected': '已驳回'
    };
    return statusMap[status] || status;
  }

  static translateResult(result) {
    const resultMap = {
      'pass': '合格',
      'fail': '不合格'
    };
    return resultMap[result] || result;
  }

  static translateStage(stage) {
    const stageMap = {
      'inspection': '检修',
      'trial': '试运行',
      'final': '放行'
    };
    return stageMap[stage] || stage;
  }
}

module.exports = ExportService;
