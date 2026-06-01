import type { CalculationStep, CalculationRecord, RecordType } from '@/types';
import { unitValidator } from './UnitValidator';

interface CalculationInput {
  nodeCount: number | null;
  edgeCount: number | string | null;
  avgDegree?: number;
  sampleId: string;
  sampleName: string;
  batchId: string;
}

interface CalculationResult {
  record: CalculationRecord;
  type: RecordType;
}

export class CalculationEngine {
  private readonly MODULARITY_THRESHOLD = 0.6;
  private readonly MODULARITY_RANGE = { min: 0.6, max: 0.95 };

  calculate(input: CalculationInput): CalculationResult {
    const steps: CalculationStep[] = [];
    let errorReason: string | undefined;
    let recordType: RecordType = 'success';

    const unitCheck = unitValidator.validateParameters({
      nodeCount: input.nodeCount,
      edgeCount: input.edgeCount,
    });

    const numericEdgeCount =
      typeof input.edgeCount === 'string'
        ? unitValidator.extractUnit(input.edgeCount).numericValue
        : input.edgeCount;

    steps.push({
      step: 1,
      name: '节点度数计算',
      formula: 'k_i = Σ_j A_ij',
      input: { adjacencyMatrix: 1 },
      output: input.avgDegree ?? this.calculateAvgDegree(input.nodeCount, numericEdgeCount),
      unit: '度/节点',
    });

    if (!input.nodeCount || !numericEdgeCount) {
      const avgDegreeStep = steps.find((s) => s.step === 1);
      if (avgDegreeStep) {
        avgDegreeStep.remark = '❌ 关键数据缺失，无法继续计算';
      }
      steps.push({
        step: 2,
        name: '计算终止',
        formula: '-',
        input: {},
        output: 0,
        unit: '',
        remark: '图神经网络社区解释算法参与判断：因数据缺失终止计算，请补全数据',
      });

      errorReason = '节点数(nodeCount)和边数(edgeCount)均为null，缺少计算所需的关键输入数据';
      recordType = 'pending';

      return {
        record: this.buildRecord(input, steps, 0, 0, unitCheck, errorReason, recordType),
        type: recordType,
      };
    }

    if (!unitCheck.passed) {
      steps[0].remark = '⚠️ 单位不一致：部分参数带有单位标识';
    }

    const normalizedWeight = this.normalizeEdgeWeight(numericEdgeCount, input.nodeCount);
    steps.push({
      step: 2,
      name: '边权重标准化',
      formula: 'W_ij = A_ij / max(A)',
      input: { adjacencyMatrix: 1 },
      output: normalizedWeight,
      unit: '',
    });

    const communityCount = this.calculateCommunityCount(input.nodeCount, normalizedWeight);
    steps.push({
      step: 3,
      name: '社区初始划分',
      formula: 'c_i = argmax_c Σ_j W_ij * δ(c_j,c)',
      input: { weightedMatrix: normalizedWeight, threshold: 0.8 },
      output: communityCount,
      unit: '个社区',
      remark: this.getCommunityRemark(communityCount, input.nodeCount),
    });

    const modularity = this.calculateModularity(communityCount, numericEdgeCount, input.nodeCount);
    steps.push({
      step: 4,
      name: '模块度计算',
      formula: 'Q = Σ_c (L_c / m) - (D_c / 2m)²',
      input: { communities: communityCount, edges: numericEdgeCount },
      output: modularity,
      unit: '模块度',
      remark: this.getModularityRemark(modularity, communityCount, input.nodeCount),
    });

    const stability = this.calculateStability(modularity, communityCount);

    if (modularity < this.MODULARITY_RANGE.min || modularity > this.MODULARITY_RANGE.max) {
      if (modularity < 0.3) {
        errorReason = `节点间连接过于稀疏，无法形成有效社区结构，模块度${modularity.toFixed(2)}远低于正常范围[${this.MODULARITY_RANGE.min}, ${this.MODULARITY_RANGE.max}]`;
        recordType = 'pending';
      } else if (modularity < this.MODULARITY_THRESHOLD) {
        recordType = 'pending';
      }
    }

    return {
      record: this.buildRecord(
        input,
        steps,
        modularity,
        communityCount,
        unitCheck,
        errorReason,
        recordType,
        stability
      ),
      type: recordType,
    };
  }

  private calculateAvgDegree(nodeCount: number | null, edgeCount: number | null): number {
    if (!nodeCount || !edgeCount || nodeCount === 0) return 0;
    return (2 * edgeCount) / nodeCount;
  }

  private normalizeEdgeWeight(edgeCount: number, nodeCount: number): number {
    const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
    return maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
  }

  private calculateCommunityCount(nodeCount: number, normalizedWeight: number): number {
    const base = Math.ceil(nodeCount / 5);
    const adjustment = Math.ceil((1 - normalizedWeight) * 3);
    return Math.max(1, base + adjustment);
  }

  private calculateModularity(communityCount: number, edgeCount: number, nodeCount: number): number {
    const density = edgeCount / ((nodeCount * (nodeCount - 1)) / 2);
    const communityFactor = Math.min(1, communityCount / (nodeCount / 10));

    const baseModularity = 0.3 + density * 0.5;
    const adjusted = baseModularity * (0.8 + communityFactor * 0.2);

    return Math.max(0, Math.min(1, Math.round(adjusted * 100) / 100));
  }

  private calculateStability(modularity: number, communityCount: number): number {
    const stability = modularity * 0.7 + (1 - Math.min(1, communityCount / 10)) * 0.3;
    return Math.round(stability * 100) / 100;
  }

  private getCommunityRemark(communityCount: number, nodeCount: number): string | undefined {
    const ratio = communityCount / nodeCount;
    if (ratio > 0.5) {
      return '大多数节点自成社区';
    }
    if (ratio > 0.3) {
      return '边界节点归属存在歧义';
    }
    return undefined;
  }

  private getModularityRemark(modularity: number, communityCount: number, nodeCount: number): string {
    const base = '图神经网络社区解释算法参与判断：';

    if (modularity >= 0.8) {
      return `${base}社区内边密度显著高于随机网络`;
    }
    if (modularity >= this.MODULARITY_THRESHOLD) {
      return `${base}社区结构清晰，结果可信`;
    }
    if (modularity >= 0.5) {
      return `${base}结果接近临界阈值，需结合业务场景确认`;
    }
    if (modularity >= 0.3) {
      return `${base}因单位问题结果仅供参考，请修正后重算`;
    }
    return `${base}结果异常，网络结构不符合社区检测前提假设`;
  }

  private buildRecord(
    input: CalculationInput,
    steps: CalculationStep[],
    modularity: number,
    communityCount: number,
    unitCheck: { passed: boolean; issues: string[] },
    errorReason: string | undefined,
    type: RecordType,
    stability: number = 0
  ): CalculationRecord {
    const now = new Date().toISOString();

    return {
      id: `REC-${Date.now()}`,
      batchId: input.batchId,
      sampleId: input.sampleId,
      sampleName: input.sampleName,
      type,
      inputData: {
        nodeCount: input.nodeCount ?? 0,
        edgeCount: typeof input.edgeCount === 'number' ? input.edgeCount : 0,
        avgDegree: input.avgDegree ?? 0,
      },
      outputData: {
        modularity,
        communityCount,
        stability,
      },
      formula: 'Q = (1/2m) * Σ(A_ij - (k_i*k_j)/(2m)) * δ(c_i,c_j)',
      unitCheck,
      errorReason,
      processingAdvice: this.generateProcessingAdvice(type, modularity, unitCheck, errorReason),
      steps,
      createdAt: now,
    };
  }

  private generateProcessingAdvice(
    type: RecordType,
    modularity: number,
    unitCheck: { passed: boolean; issues: string[] },
    errorReason?: string
  ): string {
    if (errorReason?.includes('数据缺失')) {
      return '请检查该样本的数据源，确保nodeCount和edgeCount等关键参数已正确填写，补充完整后重新运行计算';
    }

    if (!unitCheck.passed) {
      return `请核对edgeCount参数的单位，去除"条"字后重新计算，确保所有参数单位与V2.0版本规范一致`;
    }

    if (modularity < 0.3) {
      return '请检查该样本的数据源是否正确，节点连接是否完整，建议重新采集数据后再次计算';
    }

    if (type === 'pending') {
      return `模块度${modularity.toFixed(2)}接近临界值${this.MODULARITY_THRESHOLD}，边界节点重叠度较高，建议人工确认是否接受该划分结果`;
    }

    if (type === 'legacy') {
      return '数据从复盘图表补录，使用2023年口径计算，与当前版本存在差异，仅供参考比对';
    }

    return '计算顺利，社区结构清晰，可直接使用结果';
  }
}

export const calculationEngine = new CalculationEngine();
