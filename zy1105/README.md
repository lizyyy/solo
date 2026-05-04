# License Risk Checker

> 本地依赖许可证和商用风险体检 CLI 工具

一个无需联网的本地命令行工具，帮助开发者在项目商用、交付客户或上架前，全面检查依赖的许可证合规性和商用风险。

## 特性

- 🔍 **多源扫描**: 解析 npm/pnpm (package.json, pnpm-lock.yaml, package-lock.json)、Python (requirements.txt, setup.py, pyproject.toml)、手工维护的 third_party.csv
- 📊 **风险分级**: 将 MIT、Apache-2.0、BSD、GPL、AGPL、LGPL 等许可证统一归类为安全/低风险/中风险/高风险/未知
- 🚨 **问题检测**: 发现版本不一致、许可证缺失、copyleft/网络服务风险、NOTICE 缺声明、第三方代码无来源等问题
- 📝 **详细解释**: 提供人看得懂的问题说明 - 哪些必须先处理、哪些只是补声明、为什么有风险、证据来自哪个文件哪一行
- 📤 **多格式导出**: 导出 Markdown/HTML/JSON 报告和 NOTICE 草稿
- ✅ **异常处理**: 对 CSV 少列、许可证写错、依赖重复、目录不存在等异常输入有清楚的报错
- 🔧 **配置灵活**: 支持通过 overrides.json 覆盖许可证和风险等级

## 安装

```bash
npm install
npm link
```

## 快速开始

### 1. 扫描示例项目

```bash
# 扫描当前目录
license-check scan

# 扫描指定目录并显示详细信息
license-check scan -d ./samples/sample-project -v
```

### 2. 执行合规检查

```bash
# 检查当前目录
license-check check

# 严格模式（任何警告都视为失败）
license-check check --strict

# 排除开发依赖
license-check check --no-dev
```

### 3. 导出报告

```bash
# 导出所有格式到当前目录
license-check export

# 导出到指定目录
license-check export -o ./reports

# 仅导出指定格式
license-check export -f json,markdown

# 完整示例
license-check export -d ./samples/sample-project -o ./output -f json,markdown,html,notice -v
```

## 命令详解

### `scan` - 扫描项目目录

扫描项目目录，收集所有依赖信息。

```bash
license-check scan [选项]
```

**选项:**

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--dir <path>` | `-d` | 指定项目目录 | 当前目录 |
| `--output <path>` | `-o` | 指定输出目录 | 当前目录 |
| `--no-dev` | | 排除开发依赖 | false |
| `--no-transitive` | | 排除传递依赖 | false |
| `--verbose` | `-v` | 显示详细输出 | false |
| `--help` | `-h` | 显示帮助 | - |

**示例:**

```bash
# 扫描指定项目
license-check scan -d /path/to/my-project

# 扫描并排除开发依赖
license-check scan --no-dev

# 详细输出
license-check scan -v
```

### `check` - 执行合规检查

执行完整的许可证合规检查，识别风险和问题。

```bash
license-check check [选项]
```

**选项:**

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--dir <path>` | `-d` | 指定项目目录 | 当前目录 |
| `--output <path>` | `-o` | 指定输出目录 | 当前目录 |
| `--no-dev` | | 排除开发依赖 | false |
| `--no-transitive` | | 排除传递依赖 | false |
| `--strict` | | 严格模式，任何警告都视为失败 | false |
| `--verbose` | `-v` | 显示详细输出 | false |
| `--help` | `-h` | 显示帮助 | - |

**示例:**

```bash
# 基本检查
license-check check

# 严格模式
license-check check --strict

# 详细输出
license-check check -v

# 检查指定目录
license-check check -d ./samples/sample-project
```

### `export` - 导出分析报告

导出完整的分析报告，支持多种格式。

```bash
license-check export [选项]
```

**选项:**

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--dir <path>` | `-d` | 指定项目目录 | 当前目录 |
| `--output <path>` | `-o` | 指定输出目录 | 当前目录 |
| `--format <formats>` | `-f` | 指定导出格式（逗号分隔） | 所有格式 |
| `--no-dev` | | 排除开发依赖 | false |
| `--no-transitive` | | 排除传递依赖 | false |
| `--strict` | | 严格模式 | false |
| `--verbose` | `-v` | 显示详细输出 | false |
| `--help` | `-h` | 显示帮助 | - |

**支持的格式:**

- `json` - JSON 格式报告
- `markdown` / `md` - Markdown 格式报告
- `html` - HTML 格式报告
- `notice` - NOTICE 草稿文件

**示例:**

```bash
# 导出所有格式
license-check export

# 导出指定格式
license-check export -f json,markdown

# 导出到指定目录
license-check export -o ./reports

# 完整示例
license-check export -d ./samples/sample-project -o ./output -f json,markdown,html -v
```

### `help` - 显示帮助

```bash
license-check help
```

## 支持的文件格式

### package.json (npm/pnpm)

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

### pnpm-lock.yaml / package-lock.json

工具会自动解析锁文件中的实际解析版本。

### requirements.txt (Python)

```text
# Web 框架
flask==2.3.3
django>=4.2.0

# 数据处理
pandas==2.1.3
numpy==1.26.2

# HTTP 客户端
requests==2.31.0
```

支持的特殊语法：
- 版本锁定: `==`
- 版本范围: `>=`, `<=`, `>`, `<`
- Git 依赖: `git+https://...`
- URL 依赖: `https://...`
- 包含其他文件: `-r other.txt`

### third_party.csv (推荐)

用于手工维护的第三方依赖声明。

```csv
name,version,license,source,url,notes
lodash,4.17.21,MIT,npm,https://github.com/lodash/lodash,工具库
express,4.18.2,MIT,npm,https://github.com/expressjs/express,Web 框架
some-gpl-library,2.0.0,GPL-3.0,npm,https://github.com/example/gpl-lib,需要注意 copyleft 影响
some-agpl-service,1.5.0,AGPL-3.0,pypi,https://github.com/example/agpl-lib,高风险 - 网络服务感染
```

**必需列:**
- `name` - 包名
- `license` - 许可证类型（使用 SPDX 标识符）

**可选列:**
- `version` - 版本号
- `source` - 来源（npm, pypi, github 等）
- `url` - 项目 URL
- `notes` - 备注
- `copyright` - 版权信息
- `notice` - NOTICE 声明

### LICENSE / LICENSE.txt

项目许可证文件。支持多种命名：
- `LICENSE`
- `LICENSE.txt`
- `LICENSE.md`
- `LICENCE` (英式拼写)
- `COPYING`

工具会自动识别许可证类型。

### NOTICE / NOTICE.txt

Apache-2.0 许可证要求的声明文件。

```text
NOTICE
======

My Project
Copyright 2024

==============================================================================

第三方组件声明
------------------

## some-apache-tool
版本: 3.2.1
许可证: Apache-2.0
来源: npm
版权所有: 2024 Apache Software Foundation
```

### overrides.json (可选)

用于覆盖许可证和风险等级的配置文件。

```json
{
  "licenseOverrides": {
    "some-package": {
      "license": "MIT",
      "version": "1.0.0",
      "source": "手动核实",
      "notes": "内部使用，已确认 MIT 许可"
    },
    "another-package": {
      "license": "Apache-2.0",
      "source": "与作者确认"
    }
  },
  "riskOverrides": {
    "UnknownLicense": "LOW",
    "SomeSpecialLicense": "SAFE"
  },
  "ignorePackages": [
    "internal-package",
    "private-dependency"
  ],
  "exclusions": {
    "devDependencies": false,
    "testDependencies": false,
    "optionalDependencies": false,
    "packages": ["temp-package"]
  },
  "requirements": {
    "requireNoticeForApache": true,
    "requireAttribution": true,
    "checkCopyleft": true,
    "checkNetworkService": true
  },
  "notes": {
    "some-gpl-library": "此库通过独立进程使用，不影响主项目许可证",
    "some-agpl-service": "仅用于内部开发环境，生产环境使用 MIT 替代方案"
  }
}
```

## 风险等级说明

| 等级 | 颜色 | 说明 | 许可证示例 |
|------|------|------|------------|
| 🟢 **SAFE** (安全) | 绿色 | 可以安全商用，几乎没有约束 | MIT, BSD-2-Clause, BSD-3-Clause, Unlicense, CC0-1.0 |
| 🟡 **LOW** (低风险) | 黄色 | 需要保留许可证声明或归因信息 | Apache-2.0 |
| 🟠 **MEDIUM** (中风险) | 橙色 | 有 copyleft 影响，可能需要公开修改后的源代码 | LGPL-2.1, LGPL-3.0, MPL-2.0 |
| 🔴 **HIGH** (高风险) | 红色 | 强 copyleft 或网络服务感染，可能导致整个项目开源 | GPL-2.0, GPL-3.0, AGPL-3.0 |
| ⚪ **UNKNOWN** (未知) | 灰色 | 许可证未知，需要手动核实 | 未识别的许可证 |

### 许可证详细说明

#### MIT
- **摘要**: 最宽松的许可证之一
- **要求**: 保留原许可证声明
- **风险**: 无
- **商用**: ✅ 允许
- **修改**: ✅ 允许
- **分发**: ✅ 允许
- **私有使用**: ✅ 允许
- **专利授权**: ❌ 无

#### Apache-2.0
- **摘要**: 商业友好，包含专利授权
- **要求**: 保留原许可证声明、说明修改内容、包含 NOTICE 文件
- **风险**: 无
- **商用**: ✅ 允许
- **修改**: ✅ 允许
- **分发**: ✅ 允许
- **私有使用**: ✅ 允许
- **专利授权**: ✅ 有

#### BSD-2-Clause / BSD-3-Clause
- **摘要**: 简化版 BSD，非常宽松
- **要求**: 保留原许可证声明（BSD-3-Clause 还禁止使用作者名称背书）
- **风险**: 无
- **商用**: ✅ 允许

#### LGPL-2.1 / LGPL-3.0
- **摘要**: 弱 copyleft，动态链接不感染
- **要求**: 保留原许可证声明、提供库的修改源码、允许用户替换库
- **风险**: 静态链接时会感染整个项目
- **商用**: ✅ 允许（注意链接方式）

#### GPL-2.0 / GPL-3.0
- **摘要**: 强 copyleft，传染整个项目
- **要求**: 保留原许可证声明、公开全部源码、相同许可证分发
- **风险**: 整个项目必须以 GPL 开源，无法闭源商用分发
- **商用**: ⚠️ 允许但需开源

#### AGPL-3.0
- **摘要**: 网络服务感染，即使不分发也可能触发
- **要求**: 保留原许可证声明、公开全部源码、网络访问用户可获取源码
- **风险**: 网络服务场景也需开源，即使不分发也可能触发 copyleft
- **商用**: ⚠️ 高风险

#### MPL-2.0
- **摘要**: 文件级 copyleft，比 GPL 更灵活
- **要求**: 保留原许可证声明、修改的文件需开源
- **风险**: 修改的文件需以 MPL 开源，新增文件可专有
- **商用**: ✅ 允许

## 检测的问题类型

### 高优先级问题

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| `missing-license` | 依赖缺少许可证信息 | 高 |
| `network-service-risk` | AGPL 许可证，存在网络服务感染风险 | 高 |
| `unknown-licenses` | 发现许可证未知的依赖 | 高 |

### 中优先级问题

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| `copyleft-license` | Copyleft 许可证，可能需要公开源码 | 中 |
| `missing-notice-file` | 使用 Apache-2.0 依赖但缺少 NOTICE 文件 | 中 |
| `dependency-conflict` (多许可证) | 同一依赖存在多个不同许可证版本 | 中 |

### 低优先级问题

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| `version-inconsistency` | package.json 与锁文件版本不一致 | 低 |
| `notice-incomplete` | NOTICE 文件可能缺少某些依赖声明 | 低 |
| `dependency-conflict` (多版本) | 同一依赖存在多个版本 | 低 |

### 信息级别

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| `missing-license-file` | 项目根目录缺少 LICENSE 文件 | 信息 |
| `third-party-undocumented` | 中高风险依赖未在 third_party.csv 中声明 | 信息 |

## 示例项目

项目包含一个完整的示例项目，位于 `samples/sample-project/`：

```
samples/sample-project/
├── package.json          # npm 依赖清单
├── requirements.txt      # Python 依赖清单
├── third_party.csv       # 第三方依赖声明
├── LICENSE               # MIT 许可证文件
├── NOTICE                # NOTICE 声明文件
└── overrides.json        # 覆盖配置
```

### 运行示例

```bash
# 扫描示例项目
license-check scan -d ./samples/sample-project -v

# 检查示例项目
license-check check -d ./samples/sample-project -v

# 导出示例项目报告
license-check export -d ./samples/sample-project -o ./output -v
```

### 预期结果

示例项目设计为展示各种风险：

- ✅ **安全依赖**: express, lodash, react, axios, moment (MIT)
- 🟡 **低风险**: some-apache-tool (Apache-2.0)
- 🟠 **中风险**: some-gpl-library (GPL-3.0)
- 🔴 **高风险**: some-agpl-service (AGPL-3.0)

## API 使用

除了命令行，也可以作为 Node.js 模块使用：

```javascript
const LicenseRiskAssessor = require('./src/core/LicenseRiskAssessor')
const ScanEngine = require('./src/core/ScanEngine')
const CheckEngine = require('./src/core/CheckEngine')
const ExportEngine = require('./src/core/ExportEngine')

// 1. 许可证风险评估
const assessor = new LicenseRiskAssessor()

// 评估许可证风险
const risk = assessor.assessRisk('MIT')
console.log(risk.level)  // 'SAFE'

// 标准化许可证
const normalized = assessor.normalizeLicense('apache-2.0')
console.log(normalized)  // 'Apache-2.0'

// 检查 copyleft
console.log(assessor.isCopyleft('GPL-3.0'))  // true
console.log(assessor.isNetworkServiceRisk('AGPL-3.0'))  // true

// 2. 扫描项目
const scanEngine = new ScanEngine('/path/to/project', {
  includeDevDependencies: true,
  includeTransitive: true
})

const scanResult = scanEngine.scan()

console.log(`扫描到 ${scanResult.statistics.totalDependencies} 个依赖`)
console.log(`安全: ${scanResult.statistics.byRiskLevel.SAFE}`)
console.log(`高风险: ${scanResult.statistics.byRiskLevel.HIGH}`)

// 3. 执行检查
const checkEngine = new CheckEngine(scanResult, {
  strict: false
})

const checkResult = checkEngine.check()

console.log(`整体风险: ${checkResult.overallRisk}`)
console.log(`通过: ${checkResult.passed}`)
console.log(`发现 ${checkResult.issues.length} 个问题`)

for (const issue of checkResult.issues) {
  console.log(`[${issue.severity}] ${issue.message}`)
}

// 4. 导出报告
const exportEngine = new ExportEngine(scanResult, checkResult, {
  projectName: 'My Project',
  projectVersion: '1.0.0',
  outputDir: './reports'
})

// 导出所有格式
const all = exportEngine.exportAll()
console.log(all.json.path)
console.log(all.markdown.path)
console.log(all.html.path)
console.log(all.notice.path)

// 或者导出单个格式
const json = exportEngine.exportJson()
const md = exportEngine.exportMarkdown()
const html = exportEngine.exportHtml()
const notice = exportEngine.exportNotice()
```

## 测试

项目包含基础测试用例，使用 Node.js 内置测试框架。

### 运行测试

```bash
npm test
```

### 测试文件

- `tests/test-license-risk-assessor.js` - 许可证风险评估器测试
- `tests/test-parsers.js` - 各种解析器测试

### 测试覆盖

- 许可证标准化
- 风险等级评估
- Copyleft 检测
- 网络服务风险检测
- NOTICE 要求检测
- 归因要求检测
- npm 依赖解析
- Python 依赖解析
- CSV 解析（正常和异常情况）
- 覆盖配置解析
- 许可证文件检测

## 故障排除

### 常见问题

#### Q: 扫描结果为空？

**可能原因:**
- 项目目录中没有 package.json、requirements.txt 或 third_party.csv
- 路径不正确

**解决方法:**
```bash
# 确认目录存在
ls -la /path/to/project

# 确认包含至少一个配置文件
ls -la /path/to/project/package.json
ls -la /path/to/project/requirements.txt
ls -la /path/to/project/third_party.csv
```

#### Q: CSV 解析失败？

**可能原因:**
- 缺少必需列（name, license）
- 列数不一致
- 许可证类型不被识别

**解决方法:**
确保 CSV 文件至少包含 `name` 和 `license` 两列：
```csv
name,license
my-package,MIT
```

许可证类型应使用标准 SPDX 标识符：
- MIT, Apache-2.0, GPL-3.0, AGPL-3.0, LGPL-3.0, BSD-2-Clause, BSD-3-Clause, MPL-2.0, Unlicense, CC0-1.0

#### Q: 许可证被标记为 UNKNOWN？

**可能原因:**
- 许可证字符串格式不标准
- 工具无法识别该许可证

**解决方法:**
使用 overrides.json 覆盖：
```json
{
  "licenseOverrides": {
    "unknown-package": {
      "license": "MIT",
      "source": "手动核实"
    }
  }
}
```

#### Q: 如何忽略某些依赖？

**解决方法:**
在 overrides.json 中配置：
```json
{
  "ignorePackages": ["internal-package", "private-dep"],
  "exclusions": {
    "devDependencies": true,
    "packages": ["temp-package"]
  }
}
```

#### Q: 如何手动指定许可证？

**解决方法:**
方法 1: 使用 third_party.csv
```csv
name,version,license,source,notes
some-package,1.0.0,MIT,npm,已手动确认
```

方法 2: 使用 overrides.json
```json
{
  "licenseOverrides": {
    "some-package": {
      "license": "MIT",
      "source": "手动核实",
      "version": "1.0.0"
    }
  }
}
```

### 错误代码

| 退出码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1 | 执行失败（错误或严格模式下的警告） |

### 调试

使用 `-v` 或 `--verbose` 选项获取详细输出：

```bash
license-check scan -v -d ./samples/sample-project
```

## 项目结构

```
zy1105/
├── package.json              # 项目配置
├── README.md                 # 本文档
├── src/
│   ├── cli.js                # CLI 入口
│   ├── core/
│   │   ├── LicenseRiskAssessor.js   # 许可证风险评估器
│   │   ├── ScanEngine.js            # 扫描引擎
│   │   ├── CheckEngine.js           # 检查引擎
│   │   └── ExportEngine.js          # 导出引擎
│   └── parsers/
│       ├── NpmDependencyParser.js   # npm 依赖解析器
│       ├── PythonDependencyParser.js # Python 依赖解析器
│       ├── ThirdPartyCsvParser.js   # CSV 解析器
│       ├── LicenseNoticeParser.js   # 许可证/NOTICE 解析器
│       └── OverridesParser.js       # 覆盖配置解析器
├── tests/
│   ├── test-license-risk-assessor.js
│   └── test-parsers.js
└── samples/
    └── sample-project/     # 示例项目
        ├── package.json
        ├── requirements.txt
        ├── third_party.csv
        ├── LICENSE
        ├── NOTICE
        └── overrides.json
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

## 免责声明

本工具仅供参考，不构成法律建议。对于重要的商用项目，建议咨询专业法律人士。
