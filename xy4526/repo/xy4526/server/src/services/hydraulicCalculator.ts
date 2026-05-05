import { v4 as uuidv4 } from 'uuid';
import {
  Pipe,
  Valve,
  PumpCurve,
  PumpCurvePoint,
  TemperatureData,
  Node,
  CalculationResult,
  CalculationStep,
  AbnormalData,
  AdjustmentSuggestion,
} from '../models/types.js';

export class HydraulicCalculator {
  private steps: CalculationStep[] = [];
  private stepCounter: number = 0;

  calculate(
    nodes: Node[],
    pipes: Pipe[],
    valves: Valve[],
    pumpCurve: PumpCurve,
    temperatureData: TemperatureData[],
    projectId: string
  ): CalculationResult {
    this.steps = [];
    this.stepCounter = 0;

    const totalFlowRate = this.estimateTotalFlowRate(temperatureData, nodes);
    const pipeResults = this.calculatePipeHydraulics(pipes, totalFlowRate, temperatureData);
    const valveResults = this.calculateValveHydraulics(valves, pipeResults, pipes);
    const systemPressureDrop = this.calculateTotalPressureDrop(pipeResults, valveResults);
    const operatingPoint = this.findOperatingPoint(pumpCurve, systemPressureDrop, totalFlowRate);
    const abnormalData = this.detectAbnormalData(pipes, valves, temperatureData, pipeResults, valveResults);
    const suggestions = this.generateAdjustmentSuggestions(valves, pipeResults, valveResults, abnormalData);

    return {
      id: uuidv4(),
      projectId,
      timestamp: new Date().toISOString(),
      totalFlowRate,
      systemPressureDrop,
      operatingPoint,
      pipeResults,
      valveResults,
      steps: [...this.steps],
      abnormalData,
      suggestions,
    };
  }

  private addStep(
    description: string,
    inputs: Record<string, number>,
    outputs: Record<string, number>,
    formula: string
  ): void {
    this.stepCounter++;
    this.steps.push({
      step: this.stepCounter,
      description,
      inputs: { ...inputs },
      outputs: { ...outputs },
      formula,
    });
  }

  private estimateTotalFlowRate(
    temperatureData: TemperatureData[],
    nodes: Node[]
  ): number {
    const cp = 4186;
    const rho = 998;

    let totalHeatLoad = 0;
    for (const temp of temperatureData) {
      const deltaT = temp.supplyTemp - temp.returnTemp;
      if (deltaT > 0) {
        const heatLoad = this.estimateHeatLoad(temp, nodes.find(n => n.id === temp.nodeId));
        totalHeatLoad += heatLoad;
      }
    }

    const avgDeltaT = temperatureData.length > 0
      ? temperatureData.reduce((sum, t) => sum + (t.supplyTemp - t.returnTemp), 0) / temperatureData.length
      : 15;

    const totalFlowRate = totalHeatLoad / (rho * cp * avgDeltaT) * 3600;

    this.addStep(
      '估算系统总流量',
      {
        totalHeatLoad_kW: totalHeatLoad / 1000,
        avgDeltaT_C: avgDeltaT,
        rho_kgm3: rho,
        cp_JkgC: cp,
      },
      { totalFlowRate_m3h: totalFlowRate },
      'Q = totalHeatLoad / (rho * cp * ΔT) * 3600'
    );

    return Math.max(totalFlowRate, 1);
  }

  private estimateHeatLoad(temp: TemperatureData, node?: Node): number {
    const estimatedArea = node?.type === 'building' ? 5000 : node?.type === 'unit' ? 1000 : 2000;
    const heatLoadPerArea = 50;
    return estimatedArea * heatLoadPerArea;
  }

  private calculatePipeHydraulics(
    pipes: Pipe[],
    totalFlowRate: number,
    temperatureData: TemperatureData[]
  ): CalculationResult['pipeResults'] {
    const results: CalculationResult['pipeResults'] = [];
    const nu = 0.000001004;

    for (const pipe of pipes) {
      const flowRate = this.distributeFlow(pipe, pipes, totalFlowRate);
      const diameter = pipe.diameter / 1000;
      const area = Math.PI * Math.pow(diameter / 2, 2);
      const velocity = flowRate / 3600 / area;
      const reynoldsNumber = velocity * diameter / nu;
      const frictionFactor = this.calculateFrictionFactor(reynoldsNumber, pipe.roughness, pipe.diameter);
      const pressureDrop = frictionFactor * (pipe.length / diameter) * (998 * Math.pow(velocity, 2) / 2) / 1000;

      results.push({
        pipeId: pipe.id,
        flowRate,
        velocity,
        pressureDrop,
        reynoldsNumber,
      });

      this.addStep(
        `计算管道 ${pipe.name} 水力参数`,
        {
          flowRate_m3h: flowRate,
          diameter_mm: pipe.diameter,
          length_m: pipe.length,
          roughness_mm: pipe.roughness,
        },
        {
          velocity_ms: velocity,
          reynoldsNumber,
          frictionFactor: frictionFactor,
          pressureDrop_kPa: pressureDrop,
        },
        'v = Q/(3600*A), Re = v*d/nu, λ = f(Re, ε/d), ΔP = λ*(L/d)*(ρv²/2)'
      );
    }

    return results;
  }

  private distributeFlow(
    pipe: Pipe,
    allPipes: Pipe[],
    totalFlowRate: number
  ): number {
    const parallelPipes = allPipes.filter(p => 
      p.fromNodeId === pipe.fromNodeId && p.id !== pipe.id
    );

    if (parallelPipes.length === 0) {
      return totalFlowRate / allPipes.filter(p => !p.parentId).length || totalFlowRate;
    }

    const allParallel = [pipe, ...parallelPipes];
    const totalResistance = allParallel.reduce((sum, p) => {
      const d = p.diameter / 1000;
      return sum + Math.pow(d, 5) / p.length;
    }, 0);

    const pipeResistance = Math.pow(pipe.diameter / 1000, 5) / pipe.length;
    return totalFlowRate * (pipeResistance / totalResistance);
  }

  private calculateFrictionFactor(
    reynoldsNumber: number,
    roughness: number,
    diameter: number
  ): number {
    const relativeRoughness = roughness / diameter;

    if (reynoldsNumber < 2300) {
      return 64 / reynoldsNumber;
    }

    let f = 0.02;
    for (let i = 0; i < 10; i++) {
      const left = 1 / Math.sqrt(f);
      const right = -2 * Math.log10(relativeRoughness / 3.7 + 2.51 / (reynoldsNumber * Math.sqrt(f)));
      const error = left - right;
      
      if (Math.abs(error) < 0.0001) break;
      
      const df = 0.0001;
      const f1 = 1 / Math.sqrt(f + df);
      const r1 = -2 * Math.log10(relativeRoughness / 3.7 + 2.51 / (reynoldsNumber * Math.sqrt(f + df)));
      const dError = (f1 - r1) - error;
      f = f - error * (df / dError);
    }

    return f;
  }

  private calculateValveHydraulics(
    valves: Valve[],
    pipeResults: CalculationResult['pipeResults'],
    pipes: Pipe[]
  ): CalculationResult['valveResults'] {
    const results: CalculationResult['valveResults'] = [];

    for (const valve of valves) {
      const pipeResult = pipeResults.find(pr => pr.pipeId === valve.pipeId);
      const pipe = pipes.find(p => p.id === valve.pipeId);

      if (!pipeResult || !pipe) continue;

      const flowRate_m3h = pipeResult.flowRate;
      const effectiveKv = valve.kvValue * (valve.opening / 100);
      const pressureDrop = Math.pow(flowRate_m3h / effectiveKv, 2) * 100;

      const isBalanced = this.checkValveBalance(valve, pressureDrop, pipeResult);

      results.push({
        valveId: valve.id,
        pressureDrop,
        flowCoefficient: effectiveKv,
        isBalanced,
      });

      this.addStep(
        `计算阀门 ${valve.name} 水力参数`,
        {
          opening_percent: valve.opening,
          kvValue: valve.kvValue,
          flowRate_m3h: flowRate_m3h,
        },
        {
          effectiveKv: effectiveKv,
          pressureDrop_kPa: pressureDrop,
          isBalanced: isBalanced ? 1 : 0,
        },
        'Kv_eff = Kv * (opening/100), ΔP = (Q/Kv_eff)² * 100'
      );
    }

    return results;
  }

  private checkValveBalance(
    valve: Valve,
    pressureDrop: number,
    pipeResult: CalculationResult['pipeResults'][0]
  ): boolean {
    const minOpening = 10;
    const maxOpening = 90;
    const minPressureDrop = 3;
    const maxPressureDrop = 30;

    return (
      valve.opening >= minOpening &&
      valve.opening <= maxOpening &&
      pressureDrop >= minPressureDrop &&
      pressureDrop <= maxPressureDrop
    );
  }

  private calculateTotalPressureDrop(
    pipeResults: CalculationResult['pipeResults'],
    valveResults: CalculationResult['valveResults']
  ): number {
    const pipePressureDrop = pipeResults.reduce((sum, pr) => sum + pr.pressureDrop, 0);
    const valvePressureDrop = valveResults.reduce((sum, vr) => sum + vr.pressureDrop, 0);
    const fittingLoss = (pipePressureDrop + valvePressureDrop) * 0.2;
    const total = pipePressureDrop + valvePressureDrop + fittingLoss;

    this.addStep(
      '计算系统总压降',
      {
        pipePressureDrop_kPa: pipePressureDrop,
        valvePressureDrop_kPa: valvePressureDrop,
        fittingLoss_kPa: fittingLoss,
      },
      { totalPressureDrop_kPa: total },
      'ΔP_total = ΔP_pipes + ΔP_valves + ΔP_fittings'
    );

    return total;
  }

  private findOperatingPoint(
    pumpCurve: PumpCurve,
    systemPressureDrop: number,
    estimatedFlowRate: number
  ): { flowRate: number; head: number } {
    const sortedPoints = [...pumpCurve.points].sort((a, b) => a.flowRate - b.flowRate);

    let bestPoint = sortedPoints[0];
    let minDiff = Infinity;

    for (const point of sortedPoints) {
      const systemHead = this.calculateSystemHead(point.flowRate, estimatedFlowRate, systemPressureDrop);
      const diff = Math.abs(point.head - systemHead);
      if (diff < minDiff) {
        minDiff = diff;
        bestPoint = point;
      }
    }

    this.addStep(
      '确定水泵工作点',
      {
        estimatedFlowRate_m3h: estimatedFlowRate,
        systemPressureDrop_kPa: systemPressureDrop,
        pumpMaxFlow_m3h: pumpCurve.maxFlowRate,
        pumpMaxHead_m: pumpCurve.maxHead,
      },
      {
        operatingFlowRate_m3h: bestPoint.flowRate,
        operatingHead_m: bestPoint.head,
      },
      '工作点 = 泵曲线与系统阻力曲线交点'
    );

    return {
      flowRate: bestPoint.flowRate,
      head: bestPoint.head,
    };
  }

  private calculateSystemHead(
    flowRate: number,
    designFlowRate: number,
    designPressureDrop: number
  ): number {
    const flowRatio = flowRate / designFlowRate;
    const pressureDrop = designPressureDrop * flowRatio * flowRatio;
    return pressureDrop / 9.81 * 10;
  }

  private detectAbnormalData(
    pipes: Pipe[],
    valves: Valve[],
    temperatureData: TemperatureData[],
    pipeResults: CalculationResult['pipeResults'],
    valveResults: CalculationResult['valveResults']
  ): AbnormalData[] {
    const abnormalities: AbnormalData[] = [];

    for (const valve of valves) {
      if (valve.opening < 10) {
        abnormalities.push({
          type: 'valve',
          location: valve.name,
          currentValue: valve.opening,
          expectedRange: { min: 10, max: 90 },
          severity: 'high',
          suggestion: `阀门开度过小(${valve.opening}%)，可能导致系统阻力过大，建议增大开度`,
        });
      } else if (valve.opening > 90) {
        abnormalities.push({
          type: 'valve',
          location: valve.name,
          currentValue: valve.opening,
          expectedRange: { min: 10, max: 90 },
          severity: 'high',
          suggestion: `阀门开度过大(${valve.opening}%)，失去调节能力，建议减小开度`,
        });
      }
    }

    for (const temp of temperatureData) {
      const deltaT = temp.supplyTemp - temp.returnTemp;
      if (deltaT < 5) {
        abnormalities.push({
          type: 'temperature',
          location: `节点 ${temp.nodeId}`,
          currentValue: deltaT,
          expectedRange: { min: 5, max: 25 },
          severity: 'medium',
          suggestion: `供回水温差过小(${deltaT.toFixed(1)}°C)，可能存在短路或流量过大`,
        });
      } else if (deltaT > 25) {
        abnormalities.push({
          type: 'temperature',
          location: `节点 ${temp.nodeId}`,
          currentValue: deltaT,
          expectedRange: { min: 5, max: 25 },
          severity: 'high',
          suggestion: `供回水温差过大(${deltaT.toFixed(1)}°C)，流量不足，需检查阀门和过滤器`,
        });
      }

      if (temp.returnTemp > 50) {
        abnormalities.push({
          type: 'temperature',
          location: `节点 ${temp.nodeId}`,
          currentValue: temp.returnTemp,
          expectedRange: { min: 30, max: 50 },
          severity: 'medium',
          suggestion: `回水温度过高(${temp.returnTemp}°C)，换热效果差，检查流量或用户负荷`,
        });
      }
    }

    for (const result of pipeResults) {
      if (result.velocity > 3) {
        abnormalities.push({
          type: 'flow',
          location: `管道 ${pipes.find(p => p.id === result.pipeId)?.name || result.pipeId}`,
          currentValue: result.velocity,
          expectedRange: { min: 0.2, max: 3 },
          severity: 'high',
          suggestion: `流速过高(${result.velocity.toFixed(2)}m/s)，噪声和阻力过大，建议检查管径或阀门`,
        });
      } else if (result.velocity < 0.2) {
        abnormalities.push({
          type: 'flow',
          location: `管道 ${pipes.find(p => p.id === result.pipeId)?.name || result.pipeId}`,
          currentValue: result.velocity,
          expectedRange: { min: 0.2, max: 3 },
          severity: 'low',
          suggestion: `流速过低(${result.velocity.toFixed(2)}m/s)，可能存在气塞或流量分配问题`,
        });
      }
    }

    for (const result of valveResults) {
      if (result.pressureDrop > 50) {
        const valve = valves.find(v => v.id === result.valveId);
        abnormalities.push({
          type: 'pressure',
          location: `阀门 ${valve?.name || result.valveId}`,
          currentValue: result.pressureDrop,
          expectedRange: { min: 3, max: 30 },
          severity: 'high',
          suggestion: `阀门压降过大(${result.pressureDrop.toFixed(1)}kPa)，建议检查阀门开度或更换阀门`,
        });
      }
    }

    this.addStep(
      '检测异常数据',
      {
        totalValves: valves.length,
        totalTemperatures: temperatureData.length,
        totalPipes: pipes.length,
      },
      { abnormalCount: abnormalities.length },
      '检查阀门开度、温差、流速、压降是否在合理范围'
    );

    return abnormalities;
  }

  private generateAdjustmentSuggestions(
    valves: Valve[],
    pipeResults: CalculationResult['pipeResults'],
    valveResults: CalculationResult['valveResults'],
    abnormalities: AbnormalData[]
  ): AdjustmentSuggestion[] {
    const suggestions: AdjustmentSuggestion[] = [];

    for (const valve of valves) {
      const valveResult = valveResults.find(vr => vr.valveId === valve.id);
      if (!valveResult) continue;

      let suggestedOpening = valve.opening;
      let priority: 'high' | 'medium' | 'low' = 'low';
      let reasoning = '';

      if (valve.opening < 15) {
        suggestedOpening = Math.min(valve.opening + 20, 85);
        priority = 'high';
        reasoning = `阀门当前开度(${valve.opening}%)过小，系统阻力过大，建议增大至${suggestedOpening}%`;
      } else if (valve.opening > 85) {
        suggestedOpening = Math.max(valve.opening - 20, 15);
        priority = 'high';
        reasoning = `阀门当前开度(${valve.opening}%)过大，失去调节能力，建议减小至${suggestedOpening}%`;
      } else if (valveResult.pressureDrop > 40) {
        suggestedOpening = Math.min(valve.opening + 15, 85);
        priority = 'medium';
        reasoning = `阀门压降(${valveResult.pressureDrop.toFixed(1)}kPa)过大，建议增大开度至${suggestedOpening}%`;
      } else if (valveResult.pressureDrop < 5) {
        suggestedOpening = Math.max(valve.opening - 15, 15);
        priority = 'low';
        reasoning = `阀门压降(${valveResult.pressureDrop.toFixed(1)}kPa)过小，调节裕度不足，可适当减小开度至${suggestedOpening}%`;
      }

      if (suggestedOpening !== valve.opening) {
        suggestions.push({
          valveId: valve.id,
          valveName: valve.name,
          currentOpening: valve.opening,
          suggestedOpening: Math.round(suggestedOpening),
          adjustmentAmount: Math.round(suggestedOpening - valve.opening),
          priority,
          reasoning,
        });
      }
    }

    suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    this.addStep(
      '生成阀门调整建议',
      {
        totalValves: valves.length,
        unbalancedCount: valveResults.filter(v => !v.isBalanced).length,
      },
      { suggestionCount: suggestions.length },
      '根据阀门开度、压降和平衡状态生成调整建议'
    );

    return suggestions;
  }
}
