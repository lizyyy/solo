// ========== 样例数据 ==========
// 覆盖以下场景：
// 1. 顺利记录（正常过）
// 2. 需要人工确认的记录
// 3. 从排练群截图补来的旧口径
// 4. 旧版母带
// 5. 重复曲目
// 6. 缺授权
// 7. 人工改名的记录
// 8. 空值测试
// 9. 边界记录
// 10. 损坏文件（导入时会出错，但不影响其他）

(function() {
  const { createTrackRecord, createAnomaly, createAnnotation, ANOMALY_TYPES, SEVERITY, STATUS } = window.DataModels;

// 1. 顺利记录 - 正常过
const record1 = createTrackRecord({
  fileName: '肖邦练习曲Op.10 No.12_王小明_20260528.wav',
  trackName: '肖邦练习曲 Op.10 No.12 "革命"',
  artist: '王小明',
  durationMinutes: 4.2,
  roomNumber: 'A-302',
  bookingDate: '2026-05-28',
  bookingTime: '14:00-15:00',
  depositAmount: 200,
  licenseStatus: 'authorized',
  isOldMaster: false,
  isRenamed: false,
  source: 'system',
  status: STATUS.CONFIRMED,
  annotations: [
    createAnnotation('林老师说这孩子弹得不错，节奏稳', 'manual', '张老师')
  ],
  anomalies: [],
  processingNotes: [
    { author: '小李', content: '检查过了，文件完整，授权在有效期内，没问题', time: '2026-05-28 16:30' }
  ]
});

// 2. 需要人工确认的记录 - 曲目名称有歧义
const record2 = createTrackRecord({
  fileName: '月光_李晓华_20260529.mp3',
  trackName: '月光',
  artist: '李晓华',
  durationMinutes: 5.8,
  roomNumber: 'B-201',
  bookingDate: '2026-05-29',
  bookingTime: '10:00-11:00',
  depositAmount: 200,
  licenseStatus: 'pending',
  isOldMaster: false,
  isRenamed: false,
  source: 'system',
  status: STATUS.NEEDS_REVIEW,
  annotations: [
    createAnnotation('曲目名只写了"月光"，不确定是德彪西的还是贝多芬的', 'manual', '小李')
  ],
  anomalies: [
    createAnomaly(ANOMALY_TYPES.BOUNDARY, '曲目名称太模糊，可能是德彪西《月光》也可能是贝多芬《月光奏鸣曲》，得问下林老师', 'trackName', SEVERITY.REVIEW)
  ],
  processingNotes: [
    { author: '小李', content: '系统识别不出是哪首月光，先挂着等林老师确认', time: '2026-05-29 12:15' }
  ]
});

// 3. 从排练群截图补来的旧口径
const record3 = createTrackRecord({
  fileName: '（群截图）黄河大合唱第四乐章_合唱团_20260520.jpg',
  trackName: '黄河大合唱 第四乐章 "黄水谣"',
  artist: '学生合唱团',
  durationMinutes: 8.5,
  roomNumber: 'C-101（大排练厅）',
  bookingDate: '2026-05-20',
  bookingTime: '19:00-21:00',
  depositAmount: 500,  // 旧口径：排练厅押金500
  licenseStatus: 'authorized',
  isOldMaster: false,
  isRenamed: false,
  source: 'group_screenshot',
  sourceNote: '从5月21日排练群截图补录，当时还没上系统，押金标准是老规矩',
  status: STATUS.CONFIRMED,
  annotations: [
    createAnnotation('这单是上周合唱团排练的，群里发的截图，林老师说按旧规矩算', 'manual', '小王'),
    createAnnotation('注意：旧口径押金是500，不是现在的200，别算错了', 'anomaly_explain', '小王')
  ],
  anomalies: [
    createAnomaly(ANOMALY_TYPES.OLD_STANDARD, '数据来自排练群截图，押金按旧标准500元执行，不是当前系统默认的200元', 'depositAmount', SEVERITY.WARN)
  ],
  processingNotes: [
    { author: '小王', content: '群里翻到的截图，林老师微信说过可以按旧标准，我备注了', time: '2026-05-27 09:45' },
    { author: '张老师', content: '知道了，这种以后尽量少，最好走系统', time: '2026-05-27 10:20' }
  ]
});

// 4. 旧版母带
const record4 = createTrackRecord({
  fileName: '李斯特爱之梦_张伟_OLD_20260525.wav',
  trackName: '李斯特 爱之梦 No.3',
  artist: '张伟',
  durationMinutes: 5.1,
  roomNumber: 'A-305',
  bookingDate: '2026-05-25',
  bookingTime: '15:00-16:00',
  depositAmount: 200,
  licenseStatus: 'authorized',
  isOldMaster: true,
  isRenamed: false,
  source: 'system',
  status: STATUS.PENDING,
  annotations: [],
  anomalies: [
    createAnomaly(ANOMALY_TYPES.OLD_MASTER, '文件名带OLD标记，是旧版母带。按规定旧版母带扣50元押金', 'fileName', SEVERITY.ERROR)
  ],
  processingNotes: []
});

// 5. 重复曲目 - 同一个人同一首曲子报了两次
const record5a = createTrackRecord({
  fileName: '贝多芬奏鸣曲Op.57_陈小红_20260526_1.mp3',
  trackName: '贝多芬奏鸣曲 Op.57 "热情"',
  artist: '陈小红',
  durationMinutes: 7.3,
  roomNumber: 'B-203',
  bookingDate: '2026-05-26',
  bookingTime: '09:00-10:00',
  depositAmount: 200,
  licenseStatus: 'authorized',
  isOldMaster: false,
  isRenamed: false,
  source: 'system',
  status: STATUS.PENDING,
  annotations: [],
  anomalies: [],
  processingNotes: []
});

const record5b = createTrackRecord({
  fileName: '贝多芬热情奏鸣曲_陈小红_20260526_2.mp3',
  trackName: '贝多芬奏鸣曲 Op.57 "热情"',
  artist: '陈小红',
  durationMinutes: 7.3,
  roomNumber: 'B-203',
  bookingDate: '2026-05-26',
  bookingTime: '09:00-10:00',
  depositAmount: 200,
  licenseStatus: 'authorized',
  isOldMaster: false,
  isRenamed: false,
  source: 'system',
  status: STATUS.PENDING,
  annotations: [],
  anomalies: [],
  processingNotes: []
});

// 6. 缺授权
const record6 = createTrackRecord({
  fileName: '舒伯特即兴曲_刘洋_20260527.mp3',
  trackName: '舒伯特即兴曲 Op.90 No.3',
  artist: '刘洋',
  durationMinutes: 4.8,
  roomNumber: 'A-301',
  bookingDate: '2026-05-27',
  bookingTime: '11:00-12:00',
  depositAmount: 200,
  licenseStatus: 'none',
  isOldMaster: false,
  isRenamed: false,
  source: 'system',
  status: STATUS.PENDING,
  annotations: [],
  anomalies: [
    createAnomaly(ANOMALY_TYPES.UNAUTHORIZED, '没查到版权授权记录，按规定缺授权扣100元', 'licenseStatus', SEVERITY.ERROR)
  ],
  processingNotes: []
});

// 7. 人工改名的记录
const record7 = createTrackRecord({
  fileName: '未命名_20260524_修改版.mp3',
  trackName: '肖邦夜曲 Op.9 No.2',
  artist: '赵雅琴',
  durationMinutes: 3.9,
  roomNumber: 'B-205',
  bookingDate: '2026-05-24',
  bookingTime: '16:00-17:00',
  depositAmount: 200,
  licenseStatus: 'authorized',
  isOldMaster: false,
  isRenamed: true,
  source: 'manual',
  sourceNote: '原文件名叫"未命名_20260524.mp3"，林老师微信告诉我这是赵雅琴的肖邦夜曲，我手动改的',
  status: STATUS.PENDING,
  annotations: [
    createAnnotation('原文件名太乱，我按林老师说的改了，原始文件名我备注在这了：未命名_20260524.mp3', 'manual', '小李')
  ],
  anomalies: [
    createAnomaly(ANOMALY_TYPES.RENAMED, '文件名是人工改过的，原文件名叫"未命名_20260524.mp3"，林老师确认过是赵雅琴的肖邦夜曲Op.9 No.2', 'fileName', SEVERITY.WARN)
  ],
  processingNotes: []
});

// 8. 空值测试 - 缺必要字段
const record8 = createTrackRecord({
  fileName: 'unknown_file.wav',
  trackName: '',  // 空的
  artist: '',     // 空的
  durationMinutes: 0,
  roomNumber: '',
  bookingDate: '',
  bookingTime: '',
  depositAmount: 0,
  licenseStatus: 'pending',
  isOldMaster: false,
  isRenamed: false,
  source: 'system',
  status: STATUS.PENDING,
  annotations: [],
  anomalies: [],
  processingNotes: []
});

// 9. 边界记录 - 刚好1小时，押金刚好用完
const record9 = createTrackRecord({
  fileName: '巴赫平均律第一册C大调_孙浩_20260523.mp3',
  trackName: '巴赫平均律第一册 C大调前奏曲与赋格 BWV846',
  artist: '孙浩',
  durationMinutes: 60.0,  // 刚好1小时边界
  roomNumber: 'A-308',
  bookingDate: '2026-05-23',
  bookingTime: '08:00-09:00',
  depositAmount: 200,
  licenseStatus: 'authorized',
  isOldMaster: false,
  isRenamed: false,
  source: 'system',
  status: STATUS.PENDING,
  annotations: [],
  anomalies: [
    createAnomaly(ANOMALY_TYPES.BOUNDARY, '时长刚好60分钟整，踩在超时边界上，人工确认下有没有真的超时', 'durationMinutes', SEVERITY.REVIEW)
  ],
  processingNotes: []
});

// 10. 模拟损坏文件（导入时会抛错，但不影响其他）
const corruptRawData = {
  fileName: '坏文件_corrupt_20260522.dat',
  rawContent: '这不是有效的音频文件\x00\x01\x02垃圾数据',
  isCorrupt: true
};

  // ========== 导出 ==========
  window.SampleData = {
    normalRecords: [record1, record2, record3, record4, record5a, record5b, record6, record7, record8, record9],
    corruptRawData: corruptRawData,
    getAllRecords: function() {
      return [record1, record2, record3, record4, record5a, record5b, record6, record7, record8, record9];
    }
  };
})();
