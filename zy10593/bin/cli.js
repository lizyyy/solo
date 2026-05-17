#!/usr/bin/env node

import { BinaryDependencyScanner } from '../src/index.js';
import path from 'path';
import fs from 'fs/promises';

const args = process.argv.slice(2);

async function showHelp() {
  console.log(`
二进制依赖清单CLI

用法:
  bdep scan <目录> [选项]     扫描指定目录的二进制文件
  bdep file <文件> [选项]    分析单个二进制文件
  bdep self-test             运行自检
  bdep help                  显示帮助

选项:
  --json, -j        输出JSON格式报告
  --markdown, -m    输出Markdown格式报告
  --write, -w       写入报告文件
  --output, -o <dir>    报告输出目录
  --name, -n <name>    报告文件基础名称
  --quiet, -q       静默模式，只输出错误
`);
}

async function runScan(dirPath, options = {}) {
  const fullPath = path.resolve(dirPath);
  
  try {
    await fs.access(fullPath);
  } catch {
    console.error(`错误: 目录不存在: ${fullPath}`);
    process.exit(1);
  }

  const scanner = new BinaryDependencyScanner({
    generator: {
      outputDir: options.output || process.cwd(),
      baseName: options.name || 'binary-deps-report'
    }
  });

  if (!options.quiet) {
    console.log(`正在扫描目录: ${fullPath}`);
    console.log('');
  }

  const result = await scanner.scanDirectory(fullPath, {
    writeReports: options.write
  });

  if (!options.quiet) {
    console.log(result.reports.terminal);
  }

  if (options.json) {
    console.log(result.reports.json);
  }

  if (options.markdown && !options.write) {
    console.log(result.reports.markdown);
  }

  if (options.write && !options.quiet) {
    console.log('报告已写入:');
    console.log(`  JSON: ${path.join(options.output || process.cwd(), (options.name || 'binary-deps-report') + '.json')}`);
    console.log(`  Markdown: ${path.join(options.output || process.cwd(), (options.name || 'binary-deps-report') + '.md')}`);
  }

  if (result.reports.summary.hasMissingDependencies && !options.quiet) {
    process.exit(2);
  }
}

async function runFile(filePath, options = {}) {
  const fullPath = path.resolve(filePath);
  
  try {
    await fs.access(fullPath);
  } catch {
    console.error(`错误: 文件不存在: ${fullPath}`);
    process.exit(1);
  }

  const scanner = new BinaryDependencyScanner();

  if (!options.quiet) {
    console.log(`正在分析文件: ${fullPath}`);
    console.log('');
  }

  const result = await scanner.scanFile(fullPath);
  
  console.log(`文件: ${result.fileInfo.name}`);
  console.log(`路径: ${result.fileInfo.path}`);
  console.log(`类型: ${result.fileInfo.fileType}`);
  console.log(`架构: ${result.fileInfo.architectures.join(', ') || 'unknown'}`);
  console.log(`依赖数: ${result.parsedDeps.dependencies.length}`);
  console.log(`缺失依赖: ${result.parsedDeps.missingDependencies.length}`);
  console.log('');

  if (result.parsedDeps.dependencies.length > 0) {
    console.log('依赖列表:');
    for (const dep of result.parsedDeps.dependencies) {
      const marker = dep.exists ? '✓' : '❌';
      console.log(`  ${marker} ${dep.path}`);
    }
  }

  if (result.parsedDeps.missingDependencies.length > 0) {
    console.log('');
    console.log('缺失的依赖:');
    for (const dep of result.parsedDeps.missingDependencies) {
      console.log(`  ❌ ${dep.path}`);
      console.log(`     原因: ${dep.reason}`);
    }
    process.exit(2);
  }
}

async function runSelfTest() {
  console.log('Running self-test...');
  console.log('');
  
  let passed = 0;
  let failed = 0;
  
  const testDir = '/usr/bin';
  console.log('Test 1: Scan system directory');
  try {
    const scanner = new BinaryDependencyScanner();
    const result = await scanner.scanDirectory(testDir, { writeReports: false });
    if (result.scanStats.binariesFound > 0) {
      console.log('  ✓ PASS');
      passed++;
    } else {
      console.log('  ✗ FAIL - No binaries found');
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAIL - ${e.message}`);
    failed++;
  }
  
  console.log('');
  console.log('Test 2: Analyze a known binary');
  try {
    const scanner = new BinaryDependencyScanner();
    const result = await scanner.scanFile('/bin/ls');
    if (result.parsedDeps.dependencies.length > 0) {
      console.log('  ✓ PASS');
      passed++;
    } else {
      console.log('  ✗ FAIL - No dependencies found');
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAIL - ${e.message}`);
    failed++;
  }
  
  console.log('');
  console.log('Test 3: Generate reports');
  try {
    const scanner = new BinaryDependencyScanner();
    const result = await scanner.scanDirectory('/bin', { writeReports: false });
    if (result.reports.terminal && result.reports.json && result.reports.markdown) {
      console.log('  ✓ PASS');
      passed++;
    } else {
      console.log('  ✗ FAIL - Reports not generated correctly');
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAIL - ${e.message}`);
    failed++;
  }
  
  console.log('');
  console.log('Test 4: Write report files');
  try {
    const tempDir = process.env.TMPDIR || '/tmp';
    const scanner = new BinaryDependencyScanner({
      generator: { outputDir: tempDir, baseName: 'test-report' }
    });
    const result = await scanner.scanDirectory('/bin', { writeReports: false });
    await scanner.generator.writeReports(result.reports);
    
    const jsonExists = await fs.access(path.join(tempDir, 'test-report.json')).then(() => true).catch(() => false);
    const mdExists = await fs.access(path.join(tempDir, 'test-report.md')).then(() => true).catch(() => false);
    
    if (jsonExists && mdExists) {
      console.log('  ✓ PASS');
      passed++;
    } else {
      console.log('  ✗ FAIL - Report files not created');
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ FAIL - ${e.message}`);
    failed++;
  }
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━ Test Results ━━━━━━━━━━━━━━━━');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${passed + failed}`);
  console.log('');
  
  if (failed > 0) {
    process.exit(1);
  }
}

function parseOptions(args) {
  const options = {};
  const remaining = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json' || arg === '-j') {
      options.json = true;
    } else if (arg === '--markdown' || arg === '-m') {
      options.markdown = true;
    } else if (arg === '--write' || arg === '-w') {
      options.write = true;
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if ((arg === '--output' || arg === '-o') && i + 1 < args.length) {
      options.output = args[++i];
    } else if ((arg === '--name' || arg === '-n') && i + 1 < args.length) {
      options.name = args[++i];
    } else {
      remaining.push(arg);
    }
  }
  
  return { options, remaining };
}

async function main() {
  const { options, remaining } = parseOptions(args);
  
  if (remaining.length === 0 || remaining[0] === 'help') {
    await showHelp();
    return;
  }
  
  const command = remaining[0];
  
  try {
    switch (command) {
      case 'scan':
        if (remaining.length < 2) {
          console.error('错误: 请指定要扫描的目录');
          await showHelp();
          process.exit(1);
        }
        await runScan(remaining[1], options);
        break;
        
      case 'file':
        if (remaining.length < 2) {
          console.error('错误: 请指定要分析的文件');
          await showHelp();
          process.exit(1);
        }
        await runFile(remaining[1], options);
        break;
        
      case 'self-test':
        await runSelfTest();
        break;
        
      default:
        console.error(`错误: 未知命令 ${command}`);
        await showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('错误:', error.message);
    if (!options.quiet) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
