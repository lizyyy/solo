import { TrajectoryPoint, SimulationParams, RiskType, RiskExplanation, TraceRecord, SourceInfo, MIN_SAFE_LANDING_VELOCITY } from '../types';

export class RiskDetector {
  private velocityHistory: number[] = [];
  private readonly DIVERGENCE_WINDOW = 10;
  private readonly DIVERGENCE_THRESHOLD = 50;

  detect(
    point: TrajectoryPoint,
    params: SimulationParams,
    history: TrajectoryPoint[]
  ): RiskType[] {
    const risks: RiskType[] = [];

    if (this.isZeroDensity(params)) {
      risks.push('ZERO_DENSITY');
    }

    if (this.isVelocityDivergence(point, history)) {
      risks.push('VELOCITY_DIVERGENCE');
    }

    if (this.isLowDeploymentAltitude(point, params, history)) {
      risks.push('LOW_DEPLOYMENT_ALTITUDE');
    }

    this.velocityHistory.push(point.velocity);
    if (this.velocityHistory.length > this.DIVERGENCE_WINDOW) {
      this.velocityHistory.shift();
    }

    return risks;
  }

  private isZeroDensity(params: SimulationParams): boolean {
    return params.atmosphericDensity <= 0;
  }

  private isVelocityDivergence(
    point: TrajectoryPoint,
    history: TrajectoryPoint[]
  ): boolean {
    if (history.length < this.DIVERGENCE_WINDOW) {
      return false;
    }

    if (point.velocity > this.DIVERGENCE_THRESHOLD && point.parachuteDeployed) {
      const recentVelocities = history
        .slice(-this.DIVERGENCE_WINDOW)
        .map(p => p.velocity);
      
      const avgDeceleration = this.calculateAverageDeceleration(recentVelocities);
      
      return avgDeceleration >= 0;
    }

    return false;
  }

  private calculateAverageDeceleration(velocities: number[]): number {
    if (velocities.length < 2) return 0;
    const changes: number[] = [];
    for (let i = 1; i < velocities.length; i++) {
      changes.push(velocities[i] - velocities[i - 1]);
    }
    return changes.reduce((a, b) => a + b, 0) / changes.length;
  }

  private isLowDeploymentAltitude(
    point: TrajectoryPoint,
    params: SimulationParams,
    history: TrajectoryPoint[]
  ): boolean {
    if (history.length < 2) {
      return false;
    }

    const justDeployed = !history[history.length - 2]?.parachuteDeployed === false && 
                        point.parachuteDeployed === true;

    if (justDeployed && point.altitude < params.deploymentAltitude * 0.5) {
      return true;
    }

    return false;
  }

  getRiskExplanation(riskType: RiskType): RiskExplanation {
    const explanations: Record<RiskType, RiskExplanation> = {
      ZERO_DENSITY: {
        title: '大气密度为零',
        description: '模拟检测到大气密度参数设置为零或负值，这在物理上是不可能的。',
        impact: '阻力计算失效，探测器无法减速，可能导致高速撞击火星表面。',
        mitigation: '请检查大气密度输入值，确保其为正值。参考火星大气模型数据。',
        relatedParams: ['atmosphericDensity']
      },
      VELOCITY_DIVERGENCE: {
        title: '速度发散',
        description: '降落伞展开后速度未按预期减速，反而持续增加或减速不足。',
        impact: '终端速度超过安全着陆阈值，可能导致探测器损坏。',
        mitigation: '检查伞面积是否足够大，大气密度是否准确，或考虑增加备用减速系统。',
        relatedParams: ['parachuteArea', 'atmosphericDensity', 'deploymentAltitude']
      },
      LOW_DEPLOYMENT_ALTITUDE: {
        title: '开伞高度过低',
        description: '降落伞实际展开高度远低于预设开伞高度的50%。',
        impact: '减速距离不足，可能无法在达到安全着陆速度。',
        mitigation: '提高开伞高度设置，或检查探测器初始轨道参数。',
        relatedParams: ['deploymentAltitude', 'initialAltitude', 'initialVelocity']
      }
    };

    return explanations[riskType];
  }

  createTraceRecord(
    pointIndex: number,
    riskType: RiskType,
    params: SimulationParams
  ): TraceRecord {
    const explanation = this.getRiskExplanation(riskType);
    const paramSources: Record<string, SourceInfo> = {};

    explanation.relatedParams.forEach(param => {
      const sourceKey = `${param}Source` as keyof SimulationParams;
      if (sourceKey in params) {
        paramSources[param] = params[sourceKey] as SourceInfo;
      }
    });

    return {
      pointIndex,
      riskType,
      paramSources,
      calculationChain: [
        '参数输入验证',
        '数值积分计算',
        '阻力模型计算',
        '风险检测分析',
        '异常点标记'
      ]
    };
  }

  reset(): void {
    this.velocityHistory = [];
  }
}

export const createRiskDetector = () => new RiskDetector();
