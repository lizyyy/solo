const fs = require('fs');
const path = require('path');
const { getLedger, getChangeOrder, DATA_DIR } = require('./models');
const { formatDate, statusIcon } = require('./history');

function escapeMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`');
}

function generateMarkdown(ledger, changeOrder) {
  let md = '# 批量图片重命名 - 运行账本\n\n';
  md += `导出时间: ${formatDate(new Date().toISOString())}\n\n`;

  if (changeOrder) {
    md += '## 当前变更单\n\n';
    md += `| 字段 | 值 |\n`;
    md += `| --- | --- |\n`;
    md += `| 变更单ID | ${escapeMarkdown(changeOrder.id)} |\n`;
    md += `| 批次名称 | ${escapeMarkdown(changeOrder.batchName)} |\n`;
    md += `| 导入时间 | ${formatDate(changeOrder.importedAt)} |\n`;
    md += `| 状态 | ${changeOrder.status} |\n`;
    md += `| 条目总数 | ${changeOrder.items.length} |\n\n`;

    md += '### 变更单条目\n\n';
    md += '| 序号 | 原始文件名 | 目标文件名 | 当前状态 | 备注 |\n';
    md += '| --- | --- | --- | --- | --- |\n';
    changeOrder.items.forEach(item => {
      const lastHistory = item.history[item.history.length - 1];
      const detail = lastHistory ? (lastHistory.detail || lastHistory.error || '') : '';
      md += `| ${item.seq} | ${escapeMarkdown(item.originalName)} | ${escapeMarkdown(item.newName)} | ${statusIcon(item.status)} ${item.status} | ${escapeMarkdown(item.note || detail)} |\n`;
    });
    md += '\n';
  }

  md += '## 运行历史\n\n';

  if (!ledger.runs || ledger.runs.length === 0) {
    md += '暂无运行记录\n\n';
  } else {
    md += `共 ${ledger.runs.length} 次运行\n\n`;

    ledger.runs.forEach((run, runIdx) => {
      md += `### 运行 #${runIdx + 1} - ${run.id}\n\n`;
      md += `| 字段 | 值 |\n`;
      md += `| --- | --- |\n`;
      md += `| 运行ID | ${escapeMarkdown(run.id)} |\n`;
      md += `| 变更单 | ${escapeMarkdown(run.changeOrderId)} |\n`;
      md += `| 操作人 | ${escapeMarkdown(run.operator)} |\n`;
      md += `| 状态 | ${statusIcon(run.status)} ${run.status} |\n`;
      md += `| 开始时间 | ${formatDate(run.startedAt)} |\n`;
      md += `| 结束时间 | ${formatDate(run.completedAt)} |\n`;
      if (run.status === 'rolled_back') {
        md += `| 回滚时间 | ${formatDate(run.rolledBackAt)} |\n`;
      }
      md += `| 总计 | ${run.summary.total} |\n`;
      md += `| 成功 | ${run.summary.success} |\n`;
      md += `| 失败 | ${run.summary.failed} |\n`;
      md += `| 跳过 | ${run.summary.skipped} |\n\n`;

      if (run.rollbackSummary) {
        md += '#### 回滚统计\n\n';
        md += `| 总计 | 成功 | 失败 |\n`;
        md += `| --- | --- | --- |\n`;
        md += `| ${run.rollbackSummary.total} | ${run.rollbackSummary.success} | ${run.rollbackSummary.failed} |\n\n`;
      }

      md += '#### 执行详情\n\n';
      md += '| 序号 | 状态 | 原始文件名 | 目标文件名 | 完成时间 | 备注/错误 |\n';
      md += '| --- | --- | --- | --- | --- | --- |\n';
      run.items.forEach((item, idx) => {
        const remark = item.error
          ? `❌ ${item.error}`
          : (item.rollbackInfo
              ? (item.rollbackInfo.success
                  ? `↩️ ${item.rollbackInfo.detail}`
                  : `❌ 回滚失败: ${item.rollbackInfo.error}`)
              : '');
        md += `| ${idx + 1} | ${statusIcon(item.status)} ${item.status} | ${escapeMarkdown(item.originalName)} | ${escapeMarkdown(item.newName)} | ${formatDate(item.completedAt)} | ${escapeMarkdown(remark)} |\n`;
      });
      md += '\n';

      if (changeOrder && changeOrder.id === run.changeOrderId) {
        md += '#### 条目状态历史\n\n';
        run.items.forEach(runItem => {
          const coItem = changeOrder.items.find(i => i.id === runItem.itemId);
          if (coItem && coItem.history && coItem.history.length > 1) {
            md += `##### #${coItem.seq} ${escapeMarkdown(coItem.originalName)} → ${escapeMarkdown(coItem.newName)}\n\n`;
            coItem.history.forEach((h, hIdx) => {
              const error = h.error ? ` ❌ ${h.error}` : '';
              md += `${hIdx + 1}. ${formatDate(h.timestamp)} | ${statusIcon(h.status)} ${h.status} | ${h.detail}${error}\n`;
            });
            md += '\n';
          }
        });
      }

      md += '---\n\n';
    });
  }

  return md;
}

function generateJson(ledger, changeOrder) {
  const exportData = {
    exportedAt: new Date().toISOString(),
    tool: 'batch-image-renamer',
    version: '1.0.0',
    currentChangeOrder: changeOrder,
    ledger: ledger
  };
  return JSON.stringify(exportData, null, 2);
}

async function exportFormat(format) {
  const ledger = getLedger();
  const changeOrder = getChangeOrder();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let fileName, content;

  if (format === 'md' || format === 'markdown') {
    fileName = `ledger-${timestamp}.md`;
    content = generateMarkdown(ledger, changeOrder);
  } else if (format === 'json') {
    fileName = `ledger-${timestamp}.json`;
    content = generateJson(ledger, changeOrder);
  } else {
    throw new Error(`不支持的导出格式: ${format}，仅支持 json 或 md`);
  }

  const exportPath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(exportPath, content, 'utf8');

  console.log(`\n✅ 导出成功`);
  console.log(`  格式: ${format.toUpperCase()}`);
  console.log(`  文件: ${exportPath}`);
  console.log(`  包含: ${ledger.runs ? ledger.runs.length : 0} 条运行记录`);
  if (changeOrder) {
    console.log(`  变更单: ${changeOrder.id} (${changeOrder.items.length} 条)`);
  }

  if (format === 'json') {
    const mdFileName = `ledger-${timestamp}.md`;
    const mdPath = path.join(DATA_DIR, mdFileName);
    const mdContent = generateMarkdown(ledger, changeOrder);
    fs.writeFileSync(mdPath, mdContent, 'utf8');
    console.log(`\nℹ️  同时导出 Markdown 版本以便查看:`);
    console.log(`  文件: ${mdPath}`);
  }

  return exportPath;
}

module.exports = {
  export: exportFormat,
  generateMarkdown,
  generateJson
};
