#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const config = require('./config');
const { FileScanner } = require('./scanner');
const { Validator, RULE_SEVERITY } = require('./validator');
const { Store } = require('./store');
const { Archiver } = require('./archiver');
const { Reporter } = require('./reporter');

const program = new Command();

program
  .name('photo-checker')
  .description('照片入库质检搬运工 - 博物馆藏品数字化照片管理工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化工作区目录结构')
  .option('-f, --force', '强制重新初始化')
  .action(async (options) => {
    try {
      const store = new Store();
      
      if (config.isInitialized() && !options.force) {
        console.log('⚠️  工作区已初始化，使用 --force 强制重新初始化');
        process.exit(1);
      }

      const configData = await store.initializeWorkspace();
      
      console.log('✅ 工作区初始化成功');
      console.log('   目录结构:');
      console.log('   - staging/    (暂存区 - 放置待质检的照片和清单)');
      console.log('   - archive/    (归档区 - 质检通过后的照片归档)');
      console.log('   - reports/    (报告区 - 质检报告和异常表)');
      console.log('   - logs/       (日志区 - 审计日志)');
      console.log(`   初始化时间: ${configData.initializedAt}`);
      
    } catch (error) {
      console.error('❌ 初始化失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('import <source>')
  .description('将照片从源目录导入到暂存区')
  .option('-c, --copy', '复制文件而不是移动')
  .option('-n, --dry-run', '模拟执行，不实际操作文件')
  .action(async (source, options) => {
    try {
      if (!config.isInitialized()) {
        console.error('❌ 工作区未初始化，请先运行 "photo-checker init"');
        process.exit(1);
      }

      const store = new Store();
      const scanner = new FileScanner();
      
      const stagingDir = config.DEFAULT_CONFIG.directories.staging;
      const absoluteSource = path.isAbsolute(source) ? source : path.join(process.cwd(), source);
      
      if (!(await fs.pathExists(absoluteSource))) {
        console.error(`❌ 源目录不存在: ${absoluteSource}`);
        process.exit(1);
      }

      console.log(`📂 扫描源目录: ${absoluteSource}`);
      
      const sourcePhotos = await scanner.scanPhotos(absoluteSource);
      
      if (sourcePhotos.length === 0) {
        console.log('⚠️  源目录中未找到照片文件');
        return;
      }

      console.log(`🔍 发现 ${sourcePhotos.length} 个照片文件`);

      if (options.dryRun) {
        console.log('\n📋 模拟执行 - 将导入以下文件:');
        for (const photo of sourcePhotos) {
          console.log(`   - ${photo.name}`);
        }
        console.log(`\n总计: ${sourcePhotos.length} 个文件`);
        return;
      }

      const absoluteStaging = path.join(process.cwd(), stagingDir);
      let imported = 0;
      let skipped = 0;

      for (const photo of sourcePhotos) {
        const sourcePath = path.join(absoluteSource, photo.name);
        const destPath = path.join(absoluteStaging, photo.name);

        if (await fs.pathExists(destPath)) {
          console.log(`⚠️  跳过已存在的文件: ${photo.name}`);
          skipped++;
          continue;
        }

        if (options.copy) {
          await fs.copy(sourcePath, destPath);
          console.log(`✅ 已复制: ${photo.name}`);
        } else {
          await fs.move(sourcePath, destPath);
          console.log(`✅ 已移动: ${photo.name}`);
        }
        imported++;
      }

      await store.recordImport({
        source: absoluteSource,
        photos: sourcePhotos.slice(0, imported)
      });

      console.log(`\n📊 导入完成:`);
      console.log(`   成功导入: ${imported}`);
      console.log(`   跳过: ${skipped}`);
      console.log(`   目标目录: ${absoluteStaging}`);

    } catch (error) {
      console.error('❌ 导入失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('校验暂存区的照片、清单和藏品目录')
  .option('-s, --save-report', '保存质检报告到 reports 目录')
  .option('-v, --verbose', '显示详细验证结果')
  .action(async (options) => {
    try {
      if (!config.isInitialized()) {
        console.error('❌ 工作区未初始化，请先运行 "photo-checker init"');
        process.exit(1);
      }

      const scanner = new FileScanner();
      const validator = new Validator();
      const store = new Store();
      const reporter = new Reporter();

      console.log('🔍 扫描暂存区...');
      const scanResult = await scanner.scanStagingArea();
      
      console.log(`📊 扫描结果:`);
      console.log(`   照片数量: ${scanResult.photos.length}`);
      console.log(`   拍摄清单: ${scanResult.shootingList ? `${scanResult.shootingList.length} 条记录` : '未找到'}`);
      console.log(`   藏品目录: ${scanResult.collectionCatalog ? `${scanResult.collectionCatalog.items?.length || 0} 个藏品` : '未找到'}`);
      console.log('');

      if (scanResult.photos.length === 0) {
        console.log('⚠️  暂存区没有照片文件');
        return;
      }

      console.log('✅ 开始验证...');
      const validationResult = await validator.validateAll(scanResult);
      
      console.log('');
      console.log('📋 验证结果摘要:');
      console.log(`   总验证项: ${validationResult.total}`);
      console.log(`   ✅ 通过: ${validationResult.passed}`);
      console.log(`   ❌ 错误: ${validationResult.errors}`);
      console.log(`   ⚠️  警告: ${validationResult.warnings}`);
      console.log(`   整体状态: ${validationResult.isValid ? '✅ 通过' : '❌ 失败'}`);

      if (options.verbose || !validationResult.isValid) {
        console.log('');
        console.log('--- 详细结果 ---');
        
        const errors = validationResult.results.filter(
          r => !r.passed && r.severity === RULE_SEVERITY.ERROR
        );
        const warnings = validationResult.results.filter(
          r => !r.passed && r.severity === RULE_SEVERITY.WARNING
        );

        if (errors.length > 0) {
          console.log('\n❌ 错误:');
          for (const result of errors) {
            console.log(`   - [${result.rule}] ${result.message}`);
          }
        }

        if (warnings.length > 0) {
          console.log('\n⚠️  警告:');
          for (const result of warnings) {
            console.log(`   - [${result.rule}] ${result.message}`);
          }
        }
      }

      await store.saveLastCheckReport({
        scanResult,
        validationResult,
        checkedAt: new Date().toISOString()
      });

      if (options.saveReport) {
        const reportPaths = await reporter.saveReport(validationResult, scanResult);
        console.log('');
        console.log('📄 报告已保存:');
        if (reportPaths.markdown) {
          console.log(`   - Markdown: ${reportPaths.markdown}`);
        }
        if (reportPaths.csv) {
          console.log(`   - CSV异常表: ${reportPaths.csv}`);
        }
      }

      if (!validationResult.isValid) {
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ 校验失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('commit')
  .description('将校验通过的照片归档到归档区')
  .option('-n, --dry-run', '模拟执行，不实际移动文件')
  .option('-f, --force', '强制归档，忽略验证错误')
  .option('-s, --save-report', '保存归档报告')
  .action(async (options) => {
    try {
      if (!config.isInitialized()) {
        console.error('❌ 工作区未初始化，请先运行 "photo-checker init"');
        process.exit(1);
      }

      const store = new Store();
      const scanner = new FileScanner();
      const validator = new Validator();
      const archiver = new Archiver();
      const reporter = new Reporter();

      const lastCheck = await store.loadLastCheckReport();
      
      let scanResult, validationResult;

      if (lastCheck) {
        console.log('📋 使用上次校验结果');
        scanResult = lastCheck.scanResult;
        validationResult = lastCheck.validationResult;
      } else {
        console.log('🔍 未找到上次校验结果，重新扫描并校验...');
        scanResult = await scanner.scanStagingArea();
        validationResult = await validator.validateAll(scanResult);
      }

      if (!validationResult.isValid && !options.force) {
        console.error('❌ 验证未通过，无法归档');
        console.error('   请先运行 "photo-checker check" 并修复所有错误');
        console.error('   或使用 --force 强制归档');
        process.exit(1);
      }

      console.log('📦 准备归档事务...');
      
      if (options.dryRun) {
        console.log('\n📋 模拟执行模式 (dry-run)');
      }

      const commitResult = await archiver.commit(scanResult, validationResult, {
        dryRun: options.dryRun,
        force: options.force
      });

      console.log('\n📊 归档结果:');
      console.log(`   事务ID: ${commitResult.transactionId}`);
      console.log(`   总文件数: ${commitResult.summary.total}`);
      console.log(`   ✅ 成功: ${commitResult.summary.successful}`);
      console.log(`   ❌ 失败: ${commitResult.summary.failed}`);
      console.log(`   ⏭️ 跳过: ${commitResult.summary.skipped}`);

      if (commitResult.validation.issues.length > 0) {
        console.log('\n⚠️  归档期间的问题:');
        for (const issue of commitResult.validation.issues) {
          console.log(`   - [${issue.type}] ${issue.message}`);
        }
      }

      if (options.saveReport) {
        const reportPaths = await reporter.saveArchiveReport(commitResult);
        console.log('');
        console.log('📄 归档报告已保存:');
        console.log(`   - Markdown: ${reportPaths.markdown}`);
      }

      if (commitResult.summary.failed > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ 归档失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成或查看质检报告')
  .option('-t, --type <type>', '报告类型: check/archive/both', 'both')
  .option('-o, --output <path>', '输出目录')
  .option('-l, --last', '显示上次校验结果摘要')
  .action(async (options) => {
    try {
      if (!config.isInitialized()) {
        console.error('❌ 工作区未初始化，请先运行 "photo-checker init"');
        process.exit(1);
      }

      const store = new Store();
      const reporter = new Reporter();

      if (options.last) {
        const lastCheck = await store.loadLastCheckReport();
        
        if (!lastCheck) {
          console.log('⚠️  未找到上次校验记录');
          return;
        }

        console.log('📋 上次校验结果摘要:');
        console.log(`   校验时间: ${lastCheck.checkedAt}`);
        console.log(`   照片数量: ${lastCheck.scanResult?.photos?.length || 0}`);
        console.log(`   整体状态: ${lastCheck.validationResult?.isValid ? '✅ 通过' : '❌ 失败'}`);
        console.log(`   错误数: ${lastCheck.validationResult?.errors || 0}`);
        console.log(`   警告数: ${lastCheck.validationResult?.warnings || 0}`);
        return;
      }

      const lastCheck = await store.loadLastCheckReport();
      
      if (!lastCheck) {
        console.log('⚠️  未找到校验记录，请先运行 "photo-checker check"');
        return;
      }

      const reportPaths = await reporter.saveReport(
        lastCheck.validationResult,
        lastCheck.scanResult,
        {
          format: options.type === 'both' ? 'both' : options.type === 'check' ? 'markdown' : 'csv'
        }
      );

      console.log('📄 报告已生成:');
      if (reportPaths.markdown) {
        console.log(`   - Markdown报告: ${reportPaths.markdown}`);
      }
      if (reportPaths.csv && reportPaths.csv !== '无错误，未生成CSV') {
        console.log(`   - CSV异常表: ${reportPaths.csv}`);
      }

    } catch (error) {
      console.error('❌ 生成报告失败:', error.message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
