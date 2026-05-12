# 门店试吃样品成本 CLI

一个帮助生鲜门店解决试吃、报损和促销赠品成本归因问题的命令行工具。

## 问题背景

生鲜门店做试吃活动后，店长只知道少了多少水果，却说不清成本算到哪个活动。试吃、报损和促销赠品混在一起，月底成本归因不清楚。

## 功能特性

- 📦 **数据管理**：支持门店、商品、批次、活动等基础数据管理
- 📥 **智能导入**：支持批量导入试吃、报损、赠品记录
- ✅ **业务规则校验**：
  - 重复导入检测（幂等性保护）
  - 试吃数量超过批次余量检测
  - 活动已结束仍登记检测
  - 报损和试吃混填检测
  - 试吃记录必须关联活动
- 🔍 **状态追踪**：每一步都能看到状态变化、历史记录和失败原因
- 👷 **人工修正**：支持人工修正记录，保留前后差异和操作者
- 📊 **多维报表**：按门店、活动、商品批次展示样品成本和异常明细

## 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 2. 初始化数据库

```bash
python3 run.py init
```

### 3. 导入内置样例数据（推荐）

```bash
python3 run.py seed --clean
```

这会自动导入：
- 2家门店
- 9种商品（水果、熟食、乳品三个品类）
- 10个批次库存
- 4个促销活动
- 12条正常记录（试吃、报损、赠品各有代表）
- 5条异常记录（覆盖各类错误场景）

## 主要演示路径

### 路径一：完整业务流程

```bash
# 1. 初始化
python3 run.py init

# 2. 导入样例数据
python3 run.py seed --clean

# 3. 检查系统状态
python3 run.py check

# 4. 查看某条记录详情
python3 run.py detail REC_xxxxxxxx_0

# 5. 生成成本报表
python3 run.py report --show-details

# 6. 导出报表到JSON
python3 run.py report --output report.json
```

### 路径二：人工修正异常记录

```bash
# 1. 先查看异常记录详情
python3 run.py detail REC_xxxxxxxx_0

# 2. 人工修正（将数量从100改为2）
python3 run.py correct REC_xxxxxxxx_0 \
  --quantity 2 \
  --operator 张店长 \
  --change-reason "登记时多打了两个0，实际试吃2kg"

# 3. 再次检查状态，确认异常已解决
python3 run.py check
```

### 路径三：按维度查看报表

```bash
# 按门店查看
python3 run.py report --store-id STORE_001

# 按活动查看
python3 run.py report --promotion-id PROMO_001

# 按日期范围查看
python3 run.py report --start-date 2026-05-01 --end-date 2026-05-15
```

## 失败路径演示

导入异常数据，观察系统如何处理：

```bash
# 1. 确保数据库已初始化
python3 run.py init

# 2. 导入样例数据（会导入正常和异常记录）
python3 run.py seed --clean

# 3. 查看系统状态，会看到异常记录
python3 run.py check
# 输出示例：
# 记录总数: 17
# 有效记录: 12
# 异常记录: 5
# 未解决错误: 6

# 4. 查看异常明细
python3 run.py report --show-details
# 会看到"异常登记明细"表格，包含：
# - QUANTITY_EXCEEDS: 数量超过批次余量
# - PROMOTION_EXPIRED: 活动已结束仍登记
# - SAMPLE_WITHOUT_PROMOTION: 试吃未关联活动
# - INVALID_TYPE: 无效记录类型
# - PROMOTION_INACTIVE: 活动已结束

# 5. 查看某条异常记录的完整信息
python3 run.py detail REC_xxxxxxxx_0
# 会显示：
# - 记录基本信息
# - 验证错误详情
# - 变更历史
```

## 数据格式说明

### 导入记录格式（JSON）

```json
[
  {
    "store_id": "STORE_001",
    "batch_id": "BATCH_001",
    "quantity": 2.5,
    "record_type": "sample",
    "record_date": "2026-05-02",
    "promotion_id": "PROMO_001",
    "reason": "入口试吃展示"
  }
]
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| store_id | string | 是 | 门店ID |
| batch_id | string | 是 | 批次ID |
| quantity | number | 是 | 数量 |
| record_type | string | 是 | 记录类型：sample(试吃), promotion_gift(促销赠品), loss(报损) |
| record_date | string | 是 | 记录日期（YYYY-MM-DD） |
| promotion_id | string | 否 | 关联活动ID（试吃记录必填） |
| reason | string | 否 | 原因说明 |

## 业务规则

1. **试吃记录必须关联活动**：`record_type = "sample"` 时必须提供 `promotion_id`
2. **活动有效期校验**：记录日期必须在活动开始和结束日期之间
3. **数量不超过批次余量**：试吃/报损/赠品数量不能超过批次剩余量
4. **记录类型有效**：只能是 `sample`, `promotion_gift`, `loss` 中的一个
5. **幂等性保护**：重复导入相同文件不会重复创建记录

## 项目结构

```
.
├── run.py                 # CLI入口
├── requirements.txt       # 依赖
├── sample_cost_cli/
│   ├── __init__.py
│   ├── cli.py            # CLI命令定义
│   ├── core.py           # 核心业务逻辑
│   ├── database.py       # 数据库操作
│   └── samples/          # 样例数据
│       ├── stores.json
│       ├── products.json
│       ├── batches.json
│       ├── promotions.json
│       ├── normal_records.json
│       └── error_records.json
└── sample_cost.db        # SQLite数据库（运行后生成）
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `python3 run.py init [--force]` | 初始化数据库 |
| `python3 run.py seed [--clean]` | 导入内置样例数据 |
| `python3 run.py import-data <file> [--operator]` | 导入记录文件 |
| `python3 run.py check` | 检查系统状态 |
| `python3 run.py detail <record_id>` | 查看记录详情 |
| `python3 run.py correct <record_id> [options]` | 人工修正记录 |
| `python3 run.py report [options]` | 生成成本报表 |

## 验证错误类型

| 错误类型 | 说明 |
|----------|------|
| `INVALID_TYPE` | 无效的记录类型 |
| `STORE_NOT_FOUND` | 门店不存在 |
| `BATCH_NOT_FOUND` | 批次不存在 |
| `QUANTITY_EXCEEDS` | 数量超过批次余量 |
| `PROMOTION_NOT_FOUND` | 促销活动不存在 |
| `PROMOTION_EXPIRED` | 记录日期不在活动有效期内 |
| `PROMOTION_INACTIVE` | 促销活动已结束或未激活 |
| `SAMPLE_WITHOUT_PROMOTION` | 试吃记录必须关联促销活动 |
