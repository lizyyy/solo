import { dbReady } from '../database';
import { SampleService } from '../services/SampleService';
import { ExceptionService } from '../services/ExceptionService';
import { BatchService } from '../services/BatchService';
import { SampleStatus, ExceptionType } from '../types';

const handlers = ['张三', '李四', '王五', '赵六', '钱七', '孙八'];
const collectionPoints = ['北京采集中心', '上海采样点A', '广州实验室', '深圳医院'];
const destinations = ['北京中心实验室', '上海检测中心', '广州总部实验室'];
const sampleTypes = ['血液', '唾液', '组织', '尿液', 'DNA样本'];

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

async function createSampleWithHistory(barcode: string, statuses: SampleStatus[], hasException = false) {
  const type = randomItem(sampleTypes);
  const collectionPoint = randomItem(collectionPoints);
  const destination = randomItem(destinations);
  
  const sample = await SampleService.createSample({
    barcode,
    type,
    collectionPoint,
    destinationLab: destination,
    currentLocation: collectionPoint,
    currentHandler: handlers[0]
  });

  console.log(`创建样本: ${barcode} - ${type}`);

  let currentLocation = collectionPoint;
  let currentHandler = handlers[0];
  const transferLocations = ['冷链运输1号', '中转站A', '配送中心'];

  for (let i = 1; i < statuses.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (statuses[i] === SampleStatus.IN_TRANSIT && i > 1) {
      const toHandler = handlers[i % handlers.length];
      const toLocation = transferLocations[i % transferLocations.length];
      
      await SampleService.transferSample({
        sampleId: sample.id,
        fromHandler: currentHandler,
        toHandler,
        fromLocation: currentLocation,
        toLocation,
        transferTime: new Date(Date.now() - (statuses.length - i) * 3600000).toISOString(),
        temperature: 2 + Math.random() * 8
      });
      
      currentHandler = toHandler;
      currentLocation = toLocation;
    }

    await SampleService.updateSampleStatus(
      sample.id,
      statuses[i],
      currentHandler,
      `状态更新为 ${statuses[i]}`
    );
  }

  if (hasException) {
    await ExceptionService.reportException({
      sampleId: sample.id,
      type: randomItem([ExceptionType.TEMPERATURE_EXCEEDED, ExceptionType.DELAYED, ExceptionType.DAMAGED]),
      description: '样本在运输过程中发现异常，需要进一步检查',
      reportedBy: currentHandler
    });
    console.log(`  - 报告异常`);
  }

  return sample;
}

async function seed() {
  console.log('开始生成演示数据...\n');

  await dbReady;
  
  try {
    const sample1 = await createSampleWithHistory('SAM001', [
      SampleStatus.CREATED,
      SampleStatus.COLLECTED,
      SampleStatus.IN_TRANSIT,
      SampleStatus.ARRIVED,
      SampleStatus.TESTING,
      SampleStatus.COMPLETED
    ]);

    const sample2 = await createSampleWithHistory('SAM002', [
      SampleStatus.CREATED,
      SampleStatus.COLLECTED,
      SampleStatus.IN_TRANSIT,
      SampleStatus.ARRIVED,
      SampleStatus.TESTING
    ]);

    const sample3 = await createSampleWithHistory('SAM003', [
      SampleStatus.CREATED,
      SampleStatus.COLLECTED,
      SampleStatus.IN_TRANSIT,
      SampleStatus.EXCEPTION
    ], true);

    const sample4 = await createSampleWithHistory('SAM004', [
      SampleStatus.CREATED,
      SampleStatus.COLLECTED,
      SampleStatus.IN_TRANSIT
    ]);

    const sample5 = await createSampleWithHistory('SAM005', [
      SampleStatus.CREATED,
      SampleStatus.COLLECTED
    ]);

    const sample6 = await createSampleWithHistory('SAM006', [
      SampleStatus.CREATED,
      SampleStatus.COLLECTED,
      SampleStatus.IN_TRANSIT,
      SampleStatus.LOST
    ]);

    console.log('\n创建批次数据...');
    const batch1 = await BatchService.createBatch({
      batchNumber: 'BATCH2024001',
      origin: '北京采集中心',
      destination: '北京中心实验室',
      courier: '顺丰冷链',
      estimatedArrival: new Date(Date.now() - 86400000).toISOString()
    });
    console.log(`创建批次: ${batch1.batchNumber}`);

    await BatchService.addSampleToBatch(batch1.id, sample1.id);
    await BatchService.addSampleToBatch(batch1.id, sample2.id);
    await BatchService.addSampleToBatch(batch1.id, sample3.id);
    console.log(`  - 已关联样本: SAM001, SAM002, SAM003`);

    await BatchService.updateBatchStatus(batch1.id, 'SHIPPING');
    console.log(`  - 批次状态: 运输中`);

    const batch2 = await BatchService.createBatch({
      batchNumber: 'BATCH2024002',
      origin: '上海采样点A',
      destination: '上海检测中心',
      courier: '京东物流',
      estimatedArrival: new Date(Date.now() + 86400000).toISOString()
    });
    console.log(`创建批次: ${batch2.batchNumber}`);

    await BatchService.addSampleToBatch(batch2.id, sample4.id);
    await BatchService.addSampleToBatch(batch2.id, sample5.id);
    console.log(`  - 已关联样本: SAM004, SAM005`);

    console.log('\n演示数据生成完成！');
    console.log('样本条码列表: SAM001, SAM002, SAM003, SAM004, SAM005, SAM006');
    console.log('SAM001 - 完整流程，已完成');
    console.log('SAM002 - 检测中');
    console.log('SAM003 - 异常状态，有异常记录');
    console.log('SAM004 - 运输中');
    console.log('SAM005 - 已采集');
    console.log('SAM006 - 已丢失');
    console.log('\n批次列表: BATCH2024001, BATCH2024002');
    console.log('BATCH2024001 - 运输中，包含样本: SAM001, SAM002, SAM003');
    console.log('BATCH2024002 - 准备中，包含样本: SAM004, SAM005');

  } catch (error) {
    console.error('生成演示数据失败:', error);
  }

  process.exit(0);
}

seed();
