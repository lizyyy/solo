import { BatchService } from '../src/services';
import { IdempotentStrategy } from '../src/types';
import { resetDatabase } from '../src/database';

const batchService = new BatchService();

function generateSampleBatch(batchNo: string, vin: string, plateNumber: string) {
  return {
    batchNo,
    vin,
    plateNumber,
    responsiblePerson: '张三',
    strategy: IdempotentStrategy.IGNORE,
    inspectionSheets: [
      {
        sheetNo: `INSP-${batchNo}-001`,
        inspector: '李检测',
        inspectionDate: Date.now() - 86400000,
        mileage: 58000,
        overallStatus: 'good',
        items: JSON.stringify([
          { name: '发动机', status: '正常', remark: '运行平稳' },
          { name: '变速箱', status: '正常', remark: '换挡顺畅' },
          { name: '底盘', status: '正常', remark: '无渗漏' },
          { name: '刹车系统', status: '正常', remark: '制动良好' },
          { name: '电器系统', status: '正常', remark: '功能正常' }
        ]),
        remarks: '整车状态良好'
      }
    ],
    repairQuotes: [
      {
        quoteNo: `QUOTE-${batchNo}-001`,
        workshop: '诚信汽修厂',
        quotedBy: '王师傅',
        quoteDate: Date.now() - 43200000,
        totalAmount: 3500,
        items: JSON.stringify([
          { name: '前刹车片更换', cost: 800 },
          { name: '机油三滤保养', cost: 600 },
          { name: '变速箱油更换', cost: 1200 },
          { name: '轮胎动平衡', cost: 200 },
          { name: '四轮定位', cost: 300 },
          { name: '空调清洗', cost: 400 }
        ]),
        laborCost: 1500,
        partsCost: 2000,
        remarks: '含工时费'
      }
    ],
    photoItems: [
      {
        photoNo: `PHOTO-${batchNo}-001`,
        category: '外观',
        name: '车辆左前45度',
        url: `https://example.com/photos/${batchNo}/001.jpg`,
        thumbnail: `https://example.com/photos/${batchNo}/001_thumb.jpg`,
        uploadedBy: '陈拍摄',
        uploadedAt: Date.now() - 3600000,
        isAbnormal: false,
        abnormalDesc: null
      },
      {
        photoNo: `PHOTO-${batchNo}-002`,
        category: '外观',
        name: '车辆右后45度',
        url: `https://example.com/photos/${batchNo}/002.jpg`,
        thumbnail: `https://example.com/photos/${batchNo}/002_thumb.jpg`,
        uploadedBy: '陈拍摄',
        uploadedAt: Date.now() - 3500000,
        isAbnormal: false,
        abnormalDesc: null
      },
      {
        photoNo: `PHOTO-${batchNo}-003`,
        category: '内饰',
        name: '驾驶舱全景',
        url: `https://example.com/photos/${batchNo}/003.jpg`,
        thumbnail: `https://example.com/photos/${batchNo}/003_thumb.jpg`,
        uploadedBy: '陈拍摄',
        uploadedAt: Date.now() - 3400000,
        isAbnormal: false,
        abnormalDesc: null
      },
      {
        photoNo: `PHOTO-${batchNo}-004`,
        category: '发动机舱',
        name: '发动机舱全景',
        url: `https://example.com/photos/${batchNo}/004.jpg`,
        thumbnail: `https://example.com/photos/${batchNo}/004_thumb.jpg`,
        uploadedBy: '陈拍摄',
        uploadedAt: Date.now() - 3300000,
        isAbnormal: true,
        abnormalDesc: '发现气门室盖垫有轻微渗油痕迹'
      },
      {
        photoNo: `PHOTO-${batchNo}-005`,
        category: '底盘',
        name: '底盘全景',
        url: `https://example.com/photos/${batchNo}/005.jpg`,
        thumbnail: `https://example.com/photos/${batchNo}/005_thumb.jpg`,
        uploadedBy: '陈拍摄',
        uploadedAt: Date.now() - 3200000,
        isAbnormal: false,
        abnormalDesc: null
      }
    ],
    smsScreenshots: [
      {
        smsNo: `SMS-${batchNo}-001`,
        sender: '13800138000',
        receiver: '13900139000',
        content: '【诚信汽修】您的车辆整备已完成，费用3500元，请确认后提车。',
        sentAt: Date.now() - 7200000,
        url: `https://example.com/sms/${batchNo}/001.jpg`,
        uploadedBy: '孙助理',
        uploadedAt: Date.now() - 7000000
      },
      {
        smsNo: `SMS-${batchNo}-002`,
        sender: '13900139000',
        receiver: '13800138000',
        content: '好的，明天上午过去提车，谢谢！',
        sentAt: Date.now() - 7100000,
        url: `https://example.com/sms/${batchNo}/002.jpg`,
        uploadedBy: '孙助理',
        uploadedAt: Date.now() - 6900000
      }
    ],
    operator: 'system',
    operatorRole: 'admin'
  };
}

async function main() {
  console.log('正在重置数据库...');
  await resetDatabase();
  console.log('数据库重置完成');

  console.log('\n开始生成测试数据...\n');

  const batches = [
    { batchNo: 'BATCH-2024-001', vin: 'LSVAM4187D2123456', plateNumber: '京A12345' },
    { batchNo: 'BATCH-2024-002', vin: 'LSVAM4187D2123457', plateNumber: '京B67890' },
    { batchNo: 'BATCH-2024-003', vin: 'LSVAM4187D2123456', plateNumber: '京A12345' }
  ];

  for (const batch of batches) {
    console.log(`正在创建批次: ${batch.batchNo} (VIN: ${batch.vin})`);
    const result = await batchService.submitBatch(generateSampleBatch(batch.batchNo, batch.vin, batch.plateNumber));
    console.log(`  状态: ${result.status}, 成功: ${result.successItems}/${result.totalItems} 项`);
  }

  console.log('\n测试数据生成完成!');
  console.log(`\n共创建 ${batches.length} 个批次`);
  console.log(`注意: BATCH-2024-001 和 BATCH-2024-003 使用相同VIN，用于测试同一辆车多次返厂场景`);
}

main().catch(console.error);
