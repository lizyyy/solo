const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs-extra');

async function createSamples() {
  const samplesDir = __dirname;
  
  const normalData = [
    ['设备编号', '设备名称', '计划巡检时间', '实际巡检时间', '巡检人员', '设备状态'],
    ['EQ-001', '电梯A栋1号', '2024-05-10 09:00', '2024-05-10 10:30', '张三', '正常运行'],
    ['EQ-002', '消防泵B区', '2024-05-11 14:00', '2024-05-11 15:00', '李四', '正常运行'],
    ['EQ-003', '中央空调主机', '2024-05-12 08:00', '2024-05-12 09:30', '王五', '正常运行'],
    ['EQ-004', '配电室开关柜', '2024-05-13 10:00', '2024-05-13 11:00', '赵六', '正常运行'],
    ['EQ-005', '水泵房增压泵', '2024-05-14 16:00', '2024-05-14 17:30', '钱七', '正常运行']
  ];
  
  const normalWB = xlsx.utils.book_new();
  const normalWS = xlsx.utils.aoa_to_sheet(normalData);
  xlsx.utils.book_append_sheet(normalWB, normalWS, 'Sheet1');
  xlsx.writeFile(normalWB, path.join(samplesDir, '维保巡检正常数据.xlsx'));
  console.log('✓ 已创建: 维保巡检正常数据.xlsx');

  const abnormalData = [
    ['设备编号', '设备名称', '计划巡检时间', '实际巡检时间', '巡检人员', '设备状态'],
    ['EQ-101', '电梯C栋2号', '2024-05-15 09:00', '2024-05-14 08:30', '周八', '正常运行'],
    ['EQ-102', '消防监控系统', '2024-05-16 10:00', '2024-05-16 11:00', '吴九', '停用'],
    ['EQ-103', '备用发电机', '2024-05-17 14:00', '2024-05-15 16:00', '郑十', '报废'],
    ['EQ-104', '冷却塔风机', '2024-05-18 08:00', '2024-05-18 09:00', '冯一', '正常运行'],
    ['EQ-105', '配电柜总开关', '2024-05-19 15:00', '2024-05-18 14:00', '陈二', '已拆除'],
    ['EQ-106', '消防喷淋系统', '2024-05-20 11:00', '2024-05-20 12:00', '楚三', '正常运行'],
    ['EQ-107', '弱电间交换机', '2024-05-21 09:00', '2024-05-20 08:00', '卫四', '已停用']
  ];
  
  const abnormalWB = xlsx.utils.book_new();
  const abnormalWS = xlsx.utils.aoa_to_sheet(abnormalData);
  xlsx.utils.book_append_sheet(abnormalWB, abnormalWS, 'Sheet1');
  xlsx.writeFile(abnormalWB, path.join(samplesDir, '维保巡检异常数据.xlsx'));
  console.log('✓ 已创建: 维保巡检异常数据.xlsx');

  const csvContent = `设备编号,设备名称,计划巡检时间,实际巡检时间,巡检人员,设备状态
EQ-201,车库道闸系统,2024-05-22 08:00,2024-05-21 17:00,蒋石,正常运行
EQ-202,监控摄像头组,2024-05-23 10:00,2024-05-23 11:30,沈金,停用
EQ-203,门禁控制系统,2024-05-24 14:00,2024-05-24 15:00,韩木,正常运行`;
  
  await fs.writeFile(path.join(samplesDir, '维保巡检混合数据.csv'), csvContent, 'utf8');
  console.log('✓ 已创建: 维保巡检混合数据.csv');

  console.log('\n所有样例文件创建完成！');
}

createSamples().catch(console.error);
