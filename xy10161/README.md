# 日志脱敏发布检查 CLI

一个本地日志脱敏检查工具，用于发布前检查日志样例中是否混有手机号、证件号、调试 token 等敏感信息。

## 功能特性

- **规则集加载**: 支持默认规则、从文件/目录加载自定义规则
- **样例扫描**: 支持文本扫描、单文件扫描、目录递归扫描
- **误报白名单**: 支持精确匹配、规则匹配、正则模式匹配
- **严重级别**: Critical / High / Medium / Low 四级分类
- **阻断码**: 每种规则有独立的阻断码，方便 CI 集成
- **脱敏报告**: 支持 JSON、Markdown、HTML 三种导出格式
- **配置检测**: 重复导入、坏数据、配置变化都有清楚反馈

## 快速开始

### 安装依赖

```bash
npm install
```

### 链接 CLI

```bash
npm link
```

## 命令说明

### 1. rules - 规则集管理

查看和管理规则集。

```bash
# 查看默认规则
log-scan rules

# 从文件加载规则
log-scan rules -f config/rules.json

# 从目录加载规则
log-scan rules -d config/

# 不加载默认规则，只加载自定义规则
log-scan rules -f config/rules.json --no-default
```

### 2. scan - 扫描日志

扫描单个日志文件或目录。

```bash
# 扫描单个文件
log-scan scan samples/log-sample-1.txt

# 扫描目录
log-scan scan samples/

# 使用自定义规则
log-scan scan samples/log-sample-1.txt -r config/rules.json

# 使用白名单
log-scan scan samples/log-sample-2.txt -w config/whitelist.json

# 导出 JSON 报告
log-scan scan samples/log-sample-1.txt -f json -o reports/scan-result.json

# 即使发现问题也不阻断（exit code 0）
log-scan scan samples/log-sample-1.txt --no-block
```

### 3. check - 完整检查流程

完整的发布前检查流程：加载规则 → 扫描样例 → 应用白名单 → 导出报告。

```bash
# 基本使用
log-scan check samples/

# 自定义规则和白名单
log-scan check samples/ -r config/rules.json -w config/whitelist.json

# 自定义报告输出
log-scan check samples/ -o reports/ -n release-check

# 指定导出格式
log-scan check samples/ --formats json,md,html
```

## 验收流程

按以下步骤可以完整验收所有功能。

### 步骤 1: 安装和准备

```bash
# 1. 安装依赖
npm install

# 2. 链接 CLI
npm link

# 3. 查看帮助
log-scan --help
log-scan rules --help
log-scan scan --help
log-scan check --help
```

### 步骤 2: 规则集加载测试

```bash
# 测试 1: 查看默认规则
log-scan rules

# 预期输出:
# - 显示 4 条默认规则（手机号、身份证号、调试Token、邮箱）
# - 每条规则显示严重级别、阻断码、来源

# 测试 2: 加载自定义规则
log-scan rules -f config/rules.json

# 预期输出:
# - 显示 5 条规则（比默认多了银行卡号）
# - 银行卡号严重级别为 Critical

# 测试 3: 坏数据处理（无效规则）
log-scan rules -f config/bad-rules.json

# 预期输出:
# - 新增 1 条规则（validRule）
# - 2 条规则无效（invalidPattern 正则无效，missingPattern 缺少 pattern）
# - 1 条规则被禁用（disabledRule）

# 测试 4: 重复导入（状态会被持久化）
# 首先重置状态，然后连续运行两次
log-scan rules --reset -f config/rules.json
log-scan rules -f config/rules.json

# 预期输出（第一次）:
# - 显示"已重置持久化状态"
# - 显示"新增 1 条规则"、"更新 4 条规则"
# - 显示 5 条规则列表（含银行卡号）

# 预期输出（第二次）:
# - 显示"重复导入，文件未变化（仍会加载规则）"
# - 规则会被加载（显示 5 条规则）
# - 状态会被持久化到临时文件

# 测试 5: 查看持久化状态
# 状态文件位置：系统临时目录下的 log-scan-state.json


### 步骤 3: 样例扫描测试

```bash
# 测试 1: 扫描有问题的日志
log-scan scan samples/log-sample-1.txt

# 预期输出:
# - 发现问题: 手机号 (High)、身份证号 (Critical)、调试Token (Critical)、邮箱 (Medium)
# - 阻断码: BLOCK_PHONE, BLOCK_IDCARD, BLOCK_TOKEN
# - 程序以 exit code 1 退出

# 测试 2: 扫描干净的日志
log-scan scan samples/clean-log.txt

# 预期输出:
# - 未发现任何问题
# - 程序以 exit code 0 退出

# 测试 3: 扫描目录
log-scan scan samples/

# 预期输出:
# - 扫描 3 个文件
# - 汇总所有发现的问题

# 测试 4: 使用 --no-block 不阻断
log-scan scan samples/log-sample-1.txt --no-block

# 预期输出:
# - 虽然发现问题，但 exit code 为 0
```

### 步骤 4: 误报白名单测试

```bash
# 测试 1: 不使用白名单扫描
log-scan scan samples/log-sample-2.txt -r config/rules.json

# 预期发现:
# - 银行卡号 (Critical)
# - 手机号 (High)
# - 邮箱 test@example.com (Medium)
# - token internal-debug-token-12345 (Critical)
# - 阻断码: BLOCK_BANKCARD, BLOCK_PHONE, BLOCK_EMAIL, BLOCK_TOKEN
# - exit code: 1

# 测试 2: 使用白名单扫描（关键验证！）
log-scan scan samples/log-sample-2.txt -r config/rules.json -w config/whitelist.json

# 预期输出（白名单过滤后的数据）:
# - 统计: Critical: 1, High: 1, Medium: 0
# - 有效问题: 银行卡号、手机号
# - 白名单排除: test@example.com、internal-debug-token-12345
# - 阻断码: BLOCK_BANKCARD, BLOCK_PHONE（注意：不包含 BLOCK_EMAIL, BLOCK_TOKEN）
# - 白名单原因会显示

# 测试 3: 所有问题都在白名单中（验证不会误阻断）
log-scan scan samples/whitelist-only-test.txt -r config/rules.json -w config/whitelist.json

# 预期输出（完全通过，不阻断）:
# - 有效问题: 0
# - 白名单排除: 2
# - 无阻断码显示
# - 显示"扫描完成"
# - exit code: 0（关键！不会误阻断）

# 测试 4: 查看白名单效果报告
log-scan check samples/log-sample-2.txt -r config/rules.json -w config/whitelist.json -n whitelist-test
# 然后打开 reports/whitelist-test.html 查看可视化报告
```

### 步骤 5: 完整检查流程测试

```bash
# 完整检查流程
log-scan check samples/ -r config/rules.json -w config/whitelist.json -o reports/ -n full-check

# 预期输出:
# 步骤 1/4: 加载规则集
#   - 已加载默认规则: 4 条
#   - 已加载自定义规则
#   - ✅ 加载规则集完成
#
# 步骤 2/4: 扫描样例
#   - 扫描目录: ...
#   - 扫描文件数: 3
#   - 初始发现: X 条
#   - ✅ 扫描样例完成
#
# 步骤 3/4: 应用白名单
#   - 加载白名单条目: 2 条
#   - 白名单排除: 2 条
#   - 有效问题: X 条
#   - ✅ 应用白名单完成
#
# 步骤 4/4: 生成报告
#   - 已导出: reports/full-check.json
#   - 已导出: reports/full-check.md
#   - 已导出: reports/full-check.html
#   - ✅ 生成报告完成
#
# 检查摘要:
#   - 扫描文件数: 3
#   - 加载规则数: 5
#   - 白名单条目: 2
#   - 发现问题: X
#   - 白名单排除: 2
#   - 有效问题: X
#   - 阻断码: ...
#
# ❌ 检查结果: 阻断发布 或 ✅ 检查结果: 通过
```

### 步骤 6: 报告导出验证

```bash
# 1. 检查生成的文件
ls -la reports/

# 预期看到:
# - full-check.json
# - full-check.md
# - full-check.html

# 2. 查看 JSON 报告结构
cat reports/full-check.json

# 预期包含:
# - generatedAt
# - context (扫描目标、规则数、白名单数等)
# - summary (各级别计数、阻断码)
# - findings (发现的问题列表)
# - whitelisted (白名单排除列表)
# - shouldBlock

# 3. 查看 Markdown 报告
cat reports/full-check.md

# 4. 在浏览器中打开 HTML 报告
open reports/full-check.html

# 预期:
# - 状态显示（阻断发布 / 检查通过）
# - 摘要统计卡片
# - 阻断码列表
# - 按严重级别分类的问题列表
# - 白名单排除列表
```

### 步骤 7: 配置变化重跑测试

```bash
# 1. 第一次运行
log-scan check samples/ -o reports/ -n run1

# 2. 修改规则文件（例如禁用某个规则）
# 编辑 config/rules.json，将 phone 的 enabled 设为 false

# 3. 第二次运行（使用修改后的规则）
log-scan check samples/ -r config/rules.json -o reports/ -n run2

# 预期:
# - 手机号规则不再触发
# - 发现的问题数量减少

# 4. 恢复原配置
# 编辑 config/rules.json，移除 enabled: false
```

## 规则文件格式

规则文件为 JSON 格式，每个规则包含以下字段：

```json
{
  "ruleId": {
    "name": "规则名称",
    "pattern": "正则表达式",
    "severity": "critical|high|medium|low",
    "blockCode": "BLOCK_CODE",
    "description": "规则描述",
    "enabled": true
  }
}
```

## 白名单文件格式

白名单文件为 JSON 数组，每个条目包含以下字段：

```json
[
  {
    "id": "唯一标识",
    "ruleId": "匹配的规则 ID（可选）",
    "match": "精确匹配的内容（可选）",
    "filePath": "匹配的文件路径（可选）",
    "pattern": "正则匹配模式（可选）",
    "reason": "白名单原因"
  }
]
```

## 严重级别说明

| 级别 | 说明 | 是否阻断 |
|------|------|----------|
| Critical | 致命问题，如身份证号、银行卡号、Token | 是 |
| High | 高危问题，如手机号 | 是 |
| Medium | 中危问题，如邮箱 | 否 |
| Low | 低危问题 | 否 |

只要存在 Critical 或 High 级别的问题，程序会以 exit code 1 退出，阻断发布流程。

## CI/CD 集成示例

```yaml
# .gitlab-ci.yml 示例
stages:
  - security-check

log-scan:
  stage: security-check
  script:
    - npm install
    - npm link
    - log-scan check logs/ -r config/rules.json -w config/whitelist.json
  only:
    - master
    - develop
```

```bash
# Jenkins Pipeline 示例
stage('Log Security Check') {
  steps {
    sh 'npm install'
    sh 'npm link'
    sh 'log-scan check logs/ -r config/rules.json -w config/whitelist.json'
  }
}
```

## 项目结构

```
.
├── README.md
├── package.json
├── src/
│   ├── cli.js          # CLI 入口
│   ├── rules.js        # 规则集加载
│   ├── scanner.js      # 扫描器
│   ├── whitelist.js    # 白名单管理
│   ├── report.js       # 报告生成
│   └── index.js        # 模块导出
├── config/
│   ├── rules.json      # 示例规则
│   ├── whitelist.json  # 示例白名单
│   └── bad-rules.json  # 坏数据测试用例
├── samples/
│   ├── log-sample-1.txt  # 有问题的日志
│   ├── log-sample-2.txt  # 有问题的日志（可测试白名单）
│   └── clean-log.txt     # 干净的日志
└── reports/             # 报告输出目录
```

## License

MIT
