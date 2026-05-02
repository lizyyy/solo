const sampleData = [
  {
    id: 'inspection_001',
    deviceId: 'DEV-001',
    deviceName: '电机A',
    inspector: '张三',
    date: '2024-01-15',
    notes: '设备运行正常，温度略高，建议继续观察。',
    abnormalItems: ['轴承有轻微异响'],
    photos: ['photo_1', 'photo_2'],
    status: 'completed',
    lastModified: Date.now() - 86400000,
    createdAt: Date.now() - 172800000,
    version: 1
  },
  {
    id: 'inspection_002',
    deviceId: 'DEV-002',
    deviceName: '水泵B',
    inspector: '李四',
    date: '2024-01-16',
    notes: '需要更换密封件，已申请备件。',
    abnormalItems: ['密封泄漏', '振动超标'],
    photos: ['photo_3'],
    status: 'pending',
    lastModified: Date.now() - 43200000,
    createdAt: Date.now() - 86400000,
    version: 1
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sampleData };
} else {
  window.sampleData = sampleData;
}
