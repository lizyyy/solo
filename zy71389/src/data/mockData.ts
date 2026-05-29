import {
  UserBucket,
  ExposureLog,
  OperationChange,
  ConversionData,
  ContaminationType
} from '../types';

const baseTime = Date.now() - 7 * 24 * 60 * 60 * 1000;

function hours(h: number): number {
  return baseTime + h * 60 * 60 * 1000;
}

export const mockUserBuckets: UserBucket[] = [
  { userId: 'user_001', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_002', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_003', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_004', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_005', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_006', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_007', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_008', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_009', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_010', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_011', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_012', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_013', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_014', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_015', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_016', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_017', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_018', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_019', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_020', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_021', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_022', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_023', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_024', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_025', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_026', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_027', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_028', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_029', experimentId: 'exp_001', groupId: 'group_A', groupName: '实验组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_030', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(0), bucketVersion: 'v1' },
  { userId: 'user_005', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(24), bucketVersion: 'v2' },
  { userId: 'user_015', experimentId: 'exp_001', groupId: 'group_B', groupName: '对照组', bucketTime: hours(36), bucketVersion: 'v2' },
];

export const mockExposureLogs: ExposureLog[] = [
  { exposureId: 'exp_001', userId: 'user_001', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(2), configVersion: 'v1', deviceId: 'dev_001', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_002', userId: 'user_002', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(3), configVersion: 'v1', deviceId: 'dev_002', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_003', userId: 'user_003', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(4), configVersion: 'v1', deviceId: 'dev_003', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_004', userId: 'user_004', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(5), configVersion: 'v1', deviceId: 'dev_004', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_005', userId: 'user_005', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(6), configVersion: 'v1', deviceId: 'dev_005', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_006', userId: 'user_001', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(7), configVersion: 'v1', deviceId: 'dev_001', pageUrl: '/product', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_007', userId: 'user_006', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(8), configVersion: 'v1', deviceId: 'dev_006', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_008', userId: 'user_007', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(9), configVersion: 'v1', deviceId: 'dev_007', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_009', userId: 'user_008', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(10), configVersion: 'v1', deviceId: 'dev_008', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_010', userId: 'user_009', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(11), configVersion: 'v1', deviceId: 'dev_009', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_011', userId: 'user_010', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(12), configVersion: 'v1', deviceId: 'dev_010', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_012', userId: 'user_011', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(13), configVersion: 'v1', deviceId: 'dev_011', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_013', userId: 'user_012', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(14), configVersion: 'v1', deviceId: 'dev_012', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_014', userId: 'user_013', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(15), configVersion: 'v1', deviceId: 'dev_013', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_015', userId: 'user_014', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(16), configVersion: 'v1', deviceId: 'dev_014', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_016', userId: 'user_015', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(17), configVersion: 'v1', deviceId: 'dev_015', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_017', userId: 'user_016', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(18), configVersion: 'v1', deviceId: 'dev_016', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_018', userId: 'user_017', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(19), configVersion: 'v1', deviceId: 'dev_017', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_019', userId: 'user_018', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(20), configVersion: 'v1', deviceId: 'dev_018', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_020', userId: 'user_019', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(21), configVersion: 'v1', deviceId: 'dev_019', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_021', userId: 'user_020', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(22), configVersion: 'v1', deviceId: 'dev_020', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_022', userId: 'user_021', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(23), configVersion: 'v1', deviceId: 'dev_021', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_023', userId: 'user_022', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(24), configVersion: 'v1', deviceId: 'dev_022', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_024', userId: 'user_023', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(25), configVersion: 'v1', deviceId: 'dev_023', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_025', userId: 'user_024', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(26), configVersion: 'v1', deviceId: 'dev_024', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_026', userId: 'user_025', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(27), configVersion: 'v1', deviceId: 'dev_025', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_027', userId: 'user_026', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(28), configVersion: 'v1', deviceId: 'dev_026', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_028', userId: 'user_027', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(29), configVersion: 'v1', deviceId: 'dev_027', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_029', userId: 'user_028', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(30), configVersion: 'v1', deviceId: 'dev_028', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_030', userId: 'user_029', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(31), configVersion: 'v1', deviceId: 'dev_029', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_031', userId: 'user_030', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(32), configVersion: 'v1', deviceId: 'dev_030', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_032', userId: 'user_001', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(33), configVersion: 'v1', deviceId: 'dev_001', pageUrl: '/checkout', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_033', userId: 'user_002', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(34), configVersion: 'v1', deviceId: 'dev_002', pageUrl: '/checkout', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_034', userId: 'user_003', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(35), configVersion: 'v1', deviceId: 'dev_003', pageUrl: '/checkout', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_035', userId: 'user_004', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(36), configVersion: 'v1', deviceId: 'dev_004', pageUrl: '/checkout', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_036', userId: 'user_005', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(37), configVersion: 'v1', deviceId: 'dev_005', pageUrl: '/checkout', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_037', userId: 'user_006', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(38), configVersion: 'v1', deviceId: 'dev_006', pageUrl: '/checkout', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_038', userId: 'user_007', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(39), configVersion: 'v1', deviceId: 'dev_007', pageUrl: '/checkout', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_039', userId: 'user_008', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(40), configVersion: 'v1', deviceId: 'dev_008', pageUrl: '/checkout', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_040', userId: 'user_009', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(41), configVersion: 'v1', deviceId: 'dev_009', pageUrl: '/checkout', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_041', userId: 'user_010', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(42), configVersion: 'v1', deviceId: 'dev_010', pageUrl: '/checkout', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_042', userId: 'user_001', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(43), configVersion: 'v2', deviceId: 'dev_001', pageUrl: '/success', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_043', userId: 'user_011', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(44), configVersion: 'v2', deviceId: 'dev_011', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_044', userId: 'user_012', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(45), configVersion: 'v2', deviceId: 'dev_012', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_045', userId: 'user_013', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(46), configVersion: 'v2', deviceId: 'dev_013', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_046', userId: 'user_014', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(47), configVersion: 'v2', deviceId: 'dev_014', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_047', userId: 'user_015', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(48), configVersion: 'v2', deviceId: 'dev_015', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_048', userId: 'user_016', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(49), configVersion: 'v2', deviceId: 'dev_016', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_049', userId: 'user_017', experimentId: 'exp_001', groupId: 'group_A', exposureTime: hours(50), configVersion: 'v2', deviceId: 'dev_017', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
  { exposureId: 'exp_050', userId: 'user_018', experimentId: 'exp_001', groupId: 'group_B', exposureTime: hours(51), configVersion: 'v2', deviceId: 'dev_018', pageUrl: '/home', isContaminated: false, contaminationType: ContaminationType.NONE },
];

export const mockOperationChanges: OperationChange[] = [
  { changeId: 'change_001', experimentId: 'exp_001', changeType: 'traffic', changeTime: hours(24), operator: '运营_小张', changeDescription: '调整实验组流量比例从50%调整为30%', oldValue: '50%', newValue: '30%' },
  { changeId: 'change_002', experimentId: 'exp_001', changeType: 'config', changeTime: hours(36), operator: '运营_小李', changeDescription: '更新优惠券面额从10元调整为20元', oldValue: '10元', newValue: '20元' },
  { changeId: 'change_003', experimentId: 'exp_001', changeType: 'group', changeTime: hours(48), operator: '产品_小王', changeDescription: '新增实验组策略', oldValue: '2组', newValue: '3组' },
];

export const mockConversionData: ConversionData[] = [
  { conversionId: 'conv_001', userId: 'user_001', exposureId: 'exp_001', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(2.5) },
  { conversionId: 'conv_002', userId: 'user_001', exposureId: 'exp_001', conversionEvent: 'add_to_cart', conversionValue: 99, conversionTime: hours(2.8) },
  { conversionId: 'conv_003', userId: 'user_001', exposureId: 'exp_001', conversionEvent: 'purchase', conversionValue: 299, conversionTime: hours(3) },
  { conversionId: 'conv_004', userId: 'user_003', exposureId: 'exp_003', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(4.5) },
  { conversionId: 'conv_005', userId: 'user_003', exposureId: 'exp_003', conversionEvent: 'add_to_cart', conversionValue: 199, conversionTime: hours(4.8) },
  { conversionId: 'conv_006', userId: 'user_003', exposureId: 'exp_003', conversionEvent: 'purchase', conversionValue: 599, conversionTime: hours(5) },
  { conversionId: 'conv_007', userId: 'user_005', exposureId: 'exp_005', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(6.2) },
  { conversionId: 'conv_008', userId: 'user_005', exposureId: 'exp_005', conversionEvent: 'purchase', conversionValue: 159, conversionTime: hours(6.5) },
  { conversionId: 'conv_009', userId: 'user_007', exposureId: 'exp_008', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(9.1) },
  { conversionId: 'conv_010', userId: 'user_007', exposureId: 'exp_008', conversionEvent: 'add_to_cart', conversionValue: 299, conversionTime: hours(9.3) },
  { conversionId: 'conv_011', userId: 'user_009', exposureId: 'exp_009', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(11.2) },
  { conversionId: 'conv_012', userId: 'user_011', exposureId: 'exp_011', conversionEvent: 'purchase', conversionValue: 399, conversionTime: hours(13.5) },
  { conversionId: 'conv_013', userId: 'user_013', exposureId: 'exp_013', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(15.2) },
  { conversionId: 'conv_014', userId: 'user_013', exposureId: 'exp_013', conversionEvent: 'add_to_cart', conversionValue: 129, conversionTime: hours(15.5) },
  { conversionId: 'conv_015', userId: 'user_015', exposureId: 'exp_015', conversionEvent: 'purchase', conversionValue: 259, conversionTime: hours(17.3) },
  { conversionId: 'conv_016', userId: 'user_017', exposureId: 'exp_017', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(19.1) },
  { conversionId: 'conv_017', userId: 'user_019', exposureId: 'exp_019', conversionEvent: 'add_to_cart', conversionValue: 89, conversionTime: hours(21.4) },
  { conversionId: 'conv_018', userId: 'user_019', exposureId: 'exp_019', conversionEvent: 'purchase', conversionValue: 449, conversionTime: hours(21.8) },
  { conversionId: 'conv_019', userId: 'user_021', exposureId: 'exp_021', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(23.2) },
  { conversionId: 'conv_020', userId: 'user_023', exposureId: 'exp_023', conversionEvent: 'purchase', conversionValue: 189, conversionTime: hours(25.6) },
  { conversionId: 'conv_021', userId: 'user_025', exposureId: 'exp_025', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(27.3) },
  { conversionId: 'conv_022', userId: 'user_027', exposureId: 'exp_027', conversionEvent: 'add_to_cart', conversionValue: 159, conversionTime: hours(29.1) },
  { conversionId: 'conv_023', userId: 'user_027', exposureId: 'exp_027', conversionEvent: 'purchase', conversionValue: 329, conversionTime: hours(29.5) },
  { conversionId: 'conv_024', userId: 'user_029', exposureId: 'exp_029', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(31.2) },
  { conversionId: 'conv_025', userId: 'user_001', exposureId: 'exp_032', conversionEvent: 'purchase', conversionValue: 199, conversionTime: hours(33.5) },
  { conversionId: 'conv_026', userId: 'user_003', exposureId: 'exp_034', conversionEvent: 'purchase', conversionValue: 279, conversionTime: hours(35.2) },
  { conversionId: 'conv_027', userId: 'user_005', exposureId: 'exp_036', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(37.1) },
  { conversionId: 'conv_028', userId: 'user_007', exposureId: 'exp_038', conversionEvent: 'purchase', conversionValue: 459, conversionTime: hours(39.4) },
  { conversionId: 'conv_029', userId: 'user_009', exposureId: 'exp_040', conversionEvent: 'view_product', conversionValue: 0, conversionTime: hours(41.2) },
  { conversionId: 'conv_030', userId: 'user_001', exposureId: 'exp_042', conversionEvent: 'purchase', conversionValue: 599, conversionTime: hours(43.5) },
];

export const mockSampleCSVFiles = {
  userBuckets: `userId,experimentId,groupId,groupName,bucketTime,bucketVersion
user_001,exp_001,group_A,实验组,${hours(0)},v1
user_002,exp_001,group_B,对照组,${hours(0)},v1
user_003,exp_001,group_A,实验组,${hours(0)},v1
user_004,exp_001,group_B,对照组,${hours(0)},v1
user_005,exp_001,group_A,实验组,${hours(0)},v1
user_006,exp_001,group_B,对照组,${hours(0)},v1
user_007,exp_001,group_A,实验组,${hours(0)},v1
user_008,exp_001,group_B,对照组,${hours(0)},v1
user_009,exp_001,group_A,实验组,${hours(0)},v1
user_010,exp_001,group_B,对照组,${hours(0)},v1`,

  exposureLogs: `exposureId,userId,experimentId,groupId,exposureTime,configVersion,deviceId,pageUrl
exp_001,user_001,exp_001,group_A,${hours(2)},v1,dev_001,/home
exp_002,user_002,exp_001,group_B,${hours(3)},v1,dev_002,/home
exp_003,user_003,exp_001,group_A,${hours(4)},v1,dev_003,/home
exp_004,user_004,exp_001,group_B,${hours(5)},v1,dev_004,/home
exp_005,user_005,exp_001,group_A,${hours(6)},v1,dev_005,/home
exp_006,user_001,exp_001,group_A,${hours(7)},v1,dev_001,/product
exp_007,user_006,exp_001,group_B,${hours(8)},v1,dev_006,/home
exp_008,user_007,exp_001,group_A,${hours(9)},v1,dev_007,/home
exp_009,user_008,exp_001,group_B,${hours(10)},v1,dev_008,/home
exp_010,user_009,exp_001,group_A,${hours(11)},v1,dev_009,/home`,

  operationChanges: `changeId,experimentId,changeType,changeTime,operator,changeDescription,oldValue,newValue
change_001,exp_001,traffic,${hours(24)},运营_小张,调整实验组流量比例从50%调整为30%,50%,30%
change_002,exp_001,config,${hours(36)},运营_小李,更新优惠券面额从10元调整为20元,10元,20元`,

  conversionData: `conversionId,userId,exposureId,conversionEvent,conversionValue,conversionTime
conv_001,user_001,exp_001,view_product,0,${hours(2.5)}
conv_002,user_001,exp_001,add_to_cart,99,${hours(2.8)}
conv_003,user_001,exp_001,purchase,299,${hours(3)}
conv_004,user_003,exp_003,view_product,0,${hours(4.5)}
conv_005,user_003,exp_003,add_to_cart,199,${hours(4.8)}
conv_006,user_003,exp_003,purchase,599,${hours(5)}
conv_007,user_005,exp_005,view_product,0,${hours(6.2)}
conv_008,user_005,exp_005,purchase,159,${hours(6.5)}
conv_009,user_007,exp_008,view_product,0,${hours(9.1)}
conv_010,user_007,exp_008,add_to_cart,299,${hours(9.3)}`,

  experimentConfig: `experimentId,experimentName,version,configData,startTime,endTime,createdAt
exp_001,新用户首单优惠实验,v1,{"couponAmount":10,"trafficRatio":0.5},${hours(0)},${hours(72)},${hours(0)}
exp_001,新用户首单优惠实验,v2,{"couponAmount":20,"trafficRatio":0.3},${hours(36)},${hours(72)},${hours(36)}`
};
