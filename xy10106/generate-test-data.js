const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function generateTestPackages() {
  const testDir = path.join(__dirname, 'test-packages');
  fs.mkdirSync(testDir, { recursive: true });

  // 1. 完整的巡检包
  const zip1 = new JSZip();
  zip1.file('device.jpg', Buffer.from('fake image data'));
  zip1.file('location.json', JSON.stringify({
    latitude: 39.9042,
    longitude: 116.4074,
    timestamp: Date.now()
  }, null, 2));
  zip1.file('inspection-form.json', JSON.stringify({
    deviceName: '变压器A-001',
    location: '配电室1号',
    inspector: '张三',
    date: '2024-01-15',
    status: '正常',
    temperature: '42°C',
    voltage: '380V'
  }, null, 2));
  const content1 = await zip1.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(testDir, '巡检包_完整.zip'), content1);
  console.log('✓ 生成：巡检包_完整.zip');

  // 2. 缺少照片的巡检包
  const zip2 = new JSZip();
  zip2.file('location.json', JSON.stringify({
    latitude: 39.9042,
    longitude: 116.4074
  }, null, 2));
  zip2.file('inspection-form.json', JSON.stringify({
    deviceName: '变压器A-002',
    location: '配电室2号',
    inspector: '李四',
    date: '2024-01-15',
    status: '异常'
  }, null, 2));
  const content2 = await zip2.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(testDir, '巡检包_缺少照片.zip'), content2);
  console.log('✓ 生成：巡检包_缺少照片.zip');

  // 3. 缺少定位的巡检包
  const zip3 = new JSZip();
  zip3.file('device.jpg', Buffer.from('fake image data'));
  zip3.file('inspection-form.json', JSON.stringify({
    deviceName: '变压器A-003',
    location: '配电室3号',
    inspector: '王五',
    date: '2024-01-15',
    status: '正常'
  }, null, 2));
  const content3 = await zip3.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(testDir, '巡检包_缺少定位.zip'), content3);
  console.log('✓ 生成：巡检包_缺少定位.zip');

  // 4. 字段冲突的巡检包
  const zip4 = new JSZip();
  zip4.file('device.jpg', Buffer.from('fake image data'));
  zip4.file('location.json', JSON.stringify({
    latitude: 39.9042,
    longitude: 116.4074
  }, null, 2));
  zip4.file('inspection-form.json', JSON.stringify({
    deviceName: '变压器A-004',
    location: '',
    inspector: '',
    date: '2024-01-15',
    status: '正常'
  }, null, 2));
  const content4 = await zip4.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(testDir, '巡检包_字段冲突.zip'), content4);
  console.log('✓ 生成：巡检包_字段冲突.zip');

  // 5. 完整的巡检包（多张照片）
  const zip5 = new JSZip();
  zip5.file('device.jpg', Buffer.from('fake image data'));
  zip5.file('detail1.jpg', Buffer.from('fake image data'));
  zip5.file('detail2.png', Buffer.from('fake image data'));
  zip5.file('location.json', JSON.stringify({
    latitude: 39.9042,
    longitude: 116.4074,
    accuracy: 10
  }, null, 2));
  zip5.file('inspection-form.json', JSON.stringify({
    deviceName: '开关柜B-001',
    location: '主控室',
    inspector: '赵六',
    date: '2024-01-16',
    status: '正常',
    current: '150A',
    notes: '运行正常，无异常'
  }, null, 2));
  const content5 = await zip5.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(testDir, '巡检包_多张照片.zip'), content5);
  console.log('✓ 生成：巡检包_多张照片.zip');

  console.log('\n✅ 测试数据生成完成！');
  console.log(`保存位置：${testDir}`);
}

generateTestPackages().catch(console.error);
