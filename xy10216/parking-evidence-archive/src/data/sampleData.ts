import type { ParkingCase } from '../types';

export const smoothFlowSample: ParkingCase = {
  id: 'CASE-2024-001',
  plateNumber: '沪A·12345',
  entryTime: '2024-05-10 08:30:00',
  exitTime: '2024-05-10 17:45:00',
  duration: '9小时15分',
  feeAmount: 45,
  paidAmount: 0,
  status: 'payment_pending',
  paymentStatus: 'unpaid',
  evidences: [
    {
      id: 'EVID-001',
      type: 'entry_image',
      name: '入场照片_20240510_083000.jpg',
      placeholder: false,
      uploadedAt: '2024-05-10 08:30:15',
      size: '2.3MB',
      description: '车辆入口闸机抓拍照片'
    },
    {
      id: 'EVID-002',
      type: 'exit_record',
      name: '出场记录_20240510_174500.pdf',
      placeholder: false,
      uploadedAt: '2024-05-10 17:45:30',
      size: '156KB',
      description: '系统出场记录详情'
    }
  ],
  manualReleases: [],
  payments: [],
  timeline: [
    {
      id: 'TL-001',
      timestamp: '2024-05-10 08:30:00',
      type: 'event',
      description: '车辆入场，自动识别车牌沪A·12345',
      operator: '系统'
    },
    {
      id: 'TL-002',
      timestamp: '2024-05-10 17:45:00',
      type: 'event',
      description: '车辆到达出口，系统计算费用45元',
      operator: '系统'
    },
    {
      id: 'TL-003',
      timestamp: '2024-05-10 17:46:00',
      type: 'event',
      description: '车辆未缴费直接驶离，触发逃费预警',
      operator: '系统'
    },
    {
      id: 'TL-004',
      timestamp: '2024-05-10 18:00:00',
      type: 'review',
      description: '审核通过，证据链完整，转入待补缴状态',
      operator: '张主管'
    }
  ],
  remarks: '工作日通勤停车，正常收费标准',
  createdAt: '2024-05-10 18:00:00',
  updatedAt: '2024-05-10 18:00:00'
};

export const needsReviewSample: ParkingCase = {
  id: 'CASE-2024-002',
  plateNumber: '苏E·67890',
  entryTime: '2024-05-09 14:20:00',
  exitTime: '2024-05-10 02:15:00',
  duration: '11小时55分',
  feeAmount: 120,
  paidAmount: 0,
  status: 'pending_review',
  paymentStatus: 'unpaid',
  evidences: [
    {
      id: 'EVID-003',
      type: 'entry_image',
      name: '入场照片_20240509_142000.jpg',
      placeholder: false,
      uploadedAt: '2024-05-09 14:20:15',
      size: '2.1MB',
      description: '车辆入口闸机抓拍照片'
    },
    {
      id: 'EVID-004',
      type: 'exit_record',
      name: '出场记录_20240510_021500.pdf',
      placeholder: true,
      description: '出场记录缺失，需要补录'
    },
    {
      id: 'EVID-005',
      type: 'manual_release',
      name: '人工放行记录_20240510_021500.json',
      placeholder: false,
      uploadedAt: '2024-05-10 02:15:30',
      size: '8KB',
      description: '凌晨2点15分人工放行记录'
    }
  ],
  manualReleases: [
    {
      id: 'REL-001',
      timestamp: '2024-05-10 02:15:00',
      operator: '李保安',
      reason: '车主称系统故障无法识别',
      reviewed: false
    }
  ],
  payments: [],
  timeline: [
    {
      id: 'TL-005',
      timestamp: '2024-05-09 14:20:00',
      type: 'event',
      description: '车辆入场，自动识别车牌苏E·67890',
      operator: '系统'
    },
    {
      id: 'TL-006',
      timestamp: '2024-05-10 02:15:00',
      type: 'event',
      description: '车辆到达出口，系统显示异常',
      operator: '系统'
    },
    {
      id: 'TL-007',
      timestamp: '2024-05-10 02:15:00',
      type: 'event',
      description: '保安李保安执行人工放行',
      operator: '李保安'
    },
    {
      id: 'TL-008',
      timestamp: '2024-05-10 08:00:00',
      type: 'review',
      description: '系统检测到夜间人工放行，自动转入待复核',
      operator: '系统'
    }
  ],
  remarks: '夜间人工放行，出场记录缺失，需要复核放行理由',
  createdAt: '2024-05-10 08:00:00',
  updatedAt: '2024-05-10 08:00:00'
};

export const initialCases: ParkingCase[] = [smoothFlowSample, needsReviewSample];
