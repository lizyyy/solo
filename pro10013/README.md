# 券商两融担保品复核工具 (MCR)

一个 Python CLI 工具，用于券商两融担保品数据的批量复核，支持数据导入、问题检测、人工复核、历史追溯和结果导出。

## 功能特性

- **数据导入**: 支持 CSV/JSON 格式，自动识别中英文字段名
- **自动检测**: 自动识别缺项、重复记录、口径不一致等问题
- **特殊场景处理**:
  - 同一客户多账号：自动识别并单独筛选
  - 退款跨清算日：自动标记交易日与清算日间隔超过 1 天的退款
  - 人工改判：支持覆盖自动判断结果，原由永久保存可追溯
- **完整工作流**: 导入 → 查看 → 修正 → 复核 → 导出，所有操作接同一份数据
- **统计清晰**: 每次导入后清楚看到处理了多少、跳过多少、为什么跳过
- **历史记录**: 所有变更操作留痕，支持单条记录历史追溯

## 快速开始

### 安装依赖

```bash
pip3 install -r requirements.txt
```

### 生成样例数据（含真实工作中的问题）

```bash
python3 -m mcr.cli sample
# 或指定输出格式
python3 -m mcr.cli sample --output sample_data.json --format json
```

样例数据包含以下问题场景：
1. 同一客户多个账号
2. 关键字段缺失（缺项）
3. 可用担保品计算口径不一致
4. 重复上报记录
5. 退款跨清算日（交易日与清算日间隔 > 1 天）

### 导入数据

```bash
python3 -m mcr.cli import sample_data.csv --user 财务复核员
```

导入完成后会显示统计信息：
- 总记录数
- 正常记录数
- 跳过记录数
- 需复核记录数
- 跳过原因分类统计

## 常用命令

### 查看批次列表

```bash
python3 -m mcr.cli batches
```

### 查看记录列表

```bash
# 查看指定批次的所有记录
python3 -m mcr.cli list <批次号>

# 按状态筛选
python3 -m mcr.cli list --status skipped

# 按跳过原因筛选
python3 -m mcr.cli list --skip-reason caliber_mismatch

# 限制显示数量
python3 -m mcr.cli list --limit 50
```

### 查看单条记录详情及历史

```bash
python3 -m mcr.cli show <记录ID>
```

显示内容包括：
- 记录完整字段信息
- 跳过原因及详情
- 复核结果和意见
- 是否人工改判及原理由
- 完整变更历史

### 查看特殊场景记录

```bash
# 同一客户多账号
python3 -m mcr.cli special multi-account

# 退款跨清算日
python3 -m mcr.cli special cross-refund

# 已人工改判的记录
python3 -m mcr.cli special manual-override
```

### 查看批次统计

```bash
python3 -m mcr.cli stats <批次号>
```

显示完整的统计信息，包括跳过原因明细和复核结果明细。

### 复核记录

```bash
# 普通复核
python3 -m mcr.cli review <记录ID> --result pass --comment "没问题" --user 复核人

# 人工改判（覆盖自动跳过的结果）
python3 -m mcr.cli review <记录ID> --result pass --comment "特批通过" --user 复核人 --override
```

复核结果选项：
- `pass`: 通过
- `reject`: 驳回
- `need_further_check`: 需进一步核查

### 修正数据

```bash
# 修正跳过记录的字段值，修正后状态变为正常
python3 -m mcr.cli fix <记录ID> -f quantity=1000 -f market_value=50000 --user 操作人
```

### 导出数据

```bash
# 导出指定批次全部记录
python3 -m mcr.cli export all_records.csv --batch-id <批次号>

# 仅导出需复核的记录（给财务复核员）
python3 -m mcr.cli export need_review.csv --batch-id <批次号> --need-review

# 按状态导出
python3 -m mcr.cli export skipped_records.csv --status skipped

# JSON 格式导出
python3 -m mcr.cli export output.json --format json --batch-id <批次号>
```

## 跳过原因说明

| 原因代码 | 中文说明 | 是否需人工复核 |
|---------|---------|--------------|
| missing_field | 缺项（缺少必填字段） | 否 |
| duplicate | 重复记录 | 否 |
| caliber_mismatch | 口径不一致（计算值与上报值不符） | 是 |
| multi_account | 同一客户多账号 | 是 |
| cross_settlement_refund | 退款跨清算日 | 是 |
| other | 其他 | - |

## 项目结构

```
mcr/
├── __init__.py       # 包初始化
├── models.py         # 数据模型定义
├── database.py       # SQLite 数据库层
├── importer.py       # 数据导入模块
├── services.py       # 业务逻辑服务层
└── cli.py            # CLI 命令入口
```

## 数据存储

所有数据存在当前目录的 `mcr.db` (SQLite)，包含三张表：
- `collateral_records`: 担保品记录主表
- `import_batches`: 导入批次表
- `review_history`: 复核历史表

## 字段别名支持

导入时自动识别以下字段别名（支持中英文）：

| 标准字段名 | 支持的别名 |
|-----------|-----------|
| client_id | 客户编号, 客户ID, cust_id, custno |
| client_name | 客户名称, 客户姓名, cust_name |
| account_id | 账号, 资金账号, acct_id, fund_account |
| collateral_code | 证券代码, 担保品代码, sec_code, stock_code |
| collateral_name | 证券名称, 担保品名称, sec_name, stock_name |
| quantity | 数量, 持仓数量, qty, volume |
| market_value | 市值, 持仓市值, mkt_val, market_val |
| collateral_ratio | 折算率, 担保折算率, ratio |
| available_collateral | 可用担保品, 可充抵保证金, avail_collateral |
| trade_date | 交易日, 交易日期, trd_date, biz_date |
| settlement_date | 清算日, 交收日, set_date |
| is_refund | 是否退款, 退款标志, refund_flag |
| source_system | 来源系统, 系统来源, src_sys |
