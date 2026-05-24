import { PlantParams, RobotPath, ValidationResult } from '../types';

const MIN_ROBOT_PATH_WIDTH = 60;

export function validateConfiguration(
  plants: PlantParams,
  robotPath: RobotPath
): ValidationResult {
  const warnings: string[] = [];
  
  const actualPathWidth = robotPath.enabled 
    ? plants.rowSpacing * 2 - plants.canopyDiameter
    : 0;
  
  const pathWidthOk = !robotPath.enabled || actualPathWidth >= MIN_ROBOT_PATH_WIDTH;
  
  if (robotPath.enabled && actualPathWidth < MIN_ROBOT_PATH_WIDTH) {
    warnings.push(`机器人通道宽度不足：实际 ${actualPathWidth.toFixed(0)}cm，最小需要 ${MIN_ROBOT_PATH_WIDTH}cm`);
  }
  
  const canopyOverlap = plants.rowSpacing < plants.canopyDiameter || 
                        plants.plantSpacing < plants.canopyDiameter;
  
  if (plants.rowSpacing < plants.canopyDiameter) {
    warnings.push(`行距小于冠层直径，可能存在行间遮挡`);
  }
  if (plants.plantSpacing < plants.canopyDiameter) {
    warnings.push(`株距小于冠层直径，可能存在株间遮挡`);
  }
  
  const totalArea = (plants.rowsCount * plants.rowSpacing / 100) * 
                    (plants.plantsPerRow * plants.plantSpacing / 100);
  const canopyArea = plants.rowsCount * plants.plantsPerRow * 
                     Math.PI * Math.pow(plants.canopyDiameter / 200, 2);
  const lightCoverage = Math.min(100, Math.max(0, (1 - canopyArea / totalArea * 0.5) * 100));
  
  if (lightCoverage < 50) {
    warnings.push(`光照覆盖率较低，建议增加间距`);
  }
  
  return {
    pathWidthOk,
    minPathWidth: MIN_ROBOT_PATH_WIDTH,
    actualPathWidth,
    canopyOverlap,
    lightCoverage,
    warnings,
  };
}
