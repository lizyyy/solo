import type { MoldMaterial, SimulationParams, TemperaturePoint, SimulationResult } from '../types';
import { CAKE_BATTER_PROPERTIES, TARGET_CENTER_TEMPERATURE } from '../data/materials';

interface HeatTransferResult {
  temperatureCurve: TemperaturePoint[];
  maxTemperature: number;
  timeToTargetTemp: number | null;
}

export function calculateHeatTransfer(
  params: SimulationParams,
  material: MoldMaterial,
  onProgress?: (progress: number) => void
): Promise<HeatTransferResult> {
  return new Promise((resolve, reject) => {
    try {
      const { ovenTemperature, initialTemperature, cakeDimensions, timeStep, totalTime } = params;
      
      const radius = cakeDimensions.diameter / 2 / 100;
      const height = cakeDimensions.height / 100;
      
      const numRadialNodes = 20;
      const numHeightNodes = 15;
      const dr = radius / numRadialNodes;
      const dh = height / numHeightNodes;
      
      let temperatureGrid: number[][] = [];
      for (let i = 0; i < numRadialNodes; i++) {
        temperatureGrid[i] = [];
        for (let j = 0; j < numHeightNodes; j++) {
          temperatureGrid[i][j] = initialTemperature;
        }
      }
      
      const cakeK = CAKE_BATTER_PROPERTIES.thermalConductivity;
      const cakeRho = CAKE_BATTER_PROPERTIES.density;
      const cakeCp = CAKE_BATTER_PROPERTIES.specificHeat;
      const cakeAlpha = cakeK / (cakeRho * cakeCp);
      
      const moldK = material.thermalConductivity;
      const moldThickness = material.thickness;
      
      const h = 100;
      
      const dt = timeStep;
      const numSteps = Math.ceil(totalTime / dt);
      
      const temperatureCurve: TemperaturePoint[] = [];
      let maxTemperature = initialTemperature;
      let timeToTargetTemp: number | null = null;
      
      for (let step = 0; step < numSteps; step++) {
        const currentTime = step * dt;
        const newGrid: number[][] = temperatureGrid.map(row => [...row]);
        
        for (let i = 0; i < numRadialNodes; i++) {
          for (let j = 0; j < numHeightNodes; j++) {
            const r = i * dr;
            
            let dTdr2 = 0;
            let dTdr = 0;
            
            if (i === 0) {
              dTdr2 = 2 * (temperatureGrid[1][j] - temperatureGrid[0][j]) / (dr * dr);
              dTdr = 0;
            } else if (i === numRadialNodes - 1) {
              const boundaryTemp = calculateBoundaryTemperature(
                temperatureGrid[i][j],
                ovenTemperature,
                moldK,
                moldThickness,
                h,
                dr
              );
              dTdr2 = (temperatureGrid[i-1][j] - 2 * temperatureGrid[i][j] + boundaryTemp) / (dr * dr);
              dTdr = (boundaryTemp - temperatureGrid[i-1][j]) / (2 * dr);
            } else {
              dTdr2 = (temperatureGrid[i+1][j] - 2 * temperatureGrid[i][j] + temperatureGrid[i-1][j]) / (dr * dr);
              dTdr = (temperatureGrid[i+1][j] - temperatureGrid[i-1][j]) / (2 * dr);
            }
            
            let dTdh2 = 0;
            
            if (j === 0 || j === numHeightNodes - 1) {
              const adjIndex = j === 0 ? 1 : j - 1;
              const boundaryTemp = calculateBoundaryTemperature(
                temperatureGrid[i][j],
                ovenTemperature,
                moldK,
                moldThickness,
                h,
                dh
              );
              dTdh2 = (temperatureGrid[i][adjIndex] - 2 * temperatureGrid[i][j] + boundaryTemp) / (dh * dh);
            } else {
              dTdh2 = (temperatureGrid[i][j+1] - 2 * temperatureGrid[i][j] + temperatureGrid[i][j-1]) / (dh * dh);
            }
            
            const laplacian = dTdr2 + (r > 0 ? dTdr / r : 0) + dTdh2;
            newGrid[i][j] = temperatureGrid[i][j] + cakeAlpha * dt * laplacian;
            
            newGrid[i][j] = Math.min(newGrid[i][j], ovenTemperature);
          }
        }
        
        temperatureGrid = newGrid;
        
        const centerIndex = Math.floor(numRadialNodes / 2);
        const centerHeightIndex = Math.floor(numHeightNodes / 2);
        const centerTemp = temperatureGrid[centerIndex][centerHeightIndex];
        
        temperatureCurve.push({
          time: currentTime,
          temperature: centerTemp
        });
        
        if (centerTemp > maxTemperature) {
          maxTemperature = centerTemp;
        }
        
        if (timeToTargetTemp === null && centerTemp >= TARGET_CENTER_TEMPERATURE) {
          timeToTargetTemp = currentTime;
        }
        
        if (onProgress && step % Math.ceil(numSteps / 100) === 0) {
          onProgress(Math.min((step / numSteps) * 100, 100));
        }
      }
      
      resolve({
        temperatureCurve,
        maxTemperature,
        timeToTargetTemp
      });
    } catch (error) {
      reject(error);
    }
  });
}

function calculateBoundaryTemperature(
  innerTemp: number,
  ovenTemp: number,
  moldK: number,
  moldThickness: number,
  h: number,
  gridStep: number
): number {
  const moldResistance = moldThickness / moldK;
  const convResistance = 1 / h;
  const totalResistance = moldResistance + convResistance;
  
  const heatFlux = (ovenTemp - innerTemp) / (totalResistance + gridStep / moldK);
  
  return innerTemp + heatFlux * gridStep / moldK;
}

export async function runSimulation(
  params: SimulationParams,
  material: MoldMaterial,
  onProgress?: (progress: number) => void
): Promise<SimulationResult> {
  const startTime = Date.now();
  
  const result = await calculateHeatTransfer(params, material, onProgress);
  
  const simulationResult: SimulationResult = {
    id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    params,
    material,
    temperatureCurve: result.temperatureCurve,
    maxTemperature: result.maxTemperature,
    timeToTargetTemp: result.timeToTargetTemp,
    createdAt: startTime,
    status: 'completed'
  };
  
  return simulationResult;
}

export function generateCurveReport(simulation: SimulationResult): string {
  const { params, material, temperatureCurve, maxTemperature, timeToTargetTemp } = simulation;
  const lastPoint = temperatureCurve[temperatureCurve.length - 1];
  
  const report = `
蛋糕中心温度曲线报告
====================

模拟参数:
--------
模具材料: ${material.name}
  导热系数: ${material.thermalConductivity} W/(m·K)
  比热容: ${material.specificHeat} J/(kg·K)
  密度: ${material.density} kg/m³
  厚度: ${material.thickness * 1000} mm
  数据来源: ${material.source}

烤箱温度: ${params.ovenTemperature} °C
初始温度: ${params.initialTemperature} °C
蛋糕尺寸: ${params.cakeDimensions.diameter}cm (直径) × ${params.cakeDimensions.height}cm (高度)
时间步长: ${params.timeStep} 秒
总模拟时间: ${params.totalTime} 秒

模拟结果:
--------
最高中心温度: ${maxTemperature.toFixed(2)} °C
达到目标温度(${TARGET_CENTER_TEMPERATURE}°C)时间: ${timeToTargetTemp ? `${timeToTargetTemp.toFixed(1)} 秒` : '未达到'}
最终中心温度: ${lastPoint.temperature.toFixed(2)} °C
数据点数: ${temperatureCurve.length}

温度曲线数据:
------------
${temperatureCurve.map(p => `  t=${p.time.toFixed(0)}s: ${p.temperature.toFixed(2)}°C`).join('\n')}
  `.trim();
  
  return report;
}
