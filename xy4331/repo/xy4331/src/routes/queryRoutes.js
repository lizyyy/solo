const express = require('express');
const router = express.Router();
const Animal = require('../models/Animal');
const Cage = require('../models/Cage');
const SensorAlert = require('../models/SensorAlert');
const TransferRecord = require('../models/TransferRecord');
const VeterinaryOrder = require('../models/VeterinaryOrder');
const CareInspection = require('../models/CareInspection');
const ValidationViolation = require('../models/ValidationViolation');
const RuleEngine = require('../rules/RuleEngine');
const { allAsync } = require('../config/database');

router.get('/animals', async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;
    
    const animals = await Animal.findAll({ 
      status, 
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    });

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

      enrichedAnimals.push({
        ...animal,
        current_cage: cageOccupancy.length > 0 ? {
          cage_id: cageOccupancy[0].cage_id,
          rack_id: cageOccupancy[0].rack_id,
          position: cageOccupancy[0].position,
          since: cageOccupancy[0].start_date
        } : null,
        event_count: timeline.length
      });
    }

    res.json({
      success: true,
      data: enrichedAnimals,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: enrichedAnimals.length
      }
    });

  } catch (error) {
    console.error('查询动物列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/animals/:animalId', async (req, res) => {
  try {
    const { animalId } = req.params;
    
    const animal = await Animal.findByAnimalId(animalId);
    
    if (!animal) {
      return res.status(404).json({ 
        success: false, 
        error: '动物不存在' 
      });
    }

    const timeline = await Animal.getTimeline(animalId);
    const transfers = await TransferRecord.getAnimalTransferHistory(animalId);
    const orders = await VeterinaryOrder.getAnimalOrders(animalId);
    
    const cageOccupancy = await allAsync(
      `SELECT co.cage_id, co.start_date, co.end_date, co.is_active,
              c.rack_id, c.position
       FROM cage_occupancy co
       JOIN cages c ON co.cage_id = c.cage_id
       WHERE co.animal_id = ?
       ORDER BY co.start_date DESC`,
      [animalId]
    );

    const violations = await ValidationViolation.getByRelatedEntity('animal', animalId);

    res.json({
      success: true,
      data: {
        basic_info: animal,
        current_cage: cageOccupancy.find(c => c.is_active === 1) || null,
        cage_history: cageOccupancy,
        timeline: timeline,
        transfers: transfers,
        veterinary_orders: orders,
        related_violations: violations
      }
    });

  } catch (error) {
    console.error('查询动物详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/cages', async (req, res) => {
  try {
    const { status, rack_id, limit = 100, offset = 0 } = req.query;
    
    const cages = await Cage.findAll({ 
      status, 
      rack_id,
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    });

    const enrichedCages = [];
    for (const cage of cages) {
      const occupancy = await Cage.getActiveOccupancy(cage.cage_id);
      const recentInspections = await allAsync(
        `SELECT * FROM care_inspections 
         WHERE cage_id = ? 
         ORDER BY inspection_date DESC 
         LIMIT 3`,
        [cage.cage_id]
      );
      const openAlerts = await allAsync(
        `SELECT * FROM sensor_alerts 
         WHERE cage_id = ? AND status IN ('open', 'acknowledged')
         ORDER BY alert_time DESC`,
        [cage.cage_id]
      );

      enrichedCages.push({
        ...cage,
        current_occupants: occupancy,
        occupancy_count: occupancy.length,
        recent_inspections: recentInspections,
        open_alerts: openAlerts
      });
    }

    res.json({
      success: true,
      data: enrichedCages,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: enrichedCages.length
      }
    });

  } catch (error) {
    console.error('查询笼位列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/cages/:cageId', async (req, res) => {
  try {
    const { cageId } = req.params;
    
    const cage = await Cage.findByCageId(cageId);
    
    if (!cage) {
      return res.status(404).json({ 
        success: false, 
        error: '笼位不存在' 
      });
    }

    const occupancy = await Cage.getActiveOccupancy(cageId);
    const inspectionHistory = await CareInspection.getCageInspectionHistory(cageId);
    const alerts = await allAsync(
      `SELECT * FROM sensor_alerts 
       WHERE cage_id = ?
       ORDER BY alert_time DESC`,
      [cageId]
    );

    const occupancyHistory = await allAsync(
      `SELECT co.*, a.animal_id, a.species, a.strain
       FROM cage_occupancy co
       JOIN animals a ON co.animal_id = a.animal_id
       WHERE co.cage_id = ?
       ORDER BY co.start_date DESC`,
      [cageId]
    );

    res.json({
      success: true,
      data: {
        basic_info: cage,
        current_occupants: occupancy,
        occupancy_history: occupancyHistory,
        inspection_history: inspectionHistory,
        alerts: alerts
      }
    });

  } catch (error) {
    console.error('查询笼位详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const { status, cage_id, severity, limit = 100, offset = 0 } = req.query;
    
    const alerts = await SensorAlert.findAll({ 
      status, 
      cage_id, 
      severity,
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    });

    res.json({
      success: true,
      data: alerts,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: alerts.length
      }
    });

  } catch (error) {
    console.error('查询告警列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/alerts/open', async (req, res) => {
  try {
    const { cage_id, limit = 100, offset = 0 } = req.query;
    
    const alerts = await SensorAlert.getOpenAlerts({ 
      cage_id, 
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    });

    const stats = {
      total: alerts.length,
      by_severity: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
      }
    };

    res.json({
      success: true,
      statistics: stats,
      data: alerts
    });

  } catch (error) {
    console.error('查询未闭环告警失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/alerts/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    const alert = await SensorAlert.findByAlertId(alertId);
    
    if (!alert) {
      return res.status(404).json({ 
        success: false, 
        error: '告警不存在' 
      });
    }

    res.json({
      success: true,
      data: alert
    });

  } catch (error) {
    console.error('查询告警详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/transfers', async (req, res) => {
  try {
    const { status, animal_id, limit = 100, offset = 0 } = req.query;
    
    const transfers = await TransferRecord.findAll({ 
      status, 
      animal_id,
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    });

    res.json({
      success: true,
      data: transfers,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: transfers.length
      }
    });

  } catch (error) {
    console.error('查询转笼记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/transfers/pending', async (req, res) => {
  try {
    const transfers = await TransferRecord.getPendingTransfers();

    res.json({
      success: true,
      count: transfers.length,
      data: transfers
    });

  } catch (error) {
    console.error('查询待处理转笼失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/veterinary-orders', async (req, res) => {
  try {
    const { status, animal_id, limit = 100, offset = 0 } = req.query;
    
    const orders = await VeterinaryOrder.findAll({ 
      status, 
      animal_id,
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    });

    res.json({
      success: true,
      data: orders,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: orders.length
      }
    });

  } catch (error) {
    console.error('查询处置单列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/veterinary-orders/unsigned', async (req, res) => {
  try {
    const orders = await VeterinaryOrder.getUnsignedOrders();

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });

  } catch (error) {
    console.error('查询待签署处置单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/veterinary-orders/observing', async (req, res) => {
  try {
    const orders = await VeterinaryOrder.getObservingOrders();

    const enrichedOrders = orders.map(order => {
      const startDate = new Date(order.start_observation_date);
      const now = new Date();
      const daysObserved = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
      const daysOverdue = daysObserved - order.observation_period_days;

      return {
        ...order,
        days_observed: daysObserved,
        days_overdue: daysOverdue,
        is_overdue: daysOverdue > 0
      };
    });

    res.json({
      success: true,
      count: enrichedOrders.length,
      overdue_count: enrichedOrders.filter(o => o.is_overdue).length,
      data: enrichedOrders
    });

  } catch (error) {
    console.error('查询观察中处置单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/inspections', async (req, res) => {
  try {
    const { cage_id, inspector, status, limit = 100, offset = 0 } = req.query;
    
    const inspections = await CareInspection.findAll({ 
      cage_id, 
      inspector, 
      status,
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    });

    res.json({
      success: true,
      data: inspections,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: inspections.length
      }
    });

  } catch (error) {
    console.error('查询巡检记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/violations', async (req, res) => {
  try {
    const { status, violation_type, severity, limit = 100, offset = 0 } = req.query;
    
    const violations = await ValidationViolation.findAll({ 
      status, 
      violation_type, 
      severity,
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    });

    res.json({
      success: true,
      data: violations,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: violations.length
      }
    });

  } catch (error) {
    console.error('查询违规记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/violations/open', async (req, res) => {
  try {
    const violations = await ValidationViolation.getOpenViolations();
    const stats = await ValidationViolation.getStatistics();

    res.json({
      success: true,
      statistics: stats,
      count: violations.length,
      data: violations
    });

  } catch (error) {
    console.error('查询待处理违规失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/violations/:violationId', async (req, res) => {
  try {
    const { violationId } = req.params;
    
    const violation = await ValidationViolation.findById(violationId);
    
    if (!violation) {
      return res.status(404).json({ 
        success: false, 
        error: '违规记录不存在' 
      });
    }

    const reviewDecisions = await allAsync(
      `SELECT * FROM review_decisions 
       WHERE violation_id = ?
       ORDER BY created_at DESC`,
      [violationId]
    );

    res.json({
      success: true,
      data: {
        violation: violation,
        review_decisions: reviewDecisions
      }
    });

  } catch (error) {
    console.error('查询违规详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const [
      openAlerts,
      openViolations,
      pendingTransfers,
      unsignedOrders,
      observingOrders,
      stats
    ] = await Promise.all([
      SensorAlert.getUnclosedCount(),
      ValidationViolation.getStatistics(),
      TransferRecord.getPendingTransfers(),
      VeterinaryOrder.getUnsignedOrders(),
      VeterinaryOrder.getObservingOrders(),
      allAsync(`SELECT 
        (SELECT COUNT(*) FROM animals WHERE status = 'active') as active_animals,
        (SELECT COUNT(*) FROM cages) as total_cages,
        (SELECT COUNT(*) FROM sensor_alerts WHERE status IN ('open', 'acknowledged')) as open_alerts
      `)
    ]);

    const overdueObserving = observingOrders.filter(order => {
      const startDate = new Date(order.start_observation_date);
      const now = new Date();
      const daysObserved = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
      return daysObserved > order.observation_period_days;
    });

    res.json({
      success: true,
      data: {
        overview: {
          active_animals: stats[0]?.active_animals || 0,
          total_cages: stats[0]?.total_cages || 0,
          open_alerts: stats[0]?.open_alerts || 0
        },
        alerts: {
          open_count: openAlerts
        },
        violations: stats,
        transfers: {
          pending_count: pendingTransfers.length
        },
        veterinary: {
          unsigned_count: unsignedOrders.length,
          observing_count: observingOrders.length,
          overdue_count: overdueObserving.length
        }
      }
    });

  } catch (error) {
    console.error('查询仪表板数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rules/run-all', async (req, res) => {
  try {
    const result = await RuleEngine.runAllRules();

    res.json({
      success: true,
      statistics: result.statistics,
      new_violations: result.violations
    });

  } catch (error) {
    console.error('运行规则引擎失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
