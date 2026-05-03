import path from 'path';
import { ConfigParser } from '../config/index.js';
import { ValidationManager } from '../validators/index.js';
import { ManifestGenerator } from '../manifest/index.js';
import { ReportGenerator } from '../reporters/index.js';

export class IspAuditor {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.outputDir = options.outputDir || path.join(this.baseDir, 'audit_output');
    this.verbose = options.verbose || false;
  }

  async audit(releasePolicyPath) {
    const policyDir = path.dirname(path.resolve(this.baseDir, releasePolicyPath));
    this.baseDir = policyDir;

    const parser = new ConfigParser(this.baseDir);
    
    console.log('📂 正在解析配置文件...');
    const configData = await parser.parseAll(path.basename(releasePolicyPath));
    
    console.log('✅ 配置文件解析完成');
    console.log(`   - 相机配置: ${configData.cameraProfiles ? '已加载' : '未找到'}`);
    console.log(`   - 传感器模式: ${configData.sensorModes.length} 个`);
    console.log(`   - 标定文件: ${configData.calibrationFiles.length} 个`);

    console.log('\n🔍 开始执行校验...');
    const validationManager = new ValidationManager();
    const validationResult = validationManager.validate(configData);

    console.log('✅ 校验完成');
    console.log(`   - 状态: ${validationResult.valid ? '通过' : '失败'}`);
    console.log(`   - 错误: ${validationResult.totalErrors}`);
    console.log(`   - 警告: ${validationResult.totalWarnings}`);

    console.log('\n📋 生成包清单...');
    const manifestGenerator = new ManifestGenerator(this.baseDir);
    const manifest = manifestGenerator.generate(configData, validationResult);
    console.log('✅ 包清单生成完成');

    console.log('\n📄 生成报告文件...');
    const reportGenerator = new ReportGenerator(this.outputDir);
    const reportPaths = await reportGenerator.generateAll(
      configData,
      validationResult,
      manifest
    );
    console.log('✅ 报告文件生成完成');
    console.log(`   - Markdown 报告: ${reportPaths.markdownPath}`);
    console.log(`   - 违规记录 CSV: ${reportPaths.csvPath}`);
    console.log(`   - 包清单 JSON: ${reportPaths.manifestPath}`);

    console.log('\n' + '='.repeat(50));
    console.log('审计汇总');
    console.log('='.repeat(50));
    
    const health = manifest.package_health;
    console.log(`\n健康状态: ${health.status} (${health.score}/100)`);
    console.log(`状态说明: ${health.reason}`);

    if (!validationResult.valid) {
      console.log('\n⚠️  存在必须修复的错误，无法通过预检');
      process.exitCode = 1;
    } else if (validationResult.totalWarnings > 0) {
      console.log('\n⚠️  存在警告建议检查，但可以继续发布流程');
    } else {
      console.log('\n✅ 所有检查通过，可以安全发布');
    }

    return {
      valid: validationResult.valid,
      validationResult,
      manifest,
      reportPaths
    };
  }
}
