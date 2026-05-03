# 焦点顺序体检员 (Focus Order Inspector)

一个专门为无障碍审查员设计的本地命令行工具，用于审核政务网页的焦点顺序、ARIA 可访问性和键盘导航问题。

## 功能特性

- **自动检测问题**: 焦点跳到隐藏元素、弹窗未困住焦点、按钮无可读名称、快捷键冲突等
- **完整工作流**: 从 `init` 初始化示例 → `scan` 解析数据 → `check` 规则检查 → `review` 人工复核 → `report` 导出报告
- **多格式导出**: 支持 Markdown、CSV、JSON 审计包
- **结构化数据**: 支持 HTML 快照、Tab 轨迹 JSON、关键操作清单三种输入

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装

```bash
# 克隆项目
cd focus-order-inspector

# 安装依赖
npm install

# 构建项目
npm run build

# 链接到全局（可选）
npm link
```

### 验证安装

```bash
# 查看版本
npx foi --version

# 查看帮助
npx foi --help
```

## 完整工作流程

### 第一步：初始化项目

创建一个新的审查项目，包含示例文件。

```bash
# 在当前目录创建示例项目
npx foi init

# 或指定目录
npx foi init -d ./my-audit
```

初始化后会生成以下文件：
- `snapshot.html` - HTML 页面快照示例
- `trajectory.json` - Tab 键盘轨迹记录示例
- `operations.json` - 关键操作清单示例
- `foi.config.json` - 项目配置文件

### 第二步：扫描解析数据

解析 HTML 快照、轨迹 JSON 和操作清单。

```bash
# 使用默认路径
npx foi scan

# 指定文件路径
npx foi scan \
  -s ./my-page.html \
  -t ./my-trajectory.json \
  -o ./my-operations.json
```

扫描完成后会在 `.foi-output/scan-result.json` 生成结构化的扫描结果。

#### 输入文件格式说明

**1. HTML 快照 (`snapshot.html`)**

标准的 HTML 文件，包含页面的完整 DOM 结构。

**2. Tab 轨迹 JSON (`trajectory.json`)**

记录用户按 Tab 键时的焦点移动轨迹：

```json
{
  "pageUrl": "http://example.gov/service/apply",
  "snapshotId": "snapshot-20240115-1030",
  "timestamp": 1705297800000,
  "items": [
    {
      "timestamp": 1705297800100,
      "selector": "#name",
      "xpath": "//input[@id='name']",
      "tagName": "INPUT",
      "textContent": "",
      "ariaLabel": null,
      "visible": true,
      "isFocused": true,
      "isModal": false
    }
  ],
  "metadata": {
    "browser": "Chrome 120.0",
    "viewport": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

**3. 关键操作清单 (`operations.json`)**

定义页面上的关键操作和预期的焦点流：

```json
[
  {
    "id": "op-001",
    "description": "填写姓名",
    "selector": "#name",
    "operationType": "input",
    "expectedFlow": ["#name", "#idcard"],
    "required": true
  },
  {
    "id": "op-002",
    "description": "打开预览弹窗",
    "selector": "#open-modal",
    "operationType": "modal",
    "expectedFlow": ["#modal-close", "#modal-confirm"],
    "required": true
  }
]
```

操作类型可选值：
- `click` - 点击操作
- `input` - 文本输入
- `select` - 下拉选择
- `modal` - 打开模态对话框
- `navigation` - 页面导航

### 第三步：执行规则检查

运行所有无障碍规则检查，输出问题列表。

```bash
# 使用默认扫描结果
npx foi check

# 指定输入路径
npx foi check -i ./.foi-output/scan-result.json

# 只检查特定规则
npx foi check -r focus_to_hidden,modal_not_trapped

# 只显示指定严重级别的问题
npx foi check --severity critical,high

# 不显示详情
npx foi check --no-details
```

#### 检测规则说明

| 规则 ID | 严重级别 | 说明 |
|---------|----------|------|
| `focus_to_hidden` | Critical | Tab 焦点跳到了隐藏元素 |
| `modal_not_trapped` | Critical | 模态对话框未困住焦点 |
| `no_readable_name` | Critical/High | 交互元素缺少可读名称 |
| `shortcut_conflict` | High/Medium | accesskey 快捷键冲突 |
| `focus_order_violation` | High | 焦点顺序与 DOM 顺序不一致 |
| `tabindex_issue` | Medium | tabindex 属性不当使用 |
| `aria_role_mismatch` | High/Low | ARIA role 与原生语义不匹配 |

#### 问题严重级别定义

| 级别 | 说明 | 优先级 |
|------|------|--------|
| **Critical (严重)** | 核心功能不可用，严重影响残障用户 | 必须立即修复 |
| **High (高)** | 显著影响可用性 | 近期修复 |
| **Medium (中)** | 一定影响可用性 | 建议修复 |
| **Low (低)** | 最佳实践，影响较小 | 可选修复 |

检查完成后会生成 `.foi-output/check-result.json`。

### 第四步：人工复核问题

对自动检测出的问题进行人工确认或忽略。

```bash
# 交互式复核
npx foi review

# 仅列出问题
npx foi review --list

# 设置单个问题状态
npx foi review --set-status focus_to_hidden-xxx:confirmed

# 只复核新问题
npx foi review --only-new
```

#### 交互式复核操作

在交互式模式下，每个问题会提供以下选项：

- **c (确认问题)** - 确认这是一个需要修复的问题
- **i (忽略问题)** - 标记为误报或无需处理
- **f (已修复)** - 问题已修复
- **s (跳过)** - 暂时跳过，稍后处理
- **q (退出)** - 保存当前进度并退出

#### 问题状态流转

```
      ┌─────────┐
      │  new    │ ← 新检测出的问题
      └────┬────┘
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
┌──────────┐ ┌─────────┐ ┌────────┐
│confirmed │ │ ignored │ │ fixed  │
│ 已确认   │ │  已忽略  │ │ 已修复 │
└──────────┘ └─────────┘ └────────┘
```

### 第五步：导出审计报告

导出最终的审计报告，支持多种格式。

```bash
# 导出所有格式（推荐）
npx foi report

# 指定输出目录
npx foi report -o ./audit-report

# 只导出指定格式
npx foi report -f markdown
npx foi report -f csv
npx foi report -f json

# 设置报告名称
npx foi report --name "政务服务大厅首页_无障碍审计报告"

# 包含已标记为修复或忽略的问题
npx foi report --include-fixed --include-ignored
```

#### 导出格式说明

**1. Markdown 报告 (`audit-report.md`)**

完整的审计报告，包含：
- 概览（快照信息、问题统计）
- 问题摘要（按类型、严重级别分布）
- 焦点顺序分析
- 关键操作清单
- 详细问题描述（每个问题包含：描述、元素信息、修复建议、参考标准）
- WCAG 标准参考
- 附录（严重级别定义、问题类型说明）

**2. CSV 问题清单 (`issues.csv`)**

适合导入 Excel 或项目管理工具，包含以下列：
- ID - 问题唯一标识
- 严重级别
- 问题类型
- 标题
- 描述
- 建议
- 元素选择器
- 元素 XPath
- 标签名
- 文本内容
- 状态
- 复核备注
- 轨迹位置
- 创建时间

**3. JSON 审计包 (`audit-package.json`)**

完整的结构化数据，包含：
- 版本信息
- 生成时间
- 快照 ID
- 完整检查结果
- 复核会话（如已复核）
- 汇总统计

## 项目结构

```
focus-order-inspector/
├── src/
│   ├── cli/                    # 命令行界面
│   │   ├── index.ts           # 入口文件
│   │   └── commands/          # 子命令
│   │       ├── init.ts        # 初始化命令
│   │       ├── scan.ts        # 扫描命令
│   │       ├── check.ts       # 检查命令
│   │       ├── review.ts      # 复核命令
│   │       └── report.ts      # 导出命令
│   ├── parser/                 # 解析器
│   │   ├── html-parser.ts     # HTML 解析器
│   │   ├── trajectory-parser.ts # 轨迹解析器
│   │   └── operations-parser.ts # 操作清单解析器
│   ├── rules/                  # 规则引擎
│   │   ├── rules-engine.ts    # 规则引擎主类
│   │   ├── rule.interface.ts  # 规则接口
│   │   └── rules/             # 具体规则实现
│   │       ├── focus-to-hidden.rule.ts
│   │       ├── modal-not-trapped.rule.ts
│   │       ├── no-readable-name.rule.ts
│   │       ├── shortcut-conflict.rule.ts
│   │       ├── focus-order-violation.rule.ts
│   │       ├── tabindex-issue.rule.ts
│   │       └── aria-role-mismatch.rule.ts
│   ├── storage/                # 存储模块
│   │   └── review-storage.ts  # 复核结果存储
│   ├── exporter/               # 导出模块
│   │   └── exporter.ts        # 多格式导出
│   └── types/                  # 类型定义
│       └── index.ts
├── tests/                      # 测试文件
│   ├── parser/
│   └── rules/
├── dist/                       # 编译输出
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 命令参考

### foi init

```
foi init [options]

初始化示例项目，生成 HTML 快照、轨迹 JSON 和操作清单

选项:
  -d, --directory <path>  目标目录 (默认: "./audit-project")
  --no-sample             不创建示例文件
  -h, --help              显示帮助信息
```

### foi scan

```
foi scan [options]

解析页面快照、Tab 轨迹和操作清单

选项:
  -s, --snapshot <path>    HTML 快照路径 (默认: "snapshot.html")
  -t, --trajectory <path>  轨迹 JSON 路径 (默认: "trajectory.json")
  -o, --operations <path>  操作清单路径 (默认: "operations.json")
  -c, --config <path>      配置文件路径 (默认: "foi.config.json")
  --output <path>           输出目录 (默认: ".foi-output")
  -h, --help                显示帮助信息
```

### foi check

```
foi check [options]

执行无障碍检查，输出焦点顺序、ARIA名称、对话框陷阱和快捷键风险

选项:
  -i, --input <path>      扫描结果路径 (默认: ".foi-output/scan-result.json")
  -o, --output <path>     输出目录 (默认: ".foi-output")
  -r, --rules <rules>     指定检查规则，逗号分隔
  --severity <level>      显示指定严重级别 (critical,high,medium,low)
  --no-summary            不显示摘要统计
  --no-details            不显示问题详情
  -h, --help              显示帮助信息
```

### foi review

```
foi review [options]

人工复核问题，可确认或忽略问题

选项:
  -c, --check-result <path>  检查结果路径 (默认: ".foi-output/check-result.json")
  -o, --output <path>         输出目录 (默认: ".foi-output")
  --all                       复核所有问题（包括已处理过的）
  --only-new                  只复核新问题
  --list                      仅列出问题，不进入复核
  --set-status <issueId:status>  设置单个问题状态
  -h, --help                  显示帮助信息
```

### foi report

```
foi report [options]

导出审计报告，支持 Markdown、CSV 和 JSON 格式

选项:
  -c, --check-result <path>  检查结果路径 (默认: ".foi-output/check-result.json")
  -r, --review <path>         复核结果路径
  -o, --output <path>         输出目录 (默认: "audit-report")
  -f, --format <format>       导出格式 (markdown,csv,json,all) (默认: "all")
  --name <name>               报告名称
  --include-fixed             包含已标记为修复的问题
  --include-ignored           包含已标记为忽略的问题
  -h, --help                  显示帮助信息
```

## 验证流程示例

### 使用示例数据验证

```bash
# 1. 初始化示例项目
npx foi init -d ./test-audit
cd ./test-audit

# 2. 扫描解析数据
npx foi scan

# 3. 执行规则检查
npx foi check

# 4. （可选）人工复核
npx foi review

# 5. 导出报告
npx foi report -o ./report
```

### 预期的检测结果

使用示例数据运行 `foi check` 应该会检测出以下问题：

1. **焦点跳到隐藏元素** - 示例中有一个隐藏的 input 字段
2. **对话框未困住焦点** - 示例中的模态框焦点可以逃离
3. **按钮缺少可读名称** - "预览申请" 按钮的文本可能不够明确
4. **自定义可聚焦元素** - 带有 tabindex="0" 的 div 缺少语义

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --testPathPattern=html-parser
npm test -- --testPathPattern=rules-engine

# 运行测试并生成覆盖率报告
npm test -- --coverage
```

## 配置文件

项目根目录的 `foi.config.json` 可以配置默认行为：

```json
{
  "version": "1.0.0",
  "project": {
    "name": "无障碍审查项目",
    "description": "焦点顺序体检员项目配置"
  },
  "paths": {
    "snapshot": "snapshot.html",
    "trajectory": "trajectory.json",
    "operations": "operations.json",
    "output": ".foi-output"
  },
  "rules": {
    "enabled": [
      "focus_to_hidden",
      "modal_not_trapped",
      "no_readable_name",
      "shortcut_conflict",
      "focus_order_violation"
    ]
  }
}
```

## 无障碍标准参考

### WCAG 2.1 相关标准

| 编号 | 标准 | 级别 | 说明 |
|------|------|------|------|
| 2.4.3 | Focus Order | A | 键盘焦点顺序应符合逻辑 |
| 2.4.7 | Focus Visible | AA | 键盘焦点指示器应可见 |
| 2.1.1 | Keyboard | A | 所有功能应可通过键盘访问 |
| 2.1.4 | Character Key Shortcuts | A | 单字符快捷键应可关闭或重新映射 |
| 1.1.1 | Non-text Content | A | 非文本内容应有替代文本 |
| 2.4.4 | Link Purpose (In Context) | A | 链接目的在上下文中应清晰 |
| 4.1.2 | Name, Role, Value | A | UI 组件应提供名称、角色和值 |
| 1.3.1 | Info and Relationships | A | 信息、结构和关系应可通过程序确定 |

### ARIA 最佳实践

- [ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/)
- [Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/)
- [Using ARIA](https://www.w3.org/TR/using-aria/)

## 常见问题

### Q: 如何获取页面的 HTML 快照？

A: 在浏览器中：
1. 打开开发者工具 (F12)
2. 在 Elements 面板右键点击 `<html>` 标签
3. 选择 "Copy" → "Copy outer HTML"
4. 粘贴到文件中保存为 `.html`

### Q: 如何记录 Tab 轨迹？

A: 可以使用浏览器扩展或手动记录，需要捕获：
- 每次 Tab 键按下时获得焦点的元素
- 元素的选择器、XPath、标签名
- 元素是否可见
- 是否在模态框中

### Q: 如何处理检测出的误报？

A: 使用 `foi review` 命令将问题标记为 `ignored` 并添加备注说明原因。导出报告时可以选择包含或忽略这些标记。

### Q: 可以只检查特定规则吗？

A: 可以，使用 `-r` 参数指定规则列表：

```bash
npx foi check -r focus_to_hidden,modal_not_trapped
```

## 版本历史

- **1.0.0** - 初始版本
  - 实现核心命令：init、scan、check、review、report
  - 实现 7 个检测规则
  - 支持 Markdown、CSV、JSON 导出
  - 支持交互式复核

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

**注意**: 此工具旨在辅助无障碍审查，不能替代人工审查。建议将自动检测结果与人工复核相结合，确保全面的无障碍合规性。
