import { BattleReport, BatchJob, BatchLogEntry } from '../types';
import { genId, saveReport, addHistory } from '../store/localStorage';
import { calculateTurnOrder, verifyTurnOrder } from './turnOrder';
import { recalculateReport } from './battleReport';

export function createBatchJob(reports: BattleReport[]): BatchJob {
  return {
    id: genId(),
    createdAt: Date.now(),
    reports: reports.map(r => structuredClone(r)),
    status: 'pending',
    progress: 0,
    total: reports.length,
    logs: [],
  };
}

function addLog(job: BatchJob, level: BatchLogEntry['level'], message: string): void {
  job.logs.push({ timestamp: Date.now(), level, message });
}

export function runBatchReview(job: BatchJob, onProgress?: (job: BatchJob) => void): BatchJob {
  job.status = 'running';
  job.progress = 0;
  addLog(job, 'ok', `开始批量复核，共 ${job.total} 条战报`);

  for (let i = 0; i < job.reports.length; i++) {
    const report = job.reports[i];
    const verification = verifyTurnOrder(report.units, report.turnOrder.checksum);

    if (verification.valid) {
      addLog(job, 'ok', `[${i + 1}/${job.total}] "${report.scenarioName}" - 校验通过`);
    } else {
      addLog(job, 'warn', `[${i + 1}/${job.total}] "${report.scenarioName}" - 校验不一致：${verification.detail}`);
      const recalced = recalculateReport(report);
      job.reports[i] = recalced;
      addLog(job, 'ok', `[${i + 1}/${job.total}] "${report.scenarioName}" - 已自动重算回合顺序`);
    }

    job.progress = i + 1;
    if (onProgress) onProgress(structuredClone(job));
  }

  job.status = 'done';
  addLog(job, 'ok', `批量复核完成，处理 ${job.total} 条战报`);
  return structuredClone(job);
}

export function commitBatchResults(job: BatchJob): BattleReport[] {
  if (job.status !== 'done') return [];

  const results: BattleReport[] = [];
  const seenIds = new Set<string>();

  for (const report of job.reports) {
    if (seenIds.has(report.id)) {
      addLog(job, 'warn', `跳过重复ID: ${report.id}`);
      continue;
    }
    seenIds.add(report.id);

    const saved = saveReport(report);
    addHistory('batch', `批量处理: ${report.scenarioName}`, saved);
    results.push(saved);
  }

  return results;
}

export function runBatchImport(rawData: string, onProgress?: (job: BatchJob) => void): BatchJob {
  const job: BatchJob = {
    id: genId(),
    createdAt: Date.now(),
    reports: [],
    status: 'running',
    progress: 0,
    total: 0,
    logs: [],
  };

  let parsed: unknown[];
  try {
    const parsedRaw = JSON.parse(rawData);
    parsed = Array.isArray(parsedRaw) ? parsedRaw : [parsedRaw];
  } catch (e) {
    job.status = 'error';
    addLog(job, 'err', `JSON解析失败: ${(e as Error).message}`);
    return job;
  }

  job.total = parsed.length;
  addLog(job, 'ok', `开始批量导入，共 ${job.total} 条数据`);
  const seenIds = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    try {
      const item = parsed[i] as Partial<BattleReport>;
      if (!item.units || !Array.isArray(item.units) || item.units.length === 0) {
        addLog(job, 'warn', `[${i + 1}/${job.total}] 缺少有效单位数据，跳过`);
        job.progress = i + 1;
        continue;
      }

      const report: BattleReport = {
        id: item.id || genId(),
        createdAt: item.createdAt || Date.now(),
        scenarioName: item.scenarioName || `批量导入场景${i + 1}`,
        units: item.units,
        turnOrder: calculateTurnOrder(item.units),
        corrected: false,
        correctionNote: '',
        version: 1,
      };

      if (seenIds.has(report.id)) {
        addLog(job, 'warn', `[${i + 1}/${job.total}] ID重复 ${report.id}，自动生成新ID`);
        report.id = genId();
      }
      seenIds.add(report.id);

      job.reports.push(report);
      addLog(job, 'ok', `[${i + 1}/${job.total}] "${report.scenarioName}" - 导入成功`);
    } catch (e) {
      addLog(job, 'err', `[${i + 1}/${job.total}] 处理失败: ${(e as Error).message}`);
    }

    job.progress = i + 1;
    if (onProgress) onProgress(structuredClone(job));
  }

  job.status = 'done';
  addLog(job, 'ok', `批量导入完成，成功 ${job.reports.length}/${job.total} 条`);
  return structuredClone(job);
}
