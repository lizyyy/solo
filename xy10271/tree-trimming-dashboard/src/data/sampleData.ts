import type { TreeRecord, ComplaintRecord, WorkOrder, ComplaintType } from '../types';

const now = new Date();
const formatDate = (date: Date): string => date.toISOString().split('T')[0];
const addDays = (date: Date, days: number): string => formatDate(new Date(date.getTime() + days * 24 * 60 * 60 * 1000));

export const sampleTrees: TreeRecord[] = [
  {
    id: 'T001',
    treeNo: 'T-2024-001',
    location: '1号楼东侧花坛',
    building: '1号楼',
    species: '悬铃木（法国梧桐）',
    height: 18,
    crownDiameter: 12,
    plantingDate: '2005-03-15',
    status: 'needs_trimming',
    shadingLevel: 85,
    hasDisease: false,
    lastTrimDate: '2023-09-20',
    description: '树龄较大，枝条茂盛，严重遮挡1号楼3-5层东侧窗户'
  },
  {
    id: 'T002',
    treeNo: 'T-2024-002',
    location: '2号楼南侧步道旁',
    building: '2号楼',
    species: '香樟树',
    height: 12,
    crownDiameter: 8,
    plantingDate: '2010-05-20',
    status: 'diseased',
    shadingLevel: 60,
    hasDisease: true,
    diseaseDescription: '叶片出现黄斑，疑似褐斑病，部分枝条枯萎',
    lastTrimDate: '2024-01-10',
    description: '病害影响树木健康，需及时处理'
  },
  {
    id: 'T003',
    treeNo: 'T-2024-003',
    location: '3号楼北侧停车场',
    building: '3号楼',
    species: '广玉兰',
    height: 15,
    crownDiameter: 10,
    plantingDate: '2008-04-10',
    status: 'needs_trimming',
    shadingLevel: 75,
    hasDisease: false,
    lastTrimDate: '2023-06-15',
    description: '靠近停车场，低垂枝条影响车辆通行'
  },
  {
    id: 'T004',
    treeNo: 'T-2024-004',
    location: '4号楼中心花园',
    building: '4号楼',
    species: '桂花树',
    height: 6,
    crownDiameter: 4,
    plantingDate: '2015-09-05',
    status: 'healthy',
    shadingLevel: 25,
    hasDisease: false,
    lastTrimDate: '2024-02-28',
    description: '生长良好，树形美观'
  },
  {
    id: 'T005',
    treeNo: 'T-2024-005',
    location: '5号楼东门入口',
    building: '5号楼',
    species: '榕树',
    height: 10,
    crownDiameter: 9,
    plantingDate: '2012-06-18',
    status: 'needs_trimming',
    shadingLevel: 55,
    hasDisease: false,
    lastTrimDate: '2023-08-22',
    description: '气根较多，影响入口景观'
  },
  {
    id: 'T006',
    treeNo: 'T-2024-006',
    location: '6号楼西侧绿地',
    building: '6号楼',
    species: '银杏树',
    height: 20,
    crownDiameter: 14,
    plantingDate: '2003-11-12',
    status: 'diseased',
    shadingLevel: 90,
    hasDisease: true,
    diseaseDescription: '树干发现天牛蛀洞，树皮有开裂现象',
    lastTrimDate: '2022-12-05',
    description: '古树，需要专业养护，严重遮挡6号楼西侧采光'
  },
  {
    id: 'T007',
    treeNo: 'T-2024-007',
    location: '7号楼南面绿化带',
    building: '7号楼',
    species: '垂柳',
    height: 14,
    crownDiameter: 11,
    plantingDate: '2009-02-25',
    status: 'healthy',
    shadingLevel: 45,
    hasDisease: false,
    lastTrimDate: '2024-03-15',
    description: '靠近水池，长势良好'
  },
  {
    id: 'T008',
    treeNo: 'T-2024-008',
    location: '8号楼单元门旁',
    building: '8号楼',
    species: '红枫',
    height: 4,
    crownDiameter: 3,
    plantingDate: '2018-04-08',
    status: 'healthy',
    shadingLevel: 15,
    hasDisease: false,
    lastTrimDate: '2024-01-20',
    description: '观赏树种，状态良好'
  }
];

const createComplaint = (
  id: string,
  treeId: string,
  type: ComplaintType,
  description: string,
  complainant: string,
  contact: string,
  daysAgo: number,
  resolved: boolean = false
): ComplaintRecord => {
  const createdAt = addDays(now, -daysAgo);
  return {
    id,
    treeId,
    type,
    description,
    complainant,
    contact,
    createdAt,
    resolved,
    ...(resolved ? { resolvedAt: addDays(now, -Math.floor(daysAgo / 2)), resolution: '已安排修剪或病虫害处理' } : {})
  };
};

export const sampleComplaints: ComplaintRecord[] = [
  createComplaint('C001', 'T001', 'shading', 
    '1号楼302室东侧窗户采光严重不足，白天需要开灯', 
    '王先生', '138****1234', 5),
  createComplaint('C002', 'T001', 'shading', 
    '1号楼401室阳台晾晒衣物无法见到阳光', 
    '李女士', '139****5678', 3),
  createComplaint('C003', 'T001', 'resident', 
    '树木枝条过长，担心台风季节断裂伤人', 
    '张先生', '137****9012', 2),
  createComplaint('C004', 'T002', 'disease', 
    '2号楼南侧香樟树叶大量发黄掉落，担心病虫害传染', 
    '刘女士', '136****3456', 7),
  createComplaint('C005', 'T002', 'shading', 
    '2号楼203室南侧窗户被树枝遮挡', 
    '陈先生', '135****7890', 4),
  createComplaint('C006', 'T003', 'shading', 
    '3号楼停车场北侧光线太暗，监控效果不佳', 
    '物业保安李师傅', '134****2345', 6),
  createComplaint('C007', 'T006', 'shading', 
    '6号楼西侧1-6层采光严重受影响，业主多次反映', 
    '赵女士', '133****6789', 10),
  createComplaint('C008', 'T006', 'disease', 
    '6号楼西侧银杏树发现蛀虫，担心树木倒伏', 
    '孙先生', '132****0123', 8),
  createComplaint('C009', 'T006', 'resident', 
    '古树保护问题，担心树木健康状况恶化', 
    '周女士', '131****4567', 5),
  createComplaint('C010', 'T005', 'shading', 
    '5号楼入口处树枝过低，影响人员通行', 
    '吴先生', '130****8901', 1)
];

export const sampleWorkOrders: WorkOrder[] = [];

export const getSampleData = () => ({
  trees: sampleTrees,
  complaints: sampleComplaints,
  workOrders: sampleWorkOrders
});
