const chalk = require('chalk');
const { table } = require('table');

class ReportGenerator {
  printSummary(result) {
    console.log('\n' + chalk.bold.blue('═══════════════════════════════════════════════════════'));
    console.log(chalk.bold.blue('              OpenAPI 权限矩阵生成报告'));
    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════\n'));
    
    console.log(chalk.bold('📊 统计摘要'));
    console.log(`   总接口数: ${chalk.green(result.summary.totalEndpoints)}`);
    console.log(`   总角色数: ${chalk.green(result.summary.totalRoles)}`);
    console.log(`   鉴权覆盖率: ${chalk.yellow(result.matrix.stats.authCoverage + '%')}`);
    console.log(`   已鉴权接口: ${chalk.green(result.matrix.stats.endpointsWithAuth)}`);
    console.log(`   公开接口: ${chalk.red(result.matrix.stats.endpointsWithoutAuth)}`);
    
    console.log(`\n${chalk.bold('⚠️ 缺失项检测')}`);
    console.log(`   缺失项数: ${result.missing.length > 0 ? chalk.red(result.missing.length) : chalk.green(0)}`);
    console.log(`   解析错误: ${result.errors.length > 0 ? chalk.red(result.errors.length) : chalk.green(0)}`);
    console.log(`   重复接口: ${result.duplicates.length > 0 ? chalk.yellow(result.duplicates.length) : chalk.green(0)}`);
    
    if (result.roles.length > 0) {
      console.log(`\n${chalk.bold('👥 角色统计')}`);
      for (const role of result.roles) {
        const stats = result.matrix.stats.roleStats[role.name];
        console.log(`   ${chalk.cyan(role.name.padEnd(20))}: ${stats.total} 个接口 (${stats.percentage}%)`);
      }
    }
    
    if (result.missing.length > 0) {
      console.log(`\n${chalk.bold.red('❌ 缺失项详情')}`);
      const grouped = {};
      for (const item of result.missing) {
        if (!grouped[item.type]) {
          grouped[item.type] = [];
        }
        grouped[item.type].push(item);
      }
      
      for (const [type, items] of Object.entries(grouped)) {
        console.log(`\n   ${chalk.yellow(type)} (${items.length}):`);
        for (let i = 0; i < Math.min(items.length, 5); i++) {
          const item = items[i];
          console.log(`     - ${item.endpoint.method} ${item.endpoint.path}`);
          console.log(`       ${chalk.gray('来源: ' + item.source.file)}`);
        }
        if (items.length > 5) {
          console.log(`       ... 还有 ${items.length - 5} 项`);
        }
      }
    }
    
    if (result.duplicates.length > 0) {
      console.log(`\n${chalk.bold.yellow('🔄 重复接口(已去重)')}`);
      console.log(`   去重口径: ${chalk.gray('按 [method + path] 组合去重，保留首次出现的定义')}`);
      for (let i = 0; i < Math.min(result.duplicates.length, 3); i++) {
        const dup = result.duplicates[i];
        console.log(`   - ${dup.endpoint.method} ${dup.endpoint.path}`);
        console.log(`     首次: ${chalk.gray(dup.firstSource.file)}`);
        console.log(`     重复: ${chalk.gray(dup.duplicateSource.file)}`);
      }
      if (result.duplicates.length > 3) {
        console.log(`   ... 还有 ${result.duplicates.length - 3} 项重复`);
      }
    }
    
    if (result.errors.length > 0) {
      console.log(`\n${chalk.bold.red('❌ 解析错误')}`);
      for (const error of result.errors) {
        console.log(`   - ${error.message}`);
        console.log(`     ${chalk.gray('位置: ' + error.location)}`);
      }
    }
    
    console.log('\n' + chalk.bold.blue('═══════════════════════════════════════════════════════'));
  }

  generateMarkdown(result) {
    const lines = [];
    
    lines.push('# OpenAPI 权限矩阵报告');
    lines.push('');
    lines.push(`生成时间: ${new Date(result.generatedAt).toLocaleString('zh-CN')}`);
    lines.push('');
    
    lines.push('## 📊 统计摘要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总接口数 | ${result.summary.totalEndpoints} |`);
    lines.push(`| 总角色数 | ${result.summary.totalRoles} |`);
    lines.push(`| 鉴权覆盖率 | ${result.matrix.stats.authCoverage}% |`);
    lines.push(`| 已鉴权接口 | ${result.matrix.stats.endpointsWithAuth} |`);
    lines.push(`| 公开接口 | ${result.matrix.stats.endpointsWithoutAuth} |`);
    lines.push(`| 缺失项数 | ${result.missing.length} |`);
    lines.push(`| 解析错误 | ${result.errors.length} |`);
    lines.push(`| 重复接口 | ${result.duplicates.length} |`);
    lines.push('');
    
    if (result.roles.length > 0) {
      lines.push('## 👥 角色统计');
      lines.push('');
      lines.push('| 角色 | 接口数 | 占比 |');
      lines.push('|------|--------|------|');
      for (const role of result.roles) {
        const stats = result.matrix.stats.roleStats[role.name];
        lines.push(`| ${role.name} | ${stats.total} | ${stats.percentage}% |`);
      }
      lines.push('');
    }
    
    lines.push('## 🔐 权限矩阵');
    lines.push('');
    
    if (result.matrix.rows.length > 0) {
      const roleNames = result.matrix.roleNames;
      
      let header = '| 方法 | 路径 | 摘要 | 鉴权 |';
      let separator = '|------|------|------|------|';
      for (const role of roleNames) {
        header += ` ${role} |`;
        separator += '------|';
      }
      lines.push(header);
      lines.push(separator);
      
      for (const row of result.matrix.rows) {
        let line = `| ${row.method} | \`${row.path}\` | ${row.summary || '-'} | ${row.authRequired ? '✅' : '❌'} |`;
        for (const role of roleNames) {
          line += ` ${row.roles[role] ? '✅' : '-'} |`;
        }
        lines.push(line);
      }
    } else {
      lines.push('*暂无接口数据*');
    }
    lines.push('');
    
    if (result.missing.length > 0) {
      lines.push('## ⚠️ 缺失项详情');
      lines.push('');
      
      const grouped = {};
      for (const item of result.missing) {
        if (!grouped[item.type]) {
          grouped[item.type] = [];
        }
        grouped[item.type].push(item);
      }
      
      for (const [type, items] of Object.entries(grouped)) {
        lines.push(`### ${type} (${items.length})`);
        lines.push('');
        lines.push('| 方法 | 路径 | 说明 | 来源文件 |');
        lines.push('|------|------|------|----------|');
        for (const item of items) {
          lines.push(`| ${item.endpoint.method} | \`${item.endpoint.path}\` | ${item.message} | \`${item.source.file}\` |`);
        }
        lines.push('');
      }
    }
    
    if (result.duplicates.length > 0) {
      lines.push('## 🔄 重复接口(已去重)');
      lines.push('');
      lines.push('> 去重口径: 按 [method + path] 组合去重，保留首次出现的定义');
      lines.push('');
      lines.push('| 方法 | 路径 | 首次出现 | 重复来源 |');
      lines.push('|------|------|----------|----------|');
      for (const dup of result.duplicates) {
        lines.push(`| ${dup.endpoint.method} | \`${dup.endpoint.path}\` | \`${dup.firstSource.file}\` | \`${dup.duplicateSource.file}\` |`);
      }
      lines.push('');
    }
    
    if (result.errors.length > 0) {
      lines.push('## ❌ 解析错误');
      lines.push('');
      lines.push('| 类型 | 消息 | 位置 |');
      lines.push('|------|------|------|');
      for (const error of result.errors) {
        lines.push(`| ${error.type} | ${error.message} | \`${error.location}\` |`);
      }
      lines.push('');
    }
    
    lines.push('## 📝 说明');
    lines.push('');
    lines.push('- ✅ 表示具有该角色权限');
    lines.push('- - 表示不具有或未配置');
    lines.push('- 鉴权列: ✅ 表示需要鉴权，❌ 表示公开接口');
    lines.push('');
    lines.push(`---`);
    lines.push(`*此报告由 openapi-permission-matrix 工具自动生成*`);
    
    return lines.join('\n');
  }
}

module.exports = {
  ReportGenerator
};
