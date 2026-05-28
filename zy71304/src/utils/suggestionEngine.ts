import type { PrintBatch, StressResult, Suggestion, IssueType } from '../types';
import { getMaterialById } from '../data/materials';
import { normalizeToMm } from './unitConverter';

const SUGGESTION_TYPE_LABELS: Record<Suggestion['type'], string> = {
  bed_temp: '床温调整',
  cooling: '冷却控制',
  material: '材料选择',
  dimension: '尺寸补偿',
  environment: '环境控制',
};

export const generateSuggestions = (
  batch: PrintBatch,
  stressResult: StressResult,
): Suggestion[] => {
  const suggestions: Suggestion[] = [];
  const material = getMaterialById(batch.materialId);

  if (!material) {
    return suggestions;
  }

  const dimensions = normalizeToMm(
    batch.modelWidth,
    batch.widthUnit,
    batch.modelHeight,
    batch.heightUnit,
    batch.modelDepth,
    batch.depthUnit,
  );

  const maxDimension = Math.max(dimensions.width, dimensions.height, dimensions.depth);

  if (
    batch.bedTemp < material.glassTransitionTemp * 0.6 &&
    stressResult.riskLevel !== 'low'
  ) {
    const recommendedBedTemp = Math.round(
      Math.min(material.recommendedBedTemp, material.glassTransitionTemp * 0.9),
    );
    const improvement = Math.min(30, (recommendedBedTemp - batch.bedTemp) * 0.8);

    suggestions.push({
      id: `sug-bed-${Date.now()}`,
      type: 'bed_temp',
      title: '提高床温以减少层间温差',
      description: `当前床温低于材料玻璃化转变温度的60%，建议提高床温至接近玻璃化转变温度，可减少底层材料的冷却速度和收缩应力。`,
      parameter: '床温',
      currentValue: `${batch.bedTemp}°C`,
      recommendedValue: `${recommendedBedTemp}°C`,
      expectedImprovement: Number(improvement.toFixed(1)),
    });
  }

  if (batch.coolingFanSpeed > 60 && maxDimension > 150) {
    const recommendedFanSpeed =
      material.id === 'pla' ? 60 : material.id === 'abs' ? 30 : 40;
    const improvement = Math.min(
      25,
      (batch.coolingFanSpeed - recommendedFanSpeed) * 0.4,
    );

    suggestions.push({
      id: `sug-cool-${Date.now()}`,
      type: 'cooling',
      title: '降低冷却风扇转速',
      description: `对于大件打印，过快的冷却速度会导致外层材料提前固化收缩，与内层未冷却材料产生应力差。建议降低风扇转速以延缓冷却。`,
      parameter: '冷却风扇转速',
      currentValue: `${batch.coolingFanSpeed}%`,
      recommendedValue: `${recommendedFanSpeed}%`,
      expectedImprovement: Number(improvement.toFixed(1)),
    });
  }

  if (stressResult.shrinkageRate > 1.5 && maxDimension > 200) {
    const shrinkageCompensation = Math.round(stressResult.shrinkageRate * 1.2);
    suggestions.push({
      id: `sug-dim-${Date.now()}`,
      type: 'dimension',
      title: '尺寸预补偿',
      description: `材料收缩率较高，建议在切片软件中将模型尺寸放大 ${shrinkageCompensation}% 进行预补偿，抵消打印过程中的收缩量。`,
      parameter: '模型缩放',
      currentValue: '100%',
      recommendedValue: `${(100 + shrinkageCompensation).toFixed(1)}%`,
      expectedImprovement: Number((shrinkageCompensation * 2).toFixed(1)),
    });
  }

  if (stressResult.temperatureDiff > 200) {
    const recommendedAmbient = 28;
    suggestions.push({
      id: `sug-env-${Date.now()}`,
      type: 'environment',
      title: '提高环境温度',
      description: `喷嘴与环境温差过大（${stressResult.temperatureDiff.toFixed(0)}°C），建议使用封闭机箱或加热器提高环境温度，减少整体温差。`,
      parameter: '环境温度',
      currentValue: `${batch.ambientTemp}°C`,
      recommendedValue: `${recommendedAmbient}°C`,
      expectedImprovement: Number(
        ((batch.ambientTemp - recommendedAmbient) * -0.5).toFixed(1),
      ),
    });
  }

  if (
    stressResult.riskLevel === 'critical' &&
    (material.id === 'abs' || material.id === 'nylon')
  ) {
    suggestions.push({
      id: `sug-mat-${Date.now()}`,
      type: 'material',
      title: '考虑更换低收缩率材料',
      description: `${material.name} 的热膨胀系数较高，对于超大件打印可考虑换用 PETG 或 PLA 等低收缩率材料，或添加填料改性。`,
      parameter: '材料类型',
      currentValue: material.name,
      recommendedValue: 'PETG/PLA',
      expectedImprovement: 40,
    });
  }

  if (batch.nozzleTemp < material.recommendedNozzleTemp - 10) {
    suggestions.push({
      id: `sug-noz-${Date.now()}`,
      type: 'bed_temp',
      title: '适当提高喷嘴温度',
      description: `喷嘴温度偏低，可能导致材料流动性不足和层间粘结力下降。建议提高至材料推荐温度范围。`,
      parameter: '喷嘴温度',
      currentValue: `${batch.nozzleTemp}°C`,
      recommendedValue: `${material.recommendedNozzleTemp}°C`,
      expectedImprovement: 15,
    });
  }

  return suggestions.sort((a, b) => b.expectedImprovement - a.expectedImprovement);
};

export const getIssueTypeLabel = (type: IssueType): string => {
  const labels: Record<IssueType, string> = {
    temp_diff_sign: '温差符号错误',
    material_missing: '材料参数缺失',
    unit_mixed: '单位混用',
    high_stress: '应力集中',
    excessive_shrinkage: '收缩量过大',
    cooling_issue: '冷却异常',
    bed_temp_issue: '床温异常',
    other: '其他问题',
  };
  return labels[type] || type;
};

export const getSuggestionTypeColor = (type: Suggestion['type']): string => {
  const colors: Record<Suggestion['type'], string> = {
    bed_temp: '#FF7D00',
    cooling: '#165DFF',
    material: '#722ED1',
    dimension: '#00B42A',
    environment: '#F53F3F',
  };
  return colors[type];
};

export const getSuggestionTypeLabel = (type: Suggestion['type']): string => {
  return SUGGESTION_TYPE_LABELS[type];
};
