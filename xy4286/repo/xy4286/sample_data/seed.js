const moment = require('moment');
const models = require('../models');
const repositories = require('../repositories');

const batchRepo = new repositories.BatchRepository();
const boxRepo = new repositories.BoxRepository();
const stationRepo = new repositories.StationRepository();
const personRepo = new repositories.ResponsiblePersonRepository();
const handoverFormRepo = new repositories.HandoverFormRepository();
const temperatureLogRepo = new repositories.TemperatureLogRepository();
const vehicleTrajectoryRepo = new repositories.VehicleTrajectoryRepository();

function seedData() {
  console.log('开始初始化示例数据...');

  const stations = [
    new models.Station({
      name: '疾控中心总站',
      address: '北京市朝阳区健康路100号',
      contactPerson: '张主任',
      contactPhone: '010-88881111',
      latitude: 39.9042,
      longitude: 116.4074
    }),
    new models.Station({
      name: '海淀区接种点',
      address: '北京市海淀区接种街50号',
      contactPerson: '李医生',
      contactPhone: '010-88882222',
      latitude: 39.9542,
      longitude: 116.4574
    }),
    new models.Station({
      name: '西城区接种点',
      address: '北京市西城区防疫路20号',
      contactPerson: '王医生',
      contactPhone: '010-88883333',
      latitude: 39.9142,
      longitude: 116.3674
    })
  ];

  stations.forEach(station => stationRepo.create(station));
  console.log(`已创建 ${stations.length} 个站点`);

  const persons = [
    new models.ResponsiblePerson({
      name: '张三',
      employeeId: 'CDC001',
      role: '疫苗管理员',
      department: '冷链物流',
      phone: '13800138001',
      email: 'zhangsan@cdc.gov.cn'
    }),
    new models.ResponsiblePerson({
      name: '李四',
      employeeId: 'CDC002',
      role: '司机',
      department: '运输部',
      phone: '13800138002',
      email: 'lisi@cdc.gov.cn'
    }),
    new models.ResponsiblePerson({
      name: '王五',
      employeeId: 'CDC003',
      role: '接种点负责人',
      department: '海淀区接种点',
      phone: '13800138003',
      email: 'wangwu@cdc.gov.cn'
    }),
    new models.ResponsiblePerson({
      name: '赵六',
      employeeId: 'CDC004',
      role: '质量监督员',
      department: '质量控制',
      phone: '13800138004',
      email: 'zhaoliu@cdc.gov.cn'
    })
  ];

  persons.forEach(person => personRepo.create(person));
  console.log(`已创建 ${persons.length} 个责任人`);

  const boxes = [
    new models.Box({
      name: '保温箱-001',
      serialNumber: 'BOX-2026-001',
      capacity: 50
    }),
    new models.Box({
      name: '保温箱-002',
      serialNumber: 'BOX-2026-002',
      capacity: 50
    }),
    new models.Box({
      name: '保温箱-003',
      serialNumber: 'BOX-2026-003',
      capacity: 30
    })
  ];

  boxes.forEach(box => boxRepo.create(box));
  console.log(`已创建 ${boxes.length} 个保温箱`);

  const now = moment();
  
  const batches = [
    new models.Batch({
      batchNumber: 'VAC-2026-05-001',
      vaccineName: '甲型流感疫苗',
      quantity: 100,
      manufacturer: '国药集团',
      expiryDate: '2027-12-31',
      boxId: boxes[0].id,
      originStationId: stations[0].id,
      destinationStationId: stations[1].id,
      scheduledDepartureTime: now.subtract(2, 'hours').toISOString(),
      scheduledArrivalTime: now.subtract(1, 'hours').toISOString(),
      actualDepartureTime: now.subtract(2, 'hours').toISOString(),
      actualArrivalTime: now.subtract(50, 'minutes').toISOString()
    }),
    new models.Batch({
      batchNumber: 'VAC-2026-05-002',
      vaccineName: '乙型肝炎疫苗',
      quantity: 80,
      manufacturer: '科兴生物',
      expiryDate: '2027-10-15',
      boxId: boxes[1].id,
      originStationId: stations[0].id,
      destinationStationId: stations[2].id,
      scheduledDepartureTime: now.subtract(3, 'hours').toISOString(),
      scheduledArrivalTime: now.subtract(2, 'hours').toISOString(),
      actualDepartureTime: now.subtract(3, 'hours').toISOString(),
      actualArrivalTime: now.subtract(1, 'hours').toISOString()
    }),
    new models.Batch({
      batchNumber: 'VAC-2026-05-003',
      vaccineName: '新冠疫苗',
      quantity: 200,
      manufacturer: '康泰生物',
      expiryDate: '2027-08-20',
      boxId: boxes[2].id,
      originStationId: stations[0].id,
      destinationStationId: stations[1].id,
      scheduledDepartureTime: now.subtract(4, 'hours').toISOString(),
      scheduledArrivalTime: now.subtract(3, 'hours').toISOString(),
      actualDepartureTime: now.subtract(4, 'hours').toISOString(),
      actualArrivalTime: now.subtract(2, 'hours').toISOString()
    })
  ];

  batches.forEach(batch => batchRepo.create(batch));
  console.log(`已创建 ${batches.length} 个疫苗批次`);

  const handoverForms = [
    new models.HandoverForm({
      formNumber: 'HO-2026-05-001',
      batchId: batches[0].id,
      boxId: boxes[0].id,
      fromStationId: stations[0].id,
      toStationId: stations[1].id,
      senderPersonId: persons[0].id,
      receiverPersonId: persons[2].id,
      handoffTime: now.subtract(2, 'hours').toISOString(),
      actualReceiveTime: now.subtract(50, 'minutes').toISOString(),
      temperatureAtHandover: 5.2,
      vehiclePlate: '京A-12345',
      notes: '周末借调车辆运输'
    }),
    new models.HandoverForm({
      formNumber: 'HO-2026-05-002',
      batchId: batches[1].id,
      boxId: boxes[1].id,
      fromStationId: stations[0].id,
      toStationId: stations[2].id,
      senderPersonId: persons[0].id,
      handoffTime: now.subtract(3, 'hours').toISOString(),
      temperatureAtHandover: 4.8,
      vehiclePlate: '京A-67890',
      notes: '周末借调车辆运输 - 接收方签名缺失'
    }),
    new models.HandoverForm({
      formNumber: 'HO-2026-05-003',
      batchId: batches[2].id,
      boxId: boxes[2].id,
      fromStationId: stations[0].id,
      toStationId: stations[1].id,
      senderPersonId: persons[0].id,
      receiverPersonId: persons[2].id,
      handoffTime: now.subtract(4, 'hours').toISOString(),
      actualReceiveTime: now.subtract(2, 'hours').toISOString(),
      temperatureAtHandover: 5.0,
      vehiclePlate: '京A-11111',
      notes: '周末借调车辆运输 - 延误20分钟'
    })
  ];

  handoverForms[0].signSender('sig_sender_001', persons[0].id);
  handoverForms[0].signReceiver('sig_receiver_001', persons[2].id);
  handoverForms[2].signSender('sig_sender_003', persons[0].id);
  handoverForms[2].signReceiver('sig_receiver_003', persons[2].id);

  handoverForms.forEach(form => handoverFormRepo.create(form));
  console.log(`已创建 ${handoverForms.length} 个交接单`);

  const baseTime = now.subtract(3, 'hours');
  const tempLogsBox1 = [];
  for (let i = 0; i < 20; i++) {
    const temp = i === 5 ? 9.5 : i === 6 ? 10.2 : i === 7 ? 9.8 : 
                   i === 15 ? 0.5 : i === 16 ? 1.2 : 
                   4.5 + Math.random() * 1.5;
    
    tempLogsBox1.push(new models.TemperatureLog({
      boxId: boxes[0].id,
      timestamp: baseTime.clone().add(i * 5, 'minutes').toISOString(),
      temperature: parseFloat(temp.toFixed(1)),
      unit: 'C',
      source: 'device'
    }));
  }
  tempLogsBox1.forEach(log => temperatureLogRepo.create(log));

  const tempLogsBox2 = [];
  for (let i = 0; i < 15; i++) {
    const temp = 4.5 + Math.random() * 1.5;
    tempLogsBox2.push(new models.TemperatureLog({
      boxId: boxes[1].id,
      timestamp: baseTime.clone().add(i * 5, 'minutes').toISOString(),
      temperature: parseFloat(temp.toFixed(1)),
      unit: 'C',
      source: 'device'
    }));
  }
  tempLogsBox2.forEach(log => temperatureLogRepo.create(log));

  const tempLogsBox3 = [];
  for (let i = 0; i < 25; i++) {
    const temp = 4.5 + Math.random() * 1.5;
    tempLogsBox3.push(new models.TemperatureLog({
      boxId: boxes[2].id,
      timestamp: baseTime.clone().subtract(1, 'hour').add(i * 5, 'minutes').toISOString(),
      temperature: parseFloat(temp.toFixed(1)),
      unit: 'C',
      source: 'device'
    }));
  }
  tempLogsBox3.forEach(log => temperatureLogRepo.create(log));

  console.log(`已创建 ${tempLogsBox1.length + tempLogsBox2.length + tempLogsBox3.length} 条温度日志`);

  console.log('\n示例数据初始化完成！');
  console.log('\n数据概览：');
  console.log(`- 站点: ${stations.length}`);
  console.log(`- 责任人: ${persons.length}`);
  console.log(`- 保温箱: ${boxes.length}`);
  console.log(`- 疫苗批次: ${batches.length}`);
  console.log(`- 交接单: ${handoverForms.length}`);
  
  return {
    stations,
    persons,
    boxes,
    batches,
    handoverForms
  };
}

if (require.main === module) {
  seedData();
}

module.exports = seedData;
