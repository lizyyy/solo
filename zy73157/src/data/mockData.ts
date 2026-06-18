import type {
  SamplingRecord,
  AnomalyMarker,
  SensorDrift,
  WithdrawalRecord,
  ProjectSummary,
} from "@/types";

const generateTimestamps = (count: number, startDate: string): string[] => {
  const timestamps: string[] = [];
  const base = new Date(startDate).getTime();
  for (let i = 0; i < count; i++) {
    timestamps.push(new Date(base + i * 30 * 60 * 1000).toISOString());
  }
  return timestamps;
};

const timestamps = generateTimestamps(24, "2026-06-18T06:00:00Z");

const basePositions = [
  { longitude: 121.4737, latitude: 31.2304, depth: 120 },
  { longitude: 121.4837, latitude: 31.2404, depth: 145 },
  { longitude: 121.4937, latitude: 31.2504, depth: 180 },
  { longitude: 121.5037, latitude: 31.2604, depth: 210 },
  { longitude: 121.5137, latitude: 31.2704, depth: 250 },
  { longitude: 121.5237, latitude: 31.2804, depth: 295 },
];

export const sensorDrifts: SensorDrift[] = [
  {
    id: "drift-001",
    sensorId: "SENSOR-TEMP-03",
    driftValue: 2.3,
    driftDirection: "positive",
    affectedStartIndex: 8,
    affectedEndIndex: 15,
    sourceLine: 47,
    detectedAt: "2026-06-18T14:30:00Z",
    corrected: true,
    correctionMethod: "现场重新校准，偏移量已修正",
  },
  {
    id: "drift-002",
    sensorId: "SENSOR-DO-02",
    driftValue: -1.8,
    driftDirection: "negative",
    affectedStartIndex: 16,
    affectedEndIndex: 22,
    sourceLine: 62,
    detectedAt: "2026-06-18T18:45:00Z",
    corrected: false,
  },
];

export const withdrawalRecords: WithdrawalRecord[] = [
  {
    id: "withdraw-001",
    originalRecordId: "REC-2026-0012",
    reason: "采样瓶污染，数据作废",
    withdrawnBy: "何建国",
    withdrawnAt: "2026-06-18T16:20:00Z",
    sourcePage: 23,
    sourceLine: 56,
    annotation: "第12号样本发现瓶盖松动，水样疑似污染，已在记录本第23页56行标注撤回，补采样本编号REC-2026-0012B",
    replacementRecordId: "REC-2026-0012B",
  },
];

export const anomalyMarkers: AnomalyMarker[] = [
  {
    id: "anom-001",
    recordId: "REC-2026-0007",
    type: "value_exceeded",
    parameter: "dissolved_oxygen",
    description: "溶解氧含量低于临界值3.5mg/L",
    severity: "high",
    detectedAt: "2026-06-18T12:30:00Z",
    handledAt: "2026-06-18T15:00:00Z",
    handler: "何建国",
    resolution: "已复核，确认为底层水缺氧区，已在报告中标注",
  },
  {
    id: "anom-002",
    recordId: "REC-2026-0010",
    type: "sensor_drift",
    parameter: "temperature",
    description: "温度传感器漂移超过允许范围±0.5℃",
    severity: "medium",
    detectedAt: "2026-06-18T14:30:00Z",
    handledAt: "2026-06-18T16:00:00Z",
    handler: "何建国",
    resolution: "已现场校准，受影响数据已标记漂移修正",
  },
  {
    id: "anom-003",
    recordId: "REC-2026-0012",
    type: "withdrawal",
    description: "该记录已撤回，见撤回记录WD-001",
    severity: "critical",
    detectedAt: "2026-06-18T16:20:00Z",
    handledAt: "2026-06-18T16:20:00Z",
    handler: "何建国",
    resolution: "样本污染，已作废并补采",
  },
  {
    id: "anom-004",
    recordId: "REC-2026-0018",
    type: "abnormal_trend",
    parameter: "salinity",
    description: "盐度突变超出正常波动范围",
    severity: "medium",
    detectedAt: "2026-06-18T20:00:00Z",
  },
  {
    id: "anom-005",
    recordId: "REC-2026-0021",
    type: "missing_data",
    parameter: "ph",
    description: "pH值数据缺失，传感器通讯中断",
    severity: "low",
    detectedAt: "2026-06-18T22:30:00Z",
  },
  {
    id: "anom-006",
    recordId: "REC-2026-0019",
    type: "sensor_drift",
    parameter: "dissolved_oxygen",
    description: "溶解氧传感器持续负漂移",
    severity: "high",
    detectedAt: "2026-06-18T18:45:00Z",
  },
];

const notebookEntries = [
  { page: 19, line: 12, text: "06:00 启航，设备自检正常，人员：何建国、张伟", by: "何建国" },
  { page: 19, line: 15, text: "06:30 抵达第一采样点，开始下放CTD", by: "何建国" },
  { page: 20, line: 22, text: "09:30 第三采样点，发现水温梯度异常", by: "何建国" },
  { page: 20, line: 28, text: "10:00 溶解氧读数偏低，已记录待复核", by: "何建国" },
  { page: 21, line: 35, text: "12:30 第七采样点，DO=3.2mg/L，低于临界值", by: "何建国" },
  { page: 21, line: 42, text: "13:30 午餐，设备待机，数据采集暂停", by: "张伟" },
  { page: 22, line: 47, text: "14:30 温度传感器漂移+2.3℃，开始校准", by: "何建国" },
  { page: 22, line: 52, text: "15:30 校准完成，恢复采样", by: "何建国" },
  { page: 23, line: 56, text: "16:20 第12号样本污染，撤回，标注作废", by: "何建国" },
  { page: 23, line: 58, text: "16:35 补采第12B号样本", by: "何建国" },
  { page: 24, line: 62, text: "18:45 溶解氧传感器漂移-1.8mg/L，待校准", by: "何建国" },
  { page: 24, line: 68, text: "19:30 盐度突变，疑似淡水汇入", by: "张伟" },
  { page: 25, line: 75, text: "21:00 第21采样点，pH传感器通讯中断", by: "何建国" },
  { page: 25, line: 80, text: "22:00 采样结束，返航", by: "何建国" },
];

const generateParameter = (
  index: number,
  param: "temperature" | "salinity" | "pressure" | "dissolved_oxygen" | "ph"
): number | null => {
  const base = {
    temperature: 18.5,
    salinity: 32.1,
    pressure: 150,
    dissolved_oxygen: 6.5,
    ph: 8.1,
  };
  const variation = Math.sin(index * 0.3) * 0.8;
  let value = base[param] + variation + (Math.random() - 0.5) * 0.3;

  if (param === "temperature" && index >= 8 && index <= 15) {
    value += 2.3;
  }
  if (param === "dissolved_oxygen" && index === 6) {
    value = 3.2;
  }
  if (param === "dissolved_oxygen" && index >= 16 && index <= 22) {
    value -= 1.8;
  }
  if (param === "salinity" && index === 17) {
    value = 28.5;
  }
  if (param === "ph" && index === 20) {
    return null;
  }
  if (index === 11) {
    return null;
  }

  return Math.round(value * 100) / 100;
};

const statusMap: Record<number, "resolved" | "pending_evidence" | "blocked"> = {
  6: "resolved",
  9: "resolved",
  11: "resolved",
  17: "pending_evidence",
  18: "pending_evidence",
  20: "blocked",
  19: "blocked",
};

export const samplingRecords: SamplingRecord[] = timestamps.map((ts, index) => {
  const posIndex = Math.floor(index / 4) % basePositions.length;
  const basePos = basePositions[posIndex];
  const position = {
    longitude: basePos.longitude + (Math.random() - 0.5) * 0.01,
    latitude: basePos.latitude + (Math.random() - 0.5) * 0.01,
    depth: basePos.depth + Math.round((Math.random() - 0.5) * 20),
  };

  const notebookEntry = notebookEntries.find((e) => Math.abs(e.line - (index + 1) * 3) < 5);

  const anomalyIds = anomalyMarkers
    .filter((a) => {
      const aIndex = parseInt(a.recordId.split("-").pop() || "0") - 1;
      return aIndex === index;
    })
    .map((a) => a.id);

  const driftIds = sensorDrifts
    .filter((d) => index >= d.affectedStartIndex && index <= d.affectedEndIndex)
    .map((d) => d.id);

  const withdrawal = withdrawalRecords.find(
    (w) => parseInt(w.originalRecordId.split("-").pop() || "0") - 1 === index
  );

  return {
    id: `REC-2026-${String(index + 1).padStart(4, "0")}`,
    timestamp: ts,
    position,
    parameters: {
      temperature: generateParameter(index, "temperature"),
      salinity: generateParameter(index, "salinity"),
      pressure: generateParameter(index, "pressure"),
      dissolved_oxygen: generateParameter(index, "dissolved_oxygen"),
      ph: generateParameter(index, "ph"),
    },
    status: statusMap[index] || "resolved",
    anomalies: anomalyIds,
    notebookSource: {
      bookId: "NB-2026-HJG-03",
      page: notebookEntry?.page || Math.floor(index / 4) + 19,
      line: notebookEntry?.line || (index + 1) * 3,
      originalText: notebookEntry?.text || `${ts.slice(11, 16)} 正常采样，数据记录`,
      recordedBy: notebookEntry?.by || "何建国",
      recordedAt: ts,
    },
    evidence: [
      {
        id: `ev-${index}-1`,
        type: "notebook",
        description: "船上记录本原始记录",
        reference: `NB-2026-HJG-03-p${notebookEntry?.page || Math.floor(index / 4) + 19}`,
        uploadedAt: ts,
      },
    ],
    withdrawalId: withdrawal?.id,
    driftIds,
    notes: index === 6 ? "底层水缺氧区，需重点关注" : undefined,
  };
});

samplingRecords.splice(
  12,
  0,
  {
    ...samplingRecords[11],
    id: "REC-2026-0012B",
    timestamp: "2026-06-18T16:35:00Z",
    parameters: {
      temperature: 19.25,
      salinity: 32.34,
      pressure: 158,
      dissolved_oxygen: 5.82,
      ph: 8.08,
    },
    status: "resolved",
    anomalies: [],
    notebookSource: {
      bookId: "NB-2026-HJG-03",
      page: 23,
      line: 58,
      originalText: "16:35 补采第12B号样本",
      recordedBy: "何建国",
      recordedAt: "2026-06-18T16:35:00Z",
    },
    notes: "补采样本，替代被撤回的REC-2026-0012",
  } as SamplingRecord
);

export const generateProjectSummary = (): ProjectSummary => {
  const totalRecords = samplingRecords.length;
  const withdrawnCount = samplingRecords.filter((r) => r.withdrawalId).length;
  const anomalyCount = samplingRecords.filter((r) => r.anomalies.length > 0).length;
  const driftAffectedCount = samplingRecords.filter((r) => r.driftIds.length > 0).length;

  const statusBreakdown = {
    resolved: samplingRecords.filter((r) => r.status === "resolved").length,
    pending_evidence: samplingRecords.filter((r) => r.status === "pending_evidence").length,
    blocked: samplingRecords.filter((r) => r.status === "blocked").length,
  };

  const anomalyBreakdown = {
    value_exceeded: anomalyMarkers.filter((a) => a.type === "value_exceeded").length,
    sensor_drift: anomalyMarkers.filter((a) => a.type === "sensor_drift").length,
    withdrawal: anomalyMarkers.filter((a) => a.type === "withdrawal").length,
    abnormal_trend: anomalyMarkers.filter((a) => a.type === "abnormal_trend").length,
    missing_data: anomalyMarkers.filter((a) => a.type === "missing_data").length,
  };

  const pendingEvidenceList = samplingRecords
    .filter((r) => r.status === "pending_evidence")
    .map((r) => ({
      recordId: r.id,
      timestamp: r.timestamp,
      position: r.position,
      missingEvidence: ["实验室分析报告", "采样现场照片"],
    }));

  const blockedList = samplingRecords
    .filter((r) => r.status === "blocked")
    .map((r) => ({
      recordId: r.id,
      timestamp: r.timestamp,
      position: r.position,
      blockReason: r.id.includes("21") ? "pH传感器硬件故障，需返厂维修" : "溶解氧传感器未校准，数据有效性待确认",
    }));

  const driftSummary = sensorDrifts.map((d) => ({
    driftId: d.id,
    sensorId: d.sensorId,
    affectedCount: d.affectedEndIndex - d.affectedStartIndex + 1,
    driftValue: d.driftValue,
    corrected: d.corrected,
  }));

  return {
    totalRecords,
    withdrawnCount,
    anomalyCount,
    driftAffectedCount,
    statusBreakdown,
    anomalyBreakdown,
    pendingEvidenceList,
    blockedList,
    driftSummary,
    lastUpdated: new Date().toISOString(),
  };
};
