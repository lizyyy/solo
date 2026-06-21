import { useCallback } from 'react';
import type { Batch, CalculationNode, ConflictRecord, NoisePredictionResult } from '../types';
import { useAppStore } from '../store/useAppStore';
import { performFullCalculation, type CalculationInput } from '../utils/physicsCalculator';
import { detectConflicts, detectAnomalies, getValidationSummary } from '../utils/validator';
import { normalizeDataPointsToDB } from '../utils/physicsCalculator';

const conflictFingerprint = (c: ConflictRecord): string => {
  switch (c.type) {
    case 'unit_mismatch':
      return `unit_mismatch|${c.sensorData.unit}|${c.importData.unit}`;
    case 'direction_error': {
      const sensorDirMatch = c.sensorData.rawLog?.match(/DIR=(CCW|CW)/i);
      const sensorDir = sensorDirMatch ? sensorDirMatch[1].toUpperCase() : 'UNKNOWN';
      let importDir: string | undefined = c.importData.direction;
      if (!importDir) {
        const importDirMatch = c.suggestedAction?.match(/导入数据为(CCW|CW)/i);
        if (importDirMatch) {
          importDir = importDirMatch[1].toUpperCase();
        }
      }
      return `direction_error|${sensorDir}|${importDir || 'UNKNOWN'}`;
    }
    case 'timegap_error':
      return `timegap_error|${c.sensorData.timestamp}|${c.importData.timestamp}`;
    case 'value_conflict':
      return `value_conflict|${c.sensorData.unit}|${c.importData.unit}|${c.sensorData.timestamp}|${c.importData.timestamp}`;
    default:
      return `${c.type}|${c.sensorData.value}|${c.sensorData.unit}|${c.importData.value}|${c.importData.unit}|${c.sensorData.timestamp}|${c.importData.timestamp}`;
  }
};

const mergeConflictsPreservingResolutions = (
  newConflicts: ConflictRecord[],
  existingConflicts: ConflictRecord[]
): ConflictRecord[] => {
  const resolvedMap = new Map<string, ConflictRecord>();
  for (const ec of existingConflicts) {
    if (ec.resolution) {
      resolvedMap.set(conflictFingerprint(ec), ec);
    }
  }
  return newConflicts.map((nc) => {
    const key = conflictFingerprint(nc);
    const resolved = resolvedMap.get(key);
    if (resolved) {
      return {
        ...nc,
        resolution: resolved.resolution,
        resolvedBy: resolved.resolvedBy,
        resolvedAt: resolved.resolvedAt,
      };
    }
    return nc;
  });
};

export const useNoiseCalculation = () => {
  const {
    updateBatch,
    setCalculating,
    thresholdConfig,
    currentBatchId,
    batches,
  } = useAppStore();

  const currentBatch = batches.find((b) => b.id === currentBatchId);

  const runCalculation = useCallback(
    async (
      batchId: string,
      params: {
        rotorSpeed: number;
        thrust: number;
        rotorRadius: number;
        bladeCount: number;
        chord: number;
        azimuth?: number;
        elevation?: number;
      }
    ): Promise<{ success: boolean; message: string }> => {
      const batch = batches.find((b) => b.id === batchId);
      if (!batch) {
        return { success: false, message: '未找到批次数据' };
      }

      setCalculating(true);

      try {
        await new Promise((resolve) => setTimeout(resolve, 800));

        const { experimentRecord } = batch;

        const rawConflicts = detectConflicts(
          experimentRecord.dataPoints,
          experimentRecord.sensorLogs,
          thresholdConfig
        );

        const conflicts = mergeConflictsPreservingResolutions(rawConflicts, batch.conflicts);

        const anomalies = detectAnomalies(experimentRecord.dataPoints, thresholdConfig);

        const validationSummary = getValidationSummary(conflicts, anomalies);
        if (!validationSummary.canProceed) {
          const updatedBatch: Batch = {
            ...batch,
            conflicts,
            anomalies,
            status: 'rework',
          };
          updateBatch(updatedBatch);
          setCalculating(false);
          return {
            success: false,
            message: validationSummary.summary + ' 请先解决冲突后再计算。',
          };
        }

        const { points: normalizedPoints, conversions } = normalizeDataPointsToDB(
          experimentRecord.dataPoints
        );

        const calcInput: CalculationInput = {
          batchId,
          dataPoints: normalizedPoints,
          rotorSpeed: params.rotorSpeed,
          thrust: params.thrust,
          rotorRadius: params.rotorRadius,
          bladeCount: params.bladeCount,
          chord: params.chord,
          azimuth: params.azimuth || 0,
          elevation: params.elevation || 0,
          config: thresholdConfig,
        };

        const { chain, result } = performFullCalculation(calcInput);

        const updatedBatch: Batch = {
          ...batch,
          experimentRecord: {
            ...experimentRecord,
            dataPoints: normalizedPoints,
          },
          calculationChain: chain,
          unitConversions: conversions as unknown as never[],
          conflicts,
          anomalies,
          result,
          status: 'completed',
        };

        updateBatch(updatedBatch);
        setCalculating(false);

        return {
          success: true,
          message: `计算完成！噪声级: ${result.overallNoiseLevel.toFixed(2)}dB，评估: ${result.assessment === 'normal' ? '正常' : result.assessment === 'warning' ? '警告' : '严重'}`,
        };
      } catch (error) {
        setCalculating(false);
        return {
          success: false,
          message: `计算失败: ${error instanceof Error ? error.message : '未知错误'}`,
        };
      }
    },
    [batches, thresholdConfig, updateBatch, setCalculating]
  );

  const rerunCalculation = useCallback(
    async (batchId: string): Promise<{ success: boolean; message: string; oldResult?: NoisePredictionResult; newResult?: NoisePredictionResult; newChain?: CalculationNode[] }> => {
      const batch = batches.find((b) => b.id === batchId);
      if (!batch) {
        return { success: false, message: '未找到批次数据' };
      }

      const oldResult = batch.result;
      const operationCondition = batch.operationConditions[0];

      if (!operationCondition) {
        return { success: false, message: '缺少工况数据，无法重跑' };
      }

      const rotorSpeed = operationCondition.rotorSpeed || 4500;
      const thrust = (operationCondition.payload || 5) * 9.81;

      setCalculating(true);

      try {
        await new Promise((resolve) => setTimeout(resolve, 600));

        const { experimentRecord } = batch;
        const { points: normalizedPoints } = normalizeDataPointsToDB(experimentRecord.dataPoints);

        const calcInput: CalculationInput = {
          batchId,
          dataPoints: normalizedPoints,
          rotorSpeed,
          thrust,
          rotorRadius: 0.28,
          bladeCount: 2,
          chord: 0.025,
          azimuth: 0,
          elevation: 0,
          config: thresholdConfig,
        };

        const { chain, result } = performFullCalculation(calcInput);

        return {
          success: true,
          message: '重跑完成',
          oldResult,
          newResult: result,
          newChain: chain,
        };
      } catch (error) {
        setCalculating(false);
        return {
          success: false,
          message: `重跑失败: ${error instanceof Error ? error.message : '未知错误'}`,
        };
      }
    },
    [batches, thresholdConfig, setCalculating]
  );

  const applyRerunResult = useCallback(
    (batchId: string, newResult: NoisePredictionResult, newChain: CalculationNode[]) => {
      const batch = batches.find((b) => b.id === batchId);
      if (!batch) return;

      const updatedBatch: Batch = {
        ...batch,
        calculationChain: newChain,
        result: newResult,
        updatedAt: Date.now(),
      };

      updateBatch(updatedBatch);
      setCalculating(false);
    },
    [batches, updateBatch, setCalculating]
  );

  return {
    currentBatch,
    runCalculation,
    rerunCalculation,
    applyRerunResult,
  };
};
