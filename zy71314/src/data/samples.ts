import { DemoSample } from '@/types';

export const demoSamples: DemoSample[] = [
  {
    id: 'normal-data',
    name: '标准实验数据',
    description: '一组符合小角度近似的理想实验数据',
    category: 'outlier',
    data: [
      { length: 0.2, period: 0.90, measurements: 10, angle: 5, notes: '第一次测量' },
      { length: 0.4, period: 1.27, measurements: 10, angle: 5, notes: '第二次测量' },
      { length: 0.6, period: 1.56, measurements: 10, angle: 5, notes: '第三次测量' },
      { length: 0.8, period: 1.80, measurements: 10, angle: 5, notes: '第四次测量' },
      { length: 1.0, period: 2.01, measurements: 10, angle: 5, notes: '第五次测量' },
      { length: 1.2, period: 2.20, measurements: 10, angle: 5, notes: '第六次测量' },
    ],
    explanation: '这是一组理想的实验数据，摆角小于15度，符合小角度近似条件。T²与L呈现良好的线性关系，拟合得到的g值接近标准值9.8 m/s²。',
  },
  {
    id: 'large-angle',
    name: '大角度近似失效',
    description: '演示摆角过大时小角度近似的误差',
    category: 'large-angle',
    data: [
      { length: 1.0, period: 2.01, measurements: 10, angle: 5, notes: '摆角5度（正常）' },
      { length: 1.0, period: 2.04, measurements: 10, angle: 30, notes: '摆角30度' },
      { length: 1.0, period: 2.12, measurements: 10, angle: 45, notes: '摆角45度' },
      { length: 1.0, period: 2.28, measurements: 10, angle: 60, notes: '摆角60度' },
      { length: 1.0, period: 2.57, measurements: 10, angle: 80, notes: '摆角80度' },
    ],
    explanation: '当摆角超过15度时，小角度近似公式 T = 2π√(L/g) 不再准确。实际周期会比理论值偏大，摆角越大误差越明显。需要使用大角度修正公式：T = 2π√(L/g) · (1 + θ²/16 + ...)',
  },
  {
    id: 'missing-period',
    name: '周期漏记样例',
    description: '演示漏记半个周期时的系统误差',
    category: 'missing-period',
    data: [
      { length: 0.5, period: 0.71, measurements: 10, angle: 10, notes: '疑似漏记周期' },
      { length: 0.7, period: 0.84, measurements: 10, angle: 10, notes: '疑似漏记周期' },
      { length: 0.9, period: 0.95, measurements: 10, angle: 10, notes: '疑似漏记周期' },
      { length: 1.1, period: 1.05, measurements: 10, angle: 10, notes: '疑似漏记周期' },
      { length: 1.3, period: 1.14, measurements: 10, angle: 10, notes: '疑似漏记周期' },
    ],
    explanation: '如果测量时漏记了半个周期（例如只数到从一端到另一端算一个周期），会导致测得的周期约为真实值的一半。计算出的g值会是正常值的4倍左右，这种系统误差可以通过数据规律发现。',
  },
  {
    id: 'outlier-data',
    name: '离群点回归样例',
    description: '包含明显异常点的实验数据',
    category: 'outlier',
    data: [
      { length: 0.3, period: 1.10, measurements: 10, angle: 10, notes: '正常数据' },
      { length: 0.5, period: 1.42, measurements: 10, angle: 10, notes: '正常数据' },
      { length: 0.7, period: 2.80, measurements: 10, angle: 10, notes: '异常值' },
      { length: 0.9, period: 1.90, measurements: 10, angle: 10, notes: '正常数据' },
      { length: 1.1, period: 2.10, measurements: 10, angle: 10, notes: '正常数据' },
      { length: 1.3, period: 2.29, measurements: 10, angle: 10, notes: '正常数据' },
    ],
    explanation: '第三组数据的周期明显偏离了T²-L的线性关系，是一个离群点。可能是测量时的操作失误或读数错误造成的。通过IQR或3σ准则可以检测出这类异常值，用户可以选择保留或排除离群点。',
  },
  {
    id: 'student-data',
    name: '学生实测数据',
    description: '模拟学生实际测量的典型数据',
    category: 'outlier',
    data: [
      { length: 0.25, period: 1.02, measurements: 5, angle: 12, studentName: '张三' },
      { length: 0.50, period: 1.45, measurements: 5, angle: 10, studentName: '张三' },
      { length: 0.75, period: 1.73, measurements: 5, angle: 8, studentName: '张三' },
      { length: 1.00, period: 2.05, measurements: 5, angle: 10, studentName: '张三' },
      { length: 1.25, period: 2.24, measurements: 5, angle: 12, studentName: '张三' },
      { length: 1.50, period: 2.46, measurements: 5, angle: 8, studentName: '张三' },
    ],
    explanation: '这是一组模拟的学生实测数据，包含了真实实验中的各种误差来源。可以看到数据点在拟合直线附近有一定的离散，这是实验中正常的随机误差。通过分析可以讨论误差的主要来源。',
  },
];

export function getSampleById(id: string): DemoSample | undefined {
  return demoSamples.find(s => s.id === id);
}

export function getSamplesByCategory(category: DemoSample['category']): DemoSample[] {
  return demoSamples.filter(s => s.category === category);
}
