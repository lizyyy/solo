import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { CsvParser } from './parsers/csv-parser';
import { YamlParser } from './parsers/yaml-parser';
import { JsonParser } from './parsers/json-parser';
import { PemParser } from './parsers/pem-parser';
import { RulesEngine } from './rules/rules-engine';
import { ReportGenerator } from './reports/report-generator';
import {
  ValidationContext,
  ParsedCertificate,
  ValidationIssue,
  CertInventoryItem,
  TrustBundles,
  ServiceGraph,
} from './types';

const program = new Command();

program
  .name('mtls-risk-precheck')
  .description('mTLS 证书轮换风险预检 CLI 工具')
  .version('1.0.0');

program
  .command('validate')
  .description('验证证书配置并生成风险报告')
  .argument('<directory>', '包含证书配置文件的目录路径')
  .option(
    '-o, --output <output-dir>',
    '输出目录 (默认: ./output)',
    './output'
  )
  .option(
    '--expiration-warning-days <days>',
    '过期警告天数 (默认: 30)',
    '30'
  )
  .option(
    '--clock-skew-minutes <minutes>',
    '时钟偏移容忍度 (分钟) (默认: 5)',
    '5'
  )
  .option(
    '--allowed-algorithms <algorithms>',
    '允许的签名算法 (逗号分隔) (默认: sha256,sha384,sha512)',
    'sha256,sha384,sha512'
  )
  .option('--verbose', '显示详细输出', false)
  .action(async (directory: string, options: Record<string, unknown>) => {
    try {
      const configDir = path.resolve(directory);
      const outputDir = path.resolve(String(options['output']));

      console.log(`\n📋 mTLS 证书轮换风险预检`);
      console.log(`========================================`);
      console.log(`配置目录: ${configDir}`);
      console.log(`输出目录: ${outputDir}`);
      console.log(`检查时间: ${new Date().toISOString()}`);
      console.log(``);

      const expirationWarningDays = parseInt(
        String(options['expirationWarningDays']),
        10
      );
      const clockSkewMinutes = parseInt(
        String(options['clockSkewMinutes']),
        10
      );
      const allowedAlgorithms = String(options['allowedAlgorithms'])
        .split(',')
        .map((a) => a.trim());

      const validationContext: ValidationContext = {
        now: new Date(),
        clockSkewTolerance: clockSkewMinutes,
        expirationWarningDays,
        allowedAlgorithms,
        allowedKeySizes: [2048, 3072, 4096],
      };

      const files = await locateConfigFiles(configDir);

      if (options['verbose']) {
        console.log('找到的配置文件:');
        console.log(`  - cert_inventory.csv: ${files.certInventory ? '✅' : '❌'}`);
        console.log(`  - trust_bundles.yaml: ${files.trustBundles ? '✅' : '❌'}`);
        console.log(`  - service_graph.json: ${files.serviceGraph ? '✅' : '❌'}`);
        console.log(`  - certs 目录: ${files.certsDir ? '✅' : '❌'}`);
        console.log(``);
      }

      console.log('📂 解析配置文件...');
      
      const csvParser = new CsvParser();
      const yamlParser = new YamlParser();
      const jsonParser = new JsonParser();
      const pemParser = new PemParser();

      let inventory: CertInventoryItem[] = [];
      let trustBundles: TrustBundles = {};
      let serviceGraph: ServiceGraph = { services: [], relationships: [] };
      const allCertificates = new Map<string, ParsedCertificate>();

      if (files.certInventory) {
        inventory = await csvParser.parseCertInventory(files.certInventory);
        console.log(`  ✅ 解析证书清单: ${inventory.length} 个服务`);
      } else {
        console.warn('  ⚠️  未找到 cert_inventory.csv，跳过服务验证');
      }

      if (files.trustBundles) {
        trustBundles = await yamlParser.parseTrustBundles(files.trustBundles);
        console.log(`  ✅ 解析信任包: ${Object.keys(trustBundles).length} 个包`);
      }

      if (files.serviceGraph) {
        serviceGraph = await jsonParser.parseServiceGraph(files.serviceGraph);
        console.log(`  ✅ 解析服务图: ${serviceGraph.services.length} 个服务, ${serviceGraph.relationships.length} 个关系`);
      }

      if (files.certsDir) {
        const dirCerts = await pemParser.parseDirectory(files.certsDir);
        for (const [path, cert] of dirCerts) {
          allCertificates.set(path, cert);
        }
      }

      for (const bundle of Object.values(trustBundles)) {
        const bundleCerts = await pemParser.parseMultipleFiles([
          ...bundle.rootCerts,
          ...bundle.intermediateCerts,
        ]);
        for (const [path, cert] of bundleCerts) {
          allCertificates.set(path, cert);
        }
      }

      for (const item of inventory) {
        if (!allCertificates.has(item.certFilePath)) {
          try {
            const cert = await pemParser.parseCertificateFile(item.certFilePath);
            allCertificates.set(item.certFilePath, cert);
          } catch {
            console.warn(`  ⚠️  无法读取证书: ${item.certFilePath}`);
          }
        }
      }

      console.log(`  ✅ 加载证书: ${allCertificates.size} 个证书`);
      console.log(``);

      console.log('🔍 运行规则引擎验证...');
      const rulesEngine = new RulesEngine();
      const allIssues: ValidationIssue[] = [];

      for (const service of inventory) {
        const cert = allCertificates.get(service.certFilePath);
        
        if (!cert) {
          console.warn(`  ⚠️  跳过服务 ${service.serviceName}: 未找到证书`);
          continue;
        }

        if (options['verbose']) {
          console.log(`  验证服务: ${service.serviceName}`);
        }

        const issues = await rulesEngine.validateService(
          service,
          cert,
          allCertificates,
          trustBundles,
          serviceGraph,
          validationContext
        );

        if (issues.length > 0) {
          console.log(`  ❌ ${service.serviceName}: 发现 ${issues.length} 个问题`);
          allIssues.push(...issues);
        } else {
          console.log(`  ✅ ${service.serviceName}: 无问题`);
        }
      }

      console.log(``);
      console.log('📊 验证结果汇总:');
      console.log(`  总服务数: ${inventory.length}`);
      console.log(`  发现问题: ${allIssues.length}`);
      
      const criticalCount = allIssues.filter((i) => i.severity === 'critical').length;
      const highCount = allIssues.filter((i) => i.severity === 'high').length;
      const mediumCount = allIssues.filter((i) => i.severity === 'medium').length;
      const lowCount = allIssues.filter((i) => i.severity === 'low').length;

      console.log(`    - Critical: ${criticalCount}`);
      console.log(`    - High: ${highCount}`);
      console.log(`    - Medium: ${mediumCount}`);
      console.log(`    - Low: ${lowCount}`);
      console.log(``);

      console.log('📝 生成报告...');

      const reportGenerator = new ReportGenerator();

      const issuesCsvPath = path.join(outputDir, 'issues.csv');
      await reportGenerator.generateIssuesCsv(allIssues, issuesCsvPath);
      console.log(`  ✅ 问题报告: ${issuesCsvPath}`);

      const rotationPlanPath = path.join(outputDir, 'rotation_plan.md');
      await reportGenerator.generateRotationPlanMarkdown(
        allIssues,
        inventory,
        serviceGraph,
        rotationPlanPath
      );
      console.log(`  ✅ 轮换计划: ${rotationPlanPath}`);

      const trustGraph = reportGenerator.buildTrustGraph(
        inventory,
        trustBundles,
        serviceGraph,
        allCertificates
      );
      const trustGraphPath = path.join(outputDir, 'trust_graph.html');
      await reportGenerator.generateTrustGraphHtml(trustGraph, trustGraphPath);
      console.log(`  ✅ 信任关系图: ${trustGraphPath}`);

      console.log(``);
      console.log('✅ 验证完成！');
      console.log(`========================================`);
      console.log(`输出文件位于: ${outputDir}`);
      
      if (allIssues.length > 0) {
        console.log(`\n⚠️  发现 ${allIssues.length} 个问题需要处理。`);
        console.log(`请查看 rotation_plan.md 了解详细的轮换建议。`);
      }

    } catch (error) {
      console.error('\n❌ 执行错误:');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

async function locateConfigFiles(
  configDir: string
): Promise<{
  certInventory: string | null;
  trustBundles: string | null;
  serviceGraph: string | null;
  certsDir: string | null;
}> {
  const result = {
    certInventory: null as string | null,
    trustBundles: null as string | null,
    serviceGraph: null as string | null,
    certsDir: null as string | null,
  };

  const certInventoryPath = path.join(configDir, 'cert_inventory.csv');
  if (await fileExists(certInventoryPath)) {
    result.certInventory = certInventoryPath;
  }

  const trustBundlesPath = path.join(configDir, 'trust_bundles.yaml');
  if (await fileExists(trustBundlesPath)) {
    result.trustBundles = trustBundlesPath;
  } else {
    const ymlPath = path.join(configDir, 'trust_bundles.yml');
    if (await fileExists(ymlPath)) {
      result.trustBundles = ymlPath;
    }
  }

  const serviceGraphPath = path.join(configDir, 'service_graph.json');
  if (await fileExists(serviceGraphPath)) {
    result.serviceGraph = serviceGraphPath;
  }

  const certsDirPath = path.join(configDir, 'certs');
  if (await directoryExists(certsDirPath)) {
    result.certsDir = certsDirPath;
  }

  return result;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(path);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

program.parse(process.argv);
