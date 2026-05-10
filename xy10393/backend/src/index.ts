import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './database';
import eventService from './services';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

async function setupRoutes() {
  await initializeDatabase();

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/checkpoints', async (req, res) => {
    res.json(await eventService.getCheckpoints());
  });

  app.post('/api/checkpoints', async (req, res) => {
    try {
      const checkpoint = await eventService.addCheckpoint(req.body);
      res.json(checkpoint);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/riders', async (req, res) => {
    const status = req.query.status as string | undefined;
    res.json(await eventService.getRiders(status));
  });

  app.get('/api/riders/bib/:bib', async (req, res) => {
    const rider = await eventService.getRiderByBib(parseInt(req.params.bib));
    if (!rider) return res.status(404).json({ error: '骑手不存在' });
    res.json(rider);
  });

  app.get('/api/riders/:id', async (req, res) => {
    const details = await eventService.getRiderDetails(req.params.id);
    if (!details) return res.status(404).json({ error: '骑手不存在' });
    res.json(details);
  });

  app.post('/api/riders', async (req, res) => {
    try {
      const rider = await eventService.registerRider(req.body);
      res.json(rider);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/equipment-checks', async (req, res) => {
    try {
      const check = await eventService.recordEquipmentCheck(req.body);
      res.json(check);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/checkins', async (req, res) => {
    try {
      const checkin = await eventService.recordCheckin(req.body);
      res.json(checkin);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/checkins', async (req, res) => {
    const checkpointId = req.query.checkpointId as string | undefined;
    const riderId = req.query.riderId as string | undefined;
    res.json(await eventService.getCheckins(checkpointId, riderId));
  });

  app.post('/api/dropouts', async (req, res) => {
    try {
      const dropout = await eventService.recordDropout(req.body);
      res.json(dropout);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/dropouts', async (req, res) => {
    res.json(await eventService.getDropouts());
  });

  app.post('/api/supplies', async (req, res) => {
    try {
      const supply = await eventService.recordSupply(req.body);
      res.json(supply);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/supplies', async (req, res) => {
    const riderId = req.query.riderId as string | undefined;
    res.json(await eventService.getSupplies(riderId));
  });

  app.post('/api/finish', async (req, res) => {
    try {
      const finish = await eventService.recordFinish(req.body);
      res.json(finish);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/finish-records', async (req, res) => {
    res.json(await eventService.getFinishRecords());
  });

  app.post('/api/approvals', async (req, res) => {
    try {
      const approval = await eventService.addApprovalComment(req.body);
      res.json(approval);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/approvals', async (req, res) => {
    const relatedType = req.query.relatedType as string | undefined;
    const relatedId = req.query.relatedId as string | undefined;
    res.json(await eventService.getApprovalComments(relatedType, relatedId));
  });

  app.get('/api/dashboard', async (req, res) => {
    res.json(await eventService.getDashboardStats());
  });

  app.get('/api/export', async (req, res) => {
    const report = await eventService.exportReport();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=cycling-event-report-${Date.now()}.json`);
    res.json(report);
  });

  app.listen(PORT, () => {
    console.log(`城市骑行活动签到台后端运行在 http://localhost:${PORT}`);
  });
}

setupRoutes();
