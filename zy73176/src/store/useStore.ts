import { useState, useCallback } from 'react';
import type {
  Material,
  BoundaryRecord,
  CaliberVersion,
  ObjectAlias,
  ReviewSummary,
  CSVExportConfig,
  ThresholdDefinition,
  AnomalyRecord,
  ExtrapolationInfo,
  ExtrapolationDirection
} from '../types';
import { mockCaliberVersions, mockObjectAliases, mockMaterials, generateId } from '../data/mockData';
import { AliasResolver } from '../utils/aliasResolver';
import { BoundaryCalculationEngine, type CalculationConfig } from '../utils/boundaryEngine';
import { RemarkParser, type ParsedRemark } from '../utils/remarkParser';

function findThresholdForCaliber(canonicalName: string, caliber: CaliberVersion): ThresholdDefinition | undefined {
  const name = canonicalName.toLowerCase();
  if (name.includes('违约概率') || name.includes('pd') || name.includes('不良概率') || name.includes('违约率') || name.includes('损失率') || name.includes('lgd')) {
    return caliber.thresholds.find((t) => t.name.includes('违约概率'));
  }
  if (name.includes('损失') || name.includes('金额') || name.includes('敞口') || name.includes('ead') || name.includes('暴露')) {
    return caliber.thresholds.find((t) => t.name.includes('损失金额'));
  }
  if (name.includes('逾期') || name.includes('天数')) {
    return caliber.thresholds.find((t) => t.name.includes('逾期天数'));
  }
  return undefined;
}

function makeAnomaly(
  blockType: AnomalyRecord['blockType'],
  severity: 'error' | 'warning' | 'info',
  message: string,
  details: Record<string, unknown>
): AnomalyRecord {
  return {
    id: generateId(),
    boundaryRecordId: '',
    blockType,
    severity,
    message,
    details,
    resolved: false,
    createdAt: new Date().toISOString()
  };
}

function makeMaterialRecord(
  materialId: string,
  caliberId: string,
  objectName: string,
  canonicalName: string,
  severity: 'error' | 'warning',
  message: string,
  details: Record<string, unknown>,
  sourceIndex: number,
  sourceName: string,
  sourceType: 'file' | 'remark' | 'oral',
  sourceContext: string
): BoundaryRecord {
  const anomaly = makeAnomaly(details.blockType as AnomalyRecord['blockType'] || 'consistency', severity, message, details);
  const record: BoundaryRecord = {
    id: generateId(),
    materialId,
    objectName,
    canonicalName,
    inputValue: 0,
    inputUnit: '',
    calculatedValue: 0,
    calculatedUnit: '',
    probability: 0,
    lowerBound: 0,
    upperBound: 0,
    boundUnit: '',
    isWithinBounds: false,
    status: severity,
    caliberVersionId: caliberId,
    anomalies: [anomaly],
    extrapolation: undefined,
    calculationTrace: [],
    sourceIndex,
    sourceName,
    sourceType,
    sourceContext,
    isMaterialLevel: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  anomaly.boundaryRecordId = record.id;
  record.anomalies = [anomaly];
  return record;
}

export interface AppState {
  materials: Material[];
  boundaryRecords: BoundaryRecord[];
  caliberVersions: CaliberVersion[];
  activeCaliber: CaliberVersion;
  objectAliases: ObjectAlias[];
  selectedMaterialId: string | null;
  selectedRecordId: string | null;
  isCalculating: boolean;
  parsedRemark: ParsedRemark | null;
  calculationConfig: CalculationConfig;
  exportConfig: CSVExportConfig;
}

export function useStore() {
  const [state, setState] = useState<AppState>({
    materials: mockMaterials,
    boundaryRecords: [],
    caliberVersions: mockCaliberVersions,
    activeCaliber: mockCaliberVersions.find((c) => c.isActive) || mockCaliberVersions[0],
    objectAliases: mockObjectAliases,
    selectedMaterialId: null,
    selectedRecordId: null,
    isCalculating: false,
    parsedRemark: null,
    calculationConfig: {
      confidenceLevel: 95,
      sampleSize: 100,
      useExtrapolation: true
    },
    exportConfig: {
      includeCaliberInfo: true,
      includeCalculationTrace: true,
      includeAnomalies: true,
      format: 'detailed'
    }
  });

  const selectMaterial = useCallback((materialId: string | null) => {
    setState((prev) => ({ ...prev, selectedMaterialId: materialId, selectedRecordId: null }));
  }, []);

  const selectRecord = useCallback((recordId: string | null) => {
    setState((prev) => ({ ...prev, selectedRecordId: recordId }));
  }, []);

  const setActiveCaliber = useCallback((caliberId: string) => {
    setState((prev) => {
      const caliber = prev.caliberVersions.find((c) => c.id === caliberId);
      return caliber ? { ...prev, activeCaliber: caliber } : prev;
    });
  }, []);

  const parseMaterialRemark = useCallback((material: Material) => {
    const parsed = RemarkParser.parse(material.materials, material.scoreRemark, material.oralNote);
    setState((prev) => ({
      ...prev,
      parsedRemark: parsed,
      calculationConfig: {
        ...prev.calculationConfig,
        sampleSize: parsed.sampleSize || prev.calculationConfig.sampleSize,
        confidenceLevel: parsed.confidenceLevel || prev.calculationConfig.confidenceLevel
      }
    }));
    return parsed;
  }, []);

  const calculateBoundaries = useCallback(async (material: Material) => {
    setState((prev) => ({ ...prev, isCalculating: true }));

    await new Promise((resolve) => setTimeout(resolve, 800));

    const aliasResolver = new AliasResolver(state.objectAliases);
    const engine = new BoundaryCalculationEngine(state.activeCaliber, aliasResolver);

    const parsed = parseMaterialRemark(material);

    const config: CalculationConfig = {
      confidenceLevel: state.calculationConfig.confidenceLevel,
      sampleSize: parsed.sampleSize || state.calculationConfig.sampleSize,
      useExtrapolation: state.calculationConfig.useExtrapolation
    };

    const records: BoundaryRecord[] = [];
    for (const item of material.items) {
      const result = engine.calculate(material, item, config);
      records.push(result.record);
    }

    const materialRecords: BoundaryRecord[] = [];

    if (parsed.hasTitleMismatch) {
      const fileSource = material.materials.find((m) => m.type === 'file') || material.materials[0];
      const detailMsg = material.scoreRemark || '标题与明细数据存在出入，请核查';
      materialRecords.push(makeMaterialRecord(
        material.id,
        state.activeCaliber.id,
        '材料标题明细一致性',
        '材料一致性校验',
        'warning',
        `标题与明细不一致：材料《${material.title}》存在标题与明细不一致。${detailMsg}。不一致来源：${fileSource?.name || '未知'}。`,
        {
          blockType: 'consistency',
          materialTitle: material.title,
          sourceName: fileSource?.name,
          sourceType: fileSource?.type,
          scoreRemark: material.scoreRemark
        },
        material.materials.indexOf(fileSource),
        fileSource?.name || '未知来源',
        fileSource?.type || 'file',
        fileSource?.content?.split('\n')[0] || ''
      ));
    }

    const oldCaliber = material.caliberVersionId !== state.activeCaliber.id
      ? state.caliberVersions.find((c) => c.id === material.caliberVersionId)
      : null;

    if (oldCaliber) {
      const affected: string[] = [];
      records.forEach((rec) => {
        const oldThreshold = findThresholdForCaliber(rec.canonicalName, oldCaliber);
        const newThreshold = findThresholdForCaliber(rec.canonicalName, state.activeCaliber);
        if (oldThreshold && newThreshold) {
          const oldWithin = rec.calculatedValue >= oldThreshold.minValue && rec.calculatedValue <= oldThreshold.maxValue;
          if (oldWithin !== rec.isWithinBounds) {
            affected.push(`${rec.canonicalName}（${oldWithin ? '界内' : '界外'}→${rec.isWithinBounds ? '界内' : '界外'}）`);
            const anomaly = makeAnomaly(
              'caliber',
              'warning',
              `口径变更影响：该材料使用旧口径${oldCaliber.version}（${oldCaliber.name}），现按新口径${state.activeCaliber.version}复核。"${rec.canonicalName}"阈值由[${oldThreshold.minValue}, ${oldThreshold.maxValue}]${oldThreshold.unit}变为[${newThreshold.minValue}, ${newThreshold.maxValue}]${newThreshold.unit}，边界判定由"${oldWithin ? '界内' : '界外'}"变为"${rec.isWithinBounds ? '界内' : '界外'}"。`,
              {
                blockType: 'caliber',
                oldVersion: oldCaliber.version,
                newVersion: state.activeCaliber.version,
                canonicalName: rec.canonicalName,
                oldThreshold: { min: oldThreshold.minValue, max: oldThreshold.maxValue, unit: oldThreshold.unit },
                newThreshold: { min: newThreshold.minValue, max: newThreshold.maxValue, unit: newThreshold.unit },
                oldWithin,
                newWithin: rec.isWithinBounds
              }
            );
            anomaly.boundaryRecordId = rec.id;
            rec.anomalies.push(anomaly);
            if (rec.status === 'completed') {
              rec.status = 'warning';
            }
          }
        }
      });

      const oralSource = material.materials.find((m) => m.type === 'oral') || material.materials[0];
      materialRecords.push(makeMaterialRecord(
        material.id,
        state.activeCaliber.id,
        '口径变更追踪',
        '口径变更追踪',
        'warning',
        `口径变更：材料《${material.title}》使用旧口径${oldCaliber.version}（${oldCaliber.name}），当前生效口径为${state.activeCaliber.version}（${state.activeCaliber.name}）。${affected.length > 0 ? `受影响边界判断：${affected.join('、')}。` : '经比对，各指标边界判定未发生变化，但材料仍使用旧口径数据，需确认是否需按新口径重算。'}变更说明：${oldCaliber.changeLog.replace(/\n/g, '；')}`,
        {
          blockType: 'caliber',
          materialTitle: material.title,
          oldVersion: oldCaliber.version,
          newVersion: state.activeCaliber.version,
          affectedIndicators: affected
        },
        material.materials.indexOf(oralSource),
        oralSource?.name || '未知来源',
        oralSource?.type || 'oral',
        oralSource?.content || ''
      ));
    }

    if (parsed.extrapolationInfo) {
      const info = parsed.extrapolationInfo;
      const dir: ExtrapolationDirection = info.direction.includes('上') || info.direction.toLowerCase().includes('up') ? 'up' : 'down';
      const target = records.find((r) => r.objectName.includes('外推') || Math.abs(r.inputValue - info.extrapolatedValue) < 0.01);
      if (target && !target.extrapolation) {
        const ext: ExtrapolationInfo = {
          direction: dir,
          originalRange: info.originalRange,
          extrapolatedValue: info.extrapolatedValue,
          impactScope: ['概率模拟结果', '风险加权资产计算', '资本充足率'],
          suggestion: `该指标基于${info.method}外推得出，原始样本范围[${info.originalRange[0]}%, ${info.originalRange[1]}%]，外推至${info.extrapolatedValue}%。收尾建议：1. 样本量不足，外推结果不确定性高，需审慎使用；2. 设置审慎调整因子（建议系数1.2-1.5）；3. 人工复核并记录审批意见；4. 与业务部门沟通确认风险容忍度。`,
          method: info.method
        };
        target.extrapolation = ext;
        const anomaly = makeAnomaly(
          'extrapolation',
          'warning',
          `外推越界检测：${target.canonicalName}基于${info.method}外推，原始样本范围[${info.originalRange[0]}%, ${info.originalRange[1]}%]，外推值${info.extrapolatedValue}%。影响范围：${ext.impactScope.join(' → ')}。`,
          {
            blockType: 'extrapolation',
            method: info.method,
            originalRange: info.originalRange,
            extrapolatedValue: info.extrapolatedValue,
            impactScope: ext.impactScope
          }
        );
        anomaly.boundaryRecordId = target.id;
        target.anomalies.push(anomaly);
        if (target.status === 'completed') {
          target.status = 'warning';
        }
      }
    }

    const allRecords = [...materialRecords, ...records];

    setState((prev) => ({
      ...prev,
      boundaryRecords: allRecords,
      isCalculating: false,
      selectedMaterialId: material.id
    }));

    return allRecords;
  }, [state.objectAliases, state.activeCaliber, state.calculationConfig, state.caliberVersions, parseMaterialRemark]);

  const getReviewSummary = useCallback((): ReviewSummary => {
    const records = state.boundaryRecords;
    const boundaryRecords = records.filter((r) => !r.isMaterialLevel);
    return {
      totalRecords: records.length,
      withinBounds: boundaryRecords.filter((r) => r.isWithinBounds).length,
      outOfBounds: boundaryRecords.filter((r) => !r.isWithinBounds).length,
      errors: records.filter((r) => r.status === 'error').length,
      warnings: records.filter((r) => r.status === 'warning').length,
      extrapolations: records.filter((r) => r.extrapolation).length,
      aliasResolved: records.filter((r) => r.anomalies.some((a) => a.blockType === 'alias')).length
    };
  }, [state.boundaryRecords]);

  const addMaterial = useCallback((material: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const newMaterial: Material = {
      ...material,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending'
    };
    setState((prev) => ({
      ...prev,
      materials: [newMaterial, ...prev.materials]
    }));
    return newMaterial;
  }, []);

  const updateCalculationConfig = useCallback((config: Partial<CalculationConfig>) => {
    setState((prev) => ({
      ...prev,
      calculationConfig: { ...prev.calculationConfig, ...config }
    }));
  }, []);

  const updateExportConfig = useCallback((config: Partial<CSVExportConfig>) => {
    setState((prev) => ({
      ...prev,
      exportConfig: { ...prev.exportConfig, ...config }
    }));
  }, []);

  const resolveAnomaly = useCallback((anomalyId: string, resolution: string) => {
    setState((prev) => ({
      ...prev,
      boundaryRecords: prev.boundaryRecords.map((record) => ({
        ...record,
        anomalies: record.anomalies.map((a) =>
          a.id === anomalyId ? { ...a, resolved: true, resolution } : a
        ),
        updatedAt: new Date().toISOString()
      }))
    }));
  }, []);

  const getSelectedMaterial = useCallback(() => {
    return state.materials.find((m) => m.id === state.selectedMaterialId) || null;
  }, [state.materials, state.selectedMaterialId]);

  const getSelectedRecord = useCallback(() => {
    return state.boundaryRecords.find((r) => r.id === state.selectedRecordId) || null;
  }, [state.boundaryRecords, state.selectedRecordId]);

  return {
    state,
    selectMaterial,
    selectRecord,
    setActiveCaliber,
    calculateBoundaries,
    parseMaterialRemark,
    getReviewSummary,
    addMaterial,
    updateCalculationConfig,
    updateExportConfig,
    resolveAnomaly,
    getSelectedMaterial,
    getSelectedRecord
  };
}

export type AppStore = ReturnType<typeof useStore>;
