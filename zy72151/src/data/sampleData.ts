import { BusStop, DataSource, ProcessRecord, PointStatus, SourceType } from '@/types';
import { generateId, standardizeName, calculateMatch } from '@/utils/algorithm';

interface RawBusStopData {
  name: string;
  lat: number;
  lng: number;
  source: SourceType;
  status?: PointStatus;
  address?: string;
  isBoundary?: boolean;
  needsReview?: boolean;
  hasEmptyFields?: boolean;
  rawData?: Record<string, string>;
  fileName?: string;
}

const rawDataList: RawBusStopData[] = [
  {
    name: '人民广场站',
    lat: 31.2304,
    lng: 121.4737,
    source: 'street',
    status: 'confirmed',
    address: '黄浦区人民大道120号',
    isBoundary: false,
    needsReview: false,
    rawData: { 编号: 'B001', 线路: '1路,2路,3路', 客流量: '日均5000人次' },
    fileName: '街道公交站点统计表.xlsx',
  },
  {
    name: '人民广场公交站',
    lat: 31.2306,
    lng: 121.4739,
    source: 'photo',
    status: 'pending',
    address: '',
    isBoundary: false,
    needsReview: true,
    rawData: { 照片编号: 'P2024_001', 拍摄时间: '2024-03-15', 拍摄人: '张巡检' },
    fileName: '现场巡检照片记录.xlsx',
  },
  {
    name: '南京东路站(旧)',
    lat: 31.2354,
    lng: 121.4807,
    source: 'photo',
    status: 'pending',
    address: '南京东路步行街入口',
    isBoundary: false,
    needsReview: false,
    rawData: { 照片编号: 'P2024_002', 拍摄时间: '2024-03-10', 备注: '旧站点已迁移,待确认新位置' },
    fileName: '历史巡检照片归档.xlsx',
  },
  {
    name: '南京东路地铁站',
    lat: 31.2352,
    lng: 121.4805,
    source: 'approval',
    status: 'pending',
    address: '南京东路299号',
    isBoundary: false,
    needsReview: true,
    rawData: { 审批编号: 'AP2024_001', 申请单位: '地铁公司', 批复日期: '2024-02-20' },
    fileName: '站点迁移审批记录.pdf',
  },
  {
    name: '外滩站',
    lat: 31.2397,
    lng: 121.4908,
    source: 'street',
    status: 'pending',
    address: '',
    isBoundary: true,
    needsReview: true,
    rawData: { 编号: 'B003', 备注: '位于黄浦区与虹口区交界' },
    fileName: '街道公交站点统计表.xlsx',
  },
  {
    name: '',
    lat: 31.2200,
    lng: 121.4500,
    source: 'street',
    status: 'pending',
    address: '',
    isBoundary: false,
    needsReview: true,
    hasEmptyFields: true,
    rawData: { 编号: 'B004', 备注: '站点名称缺失,需现场确认' },
    fileName: '街道公交站点统计表.xlsx',
  },
  {
    name: '人民广场站',
    lat: 31.2304,
    lng: 121.4737,
    source: 'approval',
    status: 'pending',
    address: '黄浦区人民大道120号',
    isBoundary: false,
    needsReview: false,
    rawData: { 审批编号: 'AP2024_002', 重复标记: '是' },
    fileName: '审批记录副本.xlsx',
  },
  {
    name: '豫园站',
    lat: 31.2272,
    lng: 121.4925,
    source: 'street',
    status: 'confirmed',
    address: '黄浦区福佑路288号',
    isBoundary: false,
    needsReview: false,
    rawData: { 编号: 'B005', 线路: '11路,64路,66路' },
    fileName: '街道公交站点统计表.xlsx',
  },
  {
    name: '陆家嘴站',
    lat: 31.2397,
    lng: 121.5055,
    source: 'street',
    status: 'exception',
    address: '浦东新区世纪大道1号',
    isBoundary: true,
    needsReview: false,
    rawData: { 编号: 'B006', 备注: '跨区站点,需两区协调' },
    fileName: '街道公交站点统计表.xlsx',
  },
  {
    name: '静安寺站',
    lat: 31.2245,
    lng: 121.4485,
    source: 'approval',
    status: 'pending',
    address: '静安区南京西路1688号',
    isBoundary: false,
    needsReview: false,
    rawData: { 审批编号: 'AP2024_003', 状态: '待迁移评估' },
    fileName: '站点迁移审批记录.pdf',
  },
];

export function generateSampleData(): {
  busStops: BusStop[];
  dataSources: DataSource[];
  processRecords: ProcessRecord[];
} {
  const busStops: BusStop[] = [];
  const dataSources: DataSource[] = [];
  const processRecords: ProcessRecord[] = [];
  const now = new Date().toISOString();

  rawDataList.forEach((raw, index) => {
    const busStopId = generateId();
    
    const busStop: BusStop = {
      id: busStopId,
      name: raw.name || '未命名站点',
      standardizedName: standardizeName(raw.name || '未命名站点'),
      lat: raw.lat,
      lng: raw.lng,
      status: raw.status || 'pending',
      address: raw.address,
      notes: raw.hasEmptyFields ? '站点名称缺失,请现场确认后补充' : undefined,
      isBoundary: raw.isBoundary || false,
      needsReview: raw.needsReview || false,
      mergedIds: [],
      createdAt: new Date(Date.now() - index * 3600000).toISOString(),
      updatedAt: now,
    };

    const dataSource: DataSource = {
      id: generateId(),
      busStopId,
      type: raw.source,
      rawName: raw.name,
      rawData: raw.rawData || {},
      fileName: raw.fileName,
      importedAt: new Date(Date.now() - index * 3600000).toISOString(),
    };

    const processRecord: ProcessRecord = {
      id: generateId(),
      busStopId,
      action: 'import',
      operator: '系统导入',
      remark: `从${raw.fileName || '未知文件'}导入`,
      timestamp: new Date(Date.now() - index * 3600000).toISOString(),
      afterState: { status: busStop.status },
    };

    if (raw.status === 'confirmed') {
      processRecords.push({
        id: generateId(),
        busStopId,
        action: 'confirm',
        operator: '系统自动确认',
        remark: '数据完整,自动确认',
        timestamp: new Date(Date.now() - index * 3600000 + 1800000).toISOString(),
        afterState: { status: 'confirmed' },
      });
    }

    if (raw.status === 'exception') {
      processRecords.push({
        id: generateId(),
        busStopId,
        action: 'exception',
        operator: '系统标记',
        remark: raw.rawData?.备注 || '边界站点,需特殊处理',
        timestamp: new Date(Date.now() - index * 3600000 + 1800000).toISOString(),
        afterState: { status: 'exception' },
      });
    }

    busStops.push(busStop);
    dataSources.push(dataSource);
    processRecords.push(processRecord);
  });

  busStops.forEach((stop, index) => {
    const suggestions = [];
    
    for (let i = 0; i < busStops.length; i++) {
      if (i === index) continue;
      
      const other = busStops[i];
      const match = calculateMatch(
        stop.name, stop.lat, stop.lng,
        other.name, other.lat, other.lng
      );
      
      if (match.shouldMerge || match.needsReview) {
        suggestions.push({
          targetId: other.id,
          similarity: match.similarity,
          distance: match.distance,
          reason: match.reason,
        });
      }
    }
    
    if (suggestions.length > 0) {
      stop.mergeSuggestions = suggestions.slice(0, 3);
      if (suggestions.some(s => s.distance < 50)) {
        stop.needsReview = true;
      }
    }
  });

  return { busStops, dataSources, processRecords };
}
