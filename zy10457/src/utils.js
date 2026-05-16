const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

async function cleanupOutputDir(outputDir, force) {
  try {
    await fs.access(outputDir);
    
    const files = await fs.readdir(outputDir);
    const outputFiles = ['summary.txt', 'results.json', 'report.html', 'errors.json'];
    const existingOutputFiles = files.filter(f => outputFiles.includes(f));

    if (existingOutputFiles.length > 0 && !force) {
      throw new Error(
        `输出目录已包含审计文件: ${existingOutputFiles.join(', ')}\n` +
        `使用 --force 参数覆盖，或指定其他输出目录`
      );
    }

    for (const file of existingOutputFiles) {
      await fs.unlink(path.join(outputDir, file));
    }

  } catch (e) {
    if (e.code === 'ENOENT') {
      return;
    }
    throw e;
  }
}

function handleErrors(error, strictMode) {
  console.error('\n' + chalk.red('═══════════════════════════════════════════'));
  console.error(chalk.red.bold('❌ 错误:'));
  console.error(chalk.red('═══════════════════════════════════════════'));
  
  if (error.message) {
    console.error(chalk.white(`  ${error.message}`));
  } else {
    console.error(chalk.white(`  ${error}`));
  }

  if (strictMode && error.stack) {
    console.error('\n' + chalk.gray('堆栈跟踪:'));
    console.error(chalk.gray(error.stack));
  }

  console.error(chalk.red('═══════════════════════════════════════════\n'));
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateString(str, maxLength) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

module.exports = {
  cleanupOutputDir,
  handleErrors,
  formatDate,
  truncateString,
};
