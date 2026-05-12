# 云账单标签修复 CLI

一个用于处理云资源账单缺标签或标签错误时，按项目、环境和负责人修复分摊的命令行工具。

## 功能特性

- **完整的操作链路**：init → import → check → detail → report
- **历史追踪**：每一步操作都有完整的历史记录、操作者和失败原因
- **核心规则**：
  - 重复导入账单自动跳过（幂等性）
  - 人工修正保留原标签，自动修复不会覆盖
  - 无法归属资源标记为 UNASSIGNED
  - 停用项目仍计费自动识别并高亮
  - 重复执行保持幂等
  - 人工修正必须留下前后差异和操作者
- **样例数据**：内置计算（EC2/ECS）、存储（OSS/NAS）和数据库（RDS/Redis）费用样例
- **可视化报告**：修复前后各项目成本差异、未归属资源和负责人

## 环境要求

- Python 3.7+
- 依赖：`click`, `tabulate`

## 快速开始

### 1. 安装依赖

```bash
python3 -m pip install -r requirements.txt
```

### 2. 初始化项目

```bash
# 初始化数据目录并导出样例数据
python3 cli.py init

# 强制重新初始化（会清空已有数据）
python3 cli.py init --force
```

初始化后会在当前目录创建 `.cloudbill_data/` 目录，包含：
- `samples/` - 样例数据文件
- `bills.json` - 账单数据存储
- `resources.json` - 资源清单存储
- `strategies.json` - 标签策略存储
- `owners.json` - 负责人映射存储
- `projects.json` - 项目定义存储
- `batches.json` - 导入批次记录
- `history.json` - 操作历史记录

### 3. 导入样例数据

```bash
# 一键导入所有样例数据
python3 cli.py import-cmd all

# 或分别导入
python3 cli.py import-cmd projects .cloudbill_data/samples/projects_sample.json
python3 cli.py import-cmd owners .cloudbill_data/samples/owners_sample.json
python3 cli.py import-cmd strategies .cloudbill_data/samples/strategies_sample.json
python3 cli.py import-cmd resources .cloudbill_data/samples/resources_sample.json
python3 cli.py import-cmd bills .cloudbill_data/samples/bills_sample.json
```

### 4. 检查账单状态

```bash
# 检查所有账单的标签问题
python3 cli.py check

# 检查并自动修复
python3 cli.py check --auto-fix --operator your_name
```

### 5. 查看账单详情

```bash
# 查看单个账单的详情、标签和历史记录
python3 cli.py detail bill_012

# 查看账单的历史记录
python3 cli.py history bill_012
```

### 6. 人工修正

```bash
# 人工修正账单标签
python3 cli.py manual-fix bill_012 \
  --project common \
  --env shared \
  --owner common \
  --reason "无法归属的未知费用，挂公共成本" \
  --operator your_name
```

### 7. 生成修复报告

```bash
# 在控制台显示报告
python3 cli.py report

# 导出JSON报告
python3 cli.py report -o report.json
```

### 8. 其他命令

```bash
# 列出账单（可筛选）
python3 cli.py list
python3 cli.py list --status unassigned
python3 cli.py list --project ecommerce
python3 cli.py list --limit 5
```

## 内置样例说明

样例数据覆盖了以下场景：

### 账单样例（12条）
- **计算资源**：EC2、ECS 实例费用（6条）
- **存储资源**：OSS、NAS 存储费用（2条）
- **数据库资源**：RDS、Redis 数据库费用（3条）
- **未知费用**：无法识别的资源类型（1条）

### 预设场景
1. **完全正常**：3 条账单标签完整，无需修复
2. **缺标签**：7 条账单缺少部分或全部标签
3. **停用项目计费**：1 条账单属于已停用项目
4. **无法自动归属**：1 条未知资源类型需要人工处理

### 修复策略
- **标签策略**：OSS 资源自动归电商项目，NAS 自动归公共成本
- **资源清单**：5 条资源可补全标签信息
- **负责人映射**：通过项目代码自动查找负责人
- **项目定义**：5 个项目（2 个活跃 + 1 个公共成本 + 1 个监控 + 1 个停用）

## 主要演示路径

### 路径一：完整自动修复流程

```bash
# 1. 初始化
python3 cli.py init --force

# 2. 导入数据
python3 cli.py import-cmd all

# 3. 检查初始状态
python3 cli.py check
# 预期：41.7% 已修复，58.3% 未归属，8.3% 停用项目计费

# 4. 自动修复
python3 cli.py check --auto-fix
# 预期：91.7% 已修复，0% 未归属，8.3% 停用项目计费

# 5. 查看报告
python3 cli.py report
# 预期：公共成本从 3040 降到 890，项目成本重新分配
```

### 路径二：人工修正流程

```bash
# 1. 完成路径一的步骤 1-4

# 2. 查看未归属账单
python3 cli.py list --status unassigned

# 3. 查看账单详情
python3 cli.py detail bill_012

# 4. 人工修正
python3 cli.py manual-fix bill_012 \
  --project common \
  --env shared \
  --owner common \
  --reason "无法归属的未知费用，挂公共成本" \
  --operator zhangwei

# 5. 验证幂等性（再次自动修复不应覆盖）
python3 cli.py check --auto-fix
# 预期：变更 0 条记录

# 6. 查看历史记录
python3 cli.py detail bill_012
# 预期：显示"是否人工修正：是"和历史记录
```

### 路径三：重复导入（幂等性验证）

```bash
# 1. 记录初始账单数量
python3 cli.py list --limit 20

# 2. 再次导入同一份账单
python3 cli.py import-cmd bills .cloudbill_data/samples/bills_sample.json
# 预期：显示"跳过重复账单"的警告，成功 0 条

# 3. 验证账单数量不变
python3 cli.py list --limit 20
```

## 失败路径演示

### 失败路径一：人工修正到停用项目

```bash
# 尝试将账单修正到停用项目
python3 cli.py manual-fix bill_012 --project legacy --operator tester
# 预期：报错 "修正失败: 项目已停用: legacy"
```

### 失败路径二：导入已存在的账单

```bash
# 再次导入同一份账单
python3 cli.py import-cmd bills .cloudbill_data/samples/bills_sample.json
# 预期：显示警告 "跳过重复账单"，所有账单均被跳过
```

### 失败路径三：导入无效的 JSON 文件

```bash
# 尝试导入不存在的文件
python3 cli.py import-cmd bills /nonexistent/file.json
# 预期：报错显示文件不存在
```

## 数据格式说明

### 账单数据格式

```json
[
  {
    "bill_id": "bill_001",
    "resource_id": "ec2-prod-web-01",
    "resource_type": "ec2",
    "cost": 1280.50,
    "currency": "CNY",
    "billing_period": "2024-03",
    "billing_date": "2024-03-31",
    "provider": "aliyun",
    "project": "ecommerce",
    "env": "prod",
    "owner": "zhangwei"
  }
]
```

### 资源清单格式

```json
[
  {
    "resource_id": "oss-log-bucket",
    "resource_type": "oss",
    "provider": "aliyun",
    "project": "ecommerce",
    "env": "prod",
    "owner": "zhangwei"
  }
]
```

### 标签策略格式

```json
[
  {
    "strategy_id": "strat_oss_logs",
    "name": "OSS日志存储规则",
    "description": "所有OSS日志存储默认归属于电商项目",
    "resource_type_pattern": "oss",
    "tag_rules": {
      "project": "ecommerce",
      "env": "prod",
      "owner": "zhangwei"
    },
    "priority": 10,
    "is_active": true
  }
]
```

### 负责人映射格式

```json
[
  {
    "owner_id": "own_001",
    "name": "zhangwei",
    "email": "zhangwei@example.com",
    "projects": ["ecommerce", "common"],
    "is_active": true
  }
]
```

### 项目定义格式

```json
[
  {
    "project_id": "proj_ecommerce",
    "name": "电商平台",
    "code": "ecommerce",
    "status": "active",
    "description": "核心电商交易系统"
  }
]
```

## 账单状态说明

| 状态 | 说明 |
|------|------|
| `raw` | 原始状态，未处理 |
| `imported` | 已导入但未检查 |
| `fixed` | 标签完整，已修复 |
| `unassigned` | 标签不完整，无法归属 |
| `inactive_project` | 标签完整但项目已停用 |

## 规则优先级

自动修复时按以下优先级查找标签：

1. **资源清单**（最高优先级）- 资源级别标签
2. **标签策略** - 按资源类型匹配的规则
3. **负责人映射** - 通过项目自动推导负责人
4. **原始标签**（最低优先级）- 账单自带的标签

**注意**：人工修正的账单不会被自动修复覆盖。

## 项目结构

```
.
├── cli.py                    # CLI 入口
├── requirements.txt          # 依赖列表
├── README.md                 # 本文档
└── cloudbill/
    ├── __init__.py          # 包版本
    ├── models.py            # 数据模型定义
    ├── storage.py           # JSON 文件存储层
    ├── engine.py            # 规则引擎
    ├── importer.py          # 数据导入服务
    ├── report.py            # 报告生成器
    └── samples.py           # 内置样例数据
```

## 常见问题

**Q: 如何查看所有账单？**
```bash
python3 cli.py list
```

**Q: 如何只看未归属的账单？**
```bash
python3 cli.py list --status unassigned
```

**Q: 如何导出报告？**
```bash
python3 cli.py report -o report_202403.json
```

**Q: 如何重置所有数据？**
```bash
python3 cli.py init --force
```

**Q: 自动修复会覆盖我的人工修正吗？**
不会。人工修正的账单会标记 `is_manual_fix=True`，自动修复会跳过这些账单。
