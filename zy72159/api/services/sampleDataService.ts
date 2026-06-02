import { importService } from './importService';
import { mergeService } from './mergeService';
import { recordService } from './recordService';
import type { ImportRawItem } from '../../shared/types';

export function getSampleRawData(): ImportRawItem[] {
  return [
    {
      stationName: '龙阳路站',
      exitNo: '2号口',
      lat: 31.2148,
      lng: 121.5575,
      timeSlot: '早高峰 7:30-9:00',
      bikeCount: 45,
      capacity: 60,
      reason: '早高峰通勤流量大，单车集中停放影响通行',
      source: {
        type: 'inspection',
        name: '2024年3月轨道站点巡查记录',
        date: '2024-03-15',
        rawContent: '龙阳路站2号口早高峰停放单车45辆，容量60辆，秩序良好，建议维持现有疏导方案',
      },
    },
    {
      stationName: '世纪大道站',
      exitNo: '1号口',
      lat: 31.2304,
      lng: 121.5200,
      timeSlot: '晚高峰 17:30-19:00',
      bikeCount: 85,
      capacity: 50,
      reason: '晚高峰换乘客流大，共享单车积压严重',
      source: {
        type: 'inspection',
        name: '2024年3月轨道站点巡查记录',
        date: '2024-03-15',
        rawContent: '世纪大道站1号口晚高峰停放单车85辆，容量仅50辆，严重超出容量，需要紧急疏导',
      },
    },
    {
      stationName: '世纪大道站',
      exitNo: '1号口',
      lat: 31.2322,
      lng: 121.5215,
      timeSlot: '晚高峰 17:30-19:00',
      bikeCount: 80,
      capacity: 50,
      reason: '晚高峰换乘客流大，共享单车积压严重',
      source: {
        type: 'complaint',
        name: '12345市民投诉记录',
        date: '2024-03-16',
        rawContent: '世纪大道站1号口共享单车乱停乱放，影响行人通行',
      },
    },
    {
      stationName: '静安寺站',
      exitNo: '3号口',
      lat: 31.2241,
      lng: 121.4482,
      timeSlot: '全天',
      bikeCount: 60,
      capacity: 40,
      reason: '商务区全天流量大，长期容量不足',
      source: {
        type: 'old_caliber',
        name: '2023年12月现场会议纪要',
        date: '2023-12-20',
        rawContent: '静安寺站3号口共享单车停放问题，2023年统计口径为全天汇总，建议2024年分时段统计后重新评估',
      },
    },
    {
      stationName: '人民广场站',
      exitNo: '2号口',
      lat: 31.2304,
      lng: 121.4737,
      timeSlot: '早高峰 7:30-9:00',
      bikeCount: 70,
      capacity: 55,
      reason: '早高峰换乘集中，单车停放超出容量',
      source: {
        type: 'complaint',
        name: '12345市民投诉记录',
        date: '2024-03-17',
        rawContent: '人民广场站2号口共享单车太多，走路都不方便',
      },
    },
    {
      stationName: '人民广场站',
      exitNo: '2号口',
      lat: 31.2304,
      lng: 121.4737,
      timeSlot: '早高峰 7:30-9:00',
      bikeCount: 72,
      capacity: 55,
      reason: '早高峰换乘集中，单车停放超出容量',
      source: {
        type: 'complaint',
        name: '12345市民投诉记录',
        date: '2024-03-17',
        rawContent: '人民广场站2号口早上单车堵路，请尽快处理',
      },
    },
    {
      stationName: '南京西路站',
      exitNo: '4号口',
      lat: 31.2300,
      lng: 121.4700,
      timeSlot: '晚高峰 17:30-19:00',
      bikeCount: 55,
      capacity: 45,
      reason: '晚高峰商务通勤，单车停放集中',
      source: {
        type: 'inspection',
        name: '2024年3月轨道站点巡查记录',
        date: '2024-03-15',
        rawContent: '南京西路站4号口晚高峰停放单车55辆，超出容量约10辆',
      },
    },
    {
      stationName: '徐家汇站',
      exitNo: '1号口',
      lat: 31.1930,
      lng: 121.4370,
      timeSlot: '早晚高峰 7:30-9:00, 17:30-19:00',
      bikeCount: 120,
      capacity: 70,
      reason: '商圈+换乘大站，早晚高峰流量叠加',
      source: {
        type: 'meeting',
        name: '2024年3月交通疏导专题会议纪要',
        date: '2024-03-18',
        rawContent: '徐家汇站1号口跨时段统计，早晚高峰合计120辆，建议分时段处理',
      },
    },
  ];
}

export class SampleDataService {
  async loadSampleData(): Promise<{
    importResult: Awaited<ReturnType<typeof importService.importRawItems>>;
    autoMergeResult: ReturnType<typeof mergeService.autoMerge>;
  }> {
    recordService.clearAll();

    const rawItems = getSampleRawData();
    const importResult = await importService.importRawItems(rawItems);

    const autoMergeResult = mergeService.autoMerge();

    const records = recordService.getAllRecords();
    for (const record of records) {
      if (record.stationName === '龙阳路站' && record.exitNo === '2号口') {
        recordService.updateStatus(record.id, 'processed', '疏导方案正常，单车容量在合理范围内');
      } else if (record.stationName === '世纪大道站' && record.exitNo === '1号口') {
        recordService.updateStatus(record.id, 'verify', '存在同名路口坐标偏移问题，需要人工确认是否为同一地点');
      } else if (record.isOldCaliber) {
        recordService.updateStatus(record.id, 'onsite', '旧口径补入数据，需要现场复看确认实际情况');
      } else if (record.conflicts.some(c => c.type === 'coord_offset')) {
        recordService.updateStatus(record.id, 'onsite', '坐标偏移超过300米，请现场确认实际位置');
      }
    }

    return {
      importResult,
      autoMergeResult,
    };
  }
}

export const sampleDataService = new SampleDataService();
