const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const storage = require('./utils/storage');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.use('/data', express.static(path.join(__dirname, '../data')));

function initSampleData() {
  const fs = require('fs');
  const dataDir = path.join(__dirname, '../data');
  
  if (!fs.existsSync(path.join(dataDir, 'vehicles.json'))) {
    const vehicles = [
      {
        id: 'v-001',
        model: 'Tesla Model 3 2024款',
        plateNumber: '沪A12345',
        vin: '5YJ3E1EA1KF123456',
        status: 'available',
        color: '黑色',
        mileage: 15000,
        insurance: {
          valid: true,
          company: '中国平安保险',
          policyNumber: 'PA2024SH001234',
          expiryDate: '2026-03-15'
        },
        maintenance: []
      },
      {
        id: 'v-002',
        model: 'BMW 325Li M运动套装',
        plateNumber: '沪B67890',
        vin: 'WBA5B1105NA123457',
        status: 'available',
        color: '白色',
        mileage: 8500,
        insurance: {
          valid: true,
          company: '太平洋保险',
          policyNumber: 'CPIC2024SH005678',
          expiryDate: '2026-06-20'
        },
        maintenance: []
      },
      {
        id: 'v-003',
        model: '奔驰 C260 L 运动版',
        plateNumber: '沪C54321',
        vin: 'W1KZF8DB3LA123458',
        status: 'available',
        color: '银色',
        mileage: 22000,
        insurance: {
          valid: true,
          company: '中国人寿财险',
          policyNumber: 'CLIC2024SH009012',
          expiryDate: '2025-12-10'
        },
        maintenance: []
      },
      {
        id: 'v-004',
        model: '奥迪 A4L 45 TFSI',
        plateNumber: '沪D98765',
        vin: 'WAUZZZ8V9NA123459',
        status: 'unavailable',
        color: '灰色',
        mileage: 5000,
        insurance: {
          valid: true,
          company: '人保财险',
          policyNumber: 'PICC2024SH003456',
          expiryDate: '2026-01-05'
        },
        maintenance: [],
        note: '定期保养中'
      }
    ];
    storage.writeData('vehicles', vehicles);
  }
  
  if (!fs.existsSync(path.join(dataDir, 'salespersons.json'))) {
    const salespersons = [
      {
        id: 's-001',
        name: '张三',
        phone: '13800138001',
        department: '豪华车销售部',
        schedule: []
      },
      {
        id: 's-002',
        name: '李四',
        phone: '13800138002',
        department: '新能源车销售部',
        schedule: []
      },
      {
        id: 's-003',
        name: '王五',
        phone: '13800138003',
        department: '豪华车销售部',
        schedule: []
      }
    ];
    storage.writeData('salespersons', salespersons);
  }
}

app.listen(PORT, () => {
  console.log(`车辆试驾预约风控系统 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 健康检查: http://localhost:${PORT}/api/health`);
  initSampleData();
});
