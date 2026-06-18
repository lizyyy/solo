// 海草床调查报告汇总 - 数据模型与模拟数据

const mockData = {
  reportMeta: {
    title: '海草床调查报告汇总',
    reportDate: '2026-06-18',
    deadline: '2026-06-30',
    chiefEngineer: '老何（港口工程师）',
    reviewer: '复核组',
    version: 'v2.3',
    lastUpdated: '2026-06-18 14:30'
  },

  progress: {
    totalSites: 12,
    completedSites: 9,
    pendingSites: 2,
    problemSites: 1,
    totalSamples: 86,
    samplesWithData: 72,
    samplesPending: 11,
    samplesAbnormal: 3
  },

  sites: [
    {
      id: 'S01',
      name: 'A港区海草床',
      location: '东经121°30′ 北纬31°15′',
      status: 'completed',
      sampleCount: 8,
      seagrassDensity: 85,
      biomass: 245,
      avgTideLevel: 1.2,
      tideUnit: 'm',
      lastUpdate: '2026-06-15',
      hasAbnormality: false,
      materialsComplete: true,
      versions: 3
    },
    {
      id: 'S02',
      name: 'B港区浅滩',
      location: '东经121°35′ 北纬31°18′',
      status: 'completed',
      sampleCount: 10,
      seagrassDensity: 62,
      biomass: 180,
      avgTideLevel: 0.8,
      tideUnit: 'm',
      lastUpdate: '2026-06-14',
      hasAbnormality: false,
      materialsComplete: true,
      versions: 2
    },
    {
      id: 'S03',
      name: 'C港区牡蛎礁区',
      location: '东经121°28′ 北纬31°20′',
      status: 'problem',
      sampleCount: 7,
      seagrassDensity: 45,
      biomass: 120,
      avgTideLevel: 150,
      tideUnit: 'cm',
      lastUpdate: '2026-06-12',
      hasAbnormality: true,
      abnormalityType: 'tide_unit_mismatch',
      materialsComplete: false,
      missingMaterials: ['船上记录本第3次补遗'],
      versions: 4
    },
    {
      id: 'S04',
      name: 'D港区航道南侧',
      location: '东经121°40′ 北纬31°12′',
      status: 'completed',
      sampleCount: 9,
      seagrassDensity: 78,
      biomass: 220,
      avgTideLevel: 1.0,
      tideUnit: 'm',
      lastUpdate: '2026-06-16',
      hasAbnormality: false,
      materialsComplete: true,
      versions: 2
    },
    {
      id: 'S05',
      name: 'E港区潮间带',
      location: '东经121°25′ 北纬31°22′',
      status: 'problem',
      sampleCount: 6,
      seagrassDensity: 55,
      biomass: 160,
      avgTideLevel: 0.9,
      tideUnit: 'm',
      lastUpdate: '2026-06-10',
      hasAbnormality: true,
      abnormalityType: 'sample_time_mismatch',
      materialsComplete: false,
      missingMaterials: ['实验室检测报告批次2'],
      versions: 3
    },
    {
      id: 'S06',
      name: 'F港区北堤外',
      location: '东经121°32′ 北纬31°25′',
      status: 'completed',
      sampleCount: 8,
      seagrassDensity: 92,
      biomass: 280,
      avgTideLevel: 1.5,
      tideUnit: 'm',
      lastUpdate: '2026-06-17',
      hasAbnormality: false,
      materialsComplete: true,
      versions: 1
    },
    {
      id: 'S07',
      name: 'G港区沙脊区',
      location: '东经121°38′ 北纬31°28′',
      status: 'pending',
      sampleCount: 5,
      seagrassDensity: null,
      biomass: null,
      avgTideLevel: 1.1,
      tideUnit: 'm',
      lastUpdate: '2026-06-08',
      hasAbnormality: false,
      materialsComplete: false,
      missingMaterials: ['现场照片', '样本编号记录'],
      versions: 1
    },
    {
      id: 'S08',
      name: 'H港区南湾',
      location: '东经121°42′ 北纬31°10′',
      status: 'completed',
      sampleCount: 7,
      seagrassDensity: 68,
      biomass: 195,
      avgTideLevel: 0.7,
      tideUnit: 'm',
      lastUpdate: '2026-06-13',
      hasAbnormality: false,
      materialsComplete: true,
      versions: 2
    },
    {
      id: 'S09',
      name: 'I港区码头东侧',
      location: '东经121°33′ 北纬31°16′',
      status: 'completed',
      sampleCount: 8,
      seagrassDensity: 73,
      biomass: 210,
      avgTideLevel: 1.3,
      tideUnit: 'm',
      lastUpdate: '2026-06-15',
      hasAbnormality: false,
      materialsComplete: true,
      versions: 2
    },
    {
      id: 'S10',
      name: 'J港区灯塔附近',
      location: '东经121°45′ 北纬31°20′',
      status: 'pending',
      sampleCount: 4,
      seagrassDensity: null,
      biomass: null,
      avgTideLevel: null,
      tideUnit: 'm',
      lastUpdate: '2026-06-05',
      hasAbnormality: false,
      materialsComplete: false,
      missingMaterials: ['船上记录本正本', 'GPS定位记录', '实验室数据'],
      versions: 1
    },
    {
      id: 'S11',
      name: 'K港区养殖场旁',
      location: '东经121°27′ 北纬31°13′',
      status: 'completed',
      sampleCount: 6,
      seagrassDensity: 50,
      biomass: 140,
      avgTideLevel: 0.6,
      tideUnit: 'm',
      lastUpdate: '2026-06-11',
      hasAbnormality: false,
      materialsComplete: true,
      versions: 2
    },
    {
      id: 'S12',
      name: 'L港区人工鱼礁区',
      location: '东经121°36′ 北纬31°23′',
      status: 'completed',
      sampleCount: 8,
      seagrassDensity: 80,
      biomass: 235,
      avgTideLevel: 1.4,
      tideUnit: 'm',
      lastUpdate: '2026-06-16',
      hasAbnormality: false,
      materialsComplete: true,
      versions: 3
    }
  ],

  sampleDetails: {
    S03: [
      {
        id: 'S03-001',
        sampleTime: '2026-06-01 09:30',
        labReceiveTime: '2026-06-02 14:00',
        labTestTime: '2026-06-03 10:00',
        density: 42,
        biomass: 115,
        tideLevel: 145,
        tideUnit: 'cm',
        status: 'normal',
        notes: '样本完好'
      },
      {
        id: 'S03-002',
        sampleTime: '2026-06-01 10:15',
        labReceiveTime: '2026-06-02 14:00',
        labTestTime: '2026-06-03 11:30',
        density: 48,
        biomass: 128,
        tideLevel: 152,
        tideUnit: 'cm',
        status: 'normal',
        notes: '样本完好'
      },
      {
        id: 'S03-003',
        sampleTime: '2026-06-01 11:00',
        labReceiveTime: '2026-06-03 09:00',
        labTestTime: '2026-06-05 08:30',
        density: 40,
        biomass: 105,
        tideLevel: 158,
        tideUnit: 'cm',
        status: 'abnormal',
        abnormality: 'sample_time_mismatch',
        notes: '采样时间与实验室记录不符，待核实',
        labNote: '记录本记载6月1日采样，但样品6月3日才到实验室'
      },
      {
        id: 'S03-004',
        sampleTime: '2026-06-02 08:45',
        labReceiveTime: '2026-06-03 09:00',
        labTestTime: '2026-06-04 14:00',
        density: 50,
        biomass: 132,
        tideLevel: 148,
        tideUnit: 'cm',
        status: 'normal',
        notes: '样本完好'
      },
      {
        id: 'S03-005',
        sampleTime: '2026-06-02 09:30',
        labReceiveTime: '2026-06-03 09:00',
        labTestTime: '2026-06-04 15:30',
        density: 46,
        biomass: 118,
        tideLevel: 1.42,
        tideUnit: 'm',
        status: 'abnormal',
        abnormality: 'tide_unit_mismatch',
        notes: '潮位单位与其他样本不一致',
        labNote: '记录本写1.42m，其余样本用cm记录，待确认是否换算错误'
      },
      {
        id: 'S03-006',
        sampleTime: '2026-06-02 14:20',
        labReceiveTime: '2026-06-03 09:00',
        labTestTime: '2026-06-05 10:00',
        density: 44,
        biomass: 112,
        tideLevel: 155,
        tideUnit: 'cm',
        status: 'normal',
        notes: '样本完好'
      },
      {
        id: 'S03-007',
        sampleTime: '待补充',
        labReceiveTime: '待补充',
        labTestTime: '待补充',
        density: null,
        biomass: null,
        tideLevel: null,
        tideUnit: null,
        status: 'pending',
        notes: '第3次补遗记录未到，数据暂缺'
      }
    ],
    S05: [
      {
        id: 'S05-001',
        sampleTime: '2026-05-28 10:00',
        labReceiveTime: '2026-05-29 11:00',
        labTestTime: '2026-05-30 09:00',
        density: 58,
        biomass: 168,
        tideLevel: 0.85,
        tideUnit: 'm',
        status: 'normal',
        notes: '样本完好'
      },
      {
        id: 'S05-002',
        sampleTime: '2026-05-28 11:30',
        labReceiveTime: '2026-05-29 11:00',
        labTestTime: '2026-05-30 10:30',
        density: 52,
        biomass: 155,
        tideLevel: 0.92,
        tideUnit: 'm',
        status: 'normal',
        notes: '样本完好'
      },
      {
        id: 'S05-003',
        sampleTime: '2026-05-29 09:00',
        labReceiveTime: '2026-05-30 14:00',
        labTestTime: '2026-06-02 08:00',
        density: 48,
        biomass: 140,
        tideLevel: 0.78,
        tideUnit: 'm',
        status: 'abnormal',
        abnormality: 'sample_time_mismatch',
        notes: '采样到检测间隔异常长',
        labNote: '记录本显示5月29日采样，但实验室批次2报告6月2日才检测，间隔超过72小时'
      },
      {
        id: 'S05-004',
        sampleTime: '2026-05-29 10:30',
        labReceiveTime: '2026-05-30 14:00',
        labTestTime: '2026-05-31 09:30',
        density: 60,
        biomass: 172,
        tideLevel: 0.95,
        tideUnit: 'm',
        status: 'normal',
        notes: '样本完好'
      },
      {
        id: 'S05-005',
        sampleTime: '待补充',
        labReceiveTime: '待补充',
        labTestTime: '待补充',
        density: null,
        biomass: null,
        tideLevel: null,
        tideUnit: null,
        status: 'pending',
        notes: '实验室检测报告批次2未到',
        labNote: '第5、6号样本检测结果在批次2中，待补充'
      },
      {
        id: 'S05-006',
        sampleTime: '待补充',
        labReceiveTime: '待补充',
        labTestTime: '待补充',
        density: null,
        biomass: null,
        tideLevel: null,
        tideUnit: null,
        status: 'pending',
        notes: '实验室检测报告批次2未到',
        labNote: '第5、6号样本检测结果在批次2中，待补充'
      }
    ]
  },

  shipLogs: {
    S03: [
      {
        id: 'LOG-S03-001',
        version: 1,
        submitDate: '2026-06-02',
        submitter: '张船长',
        content: '6月1日出海，上午9点到11点在C港区牡蛎礁区采样，共采集3个样本。天气晴，浪高0.5米。潮位约1.5米。',
        isOriginal: true,
        status: 'received'
      },
      {
        id: 'LOG-S03-002',
        version: 2,
        submitDate: '2026-06-04',
        submitter: '张船长',
        content: '6月2日继续在C港区采样，上午8点到下午2点，采集4个样本。其中第5号样本点潮位记录为1.42m（注意：此处用米，其余用厘米）。',
        isOriginal: false,
        supplementNote: '补遗：补充6月2日采样记录',
        status: 'received'
      },
      {
        id: 'LOG-S03-003',
        version: 3,
        submitDate: '2026-06-08',
        submitter: '老何',
        content: '收到第2次补遗，确认第5号样本潮位单位为米，已在汇总表中标注异常。第3号样本采样时间存疑，需等第3次补遗。',
        isOriginal: false,
        supplementNote: '处理记录：异常标注',
        status: 'processed'
      },
      {
        id: 'LOG-S03-004',
        version: 4,
        submitDate: '待提交',
        submitter: '张船长',
        content: '待补充：第3次补遗，确认第3号样本具体采样时间',
        isOriginal: false,
        supplementNote: '第3次补遗（未到）',
        status: 'pending'
      }
    ],
    S05: [
      {
        id: 'LOG-S05-001',
        version: 1,
        submitDate: '2026-05-29',
        submitter: '李船长',
        content: '5月28日出海，在E港区潮间带采样，共4个样本。天气多云。',
        isOriginal: true,
        status: 'received'
      },
      {
        id: 'LOG-S05-002',
        version: 2,
        submitDate: '2026-06-01',
        submitter: '李船长',
        content: '5月29日继续采样2个样本。下午有阵雨，样本保存完好。',
        isOriginal: false,
        supplementNote: '补遗：补充5月29日采样记录',
        status: 'received'
      },
      {
        id: 'LOG-S05-003',
        version: 3,
        submitDate: '2026-06-05',
        submitter: '老何',
        content: '实验室批次1报告已到，第3号样本从采样到检测间隔超过72小时，需核实是否影响结果。批次2报告未到，暂缺第5、6号数据。',
        isOriginal: false,
        supplementNote: '处理记录：时间异常标注',
        status: 'processed'
      }
    ]
  },

  labReports: {
    S03: [
      {
        id: 'LAB-S03-001',
        batch: '批次1',
        receiveDate: '2026-06-02',
        testDate: '2026-06-03',
        reportDate: '2026-06-04',
        sampleCount: 4,
        status: 'received'
      },
      {
        id: 'LAB-S03-002',
        batch: '批次2',
        receiveDate: '2026-06-03',
        testDate: '2026-06-05',
        reportDate: '2026-06-06',
        sampleCount: 2,
        status: 'received'
      },
      {
        id: 'LAB-S03-003',
        batch: '批次3',
        receiveDate: '待确认',
        testDate: '待确认',
        reportDate: '待确认',
        sampleCount: 1,
        status: 'pending',
        note: '第7号样本数据在第3次补遗后送检'
      }
    ],
    S05: [
      {
        id: 'LAB-S05-001',
        batch: '批次1',
        receiveDate: '2026-05-29',
        testDate: '2026-05-30',
        reportDate: '2026-05-31',
        sampleCount: 4,
        status: 'received'
      },
      {
        id: 'LAB-S05-002',
        batch: '批次2',
        receiveDate: '2026-05-30',
        testDate: '2026-06-02',
        reportDate: '待出',
        sampleCount: 2,
        status: 'pending',
        note: '第5、6号样本检测报告未出，预计6月20日'
      }
    ]
  },

  versionHistory: [
    {
      version: 'v1.0',
      date: '2026-06-01',
      author: '老何',
      changes: '初始版本，录入8个站点基础数据',
      impact: '新增S01-S08站点'
    },
    {
      version: 'v1.5',
      date: '2026-06-05',
      author: '老何',
      changes: '补充S09-S12站点，更新S03、S05第一次补遗数据',
      impact: 'S03密度从48修正为45（单位换算后），S05密度从60修正为55'
    },
    {
      version: 'v2.0',
      date: '2026-06-10',
      author: '老何',
      changes: '标记S03潮位单位异常、S05采样时间异常',
      impact: '2个站点标注为问题站点，汇总数据需谨慎引用'
    },
    {
      version: 'v2.3',
      date: '2026-06-18',
      author: '老何',
      changes: '补充S06、S12最新数据，更新进度统计',
      impact: '完成站点从7个增至9个'
    }
  ],

  actionItems: [
    {
      id: 'AI001',
      priority: 'high',
      site: 'S03',
      siteName: 'C港区牡蛎礁区',
      issue: '潮位单位混写（部分cm、部分m）',
      requiredMaterial: '船上记录本第3次补遗',
      responsible: '张船长',
      deadline: '2026-06-22',
      status: 'pending',
      description: '第5号样本潮位记录为1.42m，其余为cm单位。需确认是否记录错误还是实际换算差异。影响汇总数据准确性，优先处理。'
    },
    {
      id: 'AI002',
      priority: 'high',
      site: 'S05',
      siteName: 'E港区潮间带',
      issue: '采样时间与实验结果对不上',
      requiredMaterial: '实验室检测报告批次2',
      responsible: '检测中心',
      deadline: '2026-06-20',
      status: 'pending',
      description: '第3号样本从采样到检测间隔超过72小时，可能影响数据有效性。需核实中间保存流程。批次2报告到后可确认第5、6号情况。'
    },
    {
      id: 'AI003',
      priority: 'medium',
      site: 'S07',
      siteName: 'G港区沙脊区',
      issue: '基础材料不齐',
      requiredMaterial: '现场照片、样本编号记录',
      responsible: '调查队',
      deadline: '2026-06-25',
      status: 'pending',
      description: '缺少现场照片和样本编号记录，无法核对样本对应关系。'
    },
    {
      id: 'AI004',
      priority: 'medium',
      site: 'S10',
      siteName: 'J港区灯塔附近',
      issue: '材料严重缺失',
      requiredMaterial: '船上记录本正本、GPS定位记录、实验室数据',
      responsible: '调查队',
      deadline: '2026-06-25',
      status: 'pending',
      description: '该站点仅4个样本有登记，主要材料均未到齐。需催促尽快提交。'
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = mockData;
}
