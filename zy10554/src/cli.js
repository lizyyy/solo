#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import glob from 'glob';
import { parseMultipleYamls } from './yaml-parser.js';
import { getClusterImages, getCurrentContext } from './k8s-client.js';
import { detectDrift } from './drift-detector.js';
import { 
  generateTerminalReport, 
  generateJsonReport, 
  generateMarkdownReport,
  saveReport 
} from './report-generator.js';

const program = new Command();

program
  .name('k8s-image-drift')
  .description('Kubernetes 镜像标签漂移检测工具')
  .version('1.0.0');

program
  .command('detect', { isDefault: true })
  .description('检测镜像漂移')
  .option('-m, --manifest <path...>', '部署清单文件路径 (YAML)，支持 glob')
  .option('-n, --namespace <namespace>', 'K8s 命名空间 (默认: default)', 'default')
  .option('-A, --all-namespaces', '检测所有命名空间')
  .option('-s, --strict-tag', '严格匹配镜像标签')
  .option('-g, --group-by <field>', '结果分组: namespace|kind|status|workload', 'namespace')
  .option('--kubeconfig <path>', 'kubeconfig 文件路径')
  .option('--context <name>', 'K8s context 名称')
  .option('--json <path>', '输出 JSON 报告到指定文件')
  .option('--markdown <path>', '输出 Markdown 报告到指定文件')
  .option('--only-drifted', '只显示漂移结果')
  .option('--no-color', '禁用彩色输出')
  .action(async (options) => {
    try {
      if (options.noColor) {
        process.env.FORCE_COLOR = '0';
      }
      
      const namespace = options.allNamespaces ? 'all' : options.namespace;
      
      console.log('\n🔍 开始检测镜像标签漂移...');
      console.log(`   K8s Context: ${getCurrentContext()}`);
      console.log(`   命名空间: ${namespace}`);
      console.log('');
      
      let expectedWorkloads = [];
      let parseErrors = [];
      
      if (options.manifest && options.manifest.length > 0) {
        console.log('📄 解析部署清单...');
        
        const fileContents = [];
        const patterns = options.manifest;
        
        for (const pattern of patterns) {
          const files = glob.sync(pattern, { nodir: true });
          
          for (const file of files) {
            try {
              const content = fs.readFileSync(file, 'utf8');
              fileContents.push({ filePath: file, content });
              console.log(`   ✓ ${file}`);
            } catch (err) {
              console.error(`   ✗ 读取文件失败: ${file} - ${err.message}`);
            }
          }
        }
        
        const result = parseMultipleYamls(fileContents);
        expectedWorkloads = result.workloads;
        parseErrors = result.parseErrors;
        
        console.log(`   共解析到 ${expectedWorkloads.length} 个容器镜像`);
        console.log('');
      } else {
        console.log('⚠️  未指定部署清单，将只从集群获取运行中的镜像');
        console.log('');
      }
      
      console.log('🔌 从 K8s 集群获取运行中的镜像...');
      const { clusterImages, errors: k8sErrors } = await getClusterImages({
        namespace,
        kubeconfigPath: options.kubeconfig,
        context: options.context
      });
      
      console.log(`   共获取到 ${clusterImages.length} 个运行中的容器镜像`);
      console.log('');
      
      if (expectedWorkloads.length === 0) {
        console.log('⚠️  没有指定部署清单，跳过对比，只显示集群中的镜像');
        console.log('');
        
        if (options.json) {
          const jsonContent = JSON.stringify({
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            clusterImages
          }, null, 2);
          saveReport(jsonContent, options.json);
          console.log(`📄 JSON 报告已保存: ${options.json}`);
        }
        
        process.exit(0);
      }
      
      console.log('⚖️  执行镜像对比...');
      const detectionResult = detectDrift(expectedWorkloads, clusterImages, {
        strictTagMatch: options.strictTag,
        groupBy: options.groupBy
      });
      
      console.log(`   对比完成: ${detectionResult.summary.drifted} 个漂移, ${detectionResult.summary.warning} 个警告`);
      console.log('');
      
      const terminalReport = generateTerminalReport(detectionResult, parseErrors, k8sErrors);
      console.log(terminalReport);
      
      if (options.json) {
        const jsonContent = generateJsonReport(detectionResult, parseErrors, k8sErrors);
        saveReport(jsonContent, options.json);
        console.log(`📄 JSON 报告已保存: ${options.json}`);
      }
      
      if (options.markdown) {
        const mdContent = generateMarkdownReport(detectionResult, parseErrors, k8sErrors);
        saveReport(mdContent, options.markdown);
        console.log(`📄 Markdown 报告已保存: ${options.markdown}`);
      }
      
      if (detectionResult.summary.drifted > 0) {
        process.exit(2);
      } else if (detectionResult.summary.warning > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
      
    } catch (err) {
      console.error('❌ 检测失败:', err.message);
      console.error(err.stack);
      process.exit(1);
    }
  });

program
  .command('list-images')
  .description('列出集群中运行的所有镜像')
  .option('-n, --namespace <namespace>', 'K8s 命名空间 (默认: default)', 'default')
  .option('-A, --all-namespaces', '列出所有命名空间')
  .option('--kubeconfig <path>', 'kubeconfig 文件路径')
  .option('--context <name>', 'K8s context 名称')
  .option('--json <path>', '输出 JSON 到指定文件')
  .action(async (options) => {
    try {
      const namespace = options.allNamespaces ? 'all' : options.namespace;
      
      console.log('\n📋 获取集群镜像列表...');
      console.log(`   K8s Context: ${getCurrentContext()}`);
      console.log(`   命名空间: ${namespace}`);
      console.log('');
      
      const { clusterImages, errors } = await getClusterImages({
        namespace,
        kubeconfigPath: options.kubeconfig,
        context: options.context
      });
      
      if (errors.length > 0) {
        console.log('❌ 错误:');
        for (const err of errors) {
          console.log(`   ${err.message}`);
        }
        console.log('');
      }
      
      const grouped = {};
      for (const img of clusterImages) {
        const key = `${img.namespace}/${img.workloadKind}/${img.workload}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(img);
      }
      
      for (const [workload, images] of Object.entries(grouped)) {
        console.log(`📦 ${workload}`);
        for (const img of images) {
          const status = img.ready ? '✅' : '⏳';
          console.log(`   ${status} ${img.containerName}: ${img.specImage}`);
          if (img.actualDigest) {
            console.log(`      Digest: ${img.actualDigest}`);
          }
        }
        console.log('');
      }
      
      console.log(`总计: ${clusterImages.length} 个镜像`);
      
      if (options.json) {
        const jsonContent = JSON.stringify({
          version: '1.0.0',
          generatedAt: new Date().toISOString(),
          total: clusterImages.length,
          images: clusterImages
        }, null, 2);
        saveReport(jsonContent, options.json);
        console.log(`\n📄 JSON 已保存: ${options.json}`);
      }
      
    } catch (err) {
      console.error('❌ 获取失败:', err.message);
      process.exit(1);
    }
  });

program
  .command('parse-manifest')
  .description('解析部署清单并提取镜像')
  .argument('<path...>', '部署清单文件路径，支持 glob')
  .option('--json <path>', '输出 JSON 到指定文件')
  .action((paths, options) => {
    try {
      console.log('\n📄 解析部署清单...');
      console.log('');
      
      const fileContents = [];
      
      for (const pattern of paths) {
        const files = glob.sync(pattern, { nodir: true });
        
        for (const file of files) {
          try {
            const content = fs.readFileSync(file, 'utf8');
            fileContents.push({ filePath: file, content });
            console.log(`   ✓ ${file}`);
          } catch (err) {
            console.error(`   ✗ 读取文件失败: ${file} - ${err.message}`);
          }
        }
      }
      
      console.log('');
      
      const result = parseMultipleYamls(fileContents);
      
      if (result.parseErrors.length > 0) {
        console.log('❌ 解析错误:');
        for (const err of result.parseErrors) {
          console.log(`   ${err.filePath}:${err.line || '??'} - ${err.message}`);
        }
        console.log('');
      }
      
      const grouped = {};
      for (const workload of result.workloads) {
        const key = `${workload.namespace}/${workload.kind}/${workload.name}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(workload);
      }
      
      for (const [workload, containers] of Object.entries(grouped)) {
        console.log(`📦 ${workload}`);
        for (const c of containers) {
          console.log(`   ${c.containerName}: ${c.image}`);
          console.log(`     位置: ${c.filePath}:${c.line || '??'}`);
        }
        console.log('');
      }
      
      console.log(`总计: ${result.workloads.length} 个镜像`);
      
      if (options.json) {
        const jsonContent = JSON.stringify({
          version: '1.0.0',
          generatedAt: new Date().toISOString(),
          total: result.workloads.length,
          workloads: result.workloads,
          errors: result.parseErrors
        }, null, 2);
        saveReport(jsonContent, options.json);
        console.log(`\n📄 JSON 已保存: ${options.json}`);
      }
      
    } catch (err) {
      console.error('❌ 解析失败:', err.message);
      process.exit(1);
    }
  });

program.parse();
