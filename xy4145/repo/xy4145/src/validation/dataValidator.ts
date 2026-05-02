import { Borehole, Layer, ValidationIssue } from '../types';

export function validateBoreholes(boreholes: Borehole[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  boreholes.forEach(borehole => {
    issues.push(...validateDepthContinuity(borehole));
    issues.push(...validateLayerOrder(borehole));
    issues.push(...validateSampleGaps(borehole));
  });

  return issues;
}

function validateDepthContinuity(borehole: Borehole): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const layers = borehole.layers;

  if (layers.length === 0) return issues;

  let prevBottom = layers[0].bottomDepth;

  for (let i = 1; i < layers.length; i++) {
    const layer = layers[i];
    const gap = layer.topDepth - prevBottom;

    if (Math.abs(gap) > 0.01) {
      if (gap > 0) {
        issues.push({
          type: 'gap',
          severity: 'warning',
          boreholeId: borehole.id,
          layerIndex: layer.layerIndex,
          message: `深度断档: 层 ${layer.layerIndex} 顶部 (${layer.topDepth.toFixed(2)}m) 与前一层底部 (${prevBottom.toFixed(2)}m) 之间存在 ${gap.toFixed(2)}m 断档`,
          details: {
            previousBottom: prevBottom,
            currentTop: layer.topDepth,
            gapSize: gap,
          },
        });
      } else {
        issues.push({
          type: 'depth_discontinuity',
          severity: 'error',
          boreholeId: borehole.id,
          layerIndex: layer.layerIndex,
          message: `深度重叠: 层 ${layer.layerIndex} 与前一层存在 ${Math.abs(gap).toFixed(2)}m 重叠`,
          details: {
            previousBottom: prevBottom,
            currentTop: layer.topDepth,
            overlapSize: Math.abs(gap),
          },
        });
      }
    }

    prevBottom = Math.max(prevBottom, layer.bottomDepth);
  }

  return issues;
}

function validateLayerOrder(borehole: Borehole): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const layers = borehole.layers;

  if (layers.length < 2) return issues;

  for (let i = 0; i < layers.length - 1; i++) {
    const currentLayer = layers[i];
    const nextLayer = layers[i + 1];

    if (currentLayer.thickness <= 0) {
      issues.push({
        type: 'inversion',
        severity: 'error',
        boreholeId: borehole.id,
        layerIndex: currentLayer.layerIndex,
        message: `层 ${currentLayer.layerIndex} 厚度异常: 厚度为 ${currentLayer.thickness.toFixed(2)}m (可能层序倒置或数据错误)`,
        details: {
          topDepth: currentLayer.topDepth,
          bottomDepth: currentLayer.bottomDepth,
          thickness: currentLayer.thickness,
        },
      });
    }

    if (nextLayer.topDepth < currentLayer.topDepth) {
      issues.push({
        type: 'inversion',
        severity: 'error',
        boreholeId: borehole.id,
        layerIndex: nextLayer.layerIndex,
        message: `层序倒置: 层 ${nextLayer.layerIndex} (顶部 ${nextLayer.topDepth.toFixed(2)}m) 位于层 ${currentLayer.layerIndex} (顶部 ${currentLayer.topDepth.toFixed(2)}m) 之上`,
        details: {
          layer1Index: currentLayer.layerIndex,
          layer1Top: currentLayer.topDepth,
          layer2Index: nextLayer.layerIndex,
          layer2Top: nextLayer.topDepth,
        },
      });
    }
  }

  return issues;
}

function validateSampleGaps(borehole: Borehole): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const layers = borehole.layers;

  const thickLayersWithoutSample = layers.filter(
    layer => layer.thickness > 2.0 && !layer.hasSample
  );

  thickLayersWithoutSample.forEach(layer => {
    issues.push({
      type: 'missing_sample',
      severity: 'warning',
      boreholeId: borehole.id,
      layerIndex: layer.layerIndex,
      message: `采样缺口: 层 ${layer.layerIndex} (${layer.soilType}) 厚度 ${layer.thickness.toFixed(2)}m，建议采样`,
      details: {
        layerIndex: layer.layerIndex,
        soilType: layer.soilType,
        thickness: layer.thickness,
        threshold: 2.0,
      },
    });
  });

  const contaminatedLayers = layers.filter(layer => layer.isContaminated);
  contaminatedLayers.forEach(layer => {
    if (!layer.hasSample) {
      issues.push({
        type: 'missing_sample',
        severity: 'error',
        boreholeId: borehole.id,
        layerIndex: layer.layerIndex,
        message: `污染层无采样: 层 ${layer.layerIndex} (${layer.soilType}) 标记为污染但无采样记录`,
        details: {
          layerIndex: layer.layerIndex,
          soilType: layer.soilType,
          isContaminated: true,
          hasSample: false,
        },
      });
    }
  });

  return issues;
}

export function getIssueSummary(issues: ValidationIssue[]): {
  total: number;
  errors: number;
  warnings: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  let errors = 0;
  let warnings = 0;

  issues.forEach(issue => {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
    if (issue.severity === 'error') errors++;
    else warnings++;
  });

  return {
    total: issues.length,
    errors,
    warnings,
    byType,
  };
}
