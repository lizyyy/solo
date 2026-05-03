const express = require('express');
const router = express.Router();

module.exports = (exporter) => {
  router.get('/:format', (req, res) => {
    const { format } = req.params;
    const { subscription_id, events, logs, dead_letters } = req.query;

    const options = {
      subscriptionId: subscription_id || null,
      includeEvents: events !== 'false',
      includeLogs: logs !== 'false',
      includeDeadLetters: dead_letters !== 'false'
    };

    const result = exporter.export(format, options);

    if (result.format === 'markdown') {
      res.set('Content-Type', 'text/markdown; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename=webhook-audit.md');
      res.send(result.content);
    } else {
      res.set('Content-Type', 'application/json');
      res.json(result.content);
    }
  });

  return router;
};