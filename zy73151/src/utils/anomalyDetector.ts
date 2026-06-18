import type { LabRecord, Material, Anomaly, EvidenceItem, TideUnit } from '@/types';

const generateId = () => Math.random().toString(36).substring(2, 11);

export const detectUnitMismatch = (materials: Material[]): Anomaly[] => {
  const anomalies: Anomaly[] = [];

  materials.forEach(material => {
    if (material.parsedData.length === 0) return;

    const units = new Set<TideUnit>();
    const unitRecords: Record<TideUnit, LabRecord[]> = { m: [], cm: [], mm: [] };

    material.parsedData.forEach(record => {
      units.add(record.tideUnit);
      unitRecords[record.tideUnit].push(record);
    });

    if (units.size > 1) {
      const unitList = Array.from(units);
      const rows = material.parsedData.map(r => r.sourceRow);
      const stations = [...new Set(material.parsedData.map(r => r.stationName))];

      const evidenceChain: EvidenceItem[] = unitList.map(unit => ({
        id: generateId(),
        materialId: material.id,
        materialName: material.name,
        version: material.version,
        timestamp: material.uploadTime,
        content: `${unitRecords[unit].length} 条记录使用 ${unit} 单位`,
        isVerbal: false,
        fieldName: 'tideUnit',
      }));

      anomalies.push({
        id: `anomaly-unit-${material.id}`,
        type: 'unit_mismatch',
        severity: 'high',
        stationId: unitRecords[unitList[1]][0]?.stationId || '',
        stationName: stations.join('、'),
        description: `材料「${material.name}」中潮位单位混用：${unitList.join(' / ')}`,
        impactRange: `涉及 ${material.parsedData.length} 条记录，${stations.length} 个点位`,
        sourceRows: rows.sort((a, b) => a - b),
        materialIds: [material.id],
        materialNames: [material.name],
        evidenceChain,
        status: 'pending',
        conclusionChange: '单位不统一可能导致潮位数据对比失真，需确认标准单位后统一换算。',
        detectedAt: new Date().toISOString(),
        fieldName: 'tideLevel',
      });
    }
  });

  return anomalies;
};

export const detectCaliberChanges = (materials: Material[]): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  const sortedMaterials = [...materials].sort((a, b) => a.version - b.version);

  if (sortedMaterials.length < 2) return anomalies;

  const stationMap = new Map<string, { records: LabRecord[]; materials: Material[] }>();

  sortedMaterials.forEach(material => {
    material.parsedData.forEach(record => {
      if (!stationMap.has(record.stationId)) {
        stationMap.set(record.stationId, { records: [], materials: [] });
      }
      const data = stationMap.get(record.stationId)!;
      data.records.push(record);
      if (!data.materials.find(m => m.id === material.id)) {
        data.materials.push(material);
      }
    });
  });

  const fieldsToCheck: (keyof LabRecord)[] = [
    'temperature', 'salinity', 'tideLevel', 'dissolvedOxygen', 'ph'
  ];

  const fieldNames: Record<string, string> = {
    temperature: '水温',
    salinity: '盐度',
    tideLevel: '潮位',
    dissolvedOxygen: '溶解氧',
    ph: 'pH值',
  };

  stationMap.forEach((data, stationId) => {
    if (data.materials.length < 2) return;

    const recordsByMaterial = new Map<string, LabRecord>();
    data.records.forEach(r => {
      recordsByMaterial.set(r.materialId, r);
    });

    fieldsToCheck.forEach(field => {
      const values: { material: Material; value: number; record: LabRecord }[] = [];

      data.materials.forEach(mat => {
        const rec = recordsByMaterial.get(mat.id);
        if (rec && typeof rec[field] === 'number') {
          values.push({ material: mat, value: rec[field] as number, record: rec });
        }
      });

      if (values.length < 2) return;

      const baseline = values[0].value;
      for (let i = 1; i < values.length; i++) {
        const current = values[i].value;
        const diff = Math.abs(current - baseline);
        const relativeDiff = baseline > 0 ? diff / baseline : 0;

        if (relativeDiff > 0.1 && diff > 0.5) {
          const evidenceChain: EvidenceItem[] = values.map((v, idx) => ({
            id: generateId(),
            materialId: v.material.id,
            materialName: v.material.name,
            version: v.material.version,
            timestamp: v.material.uploadTime,
            content: `${fieldNames[field as string]}: ${v.value}`,
            isVerbal: v.material.source === 'verbal_note',
            changeType: idx === 0 ? 'add' : 'modify',
            previousValue: idx > 0 ? String(values[idx - 1].value) : undefined,
            currentValue: String(v.value),
            fieldName: field as string,
          }));

          const matNames = values.map(v => v.material.name);
          const srcRows = values.map(v => v.record.sourceRow);

          anomalies.push({
            id: `anomaly-caliber-${stationId}-${field}-${generateId()}`,
            type: 'caliber_change',
            severity: relativeDiff > 0.2 ? 'high' : 'medium',
            stationId,
            stationName: values[0].record.stationName,
            description: `${fieldNames[field as string]}数据口径变更：从 ${baseline} 变为 ${current}`,
            impactRange: `点位「${values[0].record.stationName}」的${fieldNames[field as string]}指标`,
            sourceRows: srcRows,
            materialIds: values.map(v => v.material.id),
            materialNames: matNames,
            evidenceChain,
            status: 'pending',
            conclusionChange: `${fieldNames[field as string]}在不同材料版本中数值不一致，变化幅度 ${(relativeDiff * 100).toFixed(1)}%，需确认哪一版为准。`,
            detectedAt: new Date().toISOString(),
            fieldName: field as string,
          });
          break;
        }
      }
    });
  });

  return anomalies;
};

export const detectTimeMismatch = (materials: Material[]): Anomaly[] => {
  const anomalies: Anomaly[] = [];

  materials.forEach(material => {
    material.parsedData.forEach(record => {
      const sampleTime = new Date(record.sampleTime).getTime();
      const resultTime = new Date(record.resultTime).getTime();

      if (resultTime < sampleTime) {
        anomalies.push({
          id: `anomaly-time-${record.id}`,
          type: 'time_mismatch',
          severity: 'high',
          stationId: record.stationId,
          stationName: record.stationName,
          description: `采样时间晚于实验结果时间`,
          impactRange: `点位「${record.stationName}」第 ${record.sourceRow} 行`,
          sourceRows: [record.sourceRow],
          materialIds: [material.id],
          materialNames: [material.name],
          evidenceChain: [{
            id: generateId(),
            materialId: material.id,
            materialName: material.name,
            version: material.version,
            timestamp: material.uploadTime,
            content: `采样: ${record.sampleTime}, 结果: ${record.resultTime}`,
            isVerbal: false,
            fieldName: 'sampleTime/resultTime',
          }],
          status: 'pending',
          conclusionChange: '实验结果时间早于采样时间，存在逻辑矛盾，需核实时间记录是否正确。',
          detectedAt: new Date().toISOString(),
        });
      }

      const diffHours = (resultTime - sampleTime) / (1000 * 60 * 60);
      if (resultTime > sampleTime && diffHours > 72) {
        anomalies.push({
          id: `anomaly-time-gap-${record.id}`,
          type: 'time_mismatch',
          severity: 'low',
          stationId: record.stationId,
          stationName: record.stationName,
          description: `采样与实验间隔过长（${(diffHours / 24).toFixed(1)} 天）`,
          impactRange: `点位「${record.stationName}」第 ${record.sourceRow} 行`,
          sourceRows: [record.sourceRow],
          materialIds: [material.id],
          materialNames: [material.name],
          evidenceChain: [{
            id: generateId(),
            materialId: material.id,
            materialName: material.name,
            version: material.version,
            timestamp: material.uploadTime,
            content: `间隔 ${(diffHours / 24).toFixed(1)} 天`,
            isVerbal: false,
            fieldName: 'sampleTime/resultTime',
          }],
          status: 'pending',
          conclusionChange: '样品存放时间过长可能影响检测结果准确性，建议确认是否为同批次样品。',
          detectedAt: new Date().toISOString(),
        });
      }
    });
  });

  return anomalies;
};

export const detectAllAnomalies = (materials: Material[]): Anomaly[] => {
  const unitAnomalies = detectUnitMismatch(materials);
  const caliberAnomalies = detectCaliberChanges(materials);
  const timeAnomalies = detectTimeMismatch(materials);

  return [...unitAnomalies, ...caliberAnomalies, ...timeAnomalies];
};

export const anomalyTypeLabels: Record<string, string> = {
  unit_mismatch: '单位混写',
  caliber_change: '口径变更',
  time_mismatch: '时间不一致',
  value_abnormal: '数值异常',
  missing_data: '数据缺失',
};

export const severityLabels: Record<string, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
};

export const sourceTypeLabels: Record<string, string> = {
  lab_result: '实验室结果',
  late_attachment: '晚到附件',
  verbal_note: '口头说明',
};
