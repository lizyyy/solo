import type { DataPoint, PhysicsParams, Simulation, FittedCurve } from '@/types/simulation';

export function generateEnergyConservationExplanation(dataPoints: DataPoint[], _params: PhysicsParams): string {
  if (dataPoints.length < 2) return '数据不足，无法生成能量守恒分析。';
  const initialPE = dataPoints[0].potentialEnergy;
  const finalPE = dataPoints[dataPoints.length - 1].potentialEnergy;
  const finalKE = dataPoints[dataPoints.length - 1].kineticEnergy;
  const totalFrictionLoss = dataPoints[dataPoints.length - 1].frictionLoss;
  const totalAirDragLoss = dataPoints[dataPoints.length - 1].airDragLoss;
  const totalLoss = totalFrictionLoss + totalAirDragLoss;
  const energyBalance = initialPE - (finalPE + finalKE + totalLoss);
  const balancePercent = initialPE > 0 ? Math.abs(energyBalance / initialPE) * 100 : 0;

  let explanation = `## 能量守恒分析\n\n`;
  explanation += `初始重力势能: **${initialPE.toFixed(2)} J**\n\n`;
  explanation += `末态重力势能: **${finalPE.toFixed(2)} J**\n\n`;
  explanation += `末态动能: **${finalKE.toFixed(2)} J**\n\n`;
  explanation += `摩擦损耗: **${totalFrictionLoss.toFixed(2)} J** (${(totalFrictionLoss / initialPE * 100).toFixed(1)}%)\n\n`;
  explanation += `空气阻力损耗: **${totalAirDragLoss.toFixed(2)} J** (${(totalAirDragLoss / initialPE * 100).toFixed(1)}%)\n\n`;
  explanation += `能量平衡误差: **${energyBalance.toFixed(4)} J** (${balancePercent.toFixed(3)}%)\n\n`;

  if (balancePercent < 1) {
    explanation += `✅ 能量守恒验证通过！误差在1%以内，说明系统满足能量守恒定律：E_势 + E_动 + E_摩擦损耗 + E_空气阻力损耗 = 常量`;
  } else {
    explanation += `⚠️ 能量平衡误差较大(${balancePercent.toFixed(1)}%)，请检查数据或参数设置。`;
  }
  return explanation;
}

export function generateFrictionLossExplanation(dataPoints: DataPoint[], params: PhysicsParams): string {
  if (dataPoints.length < 2) return '数据不足，无法生成摩擦损耗分析。';
  const totalFriction = dataPoints[dataPoints.length - 1].frictionLoss;
  const totalAirDrag = dataPoints[dataPoints.length - 1].airDragLoss;
  const initialPE = dataPoints[0].potentialEnergy;
  const frictionPercent = initialPE > 0 ? (totalFriction / initialPE * 100).toFixed(1) : '0';
  const airDragPercent = initialPE > 0 ? (totalAirDrag / initialPE * 100).toFixed(1) : '0';

  let explanation = `## 摩擦与空气阻力损耗分析\n\n`;
  explanation += `### 摩擦力损耗\n`;
  explanation += `- 摩擦系数 μ = **${params.frictionCoeff}**\n`;
  explanation += `- 法向力 N = mg·cosθ = **${dataPoints[0].normalForce?.toFixed(2)} N**\n`;
  explanation += `- 摩擦力 f = μN = **${dataPoints[0].frictionForce?.toFixed(2)} N**\n`;
  explanation += `- 总摩擦损耗 = **${totalFriction.toFixed(2)} J** (占初始势能 **${frictionPercent}%**)\n\n`;

  explanation += `### 空气阻力损耗\n`;
  explanation += `- 空气阻力系数 Cd = **${params.airDragCoeff}**\n`;
  explanation += `- 空气密度 ρ = **${params.airDensity || 1.225} kg/m³**\n`;
  explanation += `- 迎风面积 A = **${params.frontalArea || 0.5} m²**\n`;
  explanation += `- 总空气阻力损耗 = **${totalAirDrag.toFixed(2)} J** (占初始势能 **${airDragPercent}%**)\n\n`;

  explanation += `### 对比分析\n`;
  if (totalFriction > totalAirDrag) {
    explanation += `在本实验条件下，摩擦损耗是主要能量损失来源，是空气阻力损耗的 **${(totalFriction / Math.max(totalAirDrag, 0.01)).toFixed(1)}** 倍。`;
  } else {
    explanation += `在本实验条件下，空气阻力损耗超过了摩擦损耗，这通常发生在高速运动时。`;
  }
  return explanation;
}

export function generateVelocityFittingExplanation(dataPoints: DataPoint[], fittedCurve?: FittedCurve): string {
  if (dataPoints.length < 2) return '数据不足，无法生成速度拟合分析。';
  const maxVelocity = Math.max(...dataPoints.map(d => d.velocity));
  const maxVelTime = dataPoints.find(d => d.velocity === maxVelocity)?.timestamp || 0;
  const avgAccel = dataPoints.length > 1 ? (dataPoints[dataPoints.length - 1].velocity - dataPoints[0].velocity) / (dataPoints[dataPoints.length - 1].timestamp - dataPoints[0].timestamp) : 0;

  let explanation = `## 速度拟合分析\n\n`;
  explanation += `- 最大速度: **${maxVelocity.toFixed(2)} m/s** (时刻 ${maxVelTime.toFixed(2)}s)\n`;
  explanation += `- 平均加速度: **${avgAccel.toFixed(2)} m/s²**\n`;
  explanation += `- 初始速度: **0 m/s**\n`;
  explanation += `- 末速度: **${dataPoints[dataPoints.length - 1].velocity.toFixed(2)} m/s**\n\n`;

  if (fittedCurve) {
    explanation += `### 拟合结果\n`;
    explanation += `- 拟合方程: **${fittedCurve.equation}**\n`;
    explanation += `- R² = **${fittedCurve.rSquared.toFixed(4)}**\n\n`;
    if (fittedCurve.rSquared > 0.95) {
      explanation += `✅ 拟合优度很好(R² > 0.95)，速度随时间的变化规律与理论模型高度吻合。`;
    } else if (fittedCurve.rSquared > 0.8) {
      explanation += `⚠️ 拟合优度一般(R² > 0.8)，速度变化与理论模型有一定偏差，可能受到采样误差影响。`;
    } else {
      explanation += `❌ 拟合优度较差(R² < 0.8)，速度变化与理论模型偏差较大，建议检查数据质量。`;
    }
  }
  return explanation;
}

export function generateFullReport(simulation: Simulation): string {
  const energyExp = generateEnergyConservationExplanation(simulation.dataPoints, simulation.physicsParams);
  const frictionExp = generateFrictionLossExplanation(simulation.dataPoints, simulation.physicsParams);
  const velocityExp = generateVelocityFittingExplanation(simulation.dataPoints);
  const unconfirmedCount = simulation.anomalies.filter(a => !a.isConfirmed).length;

  let report = `# 滑板坡道能量分析报告\n\n`;
  report += `**模拟名称**: ${simulation.name}\n`;
  report += `**创建时间**: ${simulation.createdAt}\n`;
  report += `**坡道角度**: ${simulation.physicsParams.rampAngle}°\n`;
  report += `**滑板质量**: ${simulation.physicsParams.skateboardMass} kg\n\n`;
  report += `---\n\n`;
  report += `${energyExp}\n\n---\n\n${frictionExp}\n\n---\n\n${velocityExp}\n\n---\n\n`;
  if (unconfirmedCount > 0) {
    report += `## ⚠️ 待确认异常\n\n共有 **${unconfirmedCount}** 项异常待确认。\n\n`;
    simulation.anomalies.filter(a => !a.isConfirmed).forEach((a, i) => {
      report += `${i + 1}. [${a.severity.toUpperCase()}] ${a.description}\n`;
    });
  } else {
    report += `## ✅ 无待确认异常\n\n所有异常项已确认处理。`;
  }
  return report;
}
