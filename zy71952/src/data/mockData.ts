import type { FlightRecord, Anomaly } from '../types';

const baseHandlingRules: Record<Anomaly['type'], string> = {
  missing_return_point: '处理口径：1. 核查飞控日志确认返航点记录；2. 若确为设备丢失，标注为「特殊记录」单独归档；3. 补录地面站截图作为佐证；4. 不得作为有效巡检结论使用。',
  delayed_note: '处理口径：1. 核查飞手补录时间与实际飞行时间差；2. 若延迟≤24小时且内容与气象/照片匹配，标记为「补录备查」；3. 若延迟>24小时，需项目负责人签字确认后方可归档。',
  modified_photo: '处理口径：1. 对比原始照片EXIF信息确认篡改时间；2. 要求修改人提交书面说明并存档；3. 保留原始照片副本，修改后照片标注「人工修订」水印；4. 涉及病虫害等级变更的，需重新现场复核。',
  weather_mismatch: '处理口径：1. 核对气象站历史数据与截图时间戳；2. 若为气象站数据延迟，以实际飞行时实测数据为准；3. 若为截图造假，该架次记录作废，重新飞行。',
};

const createAnomaly = (
  type: Anomaly['type'],
  severity: 'warning' | 'error',
  description: string
): Anomaly => ({
  id: `anomaly-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  type,
  severity,
  description,
  handlingRule: baseHandlingRules[type],
});

export const mockFlightRecords: FlightRecord[] = [
  {
    id: 'rec-001',
    flightNo: 'NJ-20260528-01',
    flightDate: '2026-05-28',
    location: '南江县红光镇3号农田',
    status: 'confirmed',
    hasReturnPoint: true,
    weatherData: {
      id: 'w-001',
      uploadTime: '2026-05-28 06:15:00',
      screenshotUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=weather%20forecast%20screenshot%20temperature%2025%20humidity%2065%20wind%203&image_size=square',
      temperature: 24.5,
      humidity: 62,
      windSpeed: 2.8,
      rainfall: 0,
      isSupplement: false,
    },
    pilotNote: {
      id: 'p-001',
      pilotName: '张伟',
      noteTime: '2026-05-28 10:30:00',
      flightStartTime: '2026-05-28 08:00:00',
      flightEndTime: '2026-05-28 10:15:00',
      content: '飞行正常，覆盖完整，无异常情况。航线偏东50米规避高压线路。',
      isSupplement: false,
    },
    photos: [
      {
        id: 'ph-001-1',
        uploadTime: '2026-05-28 10:45:00',
        photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=aerial%20photo%20of%20green%20rice%20paddy%20field%20top%20view&image_size=square',
        locationTag: 'N32°15\'23" E106°48\'12"',
        pestType: '稻飞虱',
        severity: 'low',
        isManuallyModified: false,
      },
      {
        id: 'ph-001-2',
        uploadTime: '2026-05-28 10:46:00',
        photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=aerial%20photography%20farmland%20crop%20healthy%20green%20vegetation&image_size=square',
        locationTag: 'N32°15\'45" E106°48\'30"',
        isManuallyModified: false,
      },
    ],
    changeLogs: [
      {
        id: 'cl-001-1',
        timestamp: '2026-05-28 06:15:00',
        operator: '系统',
        changeType: 'create',
        field: '气象数据',
        newValue: '温度24.5°C 湿度62%',
        description: '气象截图上传',
      },
      {
        id: 'cl-001-2',
        timestamp: '2026-05-28 10:30:00',
        operator: '张伟',
        changeType: 'create',
        field: '飞手备注',
        newValue: '飞行正常，航线偏东50米',
        description: '飞手完成备注',
      },
      {
        id: 'cl-001-3',
        timestamp: '2026-05-28 10:46:00',
        operator: '系统',
        changeType: 'create',
        field: '巡检照片',
        newValue: '2张照片上传',
        description: '照片上传完成',
      },
    ],
    anomalies: [],
  },
  {
    id: 'rec-002',
    flightNo: 'NJ-20260528-02',
    flightDate: '2026-05-28',
    location: '南江县红光镇5号农田',
    status: 'pending',
    hasReturnPoint: true,
    weatherData: {
      id: 'w-002',
      uploadTime: '2026-05-28 06:20:00',
      screenshotUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=weather%20map%20screenshot%20showing%20cloud%20cover%20and%20wind%20direction&image_size=square',
      temperature: 23.8,
      humidity: 68,
      windSpeed: 3.2,
      rainfall: 0,
      isSupplement: false,
    },
    pilotNote: {
      id: 'p-002',
      pilotName: '李明',
      noteTime: '2026-05-28 22:15:00',
      flightStartTime: '2026-05-28 10:30:00',
      flightEndTime: '2026-05-28 12:45:00',
      content: '上午飞行，中途换电池一次。西南角发现可疑病斑，已标记坐标。返航点正常。',
      isSupplement: true,
      delayHours: 9.5,
    },
    photos: [
      {
        id: 'ph-002-1',
        uploadTime: '2026-05-28 13:00:00',
        photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=aerial%20view%20of%20crop%20field%20with%20yellow%20disease%20spots&image_size=square',
        locationTag: 'N32°14\'50" E106°47\'55"',
        pestType: '稻瘟病',
        severity: 'medium',
        isManuallyModified: false,
      },
    ],
    changeLogs: [
      {
        id: 'cl-002-1',
        timestamp: '2026-05-28 06:20:00',
        operator: '系统',
        changeType: 'create',
        field: '气象数据',
        newValue: '温度23.8°C 湿度68%',
        description: '气象截图上传（早到）',
      },
      {
        id: 'cl-002-2',
        timestamp: '2026-05-28 13:00:00',
        operator: '系统',
        changeType: 'create',
        field: '巡检照片',
        newValue: '1张照片上传',
        description: '照片上传完成',
      },
      {
        id: 'cl-002-3',
        timestamp: '2026-05-28 22:15:00',
        operator: '李明',
        changeType: 'supplement',
        field: '飞手备注',
        newValue: '飞行记录补录，延迟9.5小时',
        description: '飞手补录备注（晚半天）',
      },
    ],
    anomalies: [
      createAnomaly(
        'delayed_note',
        'warning',
        '飞手备注延迟9.5小时录入，实际飞行时间为10:30-12:45，备注录入时间为22:15。'
      ),
    ],
  },
  {
    id: 'rec-003',
    flightNo: 'NJ-20260529-01',
    flightDate: '2026-05-29',
    location: '南江县沙河镇2号农田',
    status: 'modified',
    hasReturnPoint: true,
    weatherData: {
      id: 'w-003',
      uploadTime: '2026-05-29 06:10:00',
      screenshotUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=weather%20app%20screenshot%20showing%20temperature%2026%20degrees&image_size=square',
      temperature: 26.2,
      humidity: 70,
      windSpeed: 1.5,
      rainfall: 0,
      isSupplement: false,
    },
    pilotNote: {
      id: 'p-003',
      pilotName: '王强',
      noteTime: '2026-05-29 11:45:00',
      flightStartTime: '2026-05-29 07:30:00',
      flightEndTime: '2026-05-29 09:45:00',
      content: '飞行顺利，光照充足适合拍照。东北片区发现大面积虫情。',
      isSupplement: false,
    },
    photos: [
      {
        id: 'ph-003-1',
        uploadTime: '2026-05-29 10:00:00',
        photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=aerial%20photo%20of%20rice%20field%20with%20pest%20damage%20brown%20spots&image_size=square',
        locationTag: 'N32°20\'15" E106°45\'30"',
        pestType: '稻纵卷叶螟',
        severity: 'high',
        isManuallyModified: true,
        modifiedBy: '王强',
        modifiedTime: '2026-05-29 15:30:00',
        modifyReason: '原始照片曝光不足，调整对比度后虫情更清晰；病虫害等级从"中"修正为"重"。',
      },
    ],
    changeLogs: [
      {
        id: 'cl-003-1',
        timestamp: '2026-05-29 06:10:00',
        operator: '系统',
        changeType: 'create',
        field: '气象数据',
        newValue: '温度26.2°C 湿度70%',
        description: '气象截图上传',
      },
      {
        id: 'cl-003-2',
        timestamp: '2026-05-29 10:00:00',
        operator: '系统',
        changeType: 'create',
        field: '巡检照片',
        newValue: '原始照片，标注为稻纵卷叶螟-中',
        description: '原始照片上传',
      },
      {
        id: 'cl-003-3',
        timestamp: '2026-05-29 11:45:00',
        operator: '王强',
        changeType: 'create',
        field: '飞手备注',
        newValue: '飞行记录正常',
        description: '飞手完成备注',
      },
      {
        id: 'cl-003-4',
        timestamp: '2026-05-29 15:30:00',
        operator: '王强',
        changeType: 'modify',
        field: '巡检照片',
        oldValue: '稻纵卷叶螟-中，原图',
        newValue: '稻纵卷叶螟-重，调整对比度',
        description: '手工修改照片参数和病虫害等级判定',
      },
    ],
    anomalies: [
      createAnomaly(
        'modified_photo',
        'error',
        '巡检照片被手工修改：调整对比度，病虫害等级从"中等"改为"严重"。修改人：王强，修改时间：2026-05-29 15:30。'
      ),
    ],
  },
  {
    id: 'rec-004',
    flightNo: 'NJ-20260529-02',
    flightDate: '2026-05-29',
    location: '南江县沙河镇4号农田',
    status: 'modified',
    hasReturnPoint: false,
    weatherData: {
      id: 'w-004',
      uploadTime: '2026-05-29 06:05:00',
      screenshotUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=weather%20radar%20map%20screenshot%20clear%20sky&image_size=square',
      temperature: 25.5,
      humidity: 65,
      windSpeed: 2.0,
      rainfall: 0,
      isSupplement: false,
    },
    pilotNote: {
      id: 'p-004',
      pilotName: '张伟',
      noteTime: '2026-05-29 12:30:00',
      flightStartTime: '2026-05-29 08:15:00',
      flightEndTime: '2026-05-29 10:00:00',
      content: '飞行中GPS信号短暂丢失，返航点未记录。已手动操控返航，飞机安全降落。照片数据完整。',
      isSupplement: false,
    },
    photos: [
      {
        id: 'ph-004-1',
        uploadTime: '2026-05-29 10:15:00',
        photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=aerial%20photo%20of%20farmland%20with%20suspected%20pest%20damage&image_size=square',
        locationTag: 'N32°19\'40" E106°44\'20"',
        pestType: '二化螟',
        severity: 'medium',
        isManuallyModified: true,
        modifiedBy: '项目负责人-刘总',
        modifiedTime: '2026-05-29 18:00:00',
        modifyReason: '经现场复核，确认病斑为二化螟而非施肥不均，修正标签。',
      },
    ],
    changeLogs: [
      {
        id: 'cl-004-1',
        timestamp: '2026-05-29 06:05:00',
        operator: '系统',
        changeType: 'create',
        field: '气象数据',
        newValue: '温度25.5°C 湿度65%',
        description: '气象截图上传',
      },
      {
        id: 'cl-004-2',
        timestamp: '2026-05-29 10:15:00',
        operator: '系统',
        changeType: 'create',
        field: '巡检照片',
        newValue: '原始照片，标注为施肥不均',
        description: '原始照片上传',
      },
      {
        id: 'cl-004-3',
        timestamp: '2026-05-29 12:30:00',
        operator: '张伟',
        changeType: 'create',
        field: '飞手备注',
        newValue: '返航点丢失，手动返航',
        description: '飞手备注异常情况',
      },
      {
        id: 'cl-004-4',
        timestamp: '2026-05-29 18:00:00',
        operator: '项目负责人-刘总',
        changeType: 'modify',
        field: '巡检照片',
        oldValue: '施肥不均，无病虫害',
        newValue: '二化螟-中',
        description: '人工修改照片标签，改变结论',
      },
    ],
    anomalies: [
      createAnomaly(
        'missing_return_point',
        'error',
        '返航点丢失：飞行过程中GPS信号丢失，自动返航点未记录。飞手手动操控返航。'
      ),
      createAnomaly(
        'modified_photo',
        'error',
        '照片结论被项目负责人修改：从"施肥不均"改为"二化螟-中等"。修改原因：现场复核确认。'
      ),
    ],
  },
  {
    id: 'rec-005',
    flightNo: 'NJ-20260530-01',
    flightDate: '2026-05-30',
    location: '南江县长赤镇1号农田',
    status: 'pending',
    hasReturnPoint: true,
    weatherData: {
      id: 'w-005',
      uploadTime: '2026-05-30 07:00:00',
      screenshotUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=weather%20forecast%20showing%20rain%20probability%2080%20percent&image_size=square',
      temperature: 22.0,
      humidity: 85,
      windSpeed: 4.5,
      rainfall: 5.0,
      isSupplement: false,
    },
    pilotNote: {
      id: 'p-005',
      pilotName: '李明',
      noteTime: '2026-05-30 11:00:00',
      flightStartTime: '2026-05-30 06:30:00',
      flightEndTime: '2026-05-30 08:45:00',
      content: '气象预报有雨但实际飞行时无雨，提前起飞完成作业。风速略高但可控。',
      isSupplement: false,
    },
    photos: [
      {
        id: 'ph-005-1',
        uploadTime: '2026-05-30 09:00:00',
        photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=aerial%20view%20of%20wet%20crop%20field%20after%20light%20rain&image_size=square',
        locationTag: 'N32°25\'10" E106°40\'50"',
        isManuallyModified: false,
      },
    ],
    changeLogs: [
      {
        id: 'cl-005-1',
        timestamp: '2026-05-30 07:00:00',
        operator: '系统',
        changeType: 'create',
        field: '气象数据',
        newValue: '温度22°C 湿度85% 降水5mm',
        description: '气象截图上传（预报有雨）',
      },
      {
        id: 'cl-005-2',
        timestamp: '2026-05-30 09:00:00',
        operator: '系统',
        changeType: 'create',
        field: '巡检照片',
        newValue: '1张照片上传',
        description: '照片上传，地面潮湿',
      },
      {
        id: 'cl-005-3',
        timestamp: '2026-05-30 11:00:00',
        operator: '李明',
        changeType: 'create',
        field: '飞手备注',
        newValue: '实际飞行时无雨，提前作业',
        description: '飞手备注与气象预报不符',
      },
    ],
    anomalies: [
      createAnomaly(
        'weather_mismatch',
        'warning',
        '气象与实际飞行不匹配：气象预报降水5mm，但飞手称实际飞行时无雨，已提前起飞作业。照片显示地面潮湿，需核查。'
      ),
    ],
  },
];

export const handlingSummary = `
本次复盘涉及5架次飞行记录，处理口径如下：

1. **已确认（2架次）**：NJ-20260528-01数据完整同步，可直接作为有效巡检结论归档。
2. **待补（1架次）**：NJ-20260528-02飞手备注延迟9.5小时，需项目负责人签字确认后方可归档。NJ-20260530-01气象与实际飞行不匹配，需补充地面气象站实测数据。
3. **人工改过（2架次）**：NJ-20260529-01照片对比度调整并修改病虫害等级，已提交修改说明，保留原始照片备查。NJ-20260529-02存在返航点丢失+照片结论修改双异常，该架次数据需单独标注，不得直接用于病虫害统计。

导出前复核要点：气象截图完整性、返航点状态、改动记录确认。
`.trim();

export const guideContent = {
  weatherScreenshot: `
### 气象截图放置规范

1. **命名规则**：YYYYMMDD_农田编号_天气.png（例：20260528_红光3号_晴.png）
2. **截图要求**：
   - 必须包含完整的时间戳（截图右上角系统时间）
   - 必须显示温度、湿度、风速、降水四项核心数据
   - 建议使用中央气象台或当地气象站官方APP截图
3. **上传时机**：飞行前1小时内完成截图上传，系统将自动标记为"早到"。
4. **补录说明**：若飞行前未及时截图，需在24小时内补传并标注"气象补录"，同时在备注中说明原因。
  `.trim(),
  returnPoint: `
### 返航点查看位置

1. **总览页**：每架次记录卡片右上角显示●图标，绿色表示返航点正常，红色表示返航点丢失。
2. **详情页**：
   - 在"飞行基本信息"区块中查看"返航点状态"字段
   - 在"异常解释"区块中查看针对返航点丢失的具体处理口径
   - 在"状态回看"区块中查看飞手关于返航点的原始备注
3. **异常处理**：发现返航点丢失后，应立即核查飞控日志和地面站记录，确认不是设备故障后再决定是否保留该架次数据。
  `.trim(),
  reviewCheck: `
### 导出飞行复盘前复核清单

**必须全部完成后方可导出：**

1. □ 气象截图检查
   - 每架次均有对应气象截图
   - 截图时间戳与飞行日期匹配
   - 补录气象已标注原因

2. □ 返航点状态检查
   - 所有"返航点丢失"记录已核查
   - 异常架次已按处理口径标注

3. □ 改动记录确认
   - 所有"人工改过"记录已查看修改原因
   - 修改人均已提交书面说明
   - 原始照片/数据已备份留存

4. □ 分类准确性确认
   - "已确认"记录确实无异常
   - "待补"记录已列出需补充的材料
   - "人工改过"记录处理口径已应用

**复核完成后，勾选复盘页底部所有复选框，导出按钮将自动启用。**
  `.trim(),
};
