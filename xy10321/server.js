const express = require('express');
const cors = require('cors');
const path = require('path');
const store = require('./data/store');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/pet-types', (req, res) => {
  res.json(store.getPetTypes());
});

app.get('/api/services', (req, res) => {
  res.json(store.getServices());
});

app.get('/api/addons', (req, res) => {
  res.json(store.getAddOns());
});

app.get('/api/beauticians', (req, res) => {
  res.json(store.getBeauticians());
});

app.get('/api/beauticians/:id/schedule', (req, res) => {
  const { date } = req.query;
  const schedule = store.getBeauticianSchedule(parseInt(req.params.id), date);
  res.json(schedule);
});

app.get('/api/supplies', (req, res) => {
  res.json(store.getSupplies());
});

app.get('/api/supplies/warnings', (req, res) => {
  res.json(store.getSupplyWarnings());
});

app.post('/api/supplies/check', (req, res) => {
  const result = store.checkSupplies(req.body.supplyList || []);
  res.json(result);
});

app.get('/api/pets', (req, res) => {
  res.json(store.getPets());
});

app.get('/api/pets/:id', (req, res) => {
  const pet = store.getPetById(req.params.id);
  if (!pet) {
    return res.status(404).json({ error: '宠物档案不存在' });
  }
  res.json(pet);
});

app.post('/api/pets', (req, res) => {
  const newPet = store.createPet(req.body);
  res.status(201).json(newPet);
});

app.get('/api/appointments', (req, res) => {
  const filters = {};
  if (req.query.date) filters.date = req.query.date;
  if (req.query.status) filters.status = req.query.status;
  if (req.query.beauticianId) filters.beauticianId = req.query.beauticianId;
  
  const appointments = store.getAppointments(filters);
  res.json(appointments);
});

app.get('/api/appointments/:id', (req, res) => {
  const appointment = store.getAppointmentById(req.params.id);
  if (!appointment) {
    return res.status(404).json({ error: '预约不存在' });
  }
  res.json(appointment);
});

app.post('/api/appointments', (req, res) => {
  const { beauticianId, date, startTime, endTime } = req.body;
  
  const conflict = store.checkBeauticianConflict(beauticianId, date, startTime, endTime);
  if (conflict.conflict) {
    return res.status(400).json({
      error: '美容师时段冲突',
      conflict: conflict.conflictingAppointment
    });
  }
  
  const newAppointment = store.createAppointment(req.body);
  res.status(201).json(newAppointment);
});

app.put('/api/appointments/:id', (req, res) => {
  const { beauticianId, date, startTime, endTime } = req.body;
  
  if (beauticianId && date && startTime && endTime) {
    const conflict = store.checkBeauticianConflict(
      beauticianId, 
      date, 
      startTime, 
      endTime, 
      req.params.id
    );
    if (conflict.conflict) {
      return res.status(400).json({
        error: '美容师时段冲突',
        conflict: conflict.conflictingAppointment
      });
    }
  }
  
  const updated = store.updateAppointment(req.params.id, req.body, req.headers['x-operator'] || '系统');
  if (!updated) {
    return res.status(404).json({ error: '预约不存在' });
  }
  res.json(updated);
});

app.put('/api/appointments/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'rejected', 'closed'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }
  
  const updated = store.updateAppointmentStatus(
    req.params.id, 
    status, 
    req.headers['x-operator'] || '系统'
  );
  if (!updated) {
    return res.status(404).json({ error: '预约不存在' });
  }
  res.json(updated);
});

app.post('/api/appointments/:id/addons/request', (req, res) => {
  const updated = store.requestAddOn(
    req.params.id, 
    req.body, 
    req.headers['x-operator'] || '美容师'
  );
  if (!updated) {
    return res.status(404).json({ error: '预约不存在或加项无效' });
  }
  res.json(updated);
});

app.post('/api/appointments/:id/addons/approve', (req, res) => {
  const updated = store.approveAddOn(
    req.params.id, 
    req.headers['x-operator'] || '前台'
  );
  if (!updated) {
    return res.status(404).json({ error: '预约不存在或无待审核加项' });
  }
  res.json(updated);
});

app.post('/api/appointments/:id/addons/reject', (req, res) => {
  const { reason } = req.body;
  const updated = store.rejectAddOn(
    req.params.id, 
    reason, 
    req.headers['x-operator'] || '前台'
  );
  if (!updated) {
    return res.status(404).json({ error: '预约不存在或无待审核加项' });
  }
  res.json(updated);
});

app.post('/api/appointments/:id/supplies/consume', (req, res) => {
  const result = store.consumeSupplies(
    req.params.id, 
    req.body.supplyUsage || [], 
    req.headers['x-operator'] || '美容师'
  );
  if (!result) {
    return res.status(404).json({ error: '预约不存在' });
  }
  if (!result.success) {
    return res.status(400).json({
      error: '耗材不足',
      errors: result.errors
    });
  }
  res.json(result.appointment);
});

app.get('/api/appointments/addons/pending', (req, res) => {
  res.json(store.getPendingAddOns());
});

app.get('/api/appointments/:id/histories', (req, res) => {
  res.json(store.getHistories(req.params.id));
});

app.get('/api/reports/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  res.json(store.getDailyReport(date));
});

app.get('/api/price/calculate', (req, res) => {
  const { serviceId, petTypeId, addOns } = req.query;
  
  if (!serviceId || !petTypeId) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const addOnIds = addOns ? addOns.split(',').map(Number) : [];
  const result = store.calculatePrice(
    parseInt(serviceId), 
    parseInt(petTypeId), 
    addOnIds
  );
  
  if (!result) {
    return res.status(400).json({ error: '无效的服务或宠物类型' });
  }
  
  res.json(result);
});

app.post('/api/beauticians/check-conflict', (req, res) => {
  const { beauticianId, date, startTime, endTime, excludeAppointmentId } = req.body;
  
  if (!beauticianId || !date || !startTime || !endTime) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const result = store.checkBeauticianConflict(
    beauticianId,
    date,
    startTime,
    endTime,
    excludeAppointmentId
  );
  
  res.json(result);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
