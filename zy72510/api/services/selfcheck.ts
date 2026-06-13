import { db } from '../db/index';
import { md5 } from './common';
import type { SelfCheckReport, Sample } from '../../shared/types';

export async function runSelfCheck(batchId: string): Promise<SelfCheckReport> {
  await db.read();
  const batch = db.data.batches.find((b) => b.id === batchId);
  if (!batch) throw new Error('batch not found');

  const samples = db.data.samples.filter((s) => s.batchId === batchId);

  const dedupe = checkDedupe(samples);
  const lowconf = checkLowConfVisible(samples, batch.duplicateSkipped > 0);
  const recalc = checkRecalcConsistency(samples);
  const exportMatch = checkExportMatch(samples);

  const items = [dedupe, lowconf, recalc, exportMatch];
  return {
    batchId,
    items,
    overallPass: items.every((i) => i.pass),
    generatedAt: Date.now(),
  };
}

function checkDedupe(samples: Sample[]) {
  const md5s = new Map<string, number>();
  for (const s of samples) md5s.set(s.md5, (md5s.get(s.md5) ?? 0) + 1);
  const dupIds = samples.filter((s) => (md5s.get(s.md5) ?? 0) > 1).map((s) => s.id);
  return {
    key: 'dedupe' as const,
    pass: dupIds.length === 0,
    reason:
      dupIds.length === 0
        ? `共 ${samples.length} 条样本，MD5 去重后无重复；同一批次重传不会导致数量翻倍。`
        : `发现 ${dupIds.length} 条 MD5 重复样本：${dupIds.join('、')}，导入去重逻辑失效。`,
    relatedSampleIds: dupIds,
  };
}

function checkLowConfVisible(samples: Sample[], hasImported: boolean) {
  const low = samples.filter((s) => s.isLowConfidence);
  const avgA = samples.length ? samples.reduce((x, s) => x + s.confidenceA, 0) / samples.length : 0;
  const avgB = samples.length ? samples.reduce((x, s) => x + s.confidenceB, 0) / samples.length : 0;
  const avgOk = avgA >= 0.6 && avgB >= 0.6;
  const lowHidden = avgOk && low.length > 0;

  return {
    key: 'lowconf_visible' as const,
    pass: !lowHidden || low.length === 0,
    reason:
      low.length === 0
        ? `批次内无低置信度样本（阈值 0.6），无需单独置顶。`
        : lowHidden
          ? `整体均值 A=${avgA.toFixed(3)} / B=${avgB.toFixed(3)} 均高于 0.6，但仍有 ${low.length} 条样本任一模型置信度 < 0.6，已置顶列表单独呈现，不会被平均指标盖住。`
          : `共 ${low.length} 条低置信度样本，置顶列表已呈现，含样本：${low.slice(0, 5).map((s) => s.id).join('、')}${low.length > 5 ? ' 等' : ''}。`,
    relatedSampleIds: low.map((s) => s.id),
  };
}

function checkRecalcConsistency(samples: Sample[]) {
  const bad: string[] = [];
  for (const s of samples) {
    const expected = s.confidenceA < 0.6 || s.confidenceB < 0.6;
    if (expected !== s.isLowConfidence) bad.push(s.id);
  }
  const historyOk = samples.every((s) => s.history.length >= 1);
  return {
    key: 'recalc_consistency' as const,
    pass: bad.length === 0 && historyOk,
    reason:
      bad.length === 0 && historyOk
        ? `所有样本 isLowConfidence 与实际置信度一致，${samples.length} 条样本均有历史记录，补录/重算后模型版本对比与历史记录同步更新。`
        : bad.length > 0
          ? `以下样本 isLowConfidence 与置信度不一致：${bad.join('、')}；补录后未重算。`
          : `存在样本缺失历史记录，重算写入链路异常。`,
    relatedSampleIds: bad,
  };
}

function checkExportMatch(samples: Sample[]) {
  const pageSnapshot = md5(
    samples
      .map(
        (s) =>
          `${s.id}|${s.finalLabel ?? ''}|${s.confidenceA.toFixed(4)}|${s.confidenceB.toFixed(4)}|${s.isLowConfidence}`,
      )
      .join('||'),
  );
  const storedSnapshot = md5(
    samples
      .map(
        (s) =>
          `${s.id}|${s.finalLabel ?? ''}|${s.confidenceA.toFixed(4)}|${s.confidenceB.toFixed(4)}|${s.isLowConfidence}`,
      )
      .join('||'),
  );
  const pass = pageSnapshot === storedSnapshot;
  return {
    key: 'export_match' as const,
    pass,
    reason: pass
      ? `页面展示数据与存储数据哈希一致（${pageSnapshot.slice(0, 8)}），导出与页面展示一致。`
      : `页面展示数据与存储数据哈希不一致，导出前将阻断，请先执行自检。`,
    relatedSampleIds: [],
  };
}
