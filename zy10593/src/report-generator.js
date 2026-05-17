import fs from 'fs/promises';
import path from 'path';

export class ReportGenerator {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || process.cwd(),
      baseName: options.baseName || 'binary-deps-report'
    };
  }

  generate(scanResults, parsedDependencies) {
    const aggregated = this.aggregateData(scanResults, parsedDependencies);
    const summary = this.generateSummary(aggregated);
    
    return {
      summary,
      aggregated,
      terminal: this.formatTerminal(summary, aggregated),
      json: this.formatJSON(summary, aggregated),
      markdown: this.formatMarkdown(summary, aggregated)
    };
  }

  aggregateData(scanResults, parsedDependencies) {
    const aggregated = {
      scanStats: scanResults.stats,
      binaries: [],
      errors: scanResults.errors,
      byArchitecture: {},
      byFileType: {
        executable: [],
        dylib: [],
        bundle: [],
        universal: [],
        other: []
      },
      allDependencies: new Set(),
      systemDependencies: new Set(),
      missingDependencies: [],
      totalMissingCount: 0
    };

    for (const dep of parsedDependencies) {
      aggregated.binaries.push(dep);
      
      for (const d of dep.dependencies) {
        aggregated.allDependencies.add(d.path);
        if (d.isSystem) {
          aggregated.systemDependencies.add(d.path);
        }
      }

      if (dep.missingDependencies.length > 0) {
        aggregated.missingDependencies.push({
          file: dep.file,
          name: dep.name,
          missing: dep.missingDependencies
        });
        aggregated.totalMissingCount += dep.missingDependencies.length;
      }

      const fileType = dep.fileType || 'other';
      if (aggregated.byFileType[fileType]) {
        aggregated.byFileType[fileType].push(dep);
      } else {
        aggregated.byFileType.other.push(dep);
      }

      for (const arch of Object.keys(dep.byArchitecture)) {
        if (!aggregated.byArchitecture[arch]) {
          aggregated.byArchitecture[arch] = {
            binaries: [],
            dependencies: new Set(),
            missing: []
          };
        }
        aggregated.byArchitecture[arch].binaries.push(dep.file);
        
        for (const d of dep.byArchitecture[arch].dependencies) {
          aggregated.byArchitecture[arch].dependencies.add(d);
        }
        
        if (dep.byArchitecture[arch].missing?.length > 0) {
          aggregated.byArchitecture[arch].missing.push({
            file: dep.file,
            missing: dep.byArchitecture[arch].missing
          });
        }
      }
    }

    aggregated.allDependencies = Array.from(aggregated.allDependencies).sort();
    aggregated.systemDependencies = Array.from(aggregated.systemDependencies).sort();

    for (const arch of Object.keys(aggregated.byArchitecture)) {
      aggregated.byArchitecture[arch].dependencies = 
        Array.from(aggregated.byArchitecture[arch].dependencies).sort();
    }

    return aggregated;
  }

  generateSummary(aggregated) {
    const archSummary = {};
    for (const [arch, data] of Object.entries(aggregated.byArchitecture)) {
      archSummary[arch] = {
        binaryCount: data.binaries.length,
        depCount: data.dependencies.length,
        missingCount: data.missing.length
      };
    }

    return {
      timestamp: new Date().toISOString(),
      totalFiles: aggregated.scanStats.totalFiles,
      binariesFound: aggregated.scanStats.binariesFound,
      binariesParsed: aggregated.binaries.length,
      totalDependencies: aggregated.allDependencies.length,
      systemDependencies: aggregated.systemDependencies.length,
      missingDependenciesCount: aggregated.totalMissingCount,
      hasMissingDependencies: aggregated.totalMissingCount > 0,
      byFileType: {
        executable: aggregated.byFileType.executable.length,
        dylib: aggregated.byFileType.dylib.length,
        bundle: aggregated.byFileType.bundle.length,
        universal: aggregated.byFileType.universal.length,
        other: aggregated.byFileType.other.length
      },
      byArchitecture: archSummary,
      errorCount: aggregated.errors.length
    };
  }

  formatTerminal(summary, aggregated) {
    let output = [];
    
    output.push('');
    output.push('╔══════════════════════════════════════════════════════════════╗');
    output.push('║                二进制依赖清单报告                             ║');
    output.push('╚══════════════════════════════════════════════════════════════╝');
    output.push('');
    output.push(`扫描时间: ${new Date(summary.timestamp).toLocaleString()}`);
    output.push('');
    
    output.push('━━━━━━━━━━━━━━━━ 统计摘要 ━━━━━━━━━━━━━━━━');
    output.push(`  总文件数: ${summary.totalFiles}`);
    output.push(`  发现二进制: ${summary.binariesFound}`);
    output.push(`  成功解析: ${summary.binariesParsed}`);
    output.push(`  总依赖数: ${summary.totalDependencies}`);
    output.push(`  系统库依赖: ${summary.systemDependencies}`);
    output.push(`  缺失依赖: ${summary.missingDependenciesCount}`);
    output.push(`  扫描错误: ${summary.errorCount}`);
    output.push('');

    output.push('━━━━━━━━━━━━━━━━ 文件类型分布 ━━━━━━━━━━━━━━━━');
    output.push(`  可执行文件: ${summary.byFileType.executable}`);
    output.push(`  动态库: ${summary.byFileType.dylib}`);
    output.push(`  Bundle: ${summary.byFileType.bundle}`);
    output.push(`  通用二进制: ${summary.byFileType.universal}`);
    output.push(`  其他: ${summary.byFileType.other}`);
    output.push('');

    output.push('━━━━━━━━━━━━━━━━ 架构分布 ━━━━━━━━━━━━━━━━');
    for (const [arch, stats] of Object.entries(summary.byArchitecture)) {
      const flag = stats.missingCount > 0 ? ' ⚠️' : '';
      output.push(`  ${arch}: ${stats.binaryCount}个文件, ${stats.depCount}个依赖${flag}`);
    }
    output.push('');

    if (summary.hasMissingDependencies) {
      output.push('━━━━━━━━━━━━━━━━ ⚠️ 缺失依赖 ━━━━━━━━━━━━━━━━');
      for (const item of aggregated.missingDependencies) {
        output.push(`  📄 ${item.name}`);
        output.push(`     ${item.file}`);
        for (const miss of item.missing) {
          output.push(`     ❌ ${miss.path}`);
          output.push(`        原因: ${miss.reason}`);
        }
      }
      output.push('');
    }

    if (aggregated.errors.length > 0) {
      output.push('━━━━━━━━━━━━━━━━ ⚠️ 扫描错误 ━━━━━━━━━━━━━━━━');
      for (const err of aggregated.errors) {
        output.push(`  ❌ ${err.path}`);
        output.push(`     ${err.error}`);
      }
      output.push('');
    }

    output.push('━━━━━━━━━━━━━━━━ 二进制文件列表 ━━━━━━━━━━━━━━━━');
    for (const bin of aggregated.binaries.slice(0, 20)) {
      const status = bin.error ? '❌' : (bin.missingDependencies.length > 0 ? '⚠️' : '✓');
      const archs = bin.architectures.join(', ') || 'unknown';
      output.push(`  ${status} ${bin.name} [${archs}] [${bin.fileType}]`);
      output.push(`     ${bin.file}`);
    }
    if (aggregated.binaries.length > 20) {
      output.push(`  ... 还有 ${aggregated.binaries.length - 20} 个文件`);
    }
    output.push('');

    return output.join('\n');
  }

  formatJSON(summary, aggregated) {
    return JSON.stringify({
      summary,
      binaries: aggregated.binaries.map(b => ({
        file: b.file,
        name: b.name,
        fileType: b.fileType,
        architectures: b.architectures,
        dependencies: b.dependencies,
        missingDependencies: b.missingDependencies,
        rpaths: b.rpaths,
        error: b.error,
        warnings: b.warnings
      })),
      allDependencies: aggregated.allDependencies,
      systemDependencies: aggregated.systemDependencies,
      missingDependencies: aggregated.missingDependencies,
      errors: aggregated.errors,
      byArchitecture: Object.fromEntries(
        Object.entries(aggregated.byArchitecture).map(([arch, data]) => [
          arch,
          {
            binaries: data.binaries,
            dependencies: data.dependencies,
            missing: data.missing
          }
        ])
      )
    }, null, 2);
  }

  formatMarkdown(summary, aggregated) {
    const lines = [];
    
    lines.push('# 二进制依赖清单报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date(summary.timestamp).toLocaleString()}`);
    lines.push('');
    
    lines.push('## 统计摘要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总文件数 | ${summary.totalFiles} |`);
    lines.push(`| 发现二进制 | ${summary.binariesFound} |`);
    lines.push(`| 成功解析 | ${summary.binariesParsed} |`);
    lines.push(`| 总依赖数 | ${summary.totalDependencies} |`);
    lines.push(`| 系统库依赖 | ${summary.systemDependencies} |`);
    lines.push(`| 缺失依赖 | ${summary.missingDependenciesCount} |`);
    lines.push(`| 扫描错误 | ${summary.errorCount} |`);
    lines.push('');

    lines.push('## 文件类型分布');
    lines.push('');
    lines.push('| 类型 | 数量 |');
    lines.push('|------|------|');
    lines.push(`| 可执行文件 | ${summary.byFileType.executable} |');
    lines.push(`| 动态库 (dylib) | ${summary.byFileType.dylib} |');
    lines.push(`| Bundle | ${summary.byFileType.bundle} |');
    lines.push(`| 通用二进制 | ${summary.byFileType.universal} |');
    lines.push(`| 其他 | ${summary.byFileType.other} |`);
    lines.push('');

    lines.push('## 架构分布');
    lines.push('');
    lines.push('| 架构 | 文件数 | 依赖数 | 缺失 |');
    lines.push('|------|--------|--------|------|');
    for (const [arch, stats] of Object.entries(summary.byArchitecture)) {
      lines.push(`| ${arch} | ${stats.binaryCount} | ${stats.depCount} | ${stats.missingCount} |`);
    }
    lines.push('');

    if (summary.hasMissingDependencies) {
      lines.push('## ⚠️ 缺失依赖');
      lines.push('');
      for (const item of aggregated.missingDependencies) {
        lines.push(`### ${item.name}`);
        lines.push('');
        lines.push(`文件路径: \`${item.file}\``);
        lines.push('');
        lines.push('缺失的依赖:');
        lines.push('');
        for (const miss of item.missing) {
          lines.push(`- **${miss.path}**`);
          lines.push(`  - 原因: ${miss.reason}`);
        }
        lines.push('');
      }
    }

    if (aggregated.errors.length > 0) {
      lines.push('## ⚠️ 扫描错误');
      lines.push('');
      for (const err of aggregated.errors) {
        lines.push(`- **${err.path}**: ${err.error}`);
      }
      lines.push('');
    }

    lines.push('## 二进制文件详情');
    lines.push('');
    for (const bin of aggregated.binaries) {
      const status = bin.error ? '❌' : (bin.missingDependencies.length > 0 ? '⚠️' : '✓');
      lines.push(`### ${status} ${bin.name}`);
      lines.push('');
      lines.push(`- **路径**: \`${bin.file}\``);
      lines.push(`- **类型**: ${bin.fileType}`);
      lines.push(`- **架构**: ${bin.architectures.join(', ') || 'unknown'}`);
      lines.push(`- **依赖数**: ${bin.dependencies.length}`);
      lines.push(`- **缺失依赖**: ${bin.missingDependencies.length}`);
      
      if (bin.rpaths.length > 0) {
        lines.push(`- **RPaths:**`);
        for (const rp of bin.rpaths) {
          lines.push(`  - \`${rp}\``);
        }
      }
      
      if (bin.dependencies.length > 0) {
        lines.push(`- **依赖列表**: 前10个 (共${bin.dependencies.length}个)`);
        for (const d of bin.dependencies.slice(0, 10)) {
          const marker = d.exists ? '' : ' ❌';
          lines.push(`  - \`${d.path}\`${marker}`);
        }
        if (bin.dependencies.length > 10) {
          lines.push(`  - ... 还有 ${bin.dependencies.length - 10} 个更多`);
        }
      }
      
      if (bin.error) {
        lines.push(`- **错误**: ${bin.error}`);
      }
      
      lines.push('');
    }

    lines.push('## 所有系统依赖清单');
    lines.push('');
    for (const dep of aggregated.systemDependencies) {
      lines.push(`- \`${dep}\``);
    }
    lines.push('');

    return lines.join('\n');
  }

  async writeReports(reports) {
    const basePath = path.join(this.options.outputDir, this.options.baseName);
    
    await fs.writeFile(`${basePath}.json`, reports.json, 'utf8');
    await fs.writeFile(`${basePath}.md`, reports.markdown, 'utf8');
    
    return {
      jsonPath: `${basePath}.json`,
      markdownPath: `${basePath}.md`
    };
  }
}
