import { loadConfig, validateConfig } from './config.js';
import { discoverPackages } from './packages.js';
import { scanSourceFiles } from './files.js';
import { buildDependencyGraph, detectCycles } from './graph.js';
import { validateBoundaryRules, generateFixSuggestions } from './rules.js';
import { generateReport } from './report.js';
import ora from 'ora';

export async function runAnalysis(options = {}) {
  const spinner = ora('加载配置...').start();

  try {
    const config = await loadConfig(options.config);
    
    const configValidation = validateConfig(config);
    if (!configValidation.valid) {
      spinner.fail('配置验证失败');
      return {
        success: false,
        errors: configValidation.errors,
      };
    }

    spinner.text = '发现包...';
    const packages = await discoverPackages(config);
    
    if (packages.length === 0) {
      spinner.warn('未发现任何包，请检查配置中的 packages 模式');
      return {
        success: false,
        warnings: ['未发现任何包'],
        reports: {},
      };
    }

    spinner.text = `扫描源文件 (${packages.length} 个包)...`;
    const files = await scanSourceFiles(packages, config);
    
    if (files.length === 0) {
      spinner.warn('未发现任何源文件');
      return {
        success: false,
        warnings: ['未发现任何源文件'],
        reports: {},
      };
    }

    spinner.text = `构建依赖图 (${files.length} 个文件)...`;
    const graph = await buildDependencyGraph(files, packages);

    spinner.text = '检测边界违规...';
    const violations = validateBoundaryRules(graph.edges, packages, config);

    spinner.text = '检测循环依赖...';
    const cycles = detectCycles(graph.packages);

    spinner.text = '生成修复建议...';
    const violationsWithSuggestions = violations.map(v => ({
      ...v,
      suggestions: generateFixSuggestions(v),
    }));

    const result = {
      success: true,
      summary: {
        packageCount: packages.length,
        fileCount: files.length,
        dependencyCount: graph.edges.length,
        violationCount: violations.length,
        cycleCount: cycles.length,
      },
      packages: packages.map(p => ({
        name: p.name,
        path: p.relativePath,
      })),
      graph: {
        fileDependencies: graph.edges,
        packageDependencies: graph.packages.edges,
      },
      violations: violationsWithSuggestions,
      cycles,
      timestamp: new Date().toISOString(),
    };

    spinner.text = '生成报告...';
    const outputDir = options.outputDir || config.output.dir;
    const reports = await generateReport(result, config, outputDir);

    spinner.succeed('分析完成');

    return {
      ...result,
      reports,
    };
  } catch (error) {
    spinner.fail('分析失败');
    throw error;
  }
}
