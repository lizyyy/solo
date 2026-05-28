import type { PrintEstimation, PrintParams, Material } from '@/types';
import { generateUUID } from './math';

export interface PrintEstimationConfig {
  energyCostPerKwh: number;
  machineHourlyRate: number;
  setupTimeMinutes: number;
  coolingMultiplier: number;
}

export const defaultPrintConfig: PrintEstimationConfig = {
  energyCostPerKwh: 0.8,
  machineHourlyRate: 10,
  setupTimeMinutes: 15,
  coolingMultiplier: 1.2
};

export class PrintTimeEstimator {
  private config: PrintEstimationConfig;

  constructor(config: Partial<PrintEstimationConfig> = {}) {
    this.config = { ...defaultPrintConfig, ...config };
  }

  estimate(
    volumeCm3: number,
    surfaceAreaCm2: number,
    printParams: PrintParams,
    material: Material,
    taskId: string
  ): PrintEstimation {
    const effectivePrintSpeed = Math.min(printParams.printSpeed, material.printSpeed);

    const layerCount = Math.ceil(
      this.calculateModelHeight(surfaceAreaCm2) / printParams.layerHeight
    );

    const perimeterLength = this.estimatePerimeterLength(surfaceAreaCm2, volumeCm3);

    const totalExtrusionDistance =
      perimeterLength * (printParams.wallThickness / printParams.nozzleDiameter) * layerCount;

    const infillVolume = volumeCm3 * (printParams.infillRate / 100);
    const infillDistance = infillVolume / (printParams.layerHeight * printParams.nozzleDiameter * 0.001);

    const totalDistanceMm = totalExtrusionDistance + infillDistance;

    const travelDistanceMm = totalDistanceMm * 0.3;
    const travelSpeed = effectivePrintSpeed * 2;

    const extrusionTimeHours = totalDistanceMm / effectivePrintSpeed / 3600;
    const travelTimeHours = travelDistanceMm / travelSpeed / 3600;

    const layerChangeTimeHours = layerCount * 2 / 3600;

    const printTimeHours = (extrusionTimeHours + travelTimeHours + layerChangeTimeHours) * this.config.coolingMultiplier;

    const materialWeight = volumeCm3 * material.density * (1 + printParams.infillRate / 200);

    const materialCost = materialWeight * material.costPerGram;

    const energyConsumption = printTimeHours * 0.5;
    const energyCost = energyConsumption * this.config.energyCostPerKwh;

    const machineCost = printTimeHours * this.config.machineHourlyRate;

    const totalCost = materialCost + energyCost + machineCost;

    return {
      id: generateUUID(),
      taskId,
      printTimeHours: Math.round(printTimeHours * 100) / 100,
      materialWeight: Math.round(materialWeight * 100) / 100,
      materialCost: Math.round(materialCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      energyConsumption: Math.round(energyConsumption * 100) / 100
    };
  }

  private calculateModelHeight(surfaceAreaCm2: number): number {
    return Math.sqrt(surfaceAreaCm2 / 6) * 10;
  }

  private estimatePerimeterLength(surfaceAreaCm2: number, volumeCm3: number): number {
    const surfaceAreaMm2 = surfaceAreaCm2 * 100;
    const volumeMm3 = volumeCm3 * 1000;

    const complexityFactor = surfaceAreaMm2 / Math.pow(volumeMm3, 2/3);

    const basePerimeter = Math.sqrt(surfaceAreaMm2) * 4;

    return basePerimeter * (1 + complexityFactor * 0.5);
  }

  estimateLayerTime(
    layerAreaMm2: number,
    printParams: PrintParams,
    material: Material
  ): number {
    const effectivePrintSpeed = Math.min(printParams.printSpeed, material.printSpeed);

    const perimeterLength = Math.sqrt(layerAreaMm2) * 4;
    const wallLines = Math.ceil(printParams.wallThickness / printParams.nozzleDiameter);

    const infillArea = layerAreaMm2 * (printParams.infillRate / 100);
    const infillDistance = infillArea / printParams.nozzleDiameter;

    const totalDistance = perimeterLength * wallLines + infillDistance;

    return totalDistance / effectivePrintSpeed;
  }

  getBreakdown(estimation: PrintEstimation): {
    category: string;
    value: number;
    percentage: number;
    unit: string;
  }[] {
    const breakdown = [
      {
        category: '材料成本',
        value: estimation.materialCost,
        percentage: (estimation.materialCost / estimation.totalCost) * 100,
        unit: '元'
      },
      {
        category: '能耗成本',
        value: estimation.energyConsumption * this.config.energyCostPerKwh,
        percentage: (estimation.energyConsumption * this.config.energyCostPerKwh / estimation.totalCost) * 100,
        unit: '元'
      },
      {
        category: '设备折旧',
        value: estimation.totalCost - estimation.materialCost - estimation.energyConsumption * this.config.energyCostPerKwh,
        percentage: ((estimation.totalCost - estimation.materialCost - estimation.energyConsumption * this.config.energyCostPerKwh) / estimation.totalCost) * 100,
        unit: '元'
      }
    ];

    return breakdown.map(item => ({
      ...item,
      percentage: Math.round(item.percentage * 10) / 10,
      value: Math.round(item.value * 100) / 100
    }));
  }

  compareEstimations(estimations: PrintEstimation[]): {
    fastest: PrintEstimation;
    cheapest: PrintEstimation;
    mostAccurate?: PrintEstimation;
  } {
    if (estimations.length === 0) {
      throw new Error('至少需要一个估算结果进行对比');
    }

    const sortedByTime = [...estimations].sort((a, b) => a.printTimeHours - b.printTimeHours);
    const sortedByCost = [...estimations].sort((a, b) => a.materialCost - b.materialCost);

    return {
      fastest: sortedByTime[0],
      cheapest: sortedByCost[0]
    };
  }
}

export function generatePrintEstimationReport(
  estimation: PrintEstimation,
  material: Material,
  printParams: PrintParams
): string {
  const lines: string[] = [];
  lines.push('=== 3D打印估算报告 ===');
  lines.push('');
  lines.push(`材料: ${material.name} (${material.code})`);
  lines.push(`类型: ${material.type}`);
  lines.push('');
  lines.push('--- 打印参数 ---');
  lines.push(`层厚: ${printParams.layerHeight} mm`);
  lines.push(`填充率: ${printParams.infillRate}%`);
  lines.push(`打印速度: ${printParams.printSpeed} mm/s`);
  lines.push(`壁厚: ${printParams.wallThickness} mm`);
  lines.push(`喷嘴直径: ${printParams.nozzleDiameter} mm`);
  lines.push('');
  lines.push('--- 估算结果 ---');
  lines.push(`打印时间: ${(estimation.printTimeHours * 60).toFixed(0)} 分钟 (${estimation.printTimeHours.toFixed(2)} 小时)`);
  lines.push(`材料用量: ${estimation.materialWeight.toFixed(2)} g`);
  lines.push(`材料成本: ¥${estimation.materialCost.toFixed(2)}`);
  lines.push(`能耗: ${estimation.energyConsumption.toFixed(2)} kWh`);
  lines.push(`总成本: ¥${estimation.totalCost.toFixed(2)}`);

  return lines.join('\n');
}
