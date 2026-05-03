import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Config, Issue, TokenDefinition, TokenReference } from './types';
import { loadConfig, ConfigError, createInitConfig } from './config';
import {
  parseTokenFile,
  parseCSSVariables,
  parseTailwindConfig,
  resolveAliases,
  AliasError,
  ParseError,
} from './token-parser';
import { getSourceFiles, scanAllFiles, ScannerError } from './scanner';
import { runFullAnalysis, resetIssueCounter } from './analyzer';
import { printTerminalSummary, writeReports } from './reporter';

export interface ScanResult {
  issues: Issue[];
  config: Config;
  tokenStats: {
    total: number;
    defined: number;
    unused: number;
    missing: number;
  };
}

export async function scanProject(projectRoot?: string): Promise<ScanResult> {
  const cwd = projectRoot || process.cwd();
  
  let config: Config;
  try {
    config = loadConfig(cwd);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`❌ 配置错误: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const allTokens: TokenDefinition[] = [];
  const aliasErrors: AliasError[] = [];

  for (const tokenFile of config.tokenFiles) {
    const fullPath = path.resolve(config.projectRoot, tokenFile);
    
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    try {
      const ext = path.extname(fullPath).toLowerCase();
      
      if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
        const tokens = parseTokenFile(fullPath);
        allTokens.push(...tokens);
      } else if (ext === '.css' || ext === '.scss' || ext === '.sass') {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const tokens = parseCSSVariables(content, fullPath);
        allTokens.push(...tokens);
      } else if (ext === '.js' || ext === '.ts') {
        const baseName = path.basename(fullPath);
        if (baseName.includes('tailwind')) {
          try {
            const configModule = await import(fullPath);
            const twConfig = configModule.default || configModule;
            const tokens = parseTailwindConfig(twConfig, fullPath);
            allTokens.push(...tokens);
          } catch (e) {
            console.warn(`⚠️ 无法加载 Tailwind 配置 ${fullPath}: ${(e as Error).message}`);
          }
        }
      }
    } catch (error) {
      if (error instanceof ParseError) {
        console.error(`❌ 解析 Token 文件失败: ${error.message}`);
      } else {
        console.error(`❌ 处理 Token 文件时出错: ${(error as Error).message}`);
      }
    }
  }

  const { resolved, errors } = resolveAliases(allTokens, config.themeNames);
  aliasErrors.push(...errors);

  const sourceFiles = await getSourceFiles(
    config.sourceDirs,
    config.ignorePatterns,
    config.projectRoot
  );

  const scanResult = await scanAllFiles(sourceFiles, config, resolved);

  resetIssueCounter();
  const issues = runFullAnalysis(
    scanResult.hardcoded,
    scanResult.references,
    resolved,
    aliasErrors,
    config
  );

  const unusedCount = issues.filter((i) => i.type === 'unused_token').length;
  const missingCount = issues.filter((i) => i.type === 'missing_token').length;

  return {
    issues,
    config,
    tokenStats: {
      total: allTokens.length,
      defined: resolved.length,
      unused: unusedCount,
      missing: missingCount,
    },
  };
}

export async function runScan(projectRoot?: string): Promise<void> {
  console.log('🔍 开始扫描项目...\n');
  
  const result = await scanProject(projectRoot);
  
  printTerminalSummary(result.issues);
}

export async function runReport(
  formats: string[] = ['json', 'markdown', 'html'],
  projectRoot?: string
): Promise<string[]> {
  console.log('📋 生成报告...\n');
  
  const result = await scanProject(projectRoot);
  
  printTerminalSummary(result.issues);
  
  const writtenFiles = await writeReports(
    result.issues,
    result.config,
    result.tokenStats,
    formats
  );
  
  console.log('\n📄 报告已生成:');
  for (const file of writtenFiles) {
    console.log(`   ✅ ${file}`);
  }
  
  return writtenFiles;
}

export function initProject(targetDir: string): void {
  const fullDir = path.resolve(targetDir);
  
  if (fs.existsSync(fullDir)) {
    const files = fs.readdirSync(fullDir);
    if (files.length > 0) {
      console.error(`❌ 目标目录已存在且非空: ${fullDir}`);
      process.exit(1);
    }
  } else {
    fs.mkdirSync(fullDir, { recursive: true });
  }

  const config = createInitConfig(fullDir);

  const configContent = JSON.stringify(
    {
      tokenFiles: config.tokenFiles,
      sourceDirs: config.sourceDirs,
      ignorePatterns: config.ignorePatterns,
      allowedHardcoded: config.allowedHardcoded,
      themeNames: config.themeNames,
      outputDir: config.outputDir,
    },
    null,
    2
  );

  fs.writeFileSync(
    path.join(fullDir, 'token-drift.config.json'),
    configContent,
    'utf-8'
  );

  const designTokensDir = path.join(fullDir, 'design-tokens');
  fs.mkdirSync(designTokensDir, { recursive: true });

  const tokensJson = {
    color: {
      primary: { value: '#3b82f6', type: 'color' },
      secondary: { value: '#8b5cf6', type: 'color' },
      success: { value: '#22c55e', type: 'color' },
      warning: { value: '#f59e0b', type: 'color' },
      danger: { value: '#ef4444', type: 'color' },
      text: {
        primary: { value: '#1f2937', type: 'color' },
        secondary: { value: '#6b7280', type: 'color' },
        disabled: { value: '#9ca3af', type: 'color' },
      },
      background: {
        primary: { value: '#ffffff', type: 'color' },
        secondary: { value: '#f3f4f6', type: 'color' },
        tertiary: { value: '#e5e7eb', type: 'color' },
      },
      border: {
        primary: { value: '#d1d5db', type: 'color' },
        focus: { value: '#3b82f6', type: 'color' },
      },
    },
    light: {
      text: {
        primary: { alias: 'color.text.primary' },
        secondary: { alias: 'color.text.secondary' },
      },
      background: {
        primary: { alias: 'color.background.primary' },
        secondary: { alias: 'color.background.secondary' },
      },
    },
    dark: {
      text: {
        primary: { value: '#f9fafb', type: 'color' },
        secondary: { value: '#d1d5db', type: 'color' },
      },
      background: {
        primary: { value: '#111827', type: 'color' },
        secondary: { value: '#1f2937', type: 'color' },
      },
    },
    spacing: {
      '0': { value: '0px', type: 'spacing' },
      '1': { value: '4px', type: 'spacing' },
      '2': { value: '8px', type: 'spacing' },
      '3': { value: '12px', type: 'spacing' },
      '4': { value: '16px', type: 'spacing' },
      '5': { value: '20px', type: 'spacing' },
      '6': { value: '24px', type: 'spacing' },
      '8': { value: '32px', type: 'spacing' },
      '10': { value: '40px', type: 'spacing' },
      '12': { value: '48px', type: 'spacing' },
      '16': { value: '64px', type: 'spacing' },
      xs: { value: '4px', type: 'spacing' },
      sm: { value: '8px', type: 'spacing' },
      md: { value: '16px', type: 'spacing' },
      lg: { value: '24px', type: 'spacing' },
      xl: { value: '32px', type: 'spacing' },
    },
    fontSize: {
      xs: { value: '12px', type: 'font' },
      sm: { value: '14px', type: 'font' },
      base: { value: '16px', type: 'font' },
      lg: { value: '18px', type: 'font' },
      xl: { value: '20px', type: 'font' },
      '2xl': { value: '24px', type: 'font' },
      '3xl': { value: '30px', type: 'font' },
    },
    borderRadius: {
      none: { value: '0px', type: 'radius' },
      sm: { value: '4px', type: 'radius' },
      md: { value: '6px', type: 'radius' },
      lg: { value: '8px', type: 'radius' },
      xl: { value: '12px', type: 'radius' },
      full: { value: '9999px', type: 'radius' },
    },
  };

  fs.writeFileSync(
    path.join(designTokensDir, 'tokens.json'),
    JSON.stringify(tokensJson, null, 2),
    'utf-8'
  );

  const srcDir = path.join(fullDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  const cssContent = `:root {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  
  --border-radius-sm: 4px;
  --border-radius-md: 6px;
  --border-radius-lg: 8px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: #f9fafb;
    --color-text-secondary: #d1d5db;
    --color-bg-primary: #111827;
    --color-bg-secondary: #1f2937;
  }
}
`;

  fs.writeFileSync(path.join(srcDir, 'variables.css'), cssContent, 'utf-8');

  const tsxContent = `import React from 'react';
import './variables.css';

const App: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    padding: '24px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    color: '#1f2937',
    marginBottom: '16px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  };

  const cardStyle: React.CSSProperties = {
    padding: '16px',
    backgroundColor: '#f3f4f6',
    marginTop: '20px',
  };

  return (
    <div style={containerStyle} className="p-6 bg-white rounded-lg">
      <h1 style={titleStyle} className="text-2xl font-bold text-gray-900">
        Token Drift Detector 示例
      </h1>
      
      <p className="text-gray-600 mb-4" style={{ fontSize: '16px' }}>
        这个示例项目包含一些故意的硬编码值，用于演示 token drift 检测。
      </p>

      <button 
        style={buttonStyle}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-md"
      >
        示例按钮
      </button>

      <div style={cardStyle} className="mt-5 p-4 bg-gray-100">
        <h2 style={{ color: '#6b7280', marginBottom: '8px' }} className="text-gray-500">
          示例卡片
        </h2>
        <p style={{ color: '#9ca3af' }} className="text-gray-400">
          这个卡片有一些硬编码的颜色值和间距。
        </p>
        <div style={{ marginTop: '12px' }}>
          <span style={{ color: '#22c55e' }}>成功状态</span>
          <span style={{ color: '#ef4444', marginLeft: '16px' }}>错误状态</span>
        </div>
      </div>

      <div className="mt-6">
        <span style={{ padding: '8px 16px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px' }}>
          警告标签
        </span>
      </div>

      <div className="invalid-token-test">
        <p style={{ color: 'var(--color-nonexistent)' }}>
          这个引用了一个不存在的 CSS 变量
        </p>
      </div>
    </div>
  );
};

export default App;
`;

  fs.writeFileSync(path.join(srcDir, 'App.tsx'), tsxContent, 'utf-8');

  const readmeContent = `# 示例项目 - Token Drift Detector

这是一个用于演示 Token Drift Detector 的示例项目。

## 项目结构

\`\`\`
├── design-tokens/
│   └── tokens.json          # 设计 Token 定义
├── src/
│   ├── App.tsx              # 示例组件（包含故意的硬编码值）
│   └── variables.css        # CSS 变量定义
└── token-drift.config.json  # Token Drift 配置文件
\`\`\`

## 包含的问题示例

### App.tsx 中的问题
1. **硬编码颜色**: \`#ffffff\`, \`#1f2937\`, \`#3b82f6\`, \`#f3f4f6\` 等
2. **硬编码间距**: \`24px\`, \`16px\`, \`12px\`, \`20px\` 等
3. **引用不存在的 Token**: \`var(--color-nonexistent)\`
4. **部分正确使用**: 使用了 Tailwind 类如 \`bg-blue-500\`, \`text-gray-900\`

### Token 定义问题
1. **未使用的 Token**: tokens.json 中定义了但 App.tsx 中未使用的 token
2. **主题不完整**: \`dark.text.disabled\`, \`dark.border.primary\` 等未定义

## 运行检测

\`\`\`bash
# 在示例项目目录中运行
cd <示例项目目录>

# 扫描项目
token-drift scan

# 生成报告
token-drift report
\`\`\`

## 预期检测到的问题

- 🔴 **严重 (Critical)**: 引用不存在的 Token
- 🟠 **高 (High)**: 硬编码颜色值、主题值不完整
- 🟡 **中 (Medium)**: 硬编码间距值
- 🟢 **低 (Low)**: 未使用的 Token

## 修复建议

1. 将所有硬编码的颜色值替换为 \`var(--color-xxx)\` 或使用 Design Token
2. 将所有硬编码的间距值替换为 \`var(--spacing-xxx)\`
3. 检查并修复不存在的 Token 引用
4. 为所有主题补充缺失的 Token 定义
5. 清理或使用未使用的 Token
`;

  fs.writeFileSync(path.join(fullDir, 'README.md'), readmeContent, 'utf-8');

  console.log(`\n✅ 示例项目已创建: ${fullDir}`);
  console.log('\n📁 项目结构:');
  console.log('   ├── design-tokens/');
  console.log('   │   └── tokens.json      (设计 Token 定义)');
  console.log('   ├── src/');
  console.log('   │   ├── App.tsx          (示例组件，包含问题)');
  console.log('   │   └── variables.css    (CSS 变量)');
  console.log('   ├── token-drift.config.json');
  console.log('   └── README.md');
  console.log('\n🚀 下一步:');
  console.log(`   cd ${fullDir}`);
  console.log('   token-drift scan    # 运行扫描');
  console.log('   token-drift report  # 生成报告');
}
