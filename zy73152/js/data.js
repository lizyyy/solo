// 海洋牧场时序回放 - 模拟数据

const COORD_FORMATS = {
  decimal: { name: '十进制度', pattern: /^-?\d+\.\d+$/ },
  dms: { name: '度分秒', pattern: /^\d+°\d+'\d+(\.\d+)?"?[NSEW]?$/i },
  dm: { name: '度分', pattern: /^\d+°\d+(\.\d+)?'?[NSEW]?$/i }
};

function normalizeCoord(latStr, lonStr) {
  const parse = (str, isLat) => {
    str = str.trim().toUpperCase();
    const hemi = isLat ? ['N', 'S'] : ['E', 'W'];
    let sign = 1;
    for (const h of hemi) {
      if (str.endsWith(h)) {
        sign = (h === 'N' || h === 'E') ? 1 : -1;
        str = str.slice(0, -1).trim();
        break;
      }
    }
    if (str.includes('"')) {
      const [degPart, rest] = str.split('°');
      const [minPart, secPart] = rest.split("'");
      const deg = parseFloat(degPart);
      const min = parseFloat(minPart);
      const sec = parseFloat(secPart.replace('"', ''));
      return sign * (deg + min / 60 + sec / 3600);
    } else if (str.includes("'")) {
      const [degPart, minPart] = str.split('°');
      const deg = parseFloat(degPart);
      const min = parseFloat(minPart.replace("'", ''));
      return sign * (deg + min / 60);
    } else {
      return sign * parseFloat(str.replace('°', ''));
    }
  };
  return {
    lat: parse(latStr, true).toFixed(6),
    lon: parse(lonStr, false).toFixed(6),
    latStr,
    lonStr
  };
}

const SAMPLE_RUNS = [
  {
    id: 'run-2026-06-15-v1',
    name: '2026-06-15 第1次跑（基准）',
    date: '2026-06-15 09:30',
    operator: '小林',
    status: 'completed',
    remark: '',
    params: {
      dataSource: 'Sentinel-2 L2A',
      cloudThreshold: 20,
      biomassModel: 'NDVI 线性回归 v3.2',
      coordSystem: 'WGS84'
    },
    steps: [
      {
        id: 'step-1',
        name: '数据导入',
        status: 'done',
        startTime: '09:30:00',
        endTime: '09:32:15',
        inputs: ['原始影像清单_202606.xlsx'],
        outputs: ['影像元数据表_v1.csv'],
        paramSnapshot: { sourceCount: 48, dateRange: '2026-04-01 ~ 2026-06-10' }
      },
      {
        id: 'step-2',
        name: '云检测与筛选',
        status: 'done',
        startTime: '09:32:20',
        endTime: '09:35:48',
        inputs: ['影像元数据表_v1.csv'],
        outputs: ['无云影像清单.csv'],
        paramSnapshot: { cloudThreshold: 20, keepPartial: true },
        anomalies: [
          { type: 'cloud_cover', level: 'warn', count: 12, desc: '云量>20%，已从正常结果中剔除' }
        ]
      },
      {
        id: 'step-3',
        name: '经纬度标准化',
        status: 'done',
        startTime: '09:35:50',
        endTime: '09:36:30',
        inputs: ['无云影像清单.csv', '实验室结果表_v1.xlsx'],
        outputs: ['坐标标准化对照表.csv'],
        paramSnapshot: { targetFormat: '十进制度', targetDatum: 'WGS84' },
        coordIssues: [
          { originalLat: "37°28'45\"N", originalLon: "122°45'30\"E", note: '度分秒格式' },
          { originalLat: '37.4792', originalLon: '122.7583', note: '十进制度格式' },
          { originalLat: "37°28.75'", originalLon: "122°45.5'", note: '度分格式' }
        ]
      },
      {
        id: 'step-4',
        name: '生物量反演',
        status: 'done',
        startTime: '09:36:35',
        endTime: '09:42:10',
        inputs: ['坐标标准化对照表.csv'],
        outputs: ['生物量反演结果_v1.shp'],
        paramSnapshot: { model: 'NDVI 线性回归 v3.2', resolution: '10m' },
        lateArrival: null
      },
      {
        id: 'step-5',
        name: '结果汇总导出',
        status: 'done',
        startTime: '09:42:15',
        endTime: '09:45:00',
        inputs: ['生物量反演结果_v1.shp'],
        outputs: ['海洋牧场时序报告_20260615_v1.pdf'],
        paramSnapshot: { format: 'PDF + Shapefile', includeAnomaly: false }
      }
    ],
    labResults: [
      {
        id: 'lab-001',
        sampleId: 'SD-2026-042',
        siteName: '桑沟湾示范区',
        originalLat: "37°28'45\"N",
        originalLon: "122°45'30\"E",
        biomass: 1285.6,
        sampleDate: '2026-05-12',
        sourceFormat: 'dms'
      },
      {
        id: 'lab-002',
        sampleId: 'SD-2026-043',
        siteName: '崆峒岛监测点',
        originalLat: '37.4792',
        originalLon: '122.7583',
        biomass: 956.3,
        sampleDate: '2026-05-13',
        sourceFormat: 'decimal'
      },
      {
        id: 'lab-003',
        sampleId: 'SD-2026-044',
        siteName: '养马岛对照区',
        originalLat: "37°28.75'",
        originalLon: "122°45.5'",
        biomass: 1402.1,
        sampleDate: '2026-05-14',
        sourceFormat: 'dm'
      }
    ],
    cloudRecords: [
      { id: 'c-001', sceneId: 'S2A_MSIL2A_20260415T024551', cloudPercent: 35, date: '2026-04-15', reason: '层积云覆盖超过阈值' },
      { id: 'c-002', sceneId: 'S2A_MSIL2A_20260425T024549', cloudPercent: 58, date: '2026-04-25', reason: '积云团覆盖研究区' },
      { id: 'c-003', sceneId: 'S2B_MSIL2A_20260505T024609', cloudPercent: 22, date: '2026-05-05', reason: '薄云+薄雾，接近阈值' }
    ],
    lateAttachments: []
  },
  {
    id: 'run-2026-06-17-v2',
    name: '2026-06-17 第2次跑（补晚到附件）',
    date: '2026-06-17 14:20',
    operator: '小林',
    status: 'completed',
    remark: '补充 5月20日晚到的实验室样品 SD-2026-047',
    baseRunId: 'run-2026-06-15-v1',
    params: {
      dataSource: 'Sentinel-2 L2A',
      cloudThreshold: 20,
      biomassModel: 'NDVI 线性回归 v3.2',
      coordSystem: 'WGS84'
    },
    steps: [
      {
        id: 'step-1',
        name: '数据导入',
        status: 'done',
        startTime: '14:20:00',
        endTime: '14:21:30',
        inputs: ['原始影像清单_202606.xlsx', '晚到实验室数据_0520.xlsx'],
        outputs: ['影像元数据表_v2.csv'],
        paramSnapshot: { sourceCount: 49, dateRange: '2026-04-01 ~ 2026-06-10' },
        diffFromBase: { sourceCount: '+1' }
      },
      {
        id: 'step-2',
        name: '云检测与筛选',
        status: 'done',
        startTime: '14:21:35',
        endTime: '14:24:10',
        inputs: ['影像元数据表_v2.csv'],
        outputs: ['无云影像清单.csv'],
        paramSnapshot: { cloudThreshold: 20, keepPartial: true },
        anomalies: [
          { type: 'cloud_cover', level: 'warn', count: 12, desc: '云量>20%，已从正常结果中剔除' }
        ],
        diffFromBase: {}
      },
      {
        id: 'step-3',
        name: '经纬度标准化',
        status: 'done',
        startTime: '14:24:15',
        endTime: '14:25:00',
        inputs: ['无云影像清单.csv', '实验室结果表_v2.xlsx'],
        outputs: ['坐标标准化对照表_v2.csv'],
        paramSnapshot: { targetFormat: '十进制度', targetDatum: 'WGS84' },
        coordIssues: [
          { originalLat: "37°28'45\"N", originalLon: "122°45'30\"E", note: '度分秒格式' },
          { originalLat: '37.4792', originalLon: '122.7583', note: '十进制度格式' },
          { originalLat: "37°28.75'", originalLon: "122°45.5'", note: '度分格式' },
          { originalLat: "37°30'12.5\"N", originalLon: "122°42'18\"E", note: '晚到数据，度分秒格式' }
        ],
        diffFromBase: { coordIssues: '+1 条（晚到样品）' }
      },
      {
        id: 'step-4',
        name: '生物量反演',
        status: 'done',
        startTime: '14:25:05',
        endTime: '14:30:40',
        inputs: ['坐标标准化对照表_v2.csv'],
        outputs: ['生物量反演结果_v2.shp'],
        paramSnapshot: { model: 'NDVI 线性回归 v3.2', resolution: '10m' },
        lateArrival: {
          attachment: '晚到实验室数据_0520.xlsx',
          receivedAt: '2026-06-16 17:45',
          processedIn: 'step-3 经纬度标准化',
          reason: '样品寄送延迟，5月20日采样 6月16日才收到数据',
          affected: ['SD-2026-047']
        },
        diffFromBase: { sampleCount: '+1', outputVersion: 'v1 → v2' }
      },
      {
        id: 'step-5',
        name: '结果汇总导出',
        status: 'done',
        startTime: '14:30:45',
        endTime: '14:33:20',
        inputs: ['生物量反演结果_v2.shp'],
        outputs: ['海洋牧场时序报告_20260617_v2.pdf'],
        paramSnapshot: { format: 'PDF + Shapefile', includeAnomaly: true },
        diffFromBase: { includeAnomaly: 'false → true', outputFile: 'v1 → v2' }
      }
    ],
    labResults: [
      {
        id: 'lab-001',
        sampleId: 'SD-2026-042',
        siteName: '桑沟湾示范区',
        originalLat: "37°28'45\"N",
        originalLon: "122°45'30\"E",
        biomass: 1285.6,
        sampleDate: '2026-05-12',
        sourceFormat: 'dms'
      },
      {
        id: 'lab-002',
        sampleId: 'SD-2026-043',
        siteName: '崆峒岛监测点',
        originalLat: '37.4792',
        originalLon: '122.7583',
        biomass: 956.3,
        sampleDate: '2026-05-13',
        sourceFormat: 'decimal'
      },
      {
        id: 'lab-003',
        sampleId: 'SD-2026-044',
        siteName: '养马岛对照区',
        originalLat: "37°28.75'",
        originalLon: "122°45.5'",
        biomass: 1402.1,
        sampleDate: '2026-05-14',
        sourceFormat: 'dm'
      },
      {
        id: 'lab-004',
        sampleId: 'SD-2026-047',
        siteName: '镆铘岛新增点',
        originalLat: "37°30'12.5\"N",
        originalLon: "122°42'18\"E",
        biomass: 1105.8,
        sampleDate: '2026-05-20',
        sourceFormat: 'dms',
        isLateArrival: true,
        lateNote: '样品寄送延迟，6月16日晚到'
      }
    ],
    cloudRecords: [
      { id: 'c-001', sceneId: 'S2A_MSIL2A_20260415T024551', cloudPercent: 35, date: '2026-04-15', reason: '层积云覆盖超过阈值' },
      { id: 'c-002', sceneId: 'S2A_MSIL2A_20260425T024549', cloudPercent: 58, date: '2026-04-25', reason: '积云团覆盖研究区' },
      { id: 'c-003', sceneId: 'S2B_MSIL2A_20260505T024609', cloudPercent: 22, date: '2026-05-05', reason: '薄云+薄雾，接近阈值' }
    ],
    lateAttachments: [
      {
        id: 'late-001',
        fileName: '晚到实验室数据_0520.xlsx',
        receivedAt: '2026-06-16 17:45',
        processedStep: 'step-3',
        reason: '样品寄送延迟',
        sampleCount: 1,
        content: 'SD-2026-047 镆铘岛新增点 生物量及坐标数据'
      }
    ]
  },
  {
    id: 'run-2026-06-18-v3',
    name: '2026-06-18 第3次跑（调云阈值+补备注）',
    date: '2026-06-18 10:15',
    operator: '小林',
    status: 'completed',
    remark: '云阈值从 20% 调到 25%，补全备注字段后重跑',
    baseRunId: 'run-2026-06-17-v2',
    params: {
      dataSource: 'Sentinel-2 L2A',
      cloudThreshold: 25,
      biomassModel: 'NDVI 线性回归 v3.2',
      coordSystem: 'WGS84'
    },
    steps: [
      {
        id: 'step-1',
        name: '数据导入',
        status: 'done',
        startTime: '10:15:00',
        endTime: '10:16:20',
        inputs: ['原始影像清单_202606.xlsx', '晚到实验室数据_0520.xlsx'],
        outputs: ['影像元数据表_v2.csv'],
        paramSnapshot: { sourceCount: 49, dateRange: '2026-04-01 ~ 2026-06-10' },
        diffFromBase: {}
      },
      {
        id: 'step-2',
        name: '云检测与筛选',
        status: 'done',
        startTime: '10:16:25',
        endTime: '10:19:05',
        inputs: ['影像元数据表_v2.csv'],
        outputs: ['无云影像清单_v3.csv'],
        paramSnapshot: { cloudThreshold: 25, keepPartial: true },
        anomalies: [
          { type: 'cloud_cover', level: 'warn', count: 10, desc: '云量>25%，已从正常结果中剔除' }
        ],
        diffFromBase: { cloudThreshold: '20 → 25', filteredOut: '12 → 10 景', note: '阈值放宽，2 景薄云数据纳入正常结果' }
      },
      {
        id: 'step-3',
        name: '经纬度标准化',
        status: 'done',
        startTime: '10:19:10',
        endTime: '10:19:55',
        inputs: ['无云影像清单_v3.csv', '实验室结果表_v2.xlsx'],
        outputs: ['坐标标准化对照表_v2.csv'],
        paramSnapshot: { targetFormat: '十进制度', targetDatum: 'WGS84' },
        coordIssues: [
          { originalLat: "37°28'45\"N", originalLon: "122°45'30\"E", note: '度分秒格式' },
          { originalLat: '37.4792', originalLon: '122.7583', note: '十进制度格式' },
          { originalLat: "37°28.75'", originalLon: "122°45.5'", note: '度分格式' },
          { originalLat: "37°30'12.5\"N", originalLon: "122°42'18\"E", note: '晚到数据，度分秒格式' }
        ],
        diffFromBase: {}
      },
      {
        id: 'step-4',
        name: '生物量反演',
        status: 'done',
        startTime: '10:20:00',
        endTime: '10:25:50',
        inputs: ['坐标标准化对照表_v2.csv', '无云影像清单_v3.csv'],
        outputs: ['生物量反演结果_v3.shp'],
        paramSnapshot: { model: 'NDVI 线性回归 v3.2', resolution: '10m' },
        lateArrival: {
          attachment: '晚到实验室数据_0520.xlsx',
          receivedAt: '2026-06-16 17:45',
          processedIn: 'step-3 经纬度标准化',
          reason: '样品寄送延迟，5月20日采样 6月16日才收到数据',
          affected: ['SD-2026-047']
        },
        diffFromBase: { inputScenes: '+2 景（薄云纳入）', outputVersion: 'v2 → v3' }
      },
      {
        id: 'step-5',
        name: '结果汇总导出',
        status: 'done',
        startTime: '10:25:55',
        endTime: '10:28:30',
        inputs: ['生物量反演结果_v3.shp'],
        outputs: ['海洋牧场时序报告_20260618_v3.pdf'],
        paramSnapshot: { format: 'PDF + Shapefile', includeAnomaly: true, remark: '云阈值调至25%，纳入薄云数据' },
        diffFromBase: { outputFile: 'v2 → v3', remark: '新增备注字段' }
      }
    ],
    labResults: [
      {
        id: 'lab-001',
        sampleId: 'SD-2026-042',
        siteName: '桑沟湾示范区',
        originalLat: "37°28'45\"N",
        originalLon: "122°45'30\"E",
        biomass: 1285.6,
        sampleDate: '2026-05-12',
        sourceFormat: 'dms'
      },
      {
        id: 'lab-002',
        sampleId: 'SD-2026-043',
        siteName: '崆峒岛监测点',
        originalLat: '37.4792',
        originalLon: '122.7583',
        biomass: 956.3,
        sampleDate: '2026-05-13',
        sourceFormat: 'decimal'
      },
      {
        id: 'lab-003',
        sampleId: 'SD-2026-044',
        siteName: '养马岛对照区',
        originalLat: "37°28.75'",
        originalLon: "122°45.5'",
        biomass: 1402.1,
        sampleDate: '2026-05-14',
        sourceFormat: 'dm'
      },
      {
        id: 'lab-004',
        sampleId: 'SD-2026-047',
        siteName: '镆铘岛新增点',
        originalLat: "37°30'12.5\"N",
        originalLon: "122°42'18\"E",
        biomass: 1105.8,
        sampleDate: '2026-05-20',
        sourceFormat: 'dms',
        isLateArrival: true,
        lateNote: '样品寄送延迟，6月16日晚到'
      }
    ],
    cloudRecords: [
      { id: 'c-001', sceneId: 'S2A_MSIL2A_20260415T024551', cloudPercent: 35, date: '2026-04-15', reason: '层积云覆盖超过阈值' },
      { id: 'c-002', sceneId: 'S2A_MSIL2A_20260425T024549', cloudPercent: 58, date: '2026-04-25', reason: '积云团覆盖研究区' }
    ],
    lateAttachments: [
      {
        id: 'late-001',
        fileName: '晚到实验室数据_0520.xlsx',
        receivedAt: '2026-06-16 17:45',
        processedStep: 'step-3',
        reason: '样品寄送延迟',
        sampleCount: 1,
        content: 'SD-2026-047 镆铘岛新增点 生物量及坐标数据'
      }
    ]
  }
];

function getRunById(id) {
  return SAMPLE_RUNS.find(r => r.id === id);
}

function getBaseRun(run) {
  if (run.baseRunId) {
    return SAMPLE_RUNS.find(r => r.id === run.baseRunId);
  }
  return null;
}
