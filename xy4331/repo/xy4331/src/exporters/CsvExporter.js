const { Parser } = require('json2csv');
const { allAsync } = require('../config/database');
const ValidationViolation = require('../models/ValidationViolation');
const SensorAlert = require('../models/SensorAlert');
const VeterinaryOrder = require('../models/VeterinaryOrder');
const TransferRecord = require('../models/TransferRecord');

class CsvExporter {
  static async exportRiskList(options = {}) {
    const { includeResolved = false, severity } = options;
    
    let violations;
    if (includeResolved) {
      violations = await ValidationViolation.findAll({ severity });
    } else {
      violations = await ValidationViolation.getOpenViolations();
    }

    const fields = [
      { label: '违规ID', value: 'id' },
      { label: '违规类型', value: 'violation_type' },
      { label: '严重级别', value: 'severity' },
      { label: '关联实体类型', value: 'related_entity_type' },
      { label: '关联实体ID', value: 'related_entity_id' },
      { label: '描述', value: 'description' },
      { label: '检测时间', value: 'detected_at' },
      { label: '状态', value: 'status' },
      { label: '复核人', value: 'reviewed_by' },
      { label: '复核时间', value: 'reviewed_at' },
      { label: '复核意见', value: 'review_comments' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(violations);
  }

  static async exportAlerts(options = {}) {
    const { status, cage_id, includeAll = false } = options;
    
    let alerts;
    if (includeAll) {
      alerts = await SensorAlert.findAll({ status, cage_id });
    } else {
      alerts = await SensorAlert.getOpenAlerts({ cage_id });
    }

    const fields = [
      { label: '告警ID', value: 'alert_id' },
      { label: '笼位ID', value: 'cage_id' },
      { label: '传感器类型', value: 'sensor_type' },
      { label: '阈值', value: 'threshold_value' },
      { label: '测量值', value: 'measured_value' },
      { label: '告警时间', value: 'alert_time' },
      { label: '严重级别', value: 'severity' },
      { label: '状态', value: 'status' },
      { label: '确认人', value: 'acknowledged_by' },
      { label: '确认时间', value: 'acknowledged_at' },
      { label: '解决说明', value: 'resolution_notes' },
      { label: '解决时间', value: 'resolved_at' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(alerts);
  }

  static async exportVeterinaryOrders(options = {}) {
    const { status, includeObserving = true } = options;
    
    let orders;
    if (status) {
      orders = await VeterinaryOrder.findAll({ status });
    } else if (includeObserving) {
      const observing = await VeterinaryOrder.getObservingOrders();
      const unsigned = await VeterinaryOrder.getUnsignedOrders();
      orders = [...observing, ...unsigned];
    } else {
      orders = await VeterinaryOrder.findAll();
    }

    const fields = [
      { label: '处置单ID', value: 'order_id' },
      { label: '动物ID', value: 'animal_id' },
      { label: '检查日期', value: 'examination_date' },
      { label: '症状', value: 'symptoms' },
      { label: '诊断', value: 'diagnosis' },
      { label: '治疗方案', value: 'treatment_plan' },
      { label: '用药', value: 'medications' },
      { label: '观察期(天)', value: 'observation_period_days' },
      { label: '观察开始日期', value: 'start_observation_date' },
      { label: '兽医签名', value: 'veterinarian_signature' },
      { label: '签名日期', value: 'signature_date' },
      { label: '状态', value: 'status' },
      { label: '备注', value: 'notes' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(orders);
  }

  static async exportTransfers(options = {}) {
    const { status, animal_id, startDate, endDate } = options;
    
    let sql = `SELECT tr.*, a.species, a.strain, a.gender
               FROM transfer_records tr
               JOIN animals a ON tr.animal_id = a.animal_id
               WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ' AND tr.status = ?';
      params.push(status);
    }
    if (animal_id) {
      sql += ' AND tr.animal_id = ?';
      params.push(animal_id);
    }
    if (startDate) {
      sql += ' AND tr.transfer_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND tr.transfer_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY tr.transfer_date DESC';

    const transfers = await allAsync(sql, params);

    const fields = [
      { label: '转笼ID', value: 'transfer_id' },
      { label: '动物ID', value: 'animal_id' },
      { label: '物种', value: 'species' },
      { label: '品系', value: 'strain' },
      { label: '性别', value: 'gender' },
      { label: '原笼位', value: 'from_cage_id' },
      { label: '新笼位', value: 'to_cage_id' },
      { label: '转笼日期', value: 'transfer_date' },
      { label: '转笼原因', value: 'transfer_reason' },
      { label: '操作人员', value: 'performed_by' },
      { label: '复核人', value: 'verified_by' },
      { label: '状态', value: 'status' },
      { label: '备注', value: 'notes' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(transfers);
  }

  static async exportAnimals(options = {}) {
    const { status, includeAll = false } = options;
    
    const Animal = require('../models/Animal');
    const animals = await Animal.findAll({ status });

    const enrichedAnimals = [];
    for (const animal of animals) {
      const timeline = await Animal.getTimeline(animal.animal_id);
      const cageOccupancy = await allAsync(
        `SELECT co.cage_id, co.start_date, c.rack_id, c.position
         FROM cage_occupancy co
         JOIN cages c ON co.cage_id = c.cage_id
         WHERE co.animal_id = ? AND co.is_active = 1
         LIMIT 1`,
        [animal.animal_id]
      );

      const currentCage = cageOccupancy.length > 0 ? cageOccupancy[0] : null;
      
      enrichedAnimals.push({
        ...animal,
        current_cage: currentCage?.cage_id || null,
        rack_id: currentCage?.rack_id || null,
        position: currentCage?.position || null,
        cage_since: currentCage?.start_date || null,
        total_events: timeline.length
      });
    }

    const fields = [
      { label: '动物ID', value: 'animal_id' },
      { label: '物种', value: 'species' },
      { label: '品系', value: 'strain' },
      { label: '性别', value: 'gender' },
      { label: '出生日期', value: 'birth_date' },
      { label: '入舍日期', value: 'arrival_date' },
      { label: '当前笼位', value: 'current_cage' },
      { label: '笼架', value: 'rack_id' },
      { label: '位置', value: 'position' },
      { label: '入笼时间', value: 'cage_since' },
      { label: '状态', value: 'status' },
      { label: '事件总数', value: 'total_events' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(enrichedAnimals);
  }

  static async exportCageStatus() {
    const Cage = require('../models/Cage');
    const cages = await Cage.findAll();

    const enrichedCages = [];
    for (const cage of cages) {
      const occupancy = await Cage.getActiveOccupancy(cage.cage_id);
      const recentInspections = await allAsync(
        `SELECT * FROM care_inspections 
         WHERE cage_id = ? 
         ORDER BY inspection_date DESC 
         LIMIT 1`,
        [cage.cage_id]
      );
      const recentAlerts = await allAsync(
        `SELECT COUNT(*) as count FROM sensor_alerts 
         WHERE cage_id = ? AND status IN ('open', 'acknowledged')`,
        [cage.cage_id]
      );

      enrichedCages.push({
        ...cage,
        current_animals: occupancy.map(o => o.animal_id).join(', ') || '无',
        occupancy_count: occupancy.length,
        last_inspection: recentInspections.length > 0 ? recentInspections[0].inspection_date : null,
        last_inspector: recentInspections.length > 0 ? recentInspections[0].inspector : null,
        open_alerts: recentAlerts[0]?.count || 0
      });
    }

    const fields = [
      { label: '笼位ID', value: 'cage_id' },
      { label: '笼架ID', value: 'rack_id' },
      { label: '位置', value: 'position' },
      { label: '最大容量', value: 'max_capacity' },
      { label: '当前数量', value: 'current_occupancy' },
      { label: '当前动物', value: 'current_animals' },
      { label: '状态', value: 'status' },
      { label: '最近巡检日期', value: 'last_inspection' },
      { label: '最近巡检人', value: 'last_inspector' },
      { label: '未闭环告警数', value: 'open_alerts' },
      { label: '备注', value: 'notes' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(enrichedCages);
  }

  static async exportDailyReport(options = {}) {
    const { date = new Date().toISOString().substring(0, 10) } = options;
    
    const Cage = require('../models/Cage');
    const CareInspection = require('../models/CareInspection');
    
    const alerts = await SensorAlert.getOpenAlerts();
    const violations = await ValidationViolation.getOpenViolations();
    const pendingTransfers = await TransferRecord.getPendingTransfers();
    const unsignedOrders = await VeterinaryOrder.getUnsignedOrders();
    const observingOrders = await VeterinaryOrder.getObservingOrders();
    const inspections = await CareInspection.getInspectionsByDateRange(date, date);

    const summary = {
      report_date: date,
      open_alerts_count: alerts.length,
      open_violations_count: violations.length,
      pending_transfers_count: pendingTransfers.length,
      unsigned_orders_count: unsignedOrders.length,
      observing_orders_count: observingOrders.length,
      inspections_today_count: inspections.length
    };

    const fields = [
      { label: '报告日期', value: 'report_date' },
      { label: '未闭环告警', value: 'open_alerts_count' },
      { label: '待处理违规', value: 'open_violations_count' },
      { label: '待执行转笼', value: 'pending_transfers_count' },
      { label: '待签署处置单', value: 'unsigned_orders_count' },
      { label: '观察中', value: 'observing_orders_count' },
      { label: '今日巡检数', value: 'inspections_today_count' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse([summary]);
  }
}

module.exports = CsvExporter;
