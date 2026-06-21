import type { BuoyCliRecord, CliRunResult, RemarkImpact } from './types';

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

function fmtLat(lat: number): string {
  const dir = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(4)}°${dir}`;
}

function fmtLon(lon: number): string {
  const dir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lon).toFixed(4)}°${dir}`;
}

const statusLabel: Record<BuoyCliRecord['status'], string> = {
  pending: '待复核',
  reviewed: '已复核',
  anomaly: '异常',
  boundary: '边界样本',
};

function renderInputOverview(result: CliRunResult): string {
  const { stats } = result;
  return `## 一、输入文件概况

| 项目 | 数值 |
| --- | --- |
| 输入文件 | \`${stats.inputFile}\` |
| 解析总行数 | ${stats.totalRows} |
| 正常入库（含新增 + 更新） | ${stats.processed} |
| 因重复跳过 | ${stats.skippedDuplicate} |
| 因含人工备注被保护 | ${stats.skippedRemarkProtected} |
| 校验失败坏行 | ${stats.bad} |
| 运行时间 | ${fmtTime(result.runAt)} |
| CLI 版本 | ${result.cliVersion} |
`;
}

function renderBadRows(result: CliRunResult): string {
  if (result.badRows.length === 0) return '';
  const lines = result.badRows.map(b => {
    const rawPreview = Object.entries(b.raw)
      .slice(0, 4)
      .map(([k, v]) => `${k}=${v}`)
      .join(' / ');
    return `- **第 ${b.lineNumber} 行** — ${b.errors.join('；')}（原始：${rawPreview}）`;
  });
  return `
## 二、坏行清单（校验失败，未入库）

以下行因字段缺失或格式错误未进入处理流程，请核对原始日志后重新导入。

${lines.join('\n')}
`;
}

function renderSwapCandidates(result: CliRunResult): string {
  if (result.swapCandidates.length === 0) return '';
  const rows = result.swapCandidates.map(s => `| 第${s.lineNumber}行 | ${s.buoyId} | ${fmtTime(s.recordTime)} | \`${s.originalLatRaw}\` / \`${s.originalLonRaw}\` | ${fmtLat(s.originalLat)} / ${fmtLon(s.originalLon)} | ${fmtLat(s.swappedLat)} / ${fmtLon(s.swappedLon)} | ${s.reason} |`);
  return `
## 三、经纬度疑似反写（阻断放行）

以下记录经纬度格式可疑，可能存在船上写反的情况。**因存在该类疑点，本次运行不生成"可放行结论"，回放结果暂不建议用于对外沟通。**

| 来源行 | 浮标 | 时间 | 船上写法 | 当前解析 | 若互换后 | 判定依据 |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
}

function renderRemarkImpacts(impacts: RemarkImpact[]): string {
  if (impacts.length === 0) return '';

  const sections = impacts.map(imp => {
    const changeList = imp.changes.map(c => `  - **${c.field}**：\`${c.before}\` → \`${c.after}\`（${c.reason}）`).join('\n');
    return `
### ${imp.buoyId} · ${fmtTime(imp.recordTime)}

- 旧备注：\`${imp.oldRemark || '（空）'}\`
- 新备注：\`${imp.newRemark}\`
${changeList}
`;
  });

  return `
## 四、备注变更影响分析

本次运行中，有 **${impacts.length}** 条记录因人工备注追加/变更，导致后续判断发生变化。具体如下：

${sections.join('\n')}
`;
}

function renderNewAndUpdated(result: CliRunResult): string {
  const total = result.newRecords.length + result.updatedRecords.length;
  if (total === 0) {
    return `
## 五、时序回放入库摘要

本次无新增或更新记录。
`;
  }

  const newList = result.newRecords.map(r =>
    `| ${r.buoyId} | ${fmtTime(r.recordTime)} | ${fmtLat(r.latitude)} / ${fmtLon(r.longitude)} | 海况${r.seaState}级 / 波高${r.waveHeight}m / 风速${r.windSpeed}m/s | ${statusLabel[r.status]} | ${r.manualRemark ?? '—'} |`,
  );
  const updList = result.updatedRecords.map(r =>
    `| ${r.buoyId} | ${fmtTime(r.recordTime)} | ${fmtLat(r.latitude)} / ${fmtLon(r.longitude)} | 海况${r.seaState}级 / 波高${r.waveHeight}m / 风速${r.windSpeed}m/s | ${statusLabel[r.status]} | ${r.manualRemark ?? '—'} |`,
  );

  return `
## 五、时序回放入库摘要

本次共入库 **${total}** 条（新增 ${result.newRecords.length} 条 / 更新 ${result.updatedRecords.length} 条）。

### 新增记录

| 浮标 | 时间 | 位置 | 海况指标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
${newList.length > 0 ? newList.join('\n') : '| _（无新增）_ | | | | | |'}

### 更新记录

| 浮标 | 时间 | 位置 | 海况指标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
${updList.length > 0 ? updList.join('\n') : '| _（无更新）_ | | | | | |'}
`;
}

function renderSkippedRemarkProtected(records: BuoyCliRecord[]): string {
  if (records.length === 0) return '';
  const lines = records.map(r =>
    `- **${r.buoyId} · ${fmtTime(r.recordTime)}**：已有备注"${r.manualRemark}"，本次跳过以保留人工判断`,
  );
  return `
## 六、备注保护跳过清单

以下记录因已含人工备注，本次重复导入未覆盖，确保值班员的判断不被日志覆盖。

${lines.join('\n')}
`;
}

function renderRelease(result: CliRunResult): string {
  const blockLines = result.blockingReasons.length > 0
    ? result.blockingReasons.map(r => `  - ${r}`).join('\n')
    : '  - _无_';
  const canReleaseText = result.canRelease
    ? '✅ **可放行**：本次处理结果可用于复盘沟通和对外说明。'
    : '🚫 **暂不可放行**：存在阻断因素，以下结果不得用于对外沟通，请先处理疑点后重跑。';

  const needConfirm: string[] = [];
  if (result.swapCandidates.length > 0) needConfirm.push(`确认 ${result.swapCandidates.length} 条经纬度疑似反写记录的真实位置`);
  if (result.badRows.length > 0) needConfirm.push(`补录或修正 ${result.badRows.length} 条坏行数据`);
  if (result.remarkImpacts.length > 0) needConfirm.push(`确认 ${result.remarkImpacts.length} 条备注变更对判断的影响是否符合预期`);
  const confirmList = needConfirm.length > 0 ? needConfirm.map(x => `- ${x}`).join('\n') : '- 无';

  const blockedReplayIds = result.swapCandidates.map(s => `${s.buoyId}@${fmtTime(s.recordTime)}`);
  const blockedText = blockedReplayIds.length > 0
    ? blockedReplayIds.map(id => `  - ${id}`).join('\n')
    : '  - _无_';

  return `
## 七、可放行结论与人工确认项

${canReleaseText}

**阻断因素：**
${blockLines}

**以下回放结果暂不可用于沟通：**
${blockedText}

**需要人工确认的内容：**
${confirmList}
`;
}

export function generateMarkdownReport(result: CliRunResult): string {
  const title = `# 浮标海况日志处理报告\n\n_生成于 ${fmtTime(result.runAt)}_\n`;
  const parts = [
    title,
    renderInputOverview(result),
    renderBadRows(result),
    renderSwapCandidates(result),
    renderRemarkImpacts(result.remarkImpacts),
    renderNewAndUpdated(result),
    renderSkippedRemarkProtected(result.skippedRemarkProtectedRecords),
    renderRelease(result),
  ];
  return parts.filter(Boolean).join('\n') + '\n';
}
