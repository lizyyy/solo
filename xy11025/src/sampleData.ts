import { ReturnBucketCreateRequest, ReturnBucketStatus } from './types';
import { returnBucketService } from './service';

export const sampleNormalRecord: ReturnBucketCreateRequest = {
  bucketNumber: 'WT-2024-00123',
  bucketType: '18.9L标准桶',
  waterStationId: 'WS001',
  waterStationName: '朝阳区建国门水站',
  deliveryTeamId: 'DT001',
  deliveryTeamName: '朝阳一队',
  driverId: 'DRV001',
  driverName: '张师傅',
  driverPhone: '13800138001',
  customerId: 'CUS001',
  customerName: '李先生',
  customerPhone: '13900139001',
  customerAddress: '北京市朝阳区建国路88号',
  customerAddressDetail: 'SOHO现代城A座1502室',
  returnDate: '2024-05-15',
  returnQuantity: 5,
  returnReason: '客户订水减少，退回闲置空桶',
  bucketCondition: '完好',
  hasDamage: false,
  operatorId: 'OP001',
  operatorName: '管理员小王',
  remark: '正常退桶'
};

export const sampleRejectedRecord: ReturnBucketCreateRequest = {
  bucketNumber: 'WT',
  bucketType: '18.9L标准桶',
  waterStationId: 'WS002',
  waterStationName: '海淀区中关村水站',
  deliveryTeamId: 'DT002',
  deliveryTeamName: '海淀二队',
  driverId: 'DRV002',
  driverName: '',
  driverPhone: '',
  customerId: 'CUS002',
  customerName: '',
  customerPhone: '',
  customerAddress: '北京市海淀区中关村大街1号',
  customerAddressDetail: '',
  returnDate: 'invalid-date',
  returnQuantity: 0,
  returnReason: '',
  bucketCondition: '',
  hasDamage: false,
  operatorId: 'OP001',
  operatorName: '管理员小王'
};

export const sampleSupplementRecord: ReturnBucketCreateRequest = {
  bucketNumber: 'WT-2024-00456',
  bucketType: '18.9L标准桶',
  waterStationId: 'WS003',
  waterStationName: '西城区金融街水站',
  deliveryTeamId: 'DT003',
  deliveryTeamName: '西城三队',
  driverId: 'DRV003',
  driverName: '王师傅',
  driverPhone: '13800138003',
  customerId: 'CUS003',
  customerName: '赵女士',
  customerPhone: '13900139003',
  customerAddress: '北京市西城区金融街7号',
  customerAddressDetail: '英蓝国际金融中心B1层',
  returnDate: '2024-05-16',
  returnQuantity: 3,
  returnReason: '客户搬迁退桶',
  bucketCondition: '轻微磨损',
  hasDamage: true,
  damageDescription: '桶底有轻微划痕，不影响使用',
  operatorId: 'OP001',
  operatorName: '管理员小王',
  remark: '有破损，需补充材料'
};

export const sampleDuplicateBucketRecord: ReturnBucketCreateRequest = {
  bucketNumber: 'WT-2024-00123',
  bucketType: '18.9L标准桶',
  waterStationId: 'WS004',
  waterStationName: '东城区王府井水站',
  deliveryTeamId: 'DT004',
  deliveryTeamName: '东城四队',
  driverId: 'DRV004',
  driverName: '刘师傅',
  driverPhone: '13800138004',
  customerId: 'CUS004',
  customerName: '孙先生',
  customerPhone: '13900139004',
  customerAddress: '北京市东城区王府井大街138号',
  customerAddressDetail: '新东安市场5楼',
  returnDate: '2024-05-17',
  returnQuantity: 1,
  returnReason: '终止合作退桶',
  bucketCondition: '完好',
  hasDamage: false,
  operatorId: 'OP001',
  operatorName: '管理员小王'
};

export const sampleBatchRecords: ReturnBucketCreateRequest[] = [
  sampleNormalRecord,
  {
    ...sampleNormalRecord,
    bucketNumber: 'WT-2024-00124',
    customerName: '王先生',
    customerPhone: '13900139005',
    returnQuantity: 2
  },
  {
    ...sampleNormalRecord,
    bucketNumber: 'WT-2024-00125',
    customerName: '陈女士',
    customerPhone: '13900139006',
    returnQuantity: 8
  },
  sampleRejectedRecord,
  sampleSupplementRecord
];

export function initSampleData(): void {
  returnBucketService.createSingleRecord(sampleNormalRecord);

  const completedRecord = returnBucketService.createSingleRecord({
    ...sampleNormalRecord,
    bucketNumber: 'WT-2024-00100'
  });
  if (completedRecord.record.id) {
    returnBucketService.updateRecordStatus(
      completedRecord.record.id,
      ReturnBucketStatus.COMPLETED,
      'OP002',
      '管理员小李',
      undefined,
      '材料齐全，已完成核验'
    );
  }
}
