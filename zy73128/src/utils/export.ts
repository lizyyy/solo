import Papa from 'papaparse';
import type { Annotation, AuditTrail } from '@/shared/types';

const computeHash = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

const buildBatchId = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `EXP-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

export interface UnifiedExport {
  batchId: string;
  exportTime: string;
  operator: string;
  dataHash: string;
  sceneDoc: string;
  sideMarkdown: string;
  csvContent: string;
  csvRows: Array<Record<string, string>>;
}

const formatCsvRows = (annotations: Annotation[], trails: AuditTrail[]): Array<Record<string, string>> => {
  return annotations.map((a) => {
    const validArea = a.hasCloudCover && a.cloudMask
      ? a.totalArea - a.cloudMask.affectedArea
      : a.totalArea;
    const rate = validArea > 0 ? ((a.bleachingArea / validArea) * 100).toFixed(2) + '%' : 'N/A';
    const lastTrail = trails
      .filter((t) => t.annotationId === a.id)
      .sort((x, y) => y.timestamp.localeCompare(x.timestamp))[0];
    let anomalyTag = '';
    if (a.status === '云遮挡') anomalyTag = '云遮挡-已排除';
    else if (a.status === '异常') anomalyTag = '人工改判-已记录';
    else if (a.status === '补录') anomalyTag = '补录记录-保留原时间';
    else anomalyTag = '正常';
    return {
      标注ID: a.id,
      海洋站: a.station,
      采样时间: new Date(a.sampleTime).toLocaleString('zh-CN'),
      实验结果时间: new Date(a.experimentResult).toLocaleString('zh-CN'),
      时间差小时: (
        (new Date(a.experimentResult).getTime() - new Date(a.sampleTime).getTime()) /
        3600000
      ).toFixed(1),
      总调查面积_km2: a.totalArea.toFixed(2),
      云遮挡排除_km2: a.hasCloudCover && a.cloudMask ? a.cloudMask.affectedArea.toFixed(2) : '0.00',
      有效调查面积_km2: validArea.toFixed(2),
      白化面积_km2: a.bleachingArea.toFixed(2),
      白化率: rate,
      白化等级: a.severity,
      记录状态: a.status,
      异常标记: anomalyTag,
      遥感数据源: a.screenshotMeta.dataSource,
      轨道号: a.screenshotMeta.orbitId,
      最近操作人: lastTrail?.operator ?? '-',
      最近操作: lastTrail?.action ?? '-',
      最近线索: lastTrail?.reason ?? '-',
      补看来源: a.cloudMask?.reviewSource ?? '',
      坏数据回跳锚点: a.badDataRef ?? '',
      创建时间: new Date(a.createdAt).toLocaleString('zh-CN'),
      更新时间: new Date(a.updatedAt).toLocaleString('zh-CN'),
    };
  });
};

export const buildUnifiedExport = (
  annotations: Annotation[],
  allTrails: AuditTrail[],
  operator = '小宋',
): UnifiedExport => {
  const batchId = buildBatchId();
  const exportTime = new Date().toLocaleString('zh-CN');
  const csvRows = formatCsvRows(annotations, allTrails);
  const csvContent = Papa.unparse(csvRows, { quotes: true });
  const sceneParts = annotations.map((a) => {
    const validArea = a.hasCloudCover && a.cloudMask
      ? a.totalArea - a.cloudMask.affectedArea
      : a.totalArea;
    const rate = validArea > 0 ? ((a.bleachingArea / validArea) * 100).toFixed(2) + '%' : 'N/A';
    return [
      `【${a.status}】${a.id} · ${a.station}`,
      `采样：${new Date(a.sampleTime).toLocaleString('zh-CN')}  |  实验结果：${new Date(a.experimentResult).toLocaleString('zh-CN')}`,
      `白化等级：${a.severity}   调查面积：${validArea.toFixed(2)}km²   白化面积：${a.bleachingArea.toFixed(2)}km²   白化率：${rate}`,
      `遥感：${a.screenshotMeta.dataSource} / ${a.screenshotMeta.orbitId} / ${a.screenshotMeta.bandCombo}`,
      `场景标注：${a.sceneLabel}`,
    ].join('\n');
  });
  const sceneDoc = [
    `珊瑚白化空间标注汇总  批次号 ${batchId}`,
    `导出时间：${exportTime}    操作人：${operator}    记录数：${annotations.length}`,
    '============================================================================',
    '',
    ...sceneParts.flatMap((p) => [p, '']),
  ].join('\n');

  const sideParts = annotations.map((a) => {
    const trails = allTrails
      .filter((t) => t.annotationId === a.id)
      .sort((x, y) => x.timestamp.localeCompare(y.timestamp));
    const trailLines = trails.map(
      (t) =>
        `  · ${new Date(t.timestamp).toLocaleString('zh-CN')} [${t.action}] ${t.operator}: ${t.reason}${
          t.screenshotAnchor ? `  【截图锚点：${t.screenshotAnchor}】` : ''
        }`,
    );
    return [
      `## ${a.id} · ${a.station} (${a.status})`,
      '',
      '> 侧边说明：' + a.sideNote,
      '',
      '### 线索链',
      ...(trailLines.length ? trailLines : ['  · 无线索记录']),
      '',
      a.cloudMask
        ? `### 云遮挡补看来源\n- 影响面积：${a.cloudMask.affectedArea}km²\n- ${a.cloudMask.reviewSource}\n- ${a.cloudMask.description}\n`
        : '',
      a.badDataRef ? `### 坏数据回跳\n- 锚点：${a.badDataRef}\n` : '',
    ].join('\n');
  });
  const sideMarkdown = [
    `# 珊瑚白化空间标注 · 侧边说明合集\n\n> 批次号：${batchId}  \n> 导出时间：${exportTime}  \n> 操作人：${operator}\n\n---\n`,
    ...sideParts,
  ].join('\n');

  const combined = sceneDoc + sideMarkdown + csvContent;
  const dataHash = computeHash(combined);

  return {
    batchId,
    exportTime,
    operator,
    dataHash,
    sceneDoc: `批次号：${batchId}  数据校验码：${dataHash}\n\n` + sceneDoc,
    sideMarkdown: `<!-- 批次号：${batchId}  数据校验码：${dataHash} -->\n\n` + sideMarkdown,
    csvContent,
    csvRows,
  };
};

export const downloadText = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const triggerExportAll = (
  annotations: Annotation[],
  trails: AuditTrail[],
  operator?: string,
) => {
  const exp = buildUnifiedExport(annotations, trails, operator);
  downloadText(`${exp.batchId}-场景标注.txt`, exp.sceneDoc, 'text/plain;charset=utf-8');
  setTimeout(() => {
    downloadText(`${exp.batchId}-侧边说明.md`, exp.sideMarkdown, 'text/markdown;charset=utf-8');
  }, 150);
  setTimeout(() => {
    downloadText(`${exp.batchId}-明细.csv`, '\ufeff' + exp.csvContent, 'text/csv;charset=utf-8');
  }, 300);
  return exp;
};
