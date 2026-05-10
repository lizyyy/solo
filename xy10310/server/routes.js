const express = require('express');
const router = express.Router();
const { Customer, Vehicle, Material, Appointment } = require('./models');

const CURRENT_OPERATOR = '客服小张';
const CURRENT_SOURCE = 'web';

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '服务运行正常' });
});

router.get('/statuses', (req, res) => {
  res.json({
    statuses: global.VEHICLE_STATUSES,
    statusNames: global.STATUS_NAMES,
    transitions: global.STATUS_TRANSITIONS
  });
});

router.get('/material-types', (req, res) => {
  res.json({ types: global.MATERIAL_TYPES });
});

router.post('/customers', async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/customers', async (req, res) => {
  try {
    const customers = await Customer.findAll();
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: '客户不存在' });
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.update(req.params.id, req.body);
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/vehicles', async (req, res) => {
  try {
    const vehicle = await Vehicle.create(req.body, CURRENT_OPERATOR, CURRENT_SOURCE);
    res.json({ success: true, data: vehicle });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll();
    const vehiclesWithStatusNames = vehicles.map(v => ({
      ...v,
      status_name: global.STATUS_NAMES[v.status] || v.status
    }));
    res.json({ success: true, data: vehiclesWithStatusNames });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: '车辆不存在' });
    }
    
    const materials = await Material.findByVehicleId(req.params.id);
    const appointments = await Appointment.findByVehicleId(req.params.id);
    const statusHistory = await Vehicle.getStatusHistory(req.params.id);
    const operationLogs = await Vehicle.getOperationLogs(req.params.id);
    
    const statusHistoryWithNames = statusHistory.map(s => ({
      ...s,
      status_name: global.STATUS_NAMES[s.status] || s.status
    }));
    
    res.json({
      success: true,
      data: {
        vehicle: {
          ...vehicle,
          status_name: global.STATUS_NAMES[vehicle.status] || vehicle.status
        },
        materials,
        appointments,
        status_history: statusHistoryWithNames,
        operation_logs: operationLogs
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/vehicles/:id/collect-materials', async (req, res) => {
  try {
    const { material_types } = req.body;
    const vehicleId = req.params.id;
    
    const currentStatus = await Vehicle.getCurrentStatus(vehicleId);
    if (currentStatus === 'certificate_collected') {
      return res.status(400).json({ success: false, message: '已取证，不能继续补交材料' });
    }
    
    for (const materialType of material_types) {
      await Material.collectMaterial(vehicleId, materialType, CURRENT_OPERATOR, CURRENT_SOURCE);
    }
    
    const allCollected = await Material.checkAllMaterialsCollected(vehicleId);
    if (allCollected && currentStatus === 'created') {
      await Vehicle.changeStatus(vehicleId, 'materials_collected', null, CURRENT_OPERATOR, CURRENT_SOURCE);
    }
    
    res.json({ success: true, message: '材料收集成功' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/vehicles/:id/appointments', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const appointment = await Appointment.create(req.body, CURRENT_OPERATOR, CURRENT_SOURCE);
    
    const currentStatus = await Vehicle.getCurrentStatus(vehicleId);
    if (currentStatus === 'materials_collected') {
      await Vehicle.changeStatus(vehicleId, 'appointment_scheduled', null, CURRENT_OPERATOR, CURRENT_SOURCE);
    } else if (currentStatus === 'inspection_failed') {
      await Vehicle.changeStatus(vehicleId, 'retest_scheduled', null, CURRENT_OPERATOR, CURRENT_SOURCE);
    }
    
    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/vehicles/:id/inspection-result', async (req, res) => {
  try {
    const { result, failure_reason, appointment_id } = req.body;
    const vehicleId = req.params.id;
    
    if (appointment_id) {
      const appointment = await Appointment.findByVehicleId(vehicleId);
      const targetAppointment = appointment.find(a => a.id === appointment_id);
      if (targetAppointment) {
        await Appointment.update(appointment_id, {
          ...targetAppointment,
          status: result === 'passed' ? 'passed' : 'failed',
          inspection_result: result === 'passed' ? '通过' : '未通过',
          failure_reason: result === 'failed' ? failure_reason : null
        });
      }
    }
    
    if (result === 'passed') {
      await Vehicle.changeStatus(vehicleId, 'inspection_completed', null, CURRENT_OPERATOR, CURRENT_SOURCE);
    } else {
      await Vehicle.changeStatus(vehicleId, 'inspection_failed', failure_reason, CURRENT_OPERATOR, CURRENT_SOURCE);
    }
    
    res.json({ success: true, message: result === 'passed' ? '检测通过' : '检测失败已记录' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/vehicles/:id/collect-certificate', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    await Vehicle.changeStatus(vehicleId, 'certificate_collected', null, CURRENT_OPERATOR, CURRENT_SOURCE);
    res.json({ success: true, message: '已取证' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/vehicles/:id/operation-logs', async (req, res) => {
  try {
    const logs = await Vehicle.getOperationLogs(req.params.id);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/todos', async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll();
    
    const todos = {
      pending_materials: [],
      pending_appointment: [],
      pending_inspection: [],
      pending_certificate: []
    };
    
    for (const vehicle of vehicles) {
      const materials = await Material.findByVehicleId(vehicle.id);
      const collectedCount = materials.filter(m => m.is_collected).length;
      
      if (vehicle.status === 'created' && collectedCount < materials.length) {
        todos.pending_materials.push({
          ...vehicle,
          status_name: global.STATUS_NAMES[vehicle.status],
          pending_count: materials.length - collectedCount
        });
      }
      
      if (vehicle.status === 'materials_collected') {
        todos.pending_appointment.push({
          ...vehicle,
          status_name: global.STATUS_NAMES[vehicle.status]
        });
      }
      
      if (['appointment_scheduled', 'retest_scheduled'].includes(vehicle.status)) {
        const appointments = await Appointment.findByVehicleId(vehicle.id);
        const latestAppointment = appointments[0];
        todos.pending_inspection.push({
          ...vehicle,
          status_name: global.STATUS_NAMES[vehicle.status],
          appointment: latestAppointment
        });
      }
      
      if (vehicle.status === 'inspection_completed') {
        todos.pending_certificate.push({
          ...vehicle,
          status_name: global.STATUS_NAMES[vehicle.status]
        });
      }
    }
    
    res.json({ success: true, data: todos });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll();
    const exportData = [];
    
    for (const vehicle of vehicles) {
      const materials = await Material.findByVehicleId(vehicle.id);
      const appointments = await Appointment.findByVehicleId(vehicle.id);
      
      exportData.push({
        车牌号码: vehicle.plate_number,
        客户姓名: vehicle.customer_name,
        客户电话: vehicle.customer_phone,
        品牌: vehicle.brand,
        型号: vehicle.model,
        年份: vehicle.year,
        当前状态: global.STATUS_NAMES[vehicle.status] || vehicle.status,
        材料收集情况: materials.map(m => `${m.material_type}: ${m.is_collected ? '已收集' : '未收集'}`).join(', '),
        最近预约: appointments[0] ? `${appointments[0].appointment_date} ${appointments[0].appointment_time || ''} - ${appointments[0].inspection_station}` : '无',
        更新时间: vehicle.updated_at
      });
    }
    
    res.json({ success: true, data: exportData });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
