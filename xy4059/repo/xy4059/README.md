# 蜂箱巡检批次追溯员

给流动蜂场养蜂人用的本地命令行工具，用于管理蜂箱巡检、用药、摇蜜记录，支持规则校验和计划生成。

## 功能特性

- 🐝 **配置管理**: 维护蜂场、箱号、蜂王年份、药物安全间隔
- 📥 **CSV 导入**: 支持导入巡检、用药、摇蜜记录
- ✅ **规则校验**: 自动校验日期倒序、箱号不存在、药物未登记、安全间隔、含水率等
- 📋 **隔离机制**: 校验失败的记录进入 quarantine.json 并说明原因
- 📅 **计划生成**: 生成下一轮巡检和禁采蜜提醒
- 📊 **报告导出**: Markdown 复盘、CSV 风险箱清单、JSON 审计包
- 🔍 **历史查询**: 按蜂场、箱号、批次查询历史记录

## 安装

```bash
# 安装依赖
pip install click

# 以开发模式安装
pip install -e .
```

## 快速开始：临时目录验证全流程

以下步骤演示如何在临时目录中完成一次完整的工作流验证。

### 1. 创建临时工作目录

```bash
# 创建临时目录
mkdir -p ~/tmp/beekeeper_demo
cd ~/tmp/beekeeper_demo
```

### 2. 初始化配置

```bash
# 初始化
beekeeper init

# 查看配置（此时为空）
beekeeper config list
```

### 3. 添加基础配置

```bash
# 添加蜂场
beekeeper config add-apiary "东山蜂场" --location "广东省广州市从化区" --notes "春季洋槐蜜源"
beekeeper config add-apiary "西山蜂场" --location "广东省清远市" --notes "夏季龙眼蜜源"

# 添加蜂箱
beekeeper config add-hive "A001" --apiary "东山蜂场" --queen-year 2025 --notes "新王群，群势强"
beekeeper config add-hive "A002" --apiary "东山蜂场" --queen-year 2024 --notes "老王群"
beekeeper config add-hive "A003" --apiary "东山蜂场" --queen-year 2023 --notes "老蜂王，需要关注"
beekeeper config add-hive "B001" --apiary "西山蜂场" --queen-year 2025

# 添加药物配置（安全间隔天数）
beekeeper config add-drug "氟胺氰菊酯" --interval 21 --description "治螨药物，安全间隔21天"
beekeeper config add-drug "甲酸" --interval 14 --description "熏蒸治螨"
beekeeper config add-drug "草酸" --interval 7 --description "冬季治螨"

# 查看配置
beekeeper config list
```

### 4. 准备 CSV 数据文件

创建以下 CSV 文件，或使用项目提供的示例文件：

#### 巡检记录 CSV (inspections.csv)

```csv
date,hive_number,colony_strength,queen_status,pests_diseases,feeding,notes
2026-04-15,A001,强,正常,无,喂糖,春季繁殖良好
2026-04-15,A002,中,正常,少量蜂螨,无,需要关注蜂螨
2026-04-15,A003,弱,停产,无,喂粉,蜂王停产，需要检查
2026-04-20,A001,强,正常,无,无,群势稳定
2026-04-20,A002,中,正常,蜂螨加重,无,建议用药
```

#### 用药/饲喂记录 CSV (treatments.csv)

```csv
date,hive_number,treatment_type,product_name,dosage,notes
2026-04-10,A001,饲喂,白糖浆,2kg/箱,奖励饲喂
2026-04-18,A002,用药,氟胺氰菊酯,1条/箱,治螨
2026-04-20,A003,饲喂,花粉饼,1块/箱,补充蛋白质
2026-04-25,A002,用药,甲酸,5ml/箱,续治螨
```

#### 摇蜜记录 CSV (harvests.csv)

```csv
date,hive_number,batch_number,quantity_kg,moisture_content,notes
2026-05-01,A001,B20260501,12.5,17.8,洋槐蜜
2026-05-01,A003,B20260501,8.2,18.1,洋槐蜜
2026-05-10,A001,B20260510,15.0,18.5,第二次取蜜
2026-05-10,A003,B20260510,6.5,19.0,群势一般
```

保存这些文件到当前目录。

### 5. 导入数据

```bash
# 导入巡检记录
beekeeper import-inspection inspections.csv

# 导入用药记录
beekeeper import-treatment treatments.csv

# 导入摇蜜记录（注意：A002 在 4月18日用了氟胺氰菊酯，安全间隔21天，5月1日还在安全期内）
beekeeper import-harvest harvests.csv
```

### 6. 测试隔离区功能

创建一个包含错误数据的 CSV 来测试隔离机制：

#### bad_inspections.csv

```csv
date,hive_number,colony_strength,queen_status,pests_diseases,feeding,notes
2026-04-15,A001,强,正常,无,喂糖,正常记录
2026-04-15,INVALID,中,正常,少量蜂螨,无,箱号不存在
2026-04-10,A001,强,正常,无,无,日期倒序
2026-04-20,A002,中,正常,蜂螨加重,无,正常记录
```

```bash
# 导入包含错误的数据
beekeeper import-inspection bad_inspections.csv

# 查看隔离区
beekeeper quarantine

# 查看统计
beekeeper stats
```

### 7. 生成巡检和采蜜计划

```bash
# 生成计划
beekeeper plan
```

你将看到：
- 巡检提醒列表（按优先级排序）
- 禁采蜜提醒（A002 因为在 4月18日用药，5月9日才能采蜜）
- 风险蜂箱清单

### 8. 导出报告

```bash
# 导出所有报告
beekeeper report

# 或指定输出目录
beekeeper report --output-dir ./my_reports
```

生成的报告包括：
- `report_YYYYMMDD_HHMMSS.md` - Markdown 复盘报告
- `risk_hives_YYYYMMDD_HHMMSS.csv` - 风险箱 CSV 清单
- `audit_YYYYMMDD_HHMMSS.json` - JSON 审计包

### 9. 历史查询

```bash
# 查询所有历史
beekeeper history

# 按箱号查询
beekeeper history --hive A001

# 按蜂场查询
beekeeper history --apiary "东山蜂场"

# 按批次查询
beekeeper history --batch B20260501

# 输出 JSON 格式
beekeeper history --hive A001 --json
```

## 命令详解

### `init` - 初始化

```bash
beekeeper init [--force]
```

创建配置文件 `beekeeper.json` 和数据目录 `.beekeeper_data`。

### `config` - 配置管理

```bash
# 查看配置
beekeeper config list

# 添加蜂场
beekeeper config add-apiary NAME [--location LOCATION] [--notes NOTES]

# 添加蜂箱
beekeeper config add-hive HIVE_NUMBER --apiary APIARY --queen-year YEAR [--notes NOTES]

# 添加药物
beekeeper config add-drug NAME --interval DAYS [--description DESC]
```

### `import-inspection` - 导入巡检记录

```bash
beekeeper import-inspection CSV_FILE [--skip-date-check]
```

**CSV 格式：**

| 字段 | 必填 | 说明 |
|------|------|------|
| date | ✅ | 日期 (YYYY-MM-DD 或 YYYY/MM/DD) |
| hive_number | ✅ | 箱号 |
| colony_strength | ❌ | 群势 (强/中/弱) |
| queen_status | ❌ | 蜂王状态 (正常/停产/失踪) |
| pests_diseases | ❌ | 病虫害 |
| feeding | ❌ | 饲喂情况 |
| notes | ❌ | 备注 |

### `import-treatment` - 导入用药/饲喂记录

```bash
beekeeper import-treatment CSV_FILE [--skip-date-check]
```

**CSV 格式：**

| 字段 | 必填 | 说明 |
|------|------|------|
| date | ✅ | 日期 |
| hive_number | ✅ | 箱号 |
| treatment_type | ✅ | 类型 (用药/饲喂) |
| product_name | ✅ | 产品/药物名称 |
| dosage | ❌ | 剂量 |
| notes | ❌ | 备注 |

### `import-harvest` - 导入摇蜜记录

```bash
beekeeper import-harvest CSV_FILE [--skip-date-check] [--skip-batch-check]
```

**CSV 格式：**

| 字段 | 必填 | 说明 |
|------|------|------|
| date | ✅ | 日期 |
| hive_number | ✅ | 箱号 |
| batch_number | ✅ | 批次号 |
| quantity_kg | ❌ | 产量 (公斤) |
| moisture_content | ❌ | 含水率 (%) |
| notes | ❌ | 备注 |

### `plan` - 生成计划

```bash
beekeeper plan
```

输出：
- 巡检提醒（按优先级：紧急/高/常规）
- 禁采蜜提醒（药物安全间隔）
- 风险蜂箱清单

### `report` - 导出报告

```bash
beekeeper report [--output-dir DIR]
```

生成三种报告：
1. **Markdown 复盘报告**: 统计概览、蜂场明细、巡检计划、禁采提醒、风险蜂箱、近期记录
2. **CSV 风险箱清单**: 风险蜂箱的详细列表
3. **JSON 审计包**: 完整的数据导出，用于备份和审计

### `history` - 历史查询

```bash
beekeeper history [--apiary APIARY] [--hive HIVE] [--batch BATCH] [--json]
```

可组合使用筛选条件。

### `quarantine` - 隔离区管理

```bash
# 查看隔离区
beekeeper quarantine

# 清空隔离区
beekeeper quarantine --clear
```

### `stats` - 数据统计

```bash
beekeeper stats
```

显示配置和记录的统计信息。

## 规则校验说明

导入数据时会自动执行以下校验：

| 校验项 | 说明 | 处理方式 |
|--------|------|----------|
| 箱号不存在 | 记录中的箱号未在配置中登记 | 移入隔离区 |
| 药物未登记 | 用药记录中的药物未配置安全间隔 | 移入隔离区 |
| 安全间隔未过 | 用药后在安全期内采蜜 | 移入隔离区 |
| 重复记录 | 相同内容的记录已存在 | 移入隔离区 |
| 日期倒序 | CSV 中日期不是按时间顺序 | 警告（可选跳过） |
| 含水率超阈值 | 含水率 > 阈值（默认 20%） | 警告 |
| 批次含水率差异大 | 同批次蜂箱含水率差异 > 2% | 警告 |

## 项目结构

```
beekeeper/
├── __init__.py          # 版本信息
├── main.py              # CLI 主程序
├── config.py            # 配置模型
├── store.py             # 状态存储
├── csv_parser.py        # CSV 解析器
├── validator.py         # 规则校验器
├── planner.py           # 计划生成器
└── reporter.py          # 报告导出器

examples/
├── inspections.csv      # 巡检示例
├── treatments.csv       # 用药示例
├── harvests.csv         # 摇蜜示例
└── bad_inspections.csv  # 错误数据示例

tests/
├── __init__.py
└── test_config.py       # 配置测试

pyproject.toml           # 项目配置
README.md               # 本文档
```

## 运行测试

```bash
# 安装测试依赖
pip install pytest pytest-cov

# 运行测试
pytest -v

# 运行测试并查看覆盖率
pytest --cov=beekeeper
```

## 数据存储位置

- 配置文件: `./beekeeper.json`
- 数据目录: `./.beekeeper_data/`
  - `inspections.json` - 巡检记录
  - `treatments.json` - 用药记录
  - `harvests.json` - 摇蜜记录
  - `quarantine.json` - 隔离记录

## 许可证

MIT License
