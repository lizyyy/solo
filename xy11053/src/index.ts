import { BookingService } from './services/BookingService';
import { ExportService } from './services/ExportService';
import { MaterialType } from './types';

async function main() {
  console.log('=== 篮球场预约处球场雨天顺延 API 演示 ===\n');

  const bookingService = new BookingService();
  const exportService = new ExportService(bookingService);

  console.log('1. 演示单条人工处理 - 正常顺延:');
  const singleResult = bookingService.processSinglePostpone({
    bookingNo: 'BB-20240518-001',
    rainStartTime: '2024-05-18 08:30:00',
    rainEndTime: '2024-05-18 11:30:00',
    rainLevel: '小雨',
    materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
    materialUrls: ['http://example.com/weather.jpg'],
    handlerName: '管理员',
    remarks: '正常顺延'
  });
  console.log('处理结果:', JSON.stringify(singleResult, null, 2));
  console.log('\n');

  console.log('2. 演示单条人工处理 - 半场已打完又申请整场顺延:');
  const halfPlayedResult = bookingService.processSinglePostpone({
    bookingNo: 'BB-20240518-002',
    rainStartTime: '2024-05-18 14:30:00',
    rainEndTime: '2024-05-18 16:30:00',
    rainLevel: '中雨',
    materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD, MaterialType.HALF_COURT_CONFIRM, MaterialType.CUSTOMER_SIGNATURE],
    materialUrls: ['http://example.com/weather.jpg'],
    handlerName: '管理员',
    isHalfPlayed: true,
    halfPlayedDuration: 60,
    remarks: '半场已打完，申请顺延整场'
  });
  console.log('处理结果:', JSON.stringify(halfPlayedResult, null, 2));
  console.log('\n');

  console.log('3. 演示批量补录处理:');
  const batchResult = bookingService.processBatchPostpone({
    batchNo: 'BATCH-20240518-001',
    handlerName: '管理员',
    handleTime: '2024-05-18 10:00:00',
    records: [
      {
        bookingNo: 'BB-20240518-003',
        rainStartTime: '2024-05-18 18:30:00',
        rainEndTime: '2024-05-18 20:30:00',
        rainLevel: '大雨',
        materials: [MaterialType.RAIN_REPORT, MaterialType.ON_SITE_PHOTO],
        materialUrls: [],
        handlerName: '管理员'
      }
    ]
  });
  console.log('批量处理结果:');
  console.log('  批次号:', batchResult.batchNo);
  console.log('  总数量:', batchResult.totalCount);
  console.log('  成功数量:', batchResult.successCount);
  console.log('  失败数量:', batchResult.failedCount);
  console.log('  异常记录数量:', batchResult.exceptionCount);
  console.log('\n');

  console.log('4. 正常记录与异常记录分离:');
  console.log('  正常记录数量:', bookingService.getNormalRecords().length);
  console.log('  异常记录数量:', bookingService.getExceptionRecords().length);
  console.log('\n');

  console.log('5. 顺延统计一致性检查:');
  const consistencyResult = bookingService.checkConsistency();
  console.log('  是否一致:', consistencyResult.isConsistent);
  console.log('  总记录数:', consistencyResult.totalRecords);
  console.log('  顺延记录数:', consistencyResult.postponedCount);
  console.log('  半场打完整场顺延记录数:', consistencyResult.halfPlayedFullPostponedCount);
  if (consistencyResult.inconsistencies.length > 0) {
    console.log('  不一致项:', consistencyResult.inconsistencies);
  }
  console.log('\n');

  console.log('6. 导出CSV文件（保留关键业务列）:');
  const exportPath = await exportService.exportToCsv({
    includeNormalRecords: true,
    includeExceptionRecords: true
  });
  console.log('  导出文件路径:', exportPath);
  console.log('\n');

  console.log('=== 演示结束 ===');
}

main().catch(console.error);
