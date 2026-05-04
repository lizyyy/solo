const express = require('express');
const router = express.Router();
const DrillSession = require('../models/DrillSession');
const Floor = require('../models/Floor');
const Exit = require('../models/Exit');
const Person = require('../models/Person');
const FirePoint = require('../models/FirePoint');
const DrillEvent = require('../models/DrillEvent');
const RiskAssessment = require('../models/RiskAssessment');
const SimulationSnapshot = require('../models/SimulationSnapshot');
const BroadcastSchedule = require('../models/BroadcastSchedule');
const EvacuationSimulator = require('../services/EvacuationSimulator');
const RiskEvaluator = require('../services/RiskEvaluator');

const activeSimulators = new Map();

router.get('/', (req, res) => {
  try {
    const sessions = DrillSession.findAll();
    res.json({
      success: true,
      data: sessions.map(s => s.toJSON())
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/active', (req, res) => {
  try {
    const session = DrillSession.findActive();
    if (!session) {
      return res.json({
        success: true,
        data: null
      });
    }
    res.json({
      success: true,
      data: session.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const session = DrillSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const firePoints = FirePoint.findByDrillSessionId(session.id);
    const events = DrillEvent.findByDrillSessionId(session.id);
    const riskAssessments = RiskAssessment.findByDrillSessionId(session.id);
    const broadcasts = BroadcastSchedule.findByDrillSessionId(session.id);
    const snapshots = SimulationSnapshot.findByDrillSessionId(session.id);
    
    res.json({
      success: true,
      data: {
        session: session.toJSON(),
        firePoints: firePoints.map(fp => fp.toJSON()),
        events: events.map(e => e.toJSON()),
        riskAssessments: riskAssessments.map(ra => ra.toJSON()),
        broadcasts: broadcasts.map(b => b.toJSON()),
        snapshotCount: snapshots.length,
        personSummary: Person.getStatusSummary()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: name'
      });
    }
    
    const session = DrillSession.create({
      name,
      status: 'created',
      current_time_step: 0,
      is_paused: 0
    });
    
    res.status(201).json({
      success: true,
      data: session.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const session = DrillSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const simulator = new EvacuationSimulator(session.id);
    await simulator.initialize();
    activeSimulators.set(session.id, simulator);
    
    const startedSession = session.start();
    
    DrillEvent.create({
      drill_session_id: session.id,
      time_step: 0,
      event_type: 'drill_started',
      description: `演练 "${session.name}" 开始`,
      data: { sessionId: session.id }
    });
    
    const evaluator = new RiskEvaluator(session.id);
    await evaluator.initialize();
    const initialRisk = evaluator.evaluateAndSave(0);
    
    res.json({
      success: true,
      data: {
        session: startedSession.toJSON(),
        initialRisk
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/pause', (req, res) => {
  try {
    const session = DrillSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const pausedSession = session.pause();
    
    DrillEvent.create({
      drill_session_id: session.id,
      time_step: session.current_time_step,
      event_type: 'drill_paused',
      description: '演练已暂停',
      data: { timeStep: session.current_time_step }
    });
    
    res.json({
      success: true,
      data: pausedSession.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/resume', (req, res) => {
  try {
    const session = DrillSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const resumedSession = session.resume();
    
    DrillEvent.create({
      drill_session_id: session.id,
      time_step: session.current_time_step,
      event_type: 'drill_resumed',
      description: '演练已恢复',
      data: { timeStep: session.current_time_step }
    });
    
    res.json({
      success: true,
      data: resumedSession.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/step', async (req, res) => {
  try {
    const session = DrillSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    if (session.status !== 'running' && session.status !== 'paused') {
      return res.status(400).json({
        success: false,
        error: 'Drill is not running or paused'
      });
    }
    
    let simulator = activeSimulators.get(session.id);
    if (!simulator) {
      simulator = new EvacuationSimulator(session.id);
      await simulator.initialize();
      activeSimulators.set(session.id, simulator);
    }
    
    const stepResult = simulator.step();
    
    const evaluator = new RiskEvaluator(session.id);
    await evaluator.initialize();
    const riskAssessment = evaluator.evaluateAndSave(stepResult.timeStep);
    
    res.json({
      success: true,
      data: {
        stepResult,
        riskAssessment,
        state: simulator.getState()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/fire-point', async (req, res) => {
  try {
    const session = DrillSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const { floor_id, x, y, intensity, radius } = req.body;
    
    if (!floor_id || x === undefined || y === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: floor_id, x, y'
      });
    }
    
    const floor = Floor.findById(floor_id);
    if (!floor) {
      return res.status(404).json({
        success: false,
        error: 'Floor not found'
      });
    }
    
    let simulator = activeSimulators.get(session.id);
    if (!simulator && session.status === 'running') {
      simulator = new EvacuationSimulator(session.id);
      await simulator.initialize();
      activeSimulators.set(session.id, simulator);
    }
    
    const firePoint = FirePoint.create({
      drill_session_id: session.id,
      floor_id,
      x: parseFloat(x),
      y: parseFloat(y),
      intensity: intensity !== undefined ? parseFloat(intensity) : 1.0,
      radius: radius !== undefined ? parseFloat(radius) : 5.0,
      time_step: session.current_time_step
    });
    
    if (simulator) {
      simulator.firePoints.push(firePoint);
      simulator.updateExitsAvailability();
    }
    
    DrillEvent.create({
      drill_session_id: session.id,
      time_step: session.current_time_step,
      event_type: 'fire_detected',
      description: `在 ${floor.name} 检测到火情`,
      data: {
        floorId: floor_id,
        x: parseFloat(x),
        y: parseFloat(y),
        intensity: intensity || 1.0,
        radius: radius || 5.0
      }
    });
    
    res.json({
      success: true,
      data: firePoint.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/broadcasts', (req, res) => {
  try {
    const session = DrillSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const { broadcasts } = req.body;
    
    if (!broadcasts || !Array.isArray(broadcasts)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid broadcasts array'
      });
    }
    
    const schedulesData = broadcasts.map(b => ({
      drill_session_id: session.id,
      time_step: parseInt(b.time_step),
      message: b.message,
      is_broadcasted: 0
    }));
    
    const createdSchedules = BroadcastSchedule.bulkCreate(schedulesData);
    
    res.json({
      success: true,
      count: createdSchedules.length,
      data: createdSchedules.map(s => s.toJSON())
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/state', async (req, res) => {
  try {
    const session = DrillSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    let simulator = activeSimulators.get(session.id);
    if (!simulator) {
      simulator = new EvacuationSimulator(session.id);
      await simulator.initialize();
    }
    
    const state = simulator.getState();
    
    const latestRisk = RiskAssessment.findLatestByDrillSession(session.id);
    
    res.json({
      success: true,
      data: {
        state,
        latestRisk: latestRisk ? latestRisk.toJSON() : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/complete', (req, res) => {
  try {
    const session = DrillSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const completedSession = session.complete();
    
    DrillEvent.create({
      drill_session_id: session.id,
      time_step: session.current_time_step,
      event_type: 'drill_completed',
      description: '演练已完成',
      data: {
        totalSteps: session.current_time_step,
        personSummary: Person.getStatusSummary()
      }
    });
    
    activeSimulators.delete(session.id);
    
    res.json({
      success: true,
      data: completedSession.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const session = DrillSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    FirePoint.deleteByDrillSessionId(session.id);
    DrillEvent.deleteByDrillSessionId(session.id);
    RiskAssessment.deleteByDrillSessionId(session.id);
    BroadcastSchedule.deleteByDrillSessionId(session.id);
    SimulationSnapshot.deleteByDrillSessionId(session.id);
    
    activeSimulators.delete(session.id);
    
    DrillSession.delete(session.id);
    
    res.json({
      success: true,
      message: 'Drill session deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
