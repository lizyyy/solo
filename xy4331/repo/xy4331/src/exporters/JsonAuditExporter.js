const { v4: uuidv4 } = require('uuid');
const { allAsync, getAsync } = require('../config/database');
const Animal = require('../models/Animal');
const Cage = require('../models/Cage');
const SensorAlert = require('../models/SensorAlert');
const TransferRecord = require('../models/TransferRecord');
const VeterinaryOrder = require('../models/VeterinaryOrder');
const CareInspection = require('../models/CareInspection');
const ValidationViolation = require('../models/ValidationViolation');

class JsonAuditExporter {
  static async generateAuditPackage(options = {}) {
    const { 
      startDate, 
      endDate, 
      includeAnimals = true,
      includeCages = true,
      includeAlerts = true,
      includeTransfers = true,
      includeVeterinary = true,
      includeInspections = true,
      includeViolations = true,
      includeTimelines = true,
      includeAuditLogs = true
    } = options;

    const packageId = uuidv4();
    const generatedAt = new Date().toISOString();

    const auditPackage = {
      package_id: packageId,
      generated_at: generatedAt,
      version: '1.0.0',
      system: 'Cage Health Event Arbitrator',
      metadata: {
        date_range: {
          start: startDate || null,
          end: endDate || null
        },
        included_modules: {
          animals: includeAnimals,
          cages: includeCages,
          sensor_alerts: includeAlerts,
          transfer_records: includeTransfers,
          veterinary_orders: includeVeterinary,
          care_inspections: includeInspections,
          validation_violations: includeViolations,
          animal_timelines: includeTimelines,
          audit_logs: includeAuditLogs
        }
      },
      data: {}
    };

    if (includeAnimals) {
      auditPackage.data.animals = await this.getAnimalsData(startDate, endDate);
    }

    if (includeCages) {
      auditPackage.data.cages = await this.getCagesData();
    }

    if (includeAlerts) {
      auditPackage.data.sensor_alerts = await this.getAlertsData(startDate, endDate);
    }

    if (includeTransfers) {
      auditPackage.data.transfer_records = await this.getTransfersData(startDate, endDate);
    }

    if (includeVeterinary) {
      auditPackage.data.veterinary_orders = await this.getVeterinaryData(startDate, endDate);
    }

    if (includeInspections) {
      auditPackage.data.care_inspections = await this.getInspectionsData(startDate, endDate);
    }

    if (includeViolations) {
      auditPackage.data.validation_violations = await this.getViolationsData(startDate, endDate);
      auditPackage.data.review_decisions = await this.getReviewDecisionsData();
    }

    if (includeTimelines && includeAnimals) {
      auditPackage.data.animal_timelines = await this.getTimelinesData(auditPackage.data.animals);
    }

    if (includeAuditLogs) {
      auditPackage.data.audit_logs = await this.getAuditLogsData(startDate, endDate);
    }

    auditPackage.statistics = await this.calculateStatistics(auditPackage.data);
    auditPackage.checksum = this.generateChecksum(auditPackage);

    return auditPackage;
  }

  static async getAnimalsData(startDate, endDate) {
    let sql = `SELECT * FROM animals WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND arrival_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND (arrival_date <= ? OR status != "active")';
      params.push(endDate);
    }

    sql += ' ORDER BY arrival_date ASC';

    const animals = await allAsync(sql, params);
    
    return animals.map(animal => ({
      id: animal.id,
      animal_id: animal.animal_id,
      species: animal.species,
      strain: animal.strain,
      gender: animal.gender,
      birth_date: animal.birth_date,
      arrival_date: animal.arrival_date,
      status: animal.status,
      created_at: animal.created_at,
      updated_at: animal.updated_at
    }));
  }

  static async getCagesData() {
    const cages = await allAsync('SELECT * FROM cages ORDER BY rack_id, position');
    
    const enrichedCages = [];
    for (const cage of cages) {
      const occupancy = await allAsync(
        `SELECT co.animal_id, co.start_date, a.species, a.strain
         FROM cage_occupancy co
         JOIN animals a ON co.animal_id = a.animal_id
         WHERE co.cage_id = ? AND co.is_active = 1`,
        [cage.cage_id]
      );

      enrichedCages.push({
        id: cage.id,
        cage_id: cage.cage_id,
        rack_id: cage.rack_id,
        position: cage.position,
        max_capacity: cage.max_capacity,
        current_occupancy: cage.current_occupancy,
        status: cage.status,
        notes: cage.notes,
        current_animals: occupancy.map(o => ({
          animal_id: o.animal_id,
          species: o.species,
          strain: o.strain,
          since: o.start_date
        })),
        created_at: cage.created_at,
        updated_at: cage.updated_at
      });
    }

    return enrichedCages;
  }

  static async getAlertsData(startDate, endDate) {
    let sql = `SELECT * FROM sensor_alerts WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND alert_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND alert_time <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY alert_time ASC';

    const alerts = await allAsync(sql, params);
    
    return alerts.map(alert => ({
      id: alert.id,
      alert_id: alert.alert_id,
      cage_id: alert.cage_id,
      sensor_type: alert.sensor_type,
      threshold_value: alert.threshold_value,
      measured_value: alert.measured_value,
      alert_time: alert.alert_time,
      severity: alert.severity,
      status: alert.status,
      acknowledged_by: alert.acknowledged_by,
      acknowledged_at: alert.acknowledged_at,
      resolution_notes: alert.resolution_notes,
      resolved_at: alert.resolved_at,
      created_at: alert.created_at
    }));
  }

  static async getTransfersData(startDate, endDate) {
    let sql = `SELECT tr.*, a.species, a.strain, a.gender
               FROM transfer_records tr
               JOIN animals a ON tr.animal_id = a.animal_id
               WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND transfer_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND transfer_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY transfer_date ASC';

    const transfers = await allAsync(sql, params);
    
    return transfers.map(transfer => ({
      id: transfer.id,
      transfer_id: transfer.transfer_id,
      animal_id: transfer.animal_id,
      animal_info: {
        species: transfer.species,
        strain: transfer.strain,
        gender: transfer.gender
      },
      from_cage_id: transfer.from_cage_id,
      to_cage_id: transfer.to_cage_id,
      transfer_date: transfer.transfer_date,
      transfer_reason: transfer.transfer_reason,
      performed_by: transfer.performed_by,
      verified_by: transfer.verified_by,
      notes: transfer.notes,
      status: transfer.status,
      created_at: transfer.created_at
    }));
  }

  static async getVeterinaryData(startDate, endDate) {
    let sql = `SELECT vo.*, a.species, a.strain, a.gender
               FROM veterinary_orders vo
               JOIN animals a ON vo.animal_id = a.animal_id
               WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND examination_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND examination_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY examination_date ASC';

    const orders = await allAsync(sql, params);
    
    return orders.map(order => ({
      id: order.id,
      order_id: order.order_id,
      animal_id: order.animal_id,
      animal_info: {
        species: order.species,
        strain: order.strain,
        gender: order.gender
      },
      examination_date: order.examination_date,
      symptoms: order.symptoms,
      diagnosis: order.diagnosis,
      treatment_plan: order.treatment_plan,
      medications: order.medications,
      observation_period_days: order.observation_period_days,
      start_observation_date: order.start_observation_date,
      veterinarian_signature: order.veterinarian_signature,
      signature_date: order.signature_date,
      status: order.status,
      notes: order.notes,
      created_at: order.created_at
    }));
  }

  static async getInspectionsData(startDate, endDate) {
    let sql = `SELECT ci.*, c.rack_id, c.position
               FROM care_inspections ci
               JOIN cages c ON ci.cage_id = c.cage_id
               WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND inspection_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND inspection_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY inspection_date ASC';

    const inspections = await allAsync(sql, params);
    
    return inspections.map(inspection => ({
      id: inspection.id,
      inspection_id: inspection.inspection_id,
      cage_id: inspection.cage_id,
      cage_info: {
        rack_id: inspection.rack_id,
        position: inspection.position
      },
      inspection_date: inspection.inspection_date,
      inspector: inspection.inspector,
      general_condition: inspection.general_condition,
      food_level: inspection.food_level,
      water_level: inspection.water_level,
      bedding_condition: inspection.bedding_condition,
      abnormal_signs: inspection.abnormal_signs,
      actions_taken: inspection.actions_taken,
      status: inspection.status,
      notes: inspection.notes,
      created_at: inspection.created_at
    }));
  }

  static async getViolationsData(startDate, endDate) {
    let sql = `SELECT * FROM validation_violations WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND detected_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND detected_at <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY detected_at ASC';

    const violations = await allAsync(sql, params);
    
    return violations.map(violation => ({
      id: violation.id,
      violation_type: violation.violation_type,
      severity: violation.severity,
      related_entity_type: violation.related_entity_type,
      related_entity_id: violation.related_entity_id,
      description: violation.description,
      detected_at: violation.detected_at,
      status: violation.status,
      reviewed_by: violation.reviewed_by,
      reviewed_at: violation.reviewed_at,
      review_comments: violation.review_comments,
      resolution_notes: violation.resolution_notes,
      resolved_at: violation.resolved_at
    }));
  }

  static async getReviewDecisionsData() {
    const decisions = await allAsync(`
      SELECT rd.*, vv.violation_type, vv.description as violation_description
      FROM review_decisions rd
      JOIN validation_violations vv ON rd.violation_id = vv.id
      ORDER BY rd.created_at ASC
    `);
    
    return decisions.map(decision => ({
      id: decision.id,
      violation_id: decision.violation_id,
      violation_info: {
        type: decision.violation_type,
        description: decision.violation_description
      },
      reviewer: decision.reviewer,
      decision: decision.decision,
      comments: decision.comments,
      action_items: decision.action_items ? JSON.parse(decision.action_items) : null,
      created_at: decision.created_at
    }));
  }

  static async getTimelinesData(animals) {
    const allTimelines = {};
    
    for (const animal of animals) {
      const timeline = await allAsync(
        `SELECT * FROM animal_timelines 
         WHERE animal_id = ? 
         ORDER BY event_time ASC`,
        [animal.animal_id]
      );

      allTimelines[animal.animal_id] = timeline.map(event => ({
        id: event.id,
        event_type: event.event_type,
        event_id: event.event_id,
        event_time: event.event_time,
        description: event.description,
        metadata: event.metadata ? JSON.parse(event.metadata) : null
      }));
    }

    return allTimelines;
  }

  static async getAuditLogsData(startDate, endDate) {
    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND performed_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND performed_at <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY performed_at ASC';

    const logs = await allAsync(sql, params);
    
    return logs.map(log => ({
      id: log.id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null,
      performed_by: log.performed_by,
      performed_at: log.performed_at,
      ip_address: log.ip_address,
      user_agent: log.user_agent
    }));
  }

  static async calculateStatistics(data) {
    const stats = {
      animals: {
        total: data.animals?.length || 0,
        active: data.animals?.filter(a => a.status === 'active').length || 0
      },
      cages: {
        total: data.cages?.length || 0,
        occupied: data.cages?.filter(c => c.current_occupancy > 0).length || 0
      },
      sensor_alerts: {
        total: data.sensor_alerts?.length || 0,
        open: data.sensor_alerts?.filter(a => a.status === 'open' || a.status === 'acknowledged').length || 0,
        resolved: data.sensor_alerts?.filter(a => a.status === 'resolved').length || 0
      },
      transfers: {
        total: data.transfer_records?.length || 0,
        completed: data.transfer_records?.filter(t => t.status === 'completed').length || 0,
        pending: data.transfer_records?.filter(t => t.status === 'pending').length || 0
      },
      veterinary_orders: {
        total: data.veterinary_orders?.length || 0,
        observing: data.veterinary_orders?.filter(o => o.status === 'observing').length || 0,
        unsigned: data.veterinary_orders?.filter(o => !o.veterinarian_signature).length || 0
      },
      violations: {
        total: data.validation_violations?.length || 0,
        open: data.validation_violations?.filter(v => v.status === 'open').length || 0,
        resolved: data.validation_violations?.filter(v => v.status === 'resolved').length || 0,
        dismissed: data.validation_violations?.filter(v => v.status === 'dismissed').length || 0
      }
    };

    return stats;
  }

  static generateChecksum(packageData) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    
    const dataToHash = JSON.stringify({
      package_id: packageData.package_id,
      generated_at: packageData.generated_at,
      statistics: packageData.statistics
    });
    
    hash.update(dataToHash);
    return hash.digest('hex');
  }

  static async exportAnimalAudit(animalId) {
    const animal = await Animal.findByAnimalId(animalId);
    
    if (!animal) {
      throw new Error(`动物不存在: ${animalId}`);
    }

    const timeline = await Animal.getTimeline(animalId);
    const transfers = await TransferRecord.getAnimalTransferHistory(animalId);
    const orders = await VeterinaryOrder.getAnimalOrders(animalId);

    const cageOccupancy = await allAsync(
      `SELECT co.*, c.rack_id, c.position
       FROM cage_occupancy co
       JOIN cages c ON co.cage_id = c.cage_id
       WHERE co.animal_id = ?
       ORDER BY co.start_date ASC`,
      [animalId]
    );

    return {
      package_id: uuidv4(),
      generated_at: new Date().toISOString(),
      type: 'animal_audit',
      animal: {
        id: animal.id,
        animal_id: animal.animal_id,
        species: animal.species,
        strain: animal.strain,
        gender: animal.gender,
        birth_date: animal.birth_date,
        arrival_date: animal.arrival_date,
        status: animal.status
      },
      cage_history: cageOccupancy.map(co => ({
        cage_id: co.cage_id,
        rack_id: co.rack_id,
        position: co.position,
        start_date: co.start_date,
        end_date: co.end_date,
        is_active: co.is_active === 1,
        transfer_reason: co.transfer_reason
      })),
      transfer_records: transfers.map(t => ({
        transfer_id: t.transfer_id,
        from_cage_id: t.from_cage_id,
        to_cage_id: t.to_cage_id,
        transfer_date: t.transfer_date,
        reason: t.transfer_reason,
        status: t.status
      })),
      veterinary_history: orders.map(o => ({
        order_id: o.order_id,
        examination_date: o.examination_date,
        diagnosis: o.diagnosis,
        observation_period_days: o.observation_period_days,
        status: o.status,
        veterinarian_signature: o.veterinarian_signature
      })),
      timeline: timeline.map(e => ({
        event_type: e.event_type,
        event_time: e.event_time,
        description: e.description,
        metadata: e.metadata ? JSON.parse(e.metadata) : null
      }))
    };
  }
}

module.exports = JsonAuditExporter;
