const moment = require('moment');
const { BatchService } = require('../src/services/batchService');

console.log('========================================');
console.log('冷链中转验收 - 造数工具');
console.log('========================================\n');

const generateNormalBatch = (batchNo, boxCount = 5) => {
  const boxes = [];
  const temperatureRecords = [];
  const photos = [];

  for (let i = 1; i <= boxCount; i++) {
    const boxNo = `BOX${String(batchNo).padStart(4, '0')}-${String(i).padStart(3, '0')}`;
    boxes.push({
      box_no: boxNo,
      original_box_no: boxNo,
      wms_expected_qty: 10 + Math.floor(Math.random() * 10),
      actual_qty: 10 + Math.floor(Math.random() * 10),
      receive_time: moment().subtract(Math.random() * 2, 'hours').toISOString(),
      remark: `正常箱号 ${i}`
    });

    for (let h = 0; h < 10; h++) {
      temperatureRecords.push({
        box_no: boxNo,
        record_time: moment().subtract(12 - h, 'hours').toISOString(),
        temperature: 3 + Math.random() * 3,
        humidity: 60 + Math.random() * 20
      });
    }
  }

  photos.push({
    photo_type: 'driver',
    file_name: `driver_${batchNo}.jpg`,
    file_path: `/fake/path/driver_${batchNo}.jpg`,
    file_size: 102400 + Math.floor(Math.random() * 100000),
    remark: '司机照片'
  });

  return {
    batch_no: `BATCH-${String(batchNo).padStart(6, '0')}`,
    driver_name: `司机${batchNo}`,
    driver_phone: `138${String(10000000 + Math.floor(Math.random() * 90000000))}`,
    boxes,
    temperature_records: temperatureRecords,
    photos,
    remark: '造数生成 - 正常批次'
  };
};

const generateAbnormalBatch = (batchNo) => {
  const data = generateNormalBatch(batchNo, 8);

  data.boxes[1].original_box_no = 'OLD-' + data.boxes[1].box_no;
  data.boxes[1].remark = '箱号改名测试';

  data.boxes[2].receive_time = moment().subtract(1, 'day').hour(23).minute(59).toISOString();
  data.boxes[2].remark = '跨日签收测试';

  data.boxes[3].actual_qty = data.boxes[3].wms_expected_qty - 3;
  data.boxes[3].remark = '数量短缺';

  for (let h = 0; h < 5; h++) {
    data.temperature_records.push({
      box_no: data.boxes[4].box_no,
      record_time: moment().subtract(5 - h, 'hours').toISOString(),
      temperature: 12 + Math.random() * 5,
      humidity: 80 + Math.random() * 10
    });
  }

  data.remark = '造数生成 - 异常批次（改名/跨日/短少/温度异常）';
  return data;
};

const seed = async () => {
  try {
    console.log('1. 生成正常批次数据...');
    const normalBatch = generateNormalBatch(1001, 6);
    const result1 = await BatchService.submitBatch(normalBatch, 'error', 'seed_script');
    console.log(`   正常批次创建成功: ${normalBatch.batch_no}, 赔付: ¥${result1.reconciliation.total_compensation}`);

    console.log('\n2. 生成异常批次数据（含改名/跨日/短少/温度异常）...');
    const abnormalBatch = generateAbnormalBatch(1002);
    const result2 = await BatchService.submitBatch(abnormalBatch, 'error', 'seed_script');
    console.log(`   异常批次创建成功: ${abnormalBatch.batch_no}, 赔付: ¥${result2.reconciliation.total_compensation}`);

    console.log('\n3. 生成部分失败测试数据...');
    const partialBatch = generateNormalBatch(1003, 10);
    partialBatch.boxes[5].original_box_no = 'RENAMED-' + partialBatch.boxes[5].box_no;
    partialBatch.boxes[6].actual_qty = partialBatch.boxes[6].wms_expected_qty - 2;
    const result3 = await BatchService.submitBatch(partialBatch, 'error', 'seed_script');
    console.log(`   部分异常批次创建成功: ${partialBatch.batch_no}, 赔付: ¥${result3.reconciliation.total_compensation}`);

    console.log('\n========================================');
    console.log('造数完成！');
    console.log(`共创建 3 个批次数据`);
    console.log(`正常批次: BATCH-001001`);
    console.log(`异常批次: BATCH-001002`);
    console.log(`部分异常: BATCH-001003`);
    console.log('========================================\n');

  } catch (error) {
    console.error('造数失败:', error.message);
    process.exit(1);
  }
};

seed();
