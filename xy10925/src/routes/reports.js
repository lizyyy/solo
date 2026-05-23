const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { Parser } = require('json2csv');
const { generateReport } = require('../services/qualificationService');

router.post('/:athleteId', async (req, res) => {
  try {
    const { generated_by } = req.body;
    const report = await generateReport(req.params.athleteId, generated_by);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  db.all('SELECT * FROM qualification_reports ORDER BY generated_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/export/csv', (req, res) => {
  db.all(`
    SELECT 
      a.id as athlete_id,
      a.name,
      a.id_card,
      g.name as group_name,
      ce.status as checkin_status,
      ce.checkin_time,
      ce.processing_result
    FROM athletes a
    LEFT JOIN groups g ON a.group_id = g.id
    LEFT JOIN checkin_events ce ON ce.id = (
      SELECT id FROM checkin_events 
      WHERE athlete_id = a.id 
      ORDER BY checkin_time DESC LIMIT 1
    )
    ORDER BY a.name
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(rows);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=checkin_report.csv');
    res.send(csv);
  });
});

router.get('/athlete/:athleteId', (req, res) => {
  db.all(
    'SELECT * FROM qualification_reports WHERE athlete_id = ? ORDER BY generated_at DESC',
    [req.params.athleteId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

module.exports = router;
