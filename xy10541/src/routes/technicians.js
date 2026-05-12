const express = require('express');
const router = express.Router();
const TechnicianService = require('../services/technicianService');
const store = require('../stores/memoryStore');

router.get('/', (req, res) => {
  try {
    const techs = store.listTechnicians();
    res.json({
      success: true,
      data: techs.map(t => ({
        id: t.id,
        name: t.name,
        phone: t.phone,
        skills: t.skills,
        scheduleCount: t.schedule.filter(s => s.status === 'active').length
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const tech = store.getTechnician(req.params.id);
    if (!tech) {
      return res.status(404).json({ success: false, error: '师傅不存在' });
    }
    res.json({ success: true, data: tech });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/check-availability', (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    const result = TechnicianService.checkAvailability(req.params.id, startTime, endTime);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/workload', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: '缺少 startDate 或 endDate 参数'
      });
    }

    const workload = TechnicianService.getTechnicianWorkload(
      req.params.id,
      startDate,
      endDate
    );

    if (!workload) {
      return res.status(404).json({ success: false, error: '师傅不存在' });
    }

    res.json({ success: true, data: workload });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
