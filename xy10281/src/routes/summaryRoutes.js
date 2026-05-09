const express = require('express');
const router = express.Router();
const FishGroupDao = require('../daos/fishGroupDao');
const TankDao = require('../daos/tankDao');
const QuarantineSessionDao = require('../daos/quarantineSessionDao');
const TreatmentRecordDao = require('../daos/treatmentRecordDao');
const TransferTransactionDao = require('../daos/transferTransactionDao');
const RiskReportDao = require('../daos/riskReportDao');

router.get('/dashboard', async (req, res) => {
  try {
    const [
      fishGroups,
      tanks,
      activeSessions,
      allSessions,
      treatments,
      transfers,
      reports
    ] = await Promise.all([
      FishGroupDao.all(),
      TankDao.all(),
      QuarantineSessionDao.all(true),
      QuarantineSessionDao.all(false),
      TreatmentRecordDao.all(),
      TransferTransactionDao.all(),
      RiskReportDao.all(true)
    ]);

    const summary = {
      fishGroups: {
        total: fishGroups.length,
        byHealthStatus: fishGroups.reduce((acc, fg) => {
          acc[fg.health_status] = (acc[fg.health_status] || 0) + 1;
          return acc;
        }, {}),
        byQuarantineStatus: fishGroups.reduce((acc, fg) => {
          acc[fg.quarantine_status] = (acc[fg.quarantine_status] || 0) + 1;
          return acc;
        }, {}),
        totalFish: fishGroups.reduce((sum, fg) => sum + fg.count, 0)
      },
      tanks: {
        total: tanks.length,
        byType: tanks.reduce((acc, tank) => {
          acc[tank.type] = (acc[tank.type] || 0) + 1;
          return acc;
        }, {}),
        quarantineReady: tanks.filter(t => t.is_quarantine_ready === 1).length,
        totalCapacity: tanks.reduce((sum, t) => sum + t.capacity, 0),
        usedCapacity: tanks.reduce((sum, t) => sum + t.current_occupancy, 0),
        utilizationRate: tanks.reduce((sum, t) => sum + t.capacity, 0) > 0
          ? Math.round((tanks.reduce((sum, t) => sum + t.current_occupancy, 0) / tanks.reduce((sum, t) => sum + t.capacity, 0)) * 100)
          : 0
      },
      sessions: {
        total: allSessions.length,
        active: activeSessions.length,
        completed: allSessions.filter(s => s.status === 'completed').length,
        cancelled: allSessions.filter(s => s.status === 'cancelled').length
      },
      treatments: {
        total: treatments.length,
        byStatus: treatments.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {})
      },
      transfers: {
        total: transfers.length,
        byStatus: transfers.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {})
      },
      riskReports: {
        unresolved: reports.length,
        byRiskLevel: reports.reduce((acc, r) => {
          acc[r.risk_level] = (acc[r.risk_level] || 0) + 1;
          return acc;
        }, {}),
        highRiskCount: reports.filter(r => ['high', 'critical'].includes(r.risk_level)).length
      }
    };

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fish-group/:id/history', async (req, res) => {
  try {
    const fishGroup = await FishGroupDao.getById(req.params.id);
    if (!fishGroup) {
      return res.status(404).json({ error: '鱼群不存在' });
    }

    const [treatments, transfers, reports, sessions] = await Promise.all([
      TreatmentRecordDao.getByFishGroupId(req.params.id),
      TransferTransactionDao.getByFishGroupId(req.params.id),
      RiskReportDao.getByFishGroupId(req.params.id, true),
      QuarantineSessionDao.all(false).then(s => s.filter(session => session.fish_group_id === req.params.id))
    ]);

    const history = {
      fishGroup,
      timeline: [
        ...treatments.map(t => ({
          type: 'treatment',
          id: t.id,
          date: t.created_at,
          disease: t.disease,
          status: t.status
        })),
        ...transfers.map(t => ({
          type: 'transfer',
          id: t.id,
          date: t.created_at,
          fromTank: t.from_tank_id,
          toTank: t.to_tank_id,
          count: t.transfer_count,
          reason: t.reason,
          status: t.status
        })),
        ...reports.map(r => ({
          type: 'risk_report',
          id: r.id,
          date: r.created_at,
          riskLevel: r.risk_level,
          disease: r.disease,
          isResolved: r.is_resolved === 1
        })),
        ...sessions.map(s => ({
          type: 'quarantine_session',
          id: s.id,
          date: s.created_at,
          tank: s.tank_id,
          disease: s.disease,
          status: s.status
        }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date))
    };

    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tank/:id/occupancy', async (req, res) => {
  try {
    const tank = await TankDao.getById(req.params.id);
    if (!tank) {
      return res.status(404).json({ error: '缸体不存在' });
    }

    const fishGroups = await FishGroupDao.all();
    const occupants = fishGroups.filter(fg => fg.tank_id === req.params.id);

    const transfers = await TransferTransactionDao.all();
    const tankTransfers = transfers.filter(t => 
      t.from_tank_id === req.params.id || t.to_tank_id === req.params.id
    );

    res.json({ 
      success: true, 
      data: {
        tank,
        currentOccupants: occupants,
        transferHistory: tankTransfers,
        availableCapacity: tank.capacity - tank.current_occupancy
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/risks', async (req, res) => {
  try {
    const { includeResolved } = req.query;
    const reports = await RiskReportDao.all(includeResolved === 'true');
    
    const aggregated = {
      totalReports: reports.length,
      byRiskLevel: reports.reduce((acc, r) => {
        acc[r.risk_level] = (acc[r.risk_level] || 0) + 1;
        return acc;
      }, {}),
      reports: reports
    };

    res.json({ success: true, data: aggregated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
