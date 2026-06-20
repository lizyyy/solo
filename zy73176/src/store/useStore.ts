import { useState, useCallback } from 'react';
import type { Material, BoundaryRecord, CaliberVersion, ObjectAlias, ReviewSummary, CSVExportConfig } from '../types';
import { mockCaliberVersions, mockObjectAliases, mockMaterials, generateId } from '../data/mockData';
import { AliasResolver } from '../utils/aliasResolver';
import { BoundaryCalculationEngine, type CalculationConfig } from '../utils/boundaryEngine';
import { RemarkParser, type ParsedRemark } from '../utils/remarkParser';

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
      const result = engine.calculate(material.id, item, config);
      records.push(result.record);
    }

    setState((prev) => ({
      ...prev,
      boundaryRecords: records,
      isCalculating: false,
      selectedMaterialId: material.id
    }));

    return records;
  }, [state.objectAliases, state.activeCaliber, state.calculationConfig, parseMaterialRemark]);

  const getReviewSummary = useCallback((): ReviewSummary => {
    const records = state.boundaryRecords;
    return {
      totalRecords: records.length,
      withinBounds: records.filter((r) => r.isWithinBounds).length,
      outOfBounds: records.filter((r) => !r.isWithinBounds).length,
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
