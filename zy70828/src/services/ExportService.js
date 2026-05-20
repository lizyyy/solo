const { Parser } = require('json2csv');
const TrackingRecordModel = require('../models/TrackingRecordModel');
const BedModel = require('../models/BedModel');
const PatientModel = require('../models/PatientModel');
const CleaningOrderModel = require('../models/CleaningOrderModel');

class ExportService {
  static async exportTrackingRecords(filters = {}, format = 'csv') {
    const records = await TrackingRecordModel.getHistory(filters);

    if (format === 'json') {
      return {
        data: records,
        count: records.length,
        contentType: 'application/json'
      };
    }

    const fields = [
      { label: '记录编号', value: 'record_no' },
      { label: '批次号', value: 'batch_no' },
      { label: '床位号', value: 'bed_no' },
      { label: '患者ID', value: 'patient_id' },
      { label: '患者姓名', value: 'patient_name' },
      { label: '病区', value: 'ward' },
      { label: '科室', value: 'department' },
      { label: '记录类型', value: 'record_type' },
      { label: '状态', value: 'status' },
      { label: '原因', value: 'reason' },
      { label: '处理人', value: 'handler' },
      { label: '处理时间', value: 'handled_at' },
      { label: '备注', value: 'remarks' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);

    return {
      data: csv,
      count: records.length,
      contentType: 'text/csv'
    };
  }

  static async exportBedStatus(ward = null) {
    let beds;
    if (ward) {
      beds = await BedModel.findByWard(ward);
    } else {
      beds = await BedModel.getAll();
    }

    const fields = [
      { label: '床位号', value: 'bed_no' },
      { label: '病区', value: 'ward' },
      { label: '科室', value: 'department' },
      { label: '状态', value: 'status' },
      { label: '占用患者ID', value: 'patient_id' },
      { label: '更新时间', value: 'updated_at' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(beds);

    return {
      data: csv,
      count: beds.length,
      contentType: 'text/csv'
    };
  }

  static async exportCleaningOrders(status = null) {
    let orders;
    if (status) {
      orders = await CleaningOrderModel.getAll();
      orders = orders.filter(o => o.status === status);
    } else {
      orders = await CleaningOrderModel.getAll();
    }

    const fields = [
      { label: '工单编号', value: 'order_id' },
      { label: '床位号', value: 'bed_no' },
      { label: '病区', value: 'ward' },
      { label: '负责人', value: 'assigned_to' },
      { label: '状态', value: 'status' },
      { label: '是否超时', value: row => row.is_timeout ? '是' : '否' },
      { label: '创建时间', value: 'created_at' },
      { label: '开始时间', value: 'started_at' },
      { label: '完成时间', value: 'completed_at' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(orders);

    return {
      data: csv,
      count: orders.length,
      contentType: 'text/csv'
    };
  }

  static async exportPatientOutcome(department = null) {
    let patients = await PatientModel.getAll();
    if (department) {
      patients = patients.filter(p => 
        p.to_department === department || p.from_department === department
      );
    }

    const fields = [
      { label: '患者ID', value: 'patient_id' },
      { label: '姓名', value: 'name' },
      { label: '性别', value: 'gender' },
      { label: '年龄', value: 'age' },
      { label: '诊断', value: 'diagnosis' },
      { label: '转出科室', value: 'from_department' },
      { label: '转入科室', value: 'to_department' },
      { label: '状态', value: 'status' },
      { label: '创建时间', value: 'created_at' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(patients);

    return {
      data: csv,
      count: patients.length,
      contentType: 'text/csv'
    };
  }
}

module.exports = ExportService;
