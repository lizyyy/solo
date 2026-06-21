import type {
  TideStationAnnotation,
  AnnotationVersion,
  RemarkDelta,
  RemarkCorrection,
  ConsistencyResult,
  BatchProcessResult,
  BuoyRecord,
  CsvRow,
} from './types';
import { generateId, CSV_HEADERS } from './types';
import { parseBuoyLogLine, buildBuoyRecord, createAnnotation } from './annotationEngine';

export function parseRemarkCorrections(remarkText: string): RemarkCorrection {
  const result: RemarkCorrection = { tideOffsetM: 0, tideOverride: null, found: false, description: '无可识别修正规则' };

  const overrideMatch = remarkText.match(/(?:实际潮位|修正为|订正为|实际为)\s*[:：]?\s*(-?\d+\.?\d*)\s*(m|米|公尺)?/);
  if (overrideMatch) {
    result.tideOverride = parseFloat(overrideMatch[1]);
    result.found = true;
    result.description = `识别订正规则：实际潮位修正为 ${overrideMatch[1]} m`;
    return result;
  }

  const offsetMatch = remarkText.match(/(减去|减掉|扣除|加|增加)\s*(-?\d+\.?\d*)\s*(m|米|公尺)/);
  if (offsetMatch) {
    const op = offsetMatch[1];
    const val = parseFloat(offsetMatch[2]);
    const sign = op === '减去' || op === '减掉' || op === '扣除' ? -1 : 1;
    result.tideOffsetM = sign * val;
    result.found = true;
    result.description = `识别修正规则：潮位${op} ${val} m（偏移 ${sign > 0 ? '+' : ''}${result.tideOffsetM} m）`;
    return result;
  }

  return result;
}

function applyCorrectionsToRecord(record: BuoyRecord, corrections: RemarkCorrection): BuoyRecord {
  const newRecord: BuoyRecord = {
    ...record,
    coordinates: record.coordinates ? { ...record.coordinates } : null,
    tide: record.tide ? { ...record.tide, normalizeNotes: [...record.tide.normalizeNotes] } : null,
    parseErrors: [...record.parseErrors],
    rawLog: { ...record.rawLog },
  };
  if (!newRecord.tide || newRecord.tide.valueMeters == null) return newRecord;

  if (corrections.tideOverride != null) {
    const oldVal = newRecord.tide.valueMeters;
    const newVal = corrections.tideOverride;
    newRecord.tide.valueMeters = Math.round(newVal * 1e6) / 1e6;
    newRecord.tide.normalizeNotes.push(`[备注修正] 人工订正潮位由 ${oldVal.toFixed(4)}m 改为 ${newVal.toFixed(4)}m`);
  } else if (corrections.tideOffsetM !== 0) {
    const offset = corrections.tideOffsetM;
    const oldVal = newRecord.tide.valueMeters;
    const newVal = Math.round((oldVal + offset) * 1e6) / 1e6;
    newRecord.tide.valueMeters = newVal;
    const sign = offset >= 0 ? '+' : '';
    newRecord.tide.normalizeNotes.push(
      `[备注修正] 潮位人工修正: ${oldVal.toFixed(4)}m ${sign}${offset.toFixed(4)}m = ${newVal.toFixed(4)}m`,
    );
  }
  return newRecord;
}

function compareAnnotations(oldAnn: TideStationAnnotation, newAnn: TideStationAnnotation): RemarkDelta[] {
  const deltas: RemarkDelta[] = [];

  const fields: { key: 'sceneAnnotation' | 'sideNote' | 'status'; label: string }[] = [
    { key: 'sceneAnnotation', label: '场景标注文本' },
    { key: 'sideNote', label: '侧边说明文本' },
    { key: 'status', label: '状态' },
  ];
  for (const { key, label } of fields) {
    const oldVal = String(oldAnn[key]);
    const newVal = String(newAnn[key]);
    if (oldVal !== newVal) {
      deltas.push({
        fieldChanged: label,
        oldValue: oldVal,
        newValue: newVal,
        judgmentImpact: `${label}发生变更，影响输出一致性`,
      });
    }
  }

  const csvFields: { key: keyof CsvRow; label: string }[] = [
    { key: 'tide_level', label: '潮位等级判断' },
    { key: 'tide_meters', label: '标准化潮位值' },
    { key: 'remarks', label: '备注内容' },
    { key: 'issues', label: '解析问题线索' },
  ];
  for (const { key, label } of csvFields) {
    const oldV = oldAnn.csvRow[key] ?? '';
    const newV = newAnn.csvRow[key] ?? '';
    if (oldV !== newV) {
      let impact: string;
      if (key === 'tide_level') {
        impact = `潮位等级由【${oldV}】变更为【${newV}】，影响站点可开发性判断`;
      } else if (key === 'remarks') {
        impact = '新增/修改人工备注，影响判断依据，需重新评估';
      } else if (key === 'tide_meters') {
        impact = `标准化潮位值由 ${oldV} m 变更为 ${newV} m，影响潮位等级与能位判断`;
      } else {
        impact = `${label}发生变更，影响问题追溯`;
      }
      deltas.push({ fieldChanged: label, oldValue: oldV, newValue: newV, judgmentImpact: impact });
    }
  }

  return deltas;
}

export function applyRemarkAndVersion(
  annotation: TideStationAnnotation,
  remarkText: string,
  versionNumber: number,
): { annotation: TideStationAnnotation; version: AnnotationVersion } {
  const newRemarks = [...annotation.remarks, remarkText];
  const oldAnnotation: TideStationAnnotation = {
    ...annotation,
    buoyRecord: {
      ...annotation.buoyRecord,
      coordinates: annotation.buoyRecord.coordinates ? { ...annotation.buoyRecord.coordinates } : null,
      tide: annotation.buoyRecord.tide
        ? { ...annotation.buoyRecord.tide, normalizeNotes: [...annotation.buoyRecord.tide.normalizeNotes] }
        : null,
    },
  };

  const corrections = parseRemarkCorrections(remarkText);
  let effectiveRecord = annotation.buoyRecord;
  if (corrections.found) {
    effectiveRecord = applyCorrectionsToRecord(annotation.buoyRecord, corrections);
  }

  const newAnnotation = createAnnotation(annotation.batchId, effectiveRecord, newRemarks, 'reprocessed');
  newAnnotation.annotationId = annotation.annotationId;
  newAnnotation.createdAt = annotation.createdAt;
  newAnnotation.updatedAt = new Date().toISOString();
  newAnnotation.rawTrace.remarkApplied = remarkText;
  newAnnotation.rawTrace.remarkTime = newAnnotation.updatedAt;
  newAnnotation.rawTrace.previousVersionAnnotationId = annotation.annotationId;
  if (corrections.found) newAnnotation.rawTrace.remarkCorrections = corrections;

  const deltas = compareAnnotations(oldAnnotation, newAnnotation);

  const version: AnnotationVersion = {
    versionId: generateId('ver'),
    batchId: annotation.batchId,
    annotationId: annotation.annotationId,
    versionNumber,
    annotation: {
      ...newAnnotation,
      buoyRecord: {
        ...newAnnotation.buoyRecord,
        coordinates: newAnnotation.buoyRecord.coordinates ? { ...newAnnotation.buoyRecord.coordinates } : null,
        tide: newAnnotation.buoyRecord.tide
          ? { ...newAnnotation.buoyRecord.tide, normalizeNotes: [...newAnnotation.buoyRecord.tide.normalizeNotes] }
          : null,
      },
    },
    appliedRemark: remarkText,
    deltas,
    createdAt: newAnnotation.updatedAt,
  };

  return { annotation: newAnnotation, version };
}

export function formatDeltaReport(version: AnnotationVersion): string {
  if (!version.deltas.length) {
    return `版本 ${version.versionNumber}：备注未改变任何判断结果\n备注内容: ${version.appliedRemark}`;
  }
  const lines = [
    `=== 版本 ${version.versionNumber} 变更报告 ===`,
    `备注内容: ${version.appliedRemark}`,
    `影响判断的变更 (${version.deltas.length} 项):`,
  ];
  version.deltas.forEach((d, i) => {
    lines.push(`  ${i + 1}. ${d.fieldChanged}`);
    lines.push(`     旧值: ${d.oldValue}`);
    lines.push(`     新值: ${d.newValue}`);
    lines.push(`     影响: ${d.judgmentImpact}`);
  });
  return lines.join('\n');
}

export function safeProcessLogLine(
  rawText: string,
  sourceFile: string,
  lineNumber: number,
  batchId: string,
): { annotation: TideStationAnnotation; error: string | null } {
  try {
    const rawLog = parseBuoyLogLine(rawText, sourceFile, lineNumber);
    const record = buildBuoyRecord(rawLog);

    if (!record.isValid) {
      const annotation = createAnnotation(batchId, record, [], 'exception');
      annotation.rawTrace.exceptionContext = {
        rawText,
        parseErrors: record.parseErrors,
        rawLogSnapshot: {
          rawLatitude: rawLog.rawLatitude,
          rawLongitude: rawLog.rawLongitude,
          rawTideValue: rawLog.rawTideValue,
          rawTideUnit: rawLog.rawTideUnit,
        },
      };
      return { annotation, error: null };
    }

    const annotation = createAnnotation(batchId, record);
    return { annotation, error: null };
  } catch (e) {
    const errorTrace = String(e?.stack ?? e);
    const rawLog = parseBuoyLogLine(rawText, sourceFile, lineNumber);
    const record = buildBuoyRecord(rawLog);
    const annotation = createAnnotation(batchId, record, [], 'exception');
    annotation.stationName = '异常记录';
    annotation.sceneAnnotation = `[处理异常] ${String(e)} | 原始日志: ${rawText}`;
    annotation.sideNote = `处理异常: ${String(e)}\n原始日志保留:\n${rawText}\n来源: ${sourceFile}:${lineNumber}\n堆栈:\n${errorTrace}`;
    annotation.csvRow = {
      ...annotation.csvRow,
      station_name: '异常记录',
      issues: `EXCEPTION: ${String(e)}; 原始线索已保留`,
      raw_text: rawText,
      source_ref: `${sourceFile}:${lineNumber}`,
    };
    annotation.rawTrace = {
      exception: String(e),
      traceback: errorTrace,
      rawText,
      sourceFile,
      lineNumber,
    };
    return { annotation, error: errorTrace };
  }
}

export function processBuoyText(
  text: string,
  sourceFile: string,
  batchId: string,
): TideStationAnnotation[] {
  const annotations: TideStationAnnotation[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) return;
    const { annotation } = safeProcessLogLine(stripped, sourceFile, idx + 1, batchId);
    if (annotation) annotations.push(annotation);
  });
  return annotations;
}

export function runPipeline(logText: string, sourceName = 'pasted_logs.txt'): BatchProcessResult {
  const batchId = generateId('batch');
  const annotations = processBuoyText(logText, sourceName, batchId);

  const versions: AnnotationVersion[] = annotations.map((ann) => ({
    versionId: generateId('ver'),
    batchId,
    annotationId: ann.annotationId,
    versionNumber: 1,
    annotation: ann,
    appliedRemark: null,
    deltas: [],
    createdAt: ann.createdAt,
  }));

  const hasExceptions = annotations.some((a) => a.status === 'exception');

  return {
    batchId,
    annotations,
    versions,
    hasExceptions,
    currentVersion: 1,
  };
}

export function reprocessBatchWithRemark(
  batch: BatchProcessResult,
  annotationId: string,
  remarkText: string,
): { batch: BatchProcessResult; version: AnnotationVersion | null } {
  const nextVersion = batch.currentVersion + 1;
  let newVersion: AnnotationVersion | null = null;

  const newAnnotations = batch.annotations.map((ann) => {
    if (ann.annotationId !== annotationId) return ann;
    const { annotation: newAnn, version } = applyRemarkAndVersion(ann, remarkText, nextVersion);
    newVersion = version;
    return newAnn;
  });

  const newVersions = [...batch.versions];
  if (newVersion) newVersions.push(newVersion);

  return {
    batch: {
      ...batch,
      annotations: newAnnotations,
      versions: newVersions,
      currentVersion: nextVersion,
      hasExceptions: newAnnotations.some((a) => a.status === 'exception' || a.status === 'pending_review'),
    },
    version: newVersion,
  };
}

export function generateCsvString(annotations: TideStationAnnotation[]): string {
  const header = CSV_HEADERS.join(',');
  const rows = annotations.map((ann) =>
    CSV_HEADERS.map((h) => {
      const val = ann.csvRow[h] ?? '';
      const escaped = val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
      return escaped;
    }).join(','),
  );
  return [header, ...rows].join('\n');
}

export function verifyConsistency(annotations: TideStationAnnotation[]): ConsistencyResult {
  const mismatches: string[] = [];
  for (const ann of annotations) {
    if (!ann.csvRow.raw_text) mismatches.push(`${ann.stationName}: CSV 缺少 raw_text`);
    if (!ann.csvRow.source_ref) mismatches.push(`${ann.stationName}: CSV 缺少 source_ref`);
    if (!ann.sceneAnnotation.includes(ann.csvRow.tide_meters) && !ann.csvRow.tide_meters.includes('PARSE_FAILED')) {
      mismatches.push(`${ann.stationName}: 场景标注与 CSV 潮位值不一致`);
    }
    if (ann.status === 'exception' && ann.csvRow.latitude === '0.000000') {
      mismatches.push(`${ann.stationName}: 异常记录坐标被伪装为 0.000000`);
    }
    if (ann.status === 'exception' && !ann.csvRow.issues) {
      mismatches.push(`${ann.stationName}: 异常记录缺少失败原因`);
    }
  }
  return {
    consistent: mismatches.length === 0,
    mismatches,
    countCheck: {
      annotations: annotations.length,
      sceneLines: annotations.length,
      csvRows: annotations.length,
    },
  };
}

export function downloadCsv(csvString: string, filename: string): void {
  const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
