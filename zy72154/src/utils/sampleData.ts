import { db } from '@/db';
import { GISPoint, ResidentFeedback, InspectionRecord } from '@/types';
import { generateId } from './matching';

export async function loadSampleData() {
  await db.clearAllData();

  const gisPoints: GISPoint[] = [
    {
      id: generateId(),
      lamp_id: 'LD-001',
      address: '人民路123号',
      longitude: 120.123456,
      latitude: 30.654321,
      power_rating: 150,
      operating_hours: '18:00-06:00',
      district: '城东区',
      street: '人民路',
      raw_data: { original_id: 'GIS-001', source: 'city_gis_2024' },
      created_at: new Date()
    },
    {
      id: generateId(),
      lamp_id: 'LD-002',
      address: '建设路456号',
      longitude: 120.123500,
      latitude: 30.654400,
      power_rating: 250,
      operating_hours: '19:00-05:00',
      district: '城东区',
      street: '建设路',
      raw_data: { original_id: 'GIS-002', source: 'city_gis_2024' },
      created_at: new Date()
    },
    {
      id: generateId(),
      lamp_id: 'LD-003',
      address: '解放路789号',
      longitude: 120.123600,
      latitude: 30.654500,
      power_rating: 1200,
      operating_hours: '10:00-22:00',
      district: '城西区',
      street: '解放路',
      raw_data: { original_id: 'GIS-003', source: 'city_gis_2024', note: '大功率设备' },
      created_at: new Date()
    },
    {
      id: generateId(),
      lamp_id: '',
      address: '和平路100号',
      longitude: 120.123700,
      latitude: 30.654600,
      power_rating: 0,
      operating_hours: '',
      district: '城西区',
      street: '和平路',
      raw_data: { original_id: 'GIS-004', source: 'incomplete_record' },
      created_at: new Date()
    },
    {
      id: generateId(),
      lamp_id: 'LD-001',
      address: '人民路123号-1',
      longitude: 120.123458,
      latitude: 30.654323,
      power_rating: 150,
      operating_hours: '18:00-06:00',
      district: '城东区',
      street: '人民路',
      raw_data: { original_id: 'GIS-005', source: 'duplicate_entry' },
      created_at: new Date()
    }
  ];

  const residentFeedbacks: ResidentFeedback[] = [
    {
      id: generateId(),
      feedback_id: 'FB-001',
      lamp_id: 'LD-001',
      address: '人民路123号',
      description: '路灯正常，亮度足够',
      reporter: '张某某',
      phone: '13800138001',
      feedback_time: '2024-06-01',
      raw_note: '居民反馈表原始记录：晚上经过时看到灯亮着，挺好的，没什么问题。何工说下次巡检时再看看。',
      created_at: new Date()
    },
    {
      id: generateId(),
      feedback_id: 'FB-002',
      lamp_id: 'LD-002',
      address: '建设路456号门口',
      description: '有时亮有时不亮',
      reporter: '李某某',
      phone: '13800138002',
      feedback_time: '2024-06-02',
      raw_note: '【居民手写备注】：这灯怪怪的，周一周三周五亮，周二周四不亮。周末有时候亮有时候不亮。老王说可能是接触不好？',
      created_at: new Date()
    },
    {
      id: generateId(),
      feedback_id: 'FB-003-OLD',
      lamp_id: '旧编号-JF003',
      address: '解放路789号旁边',
      description: '太亮了影响休息',
      reporter: '王某某',
      phone: '13800138003',
      feedback_time: '2023-12-15',
      old_format_note: '【2023年旧口径】此记录沿用去年巡检系统编号，当时还没换新的LD编码，属于历史数据补录，请注意区分。',
      raw_note: '旧系统导入数据：用户投诉灯光太亮，晚上拉窗帘都没用，影响家里老人睡觉。',
      created_at: new Date()
    },
    {
      id: generateId(),
      feedback_id: 'FB-004',
      lamp_id: '',
      address: '',
      description: '不知道在哪，反正有个灯坏了',
      reporter: '赵某某',
      phone: '13800138004',
      feedback_time: '2024-06-03',
      raw_note: '电话记录：用户说不清具体位置，只说在小区附近有个灯坏了好几天了。',
      created_at: new Date()
    }
  ];

  const inspectionRecords: InspectionRecord[] = [
    {
      id: generateId(),
      record_id: 'INSP-001',
      lamp_id: 'LD-001',
      address: '人民路123号',
      inspector: '何工',
      inspection_time: '2024-06-05 14:30',
      photo_urls: ['photo_001_1.jpg', 'photo_001_2.jpg'],
      status: '正常',
      manual_note: '现场检查一切正常，灯具运行良好，能耗在正常范围内。居民反馈属实。',
      created_at: new Date()
    },
    {
      id: generateId(),
      record_id: 'INSP-002',
      lamp_id: 'LD-002',
      address: '建设路456号',
      inspector: '何工',
      inspection_time: '2024-06-05 15:15',
      photo_urls: ['photo_002_1.jpg'],
      status: '待维修',
      manual_note: '【手改备注】电路板有问题，时好时坏。已经报修，等配件到了更换。建议先标记，维修后再复检。',
      created_at: new Date()
    },
    {
      id: generateId(),
      record_id: 'INSP-003',
      lamp_id: 'LD-003',
      address: '解放路789号',
      inspector: '何工',
      inspection_time: '2024-06-06 09:00',
      photo_urls: ['photo_003_1.jpg', 'photo_003_2.jpg', 'photo_003_3.jpg'],
      status: '异常',
      manual_note: '这条街改造时用了大功率投光灯，功率确实高，但属于特殊情况。已记录在案，需要单独报备。',
      created_at: new Date()
    }
  ];

  await db.gisPoints.bulkAdd(gisPoints);
  await db.residentFeedbacks.bulkAdd(residentFeedbacks);
  await db.inspectionRecords.bulkAdd(inspectionRecords);

  return {
    gisCount: gisPoints.length,
    feedbackCount: residentFeedbacks.length,
    inspectionCount: inspectionRecords.length
  };
}
