import { KitchenLayout, SimulationResult, ComparisonResult } from '../types';
import { runSimulation } from './engine';
import * as _ from 'lodash';

export function compareLayouts(
  layout1: KitchenLayout,
  layout2: KitchenLayout,
): ComparisonResult {
  const differences: ComparisonResult['differences'] = [];

  const simpleFields = ['name', 'description', 'gridResolution'];
  for (const field of simpleFields) {
    const v1 = (layout1 as any)[field];
    const v2 = (layout2 as any)[field];
    if (!_.isEqual(v1, v2)) {
      differences.push({ field, value1: v1, value2: v2 });
    }
  }

  if (!_.isEqual(layout1.dimensions, layout2.dimensions)) {
    differences.push({
      field: 'dimensions',
      value1: layout1.dimensions,
      value2: layout2.dimensions,
    });
  }

  if (layout1.stoves.length !== layout2.stoves.length) {
    differences.push({
      field: 'stoves.length',
      value1: layout1.stoves.length,
      value2: layout2.stoves.length,
    });
  } else {
    for (let i = 0; i < layout1.stoves.length; i++) {
      const s1 = layout1.stoves[i];
      const s2 = layout2.stoves.find(s => s.id === s1.id);
      if (!s2) {
        differences.push({
          field: `stoves.${s1.id}`,
          value1: `灶位"${s1.name}"存在`,
          value2: '灶位不存在',
        });
      } else if (!_.isEqual(s1, s2)) {
        if (s1.fumeEmissionRate !== s2.fumeEmissionRate) {
          differences.push({
            field: `stoves.${s1.id}.fumeEmissionRate`,
            value1: s1.fumeEmissionRate,
            value2: s2.fumeEmissionRate,
          });
        }
        if (s1.enabled !== s2.enabled) {
          differences.push({
            field: `stoves.${s1.id}.enabled`,
            value1: s1.enabled,
            value2: s2.enabled,
          });
        }
      }
    }
  }

  if (layout1.exhaustVents.length !== layout2.exhaustVents.length) {
    differences.push({
      field: 'exhaustVents.length',
      value1: layout1.exhaustVents.length,
      value2: layout2.exhaustVents.length,
    });
  } else {
    for (let i = 0; i < layout1.exhaustVents.length; i++) {
      const v1 = layout1.exhaustVents[i];
      const v2 = layout2.exhaustVents.find(v => v.id === v1.id);
      if (!v2) {
        differences.push({
          field: `exhaustVents.${v1.id}`,
          value1: `排烟口"${v1.name}"存在`,
          value2: '排烟口不存在',
        });
      } else if (v1.airflowRate !== v2.airflowRate) {
        differences.push({
          field: `exhaustVents.${v1.id}.airflowRate`,
          value1: v1.airflowRate,
          value2: v2.airflowRate,
        });
      } else if (v1.captureEfficiency !== v2.captureEfficiency) {
        differences.push({
          field: `exhaustVents.${v1.id}.captureEfficiency`,
          value1: v1.captureEfficiency,
          value2: v2.captureEfficiency,
        });
      }
    }
  }

  if (!_.isEqual(layout1.version, layout2.version)) {
    differences.push({
      field: 'version',
      value1: layout1.version,
      value2: layout2.version,
    });
  }

  const result1 = runSimulation(layout1);
  const result2 = runSimulation(layout2);

  const statDifferences = calculateStatDifferences(result1, result2);

  return {
    layout1Id: layout1.id,
    layout2Id: layout2.id,
    layout1Name: layout1.name,
    layout2Name: layout2.name,
    differences,
    statDifferences,
  };
}

function calculateStatDifferences(
  result1: SimulationResult,
  result2: SimulationResult,
): ComparisonResult['statDifferences'] {
  const statFields = [
    { key: 'maxConcentration', label: '最大浓度(mg/m³)' },
    { key: 'avgConcentration', label: '平均浓度(mg/m³)' },
    { key: 'exhaustEfficiency', label: '排风效率(%)' },
    { key: 'totalAirflow', label: '总风量(m³/h)' },
  ];

  return statFields.map(field => {
    const v1 = (result1.overallStats as any)[field.key];
    const v2 = (result2.overallStats as any)[field.key];
    const change = v2 - v1;
    const changePercent = v1 > 0 ? (change / v1) * 100 : 0;

    return {
      metric: field.label,
      value1: v1,
      value2: v2,
      change,
      changePercent,
    };
  });
}

export function compareSimulationResults(
  result1: SimulationResult,
  result2: SimulationResult,
): ComparisonResult['statDifferences'] {
  return calculateStatDifferences(result1, result2);
}
