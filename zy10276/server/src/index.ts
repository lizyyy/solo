import express from 'express';
import cors from 'cors';
import path from 'path';
import driverRoutes from './routes/drivers';
import vehicleRoutes from './routes/vehicles';
import shiftRoutes from './routes/shifts';
import violationRoutes from './routes/violations';
import batchRoutes from './routes/batches';
import historyRoutes from './routes/history';
import db from './database/db';
import DriverDAO from './dao/driver.dao';
import VehicleDAO from './dao/vehicle.dao';
import ShiftDAO from './dao/shift.dao';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/drivers', driverRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/violations', violationRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/history', historyRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '车队违章申诉平台 API 服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`🚀 服务已启动: http://localhost:${PORT}`);
  console.log(`📊 API 文档: http://localhost:${PORT}/api/health`);
  initMockData();
});

function initMockData() {
  const drivers = DriverDAO.getAll();
  if (drivers.length === 0) {
    DriverDAO.create({ name: '张明', licenseNumber: 'A12345678', phone: '13800138001' });
    DriverDAO.create({ name: '李强', licenseNumber: 'A23456789', phone: '13800138002' });
    DriverDAO.create({ name: '王芳', licenseNumber: 'A34567890', phone: '13800138003' });
    DriverDAO.create({ name: '刘伟', licenseNumber: 'A45678901', phone: '13800138004' });
    DriverDAO.create({ name: '陈静', licenseNumber: 'A56789012', phone: '13800138005' });
    console.log('✅ 模拟司机数据已初始化');
  }

  const vehicles = VehicleDAO.getAll();
  if (vehicles.length === 0) {
    VehicleDAO.create({ plateNumber: '京A12345', vehicleType: '货车', brand: '解放' });
    VehicleDAO.create({ plateNumber: '京B23456', vehicleType: '货车', brand: '东风' });
    VehicleDAO.create({ plateNumber: '京C34567', vehicleType: '客车', brand: '宇通' });
    VehicleDAO.create({ plateNumber: '京D45678', vehicleType: '货车', brand: '重汽' });
    VehicleDAO.create({ plateNumber: '京E56789', vehicleType: '客车', brand: '金龙' });
    console.log('✅ 模拟车辆数据已初始化');
  }

  const shifts = ShiftDAO.getAll();
  if (shifts.length === 0) {
    const drivers = DriverDAO.getAll();
    const vehicles = VehicleDAO.getAll();

    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0).toISOString();
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0).toISOString();
    const nightStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0).toISOString();
    const nightEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6, 0, 0).toISOString();

    ShiftDAO.create({ vehicleId: vehicles[0].id, driverId: drivers[0].id, startTime, endTime, notes: '白班' });
    ShiftDAO.create({ vehicleId: vehicles[0].id, driverId: drivers[1].id, startTime: nightStart, endTime: nightEnd, notes: '夜班' });
    ShiftDAO.create({ vehicleId: vehicles[1].id, driverId: drivers[2].id, startTime, endTime: nightEnd, notes: '长途' });
    ShiftDAO.create({ vehicleId: vehicles[2].id, driverId: drivers[3].id, startTime, endTime, notes: '白班' });
    ShiftDAO.create({ vehicleId: vehicles[3].id, driverId: drivers[4].id, startTime, endTime, notes: '白班' });
    console.log('✅ 模拟班次数据已初始化');
  }
}

export default app;
