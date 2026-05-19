# 农机合作社财务管理系统

## 项目概述

这是一个专为农机合作社设计的财务系统CLI工具，支持拖拉机按小时、亩数和油费混合计费。系统具有完整的导入验证、错误记录、计费处理、账单复核和敏感数据脱敏功能。

## 核心特性

### 1. 数据导入
- **作业单CSV**: 导入拖拉机作业记录
- **油耗表JSON**: 导入加油记录
- **费率表CSV**: 导入各拖拉机费率
- **错误处理**: 坏记录保留原始位置、失败原因和修复建议
- **幂等性**: 重复导入相同文件自动拦截

### 2. 混合计费引擎
- 按小时计费
- 按亩数计费
- 按油耗计费
- 三种方式混合计费

### 3. 完整工作流程
- 导入 → 计费 → 复核 → 导出 → 历史查询

### 4. 数据安全
- **多层脱敏**: 展示层、导出层、日志层分别应用不同脱敏规则
- **敏感字段**: 机手姓名、联系方式等自动脱敏

## 项目结构

```
├── src/
│   └── agri_finance/
│       ├── __init__.py          # 包初始化
│       ├── models.py            # 数据模型定义
│       ├── database.py          # SQLite数据库操作
│       ├── importer.py          # 数据导入模块
│       ├── billing.py           # 计费引擎
│       ├── security.py          # 脱敏处理
│       └── cli.py               # CLI命令入口
├── data/
│   └── raw/                     # 示例数据文件
├── tests/                       # 测试脚本
└── pyproject.toml               # 项目配置
```

## 安装

```bash
pip install -e .
```

## 使用指南

### 1. 导入数据

```bash
# 导入费率表
agri-fin import job data/raw/rate_sample.csv --operator admin

# 导入作业单
agri-fin import job data/raw/job_sample.csv --operator 财务小王

# 导入油耗表
agri-fin import fuel data/raw/fuel_sample.json --operator 财务小王
```

### 2. 执行计费

```bash
agri-fin bill
# 或指定批量大小
agri-fin bill --batch-size 100
```

### 3. 查询账单

```bash
# 查看所有账单
agri-fin list billing

# 按状态筛选
agri-fin list billing --status billed

# 限制显示数量
agri-fin list billing --limit 20
```

### 4. 复核账单

```bash
agri-fin review <账单ID> <复核人姓名>
```

### 5. 查看导入历史

```bash
agri-fin list history --limit 10
```

### 6. 查看错误记录

```bash
agri-fin list bad
```

### 7. 导出账单

```bash
# 导出CSV（已脱敏）
agri-fin export data/processed/bills.csv

# 导出JSON（已脱敏）
agri-fin export data/processed/bills.json --format json
```

## 数据模型

### JobRecord (作业记录)
- 拖拉机ID、机手ID、作业日期
- 工作小时数、作业亩数、油耗
- 计费类型、状态、原始数据

### BillingRecord (账单记录)
- 小时费、亩费、油费、总金额
- 状态: pending/billed/reviewed
- 复核人、复核时间

### BadRecord (错误记录)
- 批次ID、源类型、行号
- 错误信息、修复建议
- 原始数据保留

## 数据库位置

数据库文件位于用户主目录:
```
~/.agri_finance/finance.db
```

## 技术栈

- **Python 3.9+**: 开发语言
- **Click**: CLI框架
- **Pydantic 2.x**: 数据验证
- **SQLite**: 轻量存储
- **Rich**: 终端美化
- **Pandas**: 数据处理

## 幂等性保证

系统通过文件哈希校验防止重复导入:
- 相同文件内容重复导入自动拦截
- 保留原始批次信息
- 确保计费结果稳定一致
