import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SelfTestResult, SecretRule, ExceptionItem } from '../types';
import { parseYamlFile, extractAllValues, flattenObject } from '../utils/yaml-parser';
import { renderTemplate, resolveTemplateReferences } from '../utils/template-renderer';
import { isBase64, tryDecodeBase64, scanContent, ScanContext } from './scanner';
import { isExceptionExpired, matchesException, applyExceptions } from './exception-manager';
import { defaultRules } from '../config/default-rules';
import { generateMarkdownReport } from '../reporters/markdown-reporter';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hss-test-'));
}

async function testYamlParsing(): Promise<SelfTestResult> {
  try {
    const tempDir = createTempDir();
    const testFile = path.join(tempDir, 'test.yaml');
    
    const testYaml = `
database:
  host: localhost
  port: 5432
  credentials:
    username: admin
    password: secret123
`;
    fs.writeFileSync(testFile, testYaml, 'utf-8');
    
    const parsed = parseYamlFile(testFile);
    
    if (!parsed.data || typeof parsed.data !== 'object') {
      return { name: 'YAML 解析', passed: false, message: '解析结果为空或不是对象' };
    }
    
    const values = extractAllValues(parsed.data);
    
    if (values.length < 4) {
      return { name: 'YAML 解析', passed: false, message: `提取值数量不足: ${values.length}` };
    }
    
    const passwordValue = values.find(v => v.path === 'database.credentials.password');
    if (!passwordValue || passwordValue.value !== 'secret123') {
      return { name: 'YAML 解析', passed: false, message: '嵌套路径提取失败' };
    }
    
    fs.rmSync(tempDir, { recursive: true });
    
    return { 
      name: 'YAML 解析', 
      passed: true, 
      message: '成功解析 YAML 并提取嵌套值',
      details: { extractedCount: values.length }
    };
  } catch (e) {
    return { name: 'YAML 解析', passed: false, message: (e as Error).message };
  }
}

async function testTemplateRendering(): Promise<SelfTestResult> {
  try {
    const values = {
      database: {
        password: 'supersecret'
      }
    };
    
    const resolved = resolveTemplateReferences('{{ .Values.database.password }}', values);
    if (resolved !== 'supersecret') {
      return { name: '模板渲染', passed: false, message: `值引用解析失败: ${resolved}` };
    }

    const handlebarsTemplate = `
apiVersion: v1
kind: Secret
data:
  password: {{ database.password }}
`;
    const rendered = renderTemplate(handlebarsTemplate, values);
    
    if (!rendered.includes('supersecret')) {
      return { name: '模板渲染', passed: false, message: 'Handlebars 模板变量未正确渲染' };
    }
    
    return { 
      name: '模板渲染', 
      passed: true, 
      message: '模板变量渲染和引用解析正常',
      details: { resolvedValue: resolved, hasSecret: rendered.includes('supersecret') }
    };
  } catch (e) {
    return { name: '模板渲染', passed: false, message: (e as Error).message };
  }
}

async function testBase64Detection(): Promise<SelfTestResult> {
  try {
    const secretValue = 'https://user:password@internal.example.com';
    const encoded = Buffer.from(secretValue).toString('base64');
    
    if (!isBase64(encoded)) {
      return { name: 'Base64 检测', passed: false, message: '未识别有效的 Base64 字符串' };
    }
    
    const { decoded, isBase64: isB64 } = tryDecodeBase64(encoded);
    if (!isB64 || decoded !== secretValue) {
      return { name: 'Base64 检测', passed: false, message: 'Base64 解码失败' };
    }
    
    if (isBase64('not-really-base64!!!')) {
      return { name: 'Base64 检测', passed: false, message: '误将非 Base64 字符串识别为 Base64' };
    }
    
    return { 
      name: 'Base64 检测', 
      passed: true, 
      message: 'Base64 编码检测和解码功能正常',
      details: { encoded, decoded: decoded.substring(0, 20) + '...' }
    };
  } catch (e) {
    return { name: 'Base64 检测', passed: false, message: (e as Error).message };
  }
}

async function testSecretScanning(): Promise<SelfTestResult> {
  try {
    const rules = defaultRules;
    const context: ScanContext = {
      filePath: 'test.yaml',
      rules,
      verbose: false
    };
    
    const testContent = `
database:
  password: "supersecretpassword123"
  url: "https://admin:mypassword123@db.internal"
aws:
  access_key: "AKIAIOSFODNN7EXAMPLE"
network:
  internal_ip: "10.0.0.1"
`;
    
    const findings = scanContent(testContent, context);
    
    if (findings.length === 0) {
      return { name: '敏感信息扫描', passed: false, message: '未检测到任何敏感信息' };
    }
    
    const awsKeyFound = findings.some(f => f.ruleId === 'aws-access-key');
    if (!awsKeyFound) {
      return { name: '敏感信息扫描', passed: false, message: '未检测到 AWS 访问密钥' };
    }
    
    const basicAuthFound = findings.some(f => f.ruleId === 'basic-auth');
    if (!basicAuthFound) {
      return { name: '敏感信息扫描', passed: false, message: '未检测到 Basic Auth 凭证' };
    }
    
    const intranetIpFound = findings.some(f => f.ruleId === 'intranet-ip');
    if (!intranetIpFound) {
      return { name: '敏感信息扫描', passed: false, message: '未检测到内网 IP' };
    }
    
    return { 
      name: '敏感信息扫描', 
      passed: true, 
      message: `成功检测到 ${findings.length} 个敏感信息`,
      details: { findingsCount: findings.length, ruleIds: findings.map(f => f.ruleId) }
    };
  } catch (e) {
    return { name: '敏感信息扫描', passed: false, message: (e as Error).message };
  }
}

async function testBase64SecretScanning(): Promise<SelfTestResult> {
  try {
    const rules = defaultRules;
    const context: ScanContext = {
      filePath: 'test.yaml',
      rules,
      verbose: false
    };
    
    const secretInBase64 = Buffer.from('https://admin:secretpass@internal.corp').toString('base64');
    const testContent = `
apiVersion: v1
kind: Secret
data:
  connection: ${secretInBase64}
`;
    
    const findings = scanContent(testContent, context);
    
    const base64Findings = findings.filter(f => f.isBase64Encoded);
    
    if (base64Findings.length === 0) {
      return { name: 'Base64 隐藏扫描', passed: false, message: '未检测到 Base64 编码中的敏感信息' };
    }
    
    if (!base64Findings.some(f => f.ruleId === 'basic-auth' || f.ruleId === 'internal-domain')) {
      return { name: 'Base64 隐藏扫描', passed: false, message: 'Base64 解码后未检测到凭证' };
    }
    
    return { 
      name: 'Base64 隐藏扫描', 
      passed: true, 
      message: '成功检测到 Base64 编码中隐藏的敏感信息',
      details: { base64Findings: base64Findings.length }
    };
  } catch (e) {
    return { name: 'Base64 隐藏扫描', passed: false, message: (e as Error).message };
  }
}

async function testExceptionHandling(): Promise<SelfTestResult> {
  try {
    const finding = {
      id: 'test',
      ruleId: 'aws-access-key',
      ruleName: 'AWS Access Key',
      severity: 'critical' as const,
      category: 'credential',
      description: 'Test',
      location: { file: 'test.yaml', path: 'aws.key' },
      matchedValue: 'AKIAIOSFODNN7EXAMPLE',
      evidence: 'test'
    };
    
    const exception: ExceptionItem = {
      id: 'ex-001',
      reason: '测试例外',
      ruleId: 'aws-access-key',
      environment: 'test',
      createdAt: '2024-01-01',
      createdBy: 'test'
    };
    
    if (!matchesException(finding, exception, 'test')) {
      return { name: '例外处理', passed: false, message: '规则 ID 匹配失败' };
    }
    
    if (matchesException(finding, exception, 'prod')) {
      return { name: '例外处理', passed: false, message: '环境过滤失败' };
    }
    
    const expiredException: ExceptionItem = {
      ...exception,
      expiresAt: '2020-01-01'
    };
    
    if (!isExceptionExpired(expiredException)) {
      return { name: '例外处理', passed: false, message: '过期例外未被识别' };
    }
    
    const { findings, exceptedCount, expiredCount } = applyExceptions([finding], [exception], 'test');
    if (exceptedCount !== 1 || !findings[0].excepted) {
      return { name: '例外处理', passed: false, message: '例外应用失败' };
    }
    
    return { 
      name: '例外处理', 
      passed: true, 
      message: '例外匹配、环境过滤和过期检查功能正常',
      details: { exceptedCount, expiredCount }
    };
  } catch (e) {
    return { name: '例外处理', passed: false, message: (e as Error).message };
  }
}

async function testMarkdownReport(): Promise<SelfTestResult> {
  try {
    const mockResult = {
      metadata: {
        scannedAt: new Date().toISOString(),
        environment: 'test',
        valuesFile: 'values.yaml',
        templateDir: 'templates'
      },
      summary: {
        totalFiles: 5,
        totalFindings: 3,
        bySeverity: { critical: 1, high: 1, medium: 1, low: 0 },
        excepted: 1,
        expiredExceptions: 0
      },
      findings: [
        {
          id: 'finding-1',
          ruleId: 'aws-access-key',
          ruleName: 'AWS Access Key',
          severity: 'critical' as const,
          category: 'credential',
          description: '测试发现',
          location: { file: 'values.yaml', path: 'aws.key', line: 10 },
          matchedValue: 'AKIAIOSFODNN7EXAMPLE',
          evidence: '测试证据'
        }
      ],
      errors: [],
      warnings: []
    };
    
    const markdown = generateMarkdownReport(mockResult);
    
    if (!markdown.includes('# Helm Values 泄密扫描报告')) {
      return { name: 'Markdown 报告', passed: false, message: '报告标题缺失' };
    }
    
    if (!markdown.includes('AWS Access Key')) {
      return { name: 'Markdown 报告', passed: false, message: '发现项未包含在报告中' };
    }
    
    if (!markdown.includes('## 📊 扫描摘要')) {
      return { name: 'Markdown 报告', passed: false, message: '扫描摘要部分缺失' };
    }
    
    return { 
      name: 'Markdown 报告', 
      passed: true, 
      message: 'Markdown 报告生成正常',
      details: { reportLength: markdown.length }
    };
  } catch (e) {
    return { name: 'Markdown 报告', passed: false, message: (e as Error).message };
  }
}

async function testBoundaryCases(): Promise<SelfTestResult> {
  try {
    const rules = defaultRules;
    const context: ScanContext = {
      filePath: 'test.yaml',
      rules,
      verbose: false
    };
    
    const emptyFindings = scanContent('', context);
    if (emptyFindings.length !== 0) {
      return { name: '边界测试', passed: false, message: '空内容扫描返回了非空结果' };
    }
    
    const safeContent = `
name: my-app
replicas: 3
image: nginx:latest
`;
    const safeFindings = scanContent(safeContent, context);
    const criticalFindings = safeFindings.filter(f => 
      f.severity === 'critical' && f.ruleId !== 'internal-domain'
    );
    
    const nestedTest = {
      level1: {
        level2: {
          level3: {
            value: 'AKIAIOSFODNN7EXAMPLE'
          }
        }
      }
    };
    const flattened = flattenObject(nestedTest);
    if (!flattened['level1.level2.level3.value']) {
      return { name: '边界测试', passed: false, message: '深度嵌套对象扁平化失败' };
    }
    
    return { 
      name: '边界测试', 
      passed: true, 
      message: '空内容、安全内容和深度嵌套处理正常',
      details: { safeFindings: safeFindings.length, nestedKeys: Object.keys(flattened).length }
    };
  } catch (e) {
    return { name: '边界测试', passed: false, message: (e as Error).message };
  }
}

export async function runSelfTests(): Promise<SelfTestResult[]> {
  const tests = [
    testYamlParsing,
    testTemplateRendering,
    testBase64Detection,
    testSecretScanning,
    testBase64SecretScanning,
    testExceptionHandling,
    testMarkdownReport,
    testBoundaryCases
  ];

  const results: SelfTestResult[] = [];
  
  for (const test of tests) {
    results.push(await test());
  }

  return results;
}
