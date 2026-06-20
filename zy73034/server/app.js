import express from 'express';
import { createStore } from './db.js';

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function requireText(value, field) {
  if (!value || typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${field} 不能为空`);
    error.status = 400;
    throw error;
  }
  return value.trim();
}

export function createApp(options = {}) {
  const store = options.store || createStore(options.dbPath);
  const app = express();
  app.locals.store = store;

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, dbPath: store.dbPath, summary: store.summary() });
  });

  app.post('/api/reset-demo', (_req, res) => {
    res.json({ ok: true, summary: store.seed() });
  });

  app.get('/api/pets', (req, res) => {
    res.json({
      ok: true,
      pets: store.listPets({
        anomaly: req.query.anomaly,
        q: req.query.q,
      }),
    });
  });

  app.get('/api/pets/:petId/timeline', (req, res) => {
    const events = store.eventsForPet(req.params.petId);
    if (!events.length) return res.status(404).json({ ok: false, error: 'pet_not_found' });
    res.json({ ok: true, petId: req.params.petId, events });
  });

  app.post('/api/import', asyncRoute((req, res) => {
    const result = store.createImport({
      petId: req.body.petId,
      profile: req.body.profile || req.body,
      operator: requireText(req.body.operator, 'operator'),
      source: req.body.source,
      note: req.body.note,
    });
    res.status(201).json({ ok: true, ...result });
  }));

  app.post('/api/pets/:petId/confirm', asyncRoute((req, res) => {
    const result = store.confirm(req.params.petId, {
      operator: requireText(req.body.operator, 'operator'),
      note: req.body.note,
    });
    res.json({ ok: true, ...result });
  }));

  app.post('/api/pets/:petId/revoke', asyncRoute((req, res) => {
    const result = store.revoke(req.params.petId, {
      operator: requireText(req.body.operator, 'operator'),
      note: req.body.note,
    });
    res.json({ ok: true, ...result });
  }));

  app.post('/api/pets/:petId/addendum', asyncRoute((req, res) => {
    const result = store.addendum(req.params.petId, {
      operator: requireText(req.body.operator, 'operator'),
      note: req.body.note,
      updates: req.body.updates || {},
    });
    res.json({ ok: true, ...result });
  }));

  app.post('/api/pets/:petId/rejudge', asyncRoute((req, res) => {
    const result = store.rejudge(req.params.petId, {
      operator: requireText(req.body.operator, 'operator'),
      newJudge: requireText(req.body.newJudge, 'newJudge'),
      reason: requireText(req.body.reason, 'reason'),
      note: req.body.note,
    });
    res.json({ ok: true, ...result });
  }));

  app.get('/api/export', (req, res) => {
    const filters = { anomaly: req.query.anomaly, q: req.query.q };
    if (req.query.format === 'csv') {
      const result = store.exportCsv(filters);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('X-Export-Id', result.id);
      res.setHeader('X-Export-Checksum', result.checksum);
      return res.send(`\uFEFF${result.csv}`);
    }
    res.json({ ok: true, export: store.exportData(filters) });
  });

  app.get('/api/export/:exportId', (req, res) => {
    const result = store.getExport(req.params.exportId);
    if (!result) return res.status(404).json({ ok: false, error: 'export_not_found' });
    res.json({ ok: true, export: result });
  });

  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      ok: false,
      error: err.message || 'internal_error',
    });
  });

  return app;
}
