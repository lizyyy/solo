import type {
  MaterialPackage,
  ImportResult,
  Sample,
  CalculationRecord,
  Batch,
  Remark,
  ParamVersion,
  MaterialPackageSample,
} from '@/types';
import { calculationEngine } from './CalculationEngine';
import { unitValidator } from './UnitValidator';

export class MaterialPackageParser {
  parse(jsonText: string): { package: MaterialPackage | null; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    let pkg: MaterialPackage;
    try {
      pkg = JSON.parse(jsonText) as MaterialPackage;
    } catch (e) {
      return { package: null, errors: ['JSON 格式解析失败：' + (e instanceof Error ? e.message : String(e))], warnings: [] };
    }

    if (!pkg.batchName || typeof pkg.batchName !== 'string') {
      errors.push('缺少 batchName（批次名称）');
    }

    if (!pkg.samples || !Array.isArray(pkg.samples) || pkg.samples.length === 0) {
      errors.push('缺少 samples（样本列表）或列表为空');
    } else {
      pkg.samples.forEach((sample, index) => {
        if (!sample.id) {
          errors.push(`第 ${index + 1} 条样本缺少 id`);
        }
        if (!sample.name) {
          warnings.push(`第 ${index + 1} 条样本缺少 name，将使用 id 作为名称`);
        }
        if (sample.nodeCount === undefined) {
          warnings.push(`样本 ${sample.id || '第' + (index + 1) + '条'} 缺少 nodeCount，可能导致计算失败`);
        }
        if (sample.edgeCount === undefined) {
          warnings.push(`样本 ${sample.id || '第' + (index + 1) + '条'} 缺少 edgeCount，可能导致计算失败`);
        }
      });
    }

    if (pkg.parameters && typeof pkg.parameters === 'object') {
      const paramObj = Object.fromEntries(
        Object.entries(pkg.parameters).map(([k, v]) => [
          k,
          { value: v.value, unit: v.unit, description: v.description || '' },
        ])
      );
      const unitIssues = unitValidator.validateParamVersionConsistency(paramObj, paramObj);
      if (unitIssues.issues.length > 0) {
        warnings.push('参数单位存在不一致：' + unitIssues.issues.join('；'));
      }
    }

    if (pkg.legacyRecords && pkg.legacyRecords.length > 0) {
      warnings.push(`包含 ${pkg.legacyRecords.length} 条历史口径记录，请留意数据口径差异`);
    }

    return { package: pkg, errors, warnings };
  }

  processMaterialPackage(pkg: MaterialPackage): {
    batch: Batch;
    samples: Sample[];
    records: CalculationRecord[];
    remarks: Remark[];
    paramVersion: ParamVersion | null;
  } {
    const batchId = 'batch-' + Date.now();
    const now = new Date().toISOString();
    const createdBy = pkg.createdBy || '调度主管-周姐';

    let paramVersion: ParamVersion | null = null;
    if (pkg.parameters && Object.keys(pkg.parameters).length > 0) {
      paramVersion = {
        id: 'param-' + Date.now(),
        version: pkg.paramVersion || 'V-imported',
        name: pkg.paramVersionName || pkg.batchName + '参数表',
        parameters: Object.fromEntries(
          Object.entries(pkg.parameters).map(([k, v]) => [
            k,
            { value: v.value, unit: v.unit, description: v.description || k },
          ])
        ),
        createdAt: now,
        createdBy,
      };
    }

    const samples: Sample[] = pkg.samples.map((s) => this.convertSample(s, batchId, now));

    const legacySampleIds = new Set<string>();
    if (pkg.legacyRecords) {
      for (const legacy of pkg.legacyRecords) {
        legacySampleIds.add(legacy.id);
        const exists = samples.find((s) => s.id === legacy.id);
        if (!exists) {
          samples.push({
            id: legacy.id,
            batchId,
            name: legacy.name,
            value: legacy.modularity,
            unit: '模块度',
            expectedRange: { min: 0.6, max: 0.95 },
            isOutOfBounds: false,
            status: 'legacy',
            remark: legacy.remark,
            legacySource: legacy.source,
            createdAt: now,
          });
        }
      }
    }

    const records: CalculationRecord[] = [];
    for (const sample of samples) {
      const legacy = pkg.legacyRecords?.find((l) => l.id === sample.id);
      if (legacy) {
        records.push(this.createLegacyRecord(sample, legacy, batchId, now));
      } else {
        const result = calculationEngine.calculate({
          nodeCount: pkg.samples.find((s) => s.id === sample.id)?.nodeCount ?? 0,
          edgeCount: pkg.samples.find((s) => s.id === sample.id)?.edgeCount ?? 0,
          sampleId: sample.id,
          sampleName: sample.name,
          batchId,
          avgDegree: pkg.samples.find((s) => s.id === sample.id)?.avgDegree,
        });
        records.push(result.record);
      }
    }

    const remarks: Remark[] = [];
    if (pkg.remarks) {
      for (const remark of pkg.remarks) {
        const record = records.find((r) => r.sampleId === remark.sampleId);
        if (record) {
          remarks.push({
            id: 'remark-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            recordId: record.id,
            content: remark.content,
            addedBy: remark.addedBy || createdBy,
            addedAt: remark.addedAt || now,
            isSupplement: true,
          });
        }
      }
    }

    const successCount = records.filter((r) => r.type === 'success').length;
    const pendingCount = records.filter((r) => r.type === 'pending').length;
    const legacyCount = records.filter((r) => r.type === 'legacy').length;
    const errorCount = records.filter((r) => r.errorReason).length;

    const batch: Batch = {
      id: batchId,
      name: pkg.batchName,
      status: 'completed',
      paramVersionId: paramVersion?.id || 'v2',
      totalSamples: samples.length,
      successCount,
      pendingCount,
      legacyCount,
      errorCount,
      createdAt: now,
      completedAt: now,
    };

    return { batch, samples, records, remarks, paramVersion };
  }

  private convertSample(pkgSample: MaterialPackageSample, batchId: string, createdAt: string): Sample {
    let value = 0;
    if (typeof pkgSample.nodeCount === 'number' && pkgSample.nodeCount > 0) {
      value = Math.min(0.95, Math.max(0.1, 0.5 + (pkgSample.nodeCount % 20) * 0.02));
    }

    const expectedRange = pkgSample.expectedRange || { min: 0.6, max: 0.95 };
    const isOutOfBounds =
      pkgSample.isOutOfBounds !== undefined
        ? pkgSample.isOutOfBounds
        : value < expectedRange.min || value > expectedRange.max;

    let status: Sample['status'] = 'normal';
    if (pkgSample.status) {
      status = pkgSample.status;
    } else if (isOutOfBounds) {
      status = 'manual';
    }

    return {
      id: pkgSample.id,
      batchId,
      name: pkgSample.name || pkgSample.id,
      value: Math.round(value * 100) / 100,
      unit: '模块度',
      expectedRange,
      isOutOfBounds,
      status,
      remark: pkgSample.remark,
      legacySource: pkgSample.legacySource,
      createdAt,
      rawInput: {
        nodeCount: pkgSample.nodeCount !== undefined ? pkgSample.nodeCount : null,
        edgeCount: pkgSample.edgeCount !== undefined ? pkgSample.edgeCount : null,
        avgDegree: pkgSample.avgDegree !== undefined ? pkgSample.avgDegree : null,
      },
    };
  }

  private createLegacyRecord(
    sample: Sample,
    legacy: { modularity: number; communityCount: number; stability: number; source: string; remark?: string },
    batchId: string,
    createdAt: string
  ): CalculationRecord {
    return {
      id: 'REC-' + sample.id + '-legacy-' + Math.random().toString(36).slice(2, 8),
      batchId,
      sampleId: sample.id,
      sampleName: sample.name,
      type: 'legacy',
      inputData: {
        nodeCount: '历史数据',
        edgeCount: '历史数据',
        source: legacy.source,
      },
      outputData: {
        modularity: legacy.modularity,
        communityCount: legacy.communityCount,
        stability: legacy.stability,
      },
      formula: '历史口径计算（2023版社区发现算法）',
      unitCheck: {
        passed: false,
        issues: ['使用历史口径，与当前参数不完全一致', '数据来源：' + legacy.source],
      },
      steps: [
        {
          step: 1,
          name: '数据来源确认',
          formula: 'source = "' + legacy.source + '"',
          input: { 数据源: legacy.source },
          output: 1,
          unit: '次',
          remark: '📜 历史复盘图表数据，图神经网络社区解释算法参与了口径转换',
        },
        {
          step: 2,
          name: '社区划分（旧口径）',
          formula: 'Q = Σ(A_ij - k_i k_j / 2m) δ(c_i, c_j) / 2m  [2023版]',
          input: { 节点数: '历史数据', 边数: '历史数据' },
          output: legacy.communityCount,
          unit: '个社区',
          remark: '⚠️ 使用历史口径计算，与当前V2.0参数存在差异',
        },
        {
          step: 3,
          name: '模块度计算（旧口径）',
          formula: 'Q = 1/(2m) * Σ_ij [A_ij - k_i k_j/(2m)] δ(c_i,c_j)',
          input: { 邻接矩阵: '历史数据', 社区划分: legacy.communityCount + '个社区' },
          output: legacy.modularity,
          unit: '模块度',
          remark: '历史口径补录，与当前版本存在差异，仅供参考比对',
        },
      ],
      processingAdvice:
        '数据从复盘图表补录，使用2023年口径计算，与当前版本存在差异，仅供参考比对。如需准确对比，请用当前参数重新计算。',
      createdAt,
    };
  }

  toImportResult(
    pkg: MaterialPackage,
    processed: { batch: Batch; samples: Sample[]; records: CalculationRecord[]; remarks: Remark[] }
  ): ImportResult {
    return {
      success: true,
      batchId: processed.batch.id,
      sampleCount: processed.samples.length,
      remarkCount: processed.remarks.length,
      legacyCount: processed.records.filter((r) => r.type === 'legacy').length,
      errors: [],
      warnings:
        pkg.legacyRecords && pkg.legacyRecords.length > 0
          ? ['包含 ' + pkg.legacyRecords.length + ' 条历史口径记录，请注意口径差异']
          : [],
    };
  }
}

export const materialPackageParser = new MaterialPackageParser();
