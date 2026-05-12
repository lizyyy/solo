# 邮件退信归因 CLI (Bounce Attribution CLI)

一个本地可运行的邮件退信归因分析工具，帮助营销团队分析邮件退信原因，按退信码、域名、名单来源和重试结果进行归因。

## 功能特性

- **归因分析**: 按退信码、域名、名单来源多维度归因
- **状态区分**: 自动识别永久失败和临时失败
- **重试建议**: 智能判断哪些邮箱可以重试
- **幂等处理**: 重复导入相同数据不会产生副作用
- **历史追踪**: 记录所有状态变化和人工修正
- **人工修正**: 支持人工修正状态，记录操作者和原因
- **名单清洗**: 导出清洗后的有效邮箱名单
- **质量评分**: 提供投放质量综合评分

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化工作目录

在任意目录下运行（建议新建一个空目录）：

```bash
cd /path/to/your/workspace
node /path/to/project/bin/index.js init
```

或者先进入项目目录：

```bash
cd /Users/mac/pro/solo/workspaces/xy10590
node bin/index.js init
```

初始化时会自动加载内置样例数据，包含：
- 企业邮箱：company.com, techcorp.com, financebank.com, healthcare.org
- 个人邮箱：gmail.com, outlook.com, yahoo.com
- 临时失败场景
- 永久失败场景
- 退订名单

### 3. 查看数据概览

```bash
bounce list
```

或使用完整路径：

```bash
node bin/index.js list
```

### 4. 执行规则检查

```bash
bounce check
```

这一步会：
- 分析每个邮箱的退信历史
- 区分永久失败和临时失败
- 检查退订名单
- 更新状态并显示变化

### 5. 生成归因报告

```bash
bounce report
```

查看不同维度的报告：

```bash
bounce report --by-domain      # 按域名分组
bounce report --by-source      # 按名单来源分组
bounce report --by-bounce-code # 按退信码分组
```

导出清洗名单和重试建议：

```bash
bounce report --clean    # 导出有效邮箱名单
bounce report --retry    # 导出可重试邮箱名单
```

### 6. 查看特定邮箱详情

```bash
bounce detail invalid.user@company.com
```

人工修正状态：

```bash
bounce detail unknown.bounce@example.org --manual invalid --operator admin --reason "确认邮箱不存在"
```

## 完整演示路径

### 主流程演示

```bash
# 1. 初始化
bounce init

# 2. 查看数据
bounce list

# 3. 执行检查
bounce check

# 4. 生成完整报告
bounce report

# 5. 查看特定邮箱详情
bounce detail server.down@financebank.com

# 6. 导出清洗名单
bounce report --clean

# 7. 导出重试名单
bounce report --retry
```

### 失败路径演示

```bash
# 1. 初始化
bounce init

# 2. 查看高退信域名
bounce report --by-domain

# 观察到 financebank.com 有 3 次临时失败（服务不可用）
# 观察到 healthcare.org 有策略拦截（可能是发送频率问题）

# 3. 查看详情
bounce detail server.down@financebank.com
bounce detail policy.block@healthcare.org

# 4. 人工修正不确定的邮箱
bounce detail unknown.bounce@example.org --manual invalid --operator admin --reason "人工确认邮箱无效"

# 5. 重新检查
bounce check

# 6. 生成最终报告
bounce report
```

## 命令参考

### bounce init

初始化工作目录，创建配置文件和样例数据。

```bash
bounce init [--force]
```

- `--force`: 强制覆盖已有配置

### bounce import

导入数据文件或使用内置样例。

```bash
bounce import <type> [--file <path>] [--sample]
```

- `type`: 数据类型 (send, bounce, retry, source)
- `--file`: 数据文件路径 (JSON 格式)
- `--sample`: 使用内置样例数据

数据文件格式示例：

**send-logs.json**
```json
[
  {
    "id": "send-001",
    "email": "user@example.com",
    "campaign": "summer_sale_2024",
    "sentAt": "2024-06-01T10:00:00Z",
    "status": "sent",
    "source": "enterprise_list"
  }
]
```

**bounces.json**
```json
[
  {
    "id": "bounce-001",
    "email": "invalid@example.com",
    "bounceCode": "550",
    "message": "550 5.1.1 User unknown",
    "timestamp": "2024-06-01T11:00:00Z",
    "campaign": "summer_sale_2024",
    "source": "enterprise_list"
  }
]
```

### bounce list

查看数据概览。

```bash
bounce list [--type <type>]
```

- `--type`: 数据类型 (all, send, bounce, retry, source)

### bounce check

执行规则检查，更新状态。

```bash
bounce check
```

### bounce detail

查看特定邮箱详情或人工修正状态。

```bash
bounce detail <email> [--manual <status>] [--operator <name>] [--reason <text>]
```

- `--manual`: 人工修正状态 (valid, invalid, unsubscribed)
- `--operator`: 操作者名称（人工修正时必填）
- `--reason`: 修正原因

### bounce report

生成归因报告。

```bash
bounce report [--by-domain] [--by-source] [--by-bounce-code] [--clean] [--retry]
```

- `--by-domain`: 按域名分组
- `--by-source`: 按名单来源分组
- `--by-bounce-code`: 按退信码分组
- `--clean`: 导出清洗后的名单 (JSON + CSV)
- `--retry`: 导出重试建议名单 (JSON + CSV)

## 核心规则

### 退信码分类

**永久失败 (5xx)**:
- 550, 551, 553: 邮箱无效 - 不建议重试
- 552: 邮箱已满 - 可等待后重试 (7天)
- 500-504: 语法/命令错误 - 不建议重试

**临时失败 (4xx)**:
- 421, 441, 442: 服务不可用 - 可重试 (1天)
- 450, 451, 452: 处理中错误 - 可重试 (1天)
- 422: 邮箱已满(临时) - 可重试 (3天)
- 450 (策略拦截): 发送频率限制 - 降低频率后重试

### 重试规则

1. **已退订**: 不重试
2. **永久失败(邮箱无效)**: 不重试
3. **永久失败(邮箱已满)**: 7天后可重试
4. **临时失败**: 可重试，最多3次
5. **重试成功**: 标记为有效，可继续发送

### 幂等性保证

- 相同 ID 的记录重复导入会被跳过
- 内容相同的记录不会产生重复历史
- 重复执行 check 命令只会更新变化的状态

### 历史记录

每个邮箱的状态变更都会记录：
- 变更时间
- 变更类型 (created, updated, status_changed, manual_correction)
- 变更前后的状态
- 操作者（人工修正时）
- 变更原因

## 样例数据说明

内置样例包含以下场景：

| 邮箱 | 类型 | 退信码 | 状态 | 说明 |
|------|------|--------|------|------|
| john.doe@company.com | 企业 | - | 有效 | 无退信 |
| invalid.user@company.com | 企业 | 550 | 无效 | 邮箱不存在 |
| busy.mailbox@techcorp.com | 企业 | 552 | 临时退信 | 邮箱已满 |
| server.down@financebank.com | 企业 | 421 | 无效 | 服务不可用，重试3次失败 |
| policy.block@healthcare.org | 企业 | 450 | 有效 | 策略拦截，重试成功 |
| user123@gmail.com | 个人 | - | 有效 | 无退信 |
| test.user@outlook.com | 个人 | 451 | 有效 | 临时失败，重试成功 |
| unsubscribed.user@yahoo.com | 个人 | - | 已退订 | 用户退订 |
| unknown.bounce@example.org | 其他 | null | 需审核 | 缺少退信码 |

## 输出解读

### 投放质量评分

- **90-100**: 优秀 - 名单质量高，退信可控
- **70-89**: 良好 - 基本正常，关注临时退信
- **50-69**: 一般 - 需要优化，检查名单来源
- **0-49**: 较差 - 建议暂停投放，全面检查

### 域名归因

高退信率域名 (>50%) 可能意味着：
- 域名拦截（反垃圾邮件策略）
- 该域名下的名单质量差
- DNS 解析问题

### 来源归因

来源质量评价帮助判断：
- 哪些名单来源值得继续投入
- 哪些来源需要重新验证或淘汰

### 重试建议

导出的重试名单包含：
- 建议等待天数
- 重试原因
- 域名和来源信息

可用于分批发送策略。

## 项目结构

```
bounce-attribution-cli/
├── bin/
│   └── index.js              # CLI 入口
├── src/
│   ├── commands/
│   │   ├── init.js           # 初始化命令
│   │   ├── import.js         # 导入命令
│   │   ├── list.js           # 列表命令
│   │   ├── check.js          # 检查命令
│   │   ├── detail.js         # 详情命令
│   │   └── report.js         # 报告命令
│   ├── data/
│   │   └── sample-data.js    # 内置样例数据
│   └── utils/
│       ├── config.js         # 配置管理
│       └── rules.js          # 规则引擎
├── .bounce/                  # 工作目录（运行时创建）
│   ├── config.json           # 配置文件
│   ├── data/                 # 数据文件
│   └── history/              # 历史记录
├── exports/                  # 导出文件（运行时创建）
├── package.json
└── README.md
```

## 许可证

MIT
