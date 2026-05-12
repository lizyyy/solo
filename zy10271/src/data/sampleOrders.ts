export const sampleOrders = [
  {
    orderNo: 'ORD-2024-001',
    customerName: '张三',
    phone: '13800138001',
    leftEye: { sphere: -2.5, cylinder: -0.5, axis: 90 },
    rightEye: { sphere: -2.75, cylinder: -0.75, axis: 85 },
    lens: { brand: '依视路', refractiveIndex: '1.60', coating: '防蓝光', type: 'single-vision' as const },
    frame: '雷朋 RB3025'
  },
  {
    orderNo: 'ORD-2024-002',
    customerName: '李四',
    phone: '13800138002',
    leftEye: { sphere: -4.0, cylinder: 0, axis: 0 },
    rightEye: { sphere: -3.75, cylinder: -0.25, axis: 180 },
    lens: { brand: '蔡司', refractiveIndex: '1.67', coating: '钻立方', type: 'single-vision' as const },
    frame: 'Oakley Holbrook'
  },
  {
    orderNo: 'ORD-2024-003',
    customerName: '王五',
    phone: '13800138003',
    leftEye: { sphere: +1.5, cylinder: -0.5, axis: 75 },
    rightEye: { sphere: +1.75, cylinder: -0.5, axis: 80 },
    lens: { brand: '豪雅', refractiveIndex: '1.56', coating: 'UV400', type: 'single-vision' as const },
    frame: '精工 H0101'
  },
  {
    orderNo: 'ORD-2024-004',
    customerName: '赵六',
    phone: '13800138004',
    leftEye: { sphere: -6.0, cylinder: -1.0, axis: 100 },
    rightEye: { sphere: -5.75, cylinder: -1.25, axis: 95 },
    lens: { brand: '明月', refractiveIndex: '1.74', coating: '防蓝光', type: 'single-vision' as const },
    frame: '暴龙 BL301'
  },
  {
    orderNo: 'ORD-2024-005',
    customerName: '孙七',
    phone: '13800138005',
    leftEye: { sphere: -3.25, cylinder: -0.75, axis: 170 },
    rightEye: { sphere: -3.5, cylinder: -0.5, axis: 165 },
    lens: { brand: '凯米', refractiveIndex: '1.60', coating: '绿膜', type: 'single-vision' as const },
    frame: ''
  }
]
