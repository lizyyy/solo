import * as path from 'path';
import { StorageService } from './storage';
import { CheckEngine } from './checkEngine';
import { createSample, createMaterial, readJsonFile, writeJsonFile } from '../utils/helpers';
import { Sample, Material, MaterialType } from '../types';
import { defaultCountryRules, getMaterialTypeName, getSampleTypeName, getStatusName } from '../data/countryRules';
import chalk from 'chalk';
import { format } from 'date-fns';

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data');

export class CLIHandler {
  private storage: StorageService;
  private engine: CheckEngine;
  private dataDir: string;

  constructor(customDataDir?: string) {
    this.dataDir = customDataDir || DEFAULT_DATA_DIR;
    this.storage = new StorageService(this.dataDir);
    this.engine = new CheckEngine();
    
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    const existingRules = this.storage.getAllRules();
    if (existingRules.length === 0) {
      defaultCountryRules.forEach(rule => {
        this.storage.saveRule(rule);
      });
    }
  }

  init(force: boolean = false): void {
    console.log(chalk.blue.bold('\n=== 跨境样品清关材料检查 CLI 初始化 ===\n'));
    
    if (force) {
      console.log(chalk.yellow('强制重新初始化...'));
    }

    const samplesDir = path.join(this.dataDir, 'samples');
    const existingSamples = this.storage.getAllSamples();
    
    if (existingSamples.length > 0 && !force) {
      console.log(chalk.yellow('发现已有数据，跳过示例创建。使用 --force 强制重新初始化。'));
      this.printInitSummary();
      return;
    }

    const exampleSamples = this.createExampleSamples();
    exampleSamples.forEach(sample => {
      this.storage.saveSample(sample);
    });

    defaultCountryRules.forEach(rule => {
      this.storage.saveRule(rule);
      this.engine.addOrUpdateRule(rule);
    });

    this.printInitSummary();
  }

  private createExampleSamples(): Sample[] {
    const now = new Date().toISOString();
    
    return [
      {
        id: 'sample-complete-001',
        name: '完整样品-电子产品',
        type: 'electronic',
        description: '蓝牙耳机样品，用于客户测试',
        originCountry: 'CN',
        destinationCountry: 'US',
        value: 150,
        currency: 'USD',
        quantity: 2,
        materials: [
          createMaterial({
            type: 'invoice',
            name: '商业发票_电子产品.pdf',
            filePath: 'docs/invoice_electronic.pdf',
            valid: true,
            notes: '包含完整的HS编码、价值、原产地信息'
          }),
          createMaterial({
            type: 'composition',
            name: '成分说明_电子产品.pdf',
            filePath: 'docs/composition_electronic.pdf',
            valid: true,
            notes: '详细列出了塑料、电子元件等成分'
          }),
          createMaterial({
            type: 'declaration',
            name: '用途声明_电子产品.pdf',
            filePath: 'docs/declaration_electronic.pdf',
            valid: true,
            notes: '明确标注为样品，无商业价值'
          })
        ],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'sample-missing-002',
        name: '缺失材料样品-纺织品',
        type: 'textile',
        description: '服装面料样品',
        originCountry: 'CN',
        destinationCountry: 'EU',
        value: 80,
        currency: 'EUR',
        quantity: 5,
        materials: [
          createMaterial({
            type: 'invoice',
            name: '商业发票_纺织品.pdf',
            filePath: 'docs/invoice_textile.pdf',
            valid: true,
            notes: '商业发票已提供'
          })
        ],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'sample-invalid-003',
        name: '无效材料样品-化工品',
        type: 'chemical',
        description: '化妆品原料样品',
        originCountry: 'CN',
        destinationCountry: 'JP',
        value: 5000,
        currency: 'JPY',
        quantity: 1,
        materials: [
          createMaterial({
            type: 'invoice',
            name: '商业发票_化工品.pdf',
            filePath: 'docs/invoice_chemical.pdf',
            valid: true
          }),
          createMaterial({
            type: 'composition',
            name: '成分说明_化工品.pdf',
            filePath: 'docs/composition_chemical.pdf',
            valid: false,
            notes: '成分说明中缺少详细的化学物质信息'
          }),
          createMaterial({
            type: 'declaration',
            name: '用途声明_化工品.pdf',
            filePath: 'docs/declaration_chemical.pdf',
            valid: true
          })
        ],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'sample-highvalue-004',
        name: '高价值样品-医疗用品',
        type: 'medical',
        description: '医疗诊断设备样品',
        originCountry: 'CN',
        destinationCountry: 'US',
        value: 3500,
        currency: 'USD',
        quantity: 1,
        materials: [
          createMaterial({
            type: 'invoice',
            name: '商业发票_医疗.pdf',
            filePath: 'docs/invoice_medical.pdf',
            valid: true
          }),
          createMaterial({
            type: 'composition',
            name: '成分说明_医疗.pdf',
            filePath: 'docs/composition_medical.pdf',
            valid: true
          }),
          createMaterial({
            type: 'declaration',
            name: '用途声明_医疗.pdf',
            filePath: 'docs/declaration_medical.pdf',
            valid: true
          })
        ],
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  private printInitSummary(): void {
    const rules = this.storage.getAllRules();
    
    console.log(chalk.green.bold('\n✓ 初始化完成\n'));
    console.log(chalk.white('数据目录:'), this.dataDir);
    console.log(chalk.white('已加载规则:'), `${rules.length} 个国家`);
    console.log(chalk.white('可用目的国:'), rules.map(r => r.countryCode).join(', '));
    
    console.log(chalk.blue('\n=== 示例样品 ==='));
    const samples = this.storage.getAllSamples();
    samples.forEach((sample, index) => {
      const materialCount = sample.materials.filter(m => m.valid).length;
      console.log(chalk.white(`\n${index + 1}. ${sample.name}`));
      console.log(chalk.gray(`   ID: ${sample.id}`));
      console.log(chalk.gray(`   类型: ${getSampleTypeName(sample.type)}`));
      console.log(chalk.gray(`   目的国: ${sample.destinationCountry}`));
      console.log(chalk.gray(`   材料数量: ${materialCount}/3`));
    });
    
    console.log(chalk.blue('\n=== 下一步 ==='));
    console.log(chalk.white('1. 查看所有样品: '), chalk.cyan('customs-checker list'));
    console.log(chalk.white('2. 执行材料检查: '), chalk.cyan('customs-checker check <sample-id>'));
    console.log(chalk.white('3. 查看检查历史: '), chalk.cyan('customs-checker history <sample-id>'));
    console.log();
  }

  list(): void {
    const samples = this.storage.getAllSamples();
    
    console.log(chalk.blue.bold('\n=== 样品列表 ===\n'));
    
    if (samples.length === 0) {
      console.log(chalk.yellow('暂无样品数据。请先运行: customs-checker init'));
      console.log();
      return;
    }

    samples.forEach((sample, index) => {
      const validMaterials = sample.materials.filter(m => m.valid).length;
      const totalMaterials = 3;
      const status = validMaterials === totalMaterials ? chalk.green('完整') : chalk.red('不完整');
      
      console.log(chalk.white.bold(`${index + 1}. ${sample.name}`));
      console.log(chalk.gray(`   ID: ${sample.id}`));
      console.log(chalk.gray(`   类型: ${getSampleTypeName(sample.type)}`));
      console.log(chalk.gray(`   目的国: ${sample.destinationCountry}`));
      console.log(chalk.gray(`   价值: ${sample.value} ${sample.currency}`));
      console.log(chalk.gray(`   材料状态: ${validMaterials}/${totalMaterials} [${status}]`));
      
      sample.materials.forEach(material => {
        const matStatus = material.valid ? chalk.green('✓') : chalk.red('✗');
        console.log(chalk.gray(`     ${matStatus} ${getMaterialTypeName(material.type)}`));
      });
      console.log();
    });
  }

  import(filePath: string): void {
    console.log(chalk.blue.bold('\n=== 导入样品数据 ===\n'));
    
    const data = readJsonFile<any>(filePath);
    if (!data) {
      console.log(chalk.red('✗ 文件不存在或格式错误:'), filePath);
      console.log();
      return;
    }

    const samples: Sample[] = Array.isArray(data) ? data : [data];
    let imported = 0;

    samples.forEach(sampleData => {
      try {
        const sample = createSample(sampleData);
        this.storage.saveSample(sample);
        console.log(chalk.green(`✓ 已导入: ${sample.name} (${sample.id})`));
        imported++;
      } catch (error) {
        console.log(chalk.red(`✗ 导入失败: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    });

    console.log(chalk.blue.bold(`\n共导入 ${imported} 个样品\n`));
  }

  check(sampleId: string, showDetails: boolean = true): void {
    console.log(chalk.blue.bold('\n=== 清关材料检查 ===\n'));
    
    const sample = this.storage.getSample(sampleId) || this.storage.getSampleByName(sampleId);
    if (!sample) {
      console.log(chalk.red('✗ 未找到样品:'), sampleId);
      console.log(chalk.yellow('提示: 使用 customs-checker list 查看可用样品'));
      console.log();
      return;
    }

    const history = this.storage.getHistory(sample.id);
    const runNumber = history ? history.results.length + 1 : 1;

    console.log(chalk.white.bold(`样品: ${sample.name}`));
    console.log(chalk.gray(`目的国: ${sample.destinationCountry}`));
    console.log(chalk.gray(`价值: ${sample.value} ${sample.currency}`));
    console.log(chalk.gray(`检查次数: 第 ${runNumber} 次\n`));

    const result = this.engine.checkSample(sample, runNumber);
    this.storage.saveCheckResult(result);

    this.printCheckResult(result, showDetails);
  }

  private printCheckResult(result: any, showDetails: boolean): void {
    const statusColors: Record<string, typeof chalk.green> = {
      passed: chalk.green,
      failed: chalk.red,
      pending: chalk.yellow,
      manual_review: chalk.magenta
    };

    const statusColor = statusColors[result.status] || chalk.white;
    
    console.log(chalk.white.bold('检查结果:'), statusColor.bold(getStatusName(result.status)));
    console.log(chalk.gray(`检查时间: ${format(new Date(result.checkedAt), 'yyyy-MM-dd HH:mm:ss')}`));
    console.log();

    console.log(chalk.white.bold('=== 检查项目 ==='));
    result.checkItems.forEach((item: any, index: number) => {
      const icon = item.passed ? chalk.green('✓') : chalk.red('✗');
      console.log(`\n${index + 1}. ${icon} ${item.name}`);
      console.log(`   ${item.message}`);
      if (item.details && showDetails) {
        console.log(chalk.gray(`   详情: ${item.details}`));
      }
    });

    if (result.errors.length > 0) {
      console.log(chalk.red.bold('\n=== 错误信息 ==='));
      result.errors.forEach((err: string, i: number) => {
        console.log(chalk.red(`  ${i + 1}. ${err}`));
      });
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow.bold('\n=== 警告信息 ==='));
      result.warnings.forEach((warn: string, i: number) => {
        console.log(chalk.yellow(`  ${i + 1}. ${warn}`));
      });
    }

    if (result.missingMaterials.length > 0) {
      console.log(chalk.red.bold('\n=== 缺少材料 ==='));
      result.missingMaterials.forEach((type: MaterialType, i: number) => {
        console.log(chalk.red(`  ${i + 1}. ${getMaterialTypeName(type)}`));
      });
    }

    this.printStatusGuide(result.status);
    
    console.log();
  }

  private printStatusGuide(status: string): void {
    console.log(chalk.blue('\n=== 结果说明 ==='));
    
    switch (status) {
      case 'passed':
        console.log(chalk.green('✓ 通过检查'));
        console.log(chalk.white('  含义: 所有必要材料齐全且有效，样品价值在阈值范围内。'));
        console.log(chalk.white('  操作: 可以安排寄送。'));
        break;
      case 'failed':
        console.log(chalk.red('✗ 未通过检查'));
        console.log(chalk.white('  含义: 缺少必要材料或材料无效，将导致卡关。'));
        console.log(chalk.white('  操作: 请补充缺少的材料或修正无效材料后重新检查。'));
        console.log(chalk.yellow('  提示: 使用 customs-checker import 导入修正后的材料，然后 recheck。'));
        break;
      case 'manual_review':
        console.log(chalk.magenta('⚠ 需人工审核'));
        console.log(chalk.white('  含义: 材料齐全但存在警告（如价值超标、附加要求等）。'));
        console.log(chalk.white('  操作: 建议联系目的国海关或清关代理确认附加要求。'));
        break;
      default:
        console.log(chalk.yellow('? 未知状态'));
    }
  }

  history(sampleId: string, limit: number = 10): void {
    console.log(chalk.blue.bold('\n=== 检查历史 ===\n'));
    
    const sample = this.storage.getSample(sampleId) || this.storage.getSampleByName(sampleId);
    if (!sample) {
      console.log(chalk.red('✗ 未找到样品:'), sampleId);
      console.log();
      return;
    }

    const history = this.storage.getHistory(sample.id);
    if (!history || history.results.length === 0) {
      console.log(chalk.yellow('该样品暂无检查记录。'));
      console.log(chalk.white('运行: customs-checker check', sampleId));
      console.log();
      return;
    }

    const results = [...history.results].reverse().slice(0, limit);

    console.log(chalk.white.bold(`样品: ${sample.name}`));
    console.log(chalk.gray(`目的国: ${sample.destinationCountry}`));
    console.log(chalk.gray(`共 ${history.results.length} 次检查记录\n`));

    const statusColors: Record<string, string> = {
      passed: 'green',
      failed: 'red',
      pending: 'yellow',
      manual_review: 'magenta'
    };

    results.forEach((result, index) => {
      const actualIndex = history.results.length - index;
      const statusColorKey = statusColors[result.status] || 'white';
      const statusText = getStatusName(result.status);
      const dateStr = format(new Date(result.checkedAt), 'yyyy-MM-dd HH:mm:ss');
      
      console.log(chalk.white.bold(`[第${actualIndex}次检查] ${dateStr}`));
      
      let statusLine: string;
      switch (statusColorKey) {
        case 'green':
          statusLine = chalk.green(`  结果: ${statusText}`);
          break;
        case 'red':
          statusLine = chalk.red(`  结果: ${statusText}`);
          break;
        case 'yellow':
          statusLine = chalk.yellow(`  结果: ${statusText}`);
          break;
        case 'magenta':
          statusLine = chalk.magenta(`  结果: ${statusText}`);
          break;
        default:
          statusLine = chalk.white(`  结果: ${statusText}`);
      }
      console.log(statusLine);
      
      console.log(chalk.gray(`  错误: ${result.errors.length} 个`));
      console.log(chalk.gray(`  警告: ${result.warnings.length} 个`));
      if (result.missingMaterials.length > 0) {
        console.log(chalk.red(`  缺少材料: ${result.missingMaterials.map(getMaterialTypeName).join(', ')}`));
      }
      console.log();
    });
  }

  export(sampleId: string, formatType: 'json' | 'csv' = 'json'): void {
    console.log(chalk.blue.bold('\n=== 导出检查结果 ===\n'));
    
    const sample = this.storage.getSample(sampleId) || this.storage.getSampleByName(sampleId);
    if (!sample) {
      console.log(chalk.red('✗ 未找到样品:'), sampleId);
      console.log();
      return;
    }

    const history = this.storage.getHistory(sample.id);
    if (!history || history.results.length === 0) {
      console.log(chalk.yellow('该样品暂无检查记录，无法导出。'));
      console.log();
      return;
    }

    const latestResult = history.results[history.results.length - 1];
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');

    let filePath: string;
    if (formatType === 'json') {
      const exportData = {
        sample: sample,
        latestResult: latestResult,
        allHistory: history.results,
        exportTime: new Date().toISOString()
      };
      filePath = this.storage.exportToJson(
        exportData,
        `${sample.id}_result_${timestamp}.json`
      );
    } else {
      const csvData = history.results.map((r, index) => ({
        runNumber: index + 1,
        checkedAt: format(new Date(r.checkedAt), 'yyyy-MM-dd HH:mm:ss'),
        sampleName: r.sampleName,
        destinationCountry: r.destinationCountry,
        status: getStatusName(r.status),
        errorCount: r.errors.length,
        warningCount: r.warnings.length,
        missingMaterials: r.missingMaterials.map(getMaterialTypeName).join('; '),
        errors: r.errors.join('; ')
      }));
      filePath = this.storage.exportToCSV(
        csvData,
        `${sample.id}_history_${timestamp}.csv`
      );
    }

    console.log(chalk.green('✓ 导出成功!'));
    console.log(chalk.white('文件路径:'), filePath);
    console.log(chalk.white('格式:'), formatType.toUpperCase());
    console.log();
  }

  validateRules(): void {
    console.log(chalk.blue.bold('\n=== 国家规则验证 ===\n'));
    
    const validation = this.engine.validateCountryRules();
    
    if (validation.isValid) {
      console.log(chalk.green('✓ 所有国家规则配置有效\n'));
    } else {
      console.log(chalk.red('✗ 部分国家规则配置存在问题\n'));
    }

    console.log(chalk.white.bold('规则详情:'));
    validation.details.forEach((rule, index) => {
      const isValid = rule.requiredMaterials >= 3;
      const status = isValid ? chalk.green('✓') : chalk.red('✗');
      console.log(`\n${index + 1}. ${status} ${rule.countryName} (${rule.countryCode})`);
      console.log(chalk.gray(`   必需材料: ${rule.requiredMaterials} 种`));
      if (!isValid) {
        console.log(chalk.red(`   警告: 必需材料少于3种，请检查配置`));
      }
    });
    console.log();
  }

  validateMaterials(sampleId: string): void {
    console.log(chalk.blue.bold('\n=== 材料清单验证 ===\n'));
    
    const sample = this.storage.getSample(sampleId) || this.storage.getSampleByName(sampleId);
    if (!sample) {
      console.log(chalk.red('✗ 未找到样品:'), sampleId);
      console.log();
      return;
    }

    const materials = sample.materials.map(m => ({ type: m.type, valid: m.valid }));
    const validation = this.engine.validateMaterialList(materials);

    console.log(chalk.white.bold(`样品: ${sample.name}`));
    console.log(chalk.gray(`材料数量: ${sample.materials.length}\n`));

    if (validation.isValid) {
      console.log(chalk.green('✓ 材料清单格式有效'));
    } else {
      console.log(chalk.red('✗ 材料清单存在问题:'));
      validation.issues.forEach((issue, i) => {
        console.log(chalk.red(`  ${i + 1}. ${issue}`));
      });
    }
    console.log();
  }

  getDataDir(): string {
    return this.dataDir;
  }
}
