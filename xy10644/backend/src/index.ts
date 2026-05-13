import express from 'express';
import cors from 'cors';
import { TemperatureBoxService } from './services/TemperatureBoxService';
import { RiderHandoverService } from './services/RiderHandoverService';
import { GPSService } from './services/GPSService';
import { SignOffPersonService } from './services/SignOffPersonService';
import { SignOffService } from './services/SignOffService';
import { OperationLogService } from './services/OperationLogService';
import { ExportService } from './services/ExportService';
import { DelayExchangeService } from './services/DelayExchangeService';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/boxes', async (req, res) => {
  try {
    const box = await TemperatureBoxService.createBox(
      req.body.boxCode,
      req.body.orderId,
      req.body.medicineName,
      req.body.minTemp,
      req.body.maxTemp,
      req.body.currentTemp,
      req.body.operatorId,
      req.body.operatorName
    );
    res.json(box);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/boxes', async (req, res) => {
  const boxes = await TemperatureBoxService.getAllBoxes();
  res.json(boxes);
});

app.get('/api/boxes/:id', async (req, res) => {
  const box = await TemperatureBoxService.getBox(req.params.id);
  if (!box) {
    res.status(404).json({ error: '温度箱不存在' });
  } else {
    res.json(box);
  }
});

app.post('/api/handovers', async (req, res) => {
  try {
    const handover = await RiderHandoverService.createHandover(
      req.body.boxId,
      req.body.riderId,
      req.body.riderName,
      req.body.location,
      req.body.temperatureAtHandover,
      req.body.operatorId,
      req.body.operatorName,
      req.body.fromRiderId,
      req.body.fromRiderName
    );
    res.json(handover);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/handovers/:id/confirm', async (req, res) => {
  try {
    const handover = await RiderHandoverService.confirmHandover(
      req.params.id,
      req.body.operatorId,
      req.body.operatorName
    );
    res.json(handover);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/boxes/:boxId/handovers', async (req, res) => {
  const handovers = await RiderHandoverService.getHandoversByBox(req.params.boxId);
  res.json(handovers);
});

app.post('/api/gps', async (req, res) => {
  try {
    const node = await GPSService.addNode(
      req.body.boxId,
      req.body.latitude,
      req.body.longitude,
      req.body.temperature,
      req.body.batteryLevel,
      req.body.operatorId,
      req.body.operatorName
    );
    res.json(node);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/boxes/:boxId/gps', async (req, res) => {
  const nodes = await GPSService.getNodesByBox(req.params.boxId);
  res.json(nodes);
});

app.post('/api/persons', async (req, res) => {
  try {
    const person = await SignOffPersonService.createPerson(
      req.body.name,
      req.body.phone,
      req.body.idCard,
      req.body.authorized,
      req.body.department,
      req.body.operatorId,
      req.body.operatorName
    );
    res.json(person);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/persons', async (req, res) => {
  const persons = await SignOffPersonService.getAllPersons();
  res.json(persons);
});

app.post('/api/signoff', async (req, res) => {
  try {
    const result = await SignOffService.executeSignOff(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/signoff/review', async (req, res) => {
  try {
    const result = await SignOffService.manualReview(
      req.body.boxId,
      req.body.signOffPersonId,
      req.body.operatorId,
      req.body.operatorName,
      req.body.approved
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/signoff-records', async (req, res) => {
  const records = await SignOffService.getSignOffRecords(req.query.boxId as string);
  res.json(records);
});

app.post('/api/exchanges', async (req, res) => {
  try {
    const exchange = await DelayExchangeService.createExchange(
      req.body.boxId,
      req.body.reason,
      req.body.reasonType,
      req.body.delayMinutes,
      req.body.changedBy,
      req.body.changedByName,
      req.body.oldBoxId
    );
    res.json(exchange);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/exchanges/:id/approve', async (req, res) => {
  try {
    const exchange = await DelayExchangeService.approveExchange(
      req.params.id,
      req.body.reviewedBy,
      req.body.reviewedByName
    );
    res.json(exchange);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/exchanges', async (req, res) => {
  const exchanges = await DelayExchangeService.getAllExchanges();
  res.json(exchanges);
});

app.get('/api/logs', async (req, res) => {
  const logs = await OperationLogService.getAllLogs();
  res.json(logs);
});

app.get('/api/boxes/:boxId/logs', async (req, res) => {
  const logs = await OperationLogService.getLogsByEntity('temperature_box', req.params.boxId);
  res.json(logs);
});

app.post('/api/export/report', async (req, res) => {
  try {
    const buffer = await ExportService.exportReport(
      req.body.operatorId,
      req.body.operatorName,
      req.body.filters
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=cold-chain-report-${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/export/timeline/:boxId', async (req, res) => {
  try {
    const buffer = await ExportService.exportTimeline(
      req.params.boxId,
      req.body.operatorId,
      req.body.operatorName
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=timeline-${req.params.boxId}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '冷链药品配送系统API运行正常' });
});

app.listen(PORT, () => {
  console.log(`冷链药品配送系统API服务运行在 http://localhost:${PORT}`);
});
