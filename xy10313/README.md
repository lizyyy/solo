# 物业公区能耗分摊 CLI

一个用于物业公区能耗分摊计算的命令行工具，支持房屋信息管理、入住状态管理、账单导入、分摊计算、争议处理和审计追踪。

## 功能特性

- 房屋信息管理（房号、业主、面积）
- 入住/空置状态管理（支持部分月度空置）
- 公区电表账单导入
- 特殊减免记录（比例减免或定额减免）
- 按面积权重分摊计算
- 空置房特殊处理（按空置天数扣除）
- 数据验证和问题清单
- 争议记录管理
- 账单状态管理（草稿 → 试算 → 确认 → 修订/撤销）
- 审计日志和版本追踪
- 业主明细导出（CSV 和文本报告）

## 安装

```bash
pip install -r requirements.txt
pip install -e .
```

## 快速开始

### 1. 导入房屋信息

```bash
energy-share import houses sample_data/houses.csv
```

房屋CSV格式：
```csv
room_number,owner_name,area
1-101,张三,100.5
1-102,李四,89.3
```

### 2. 导入入住/空置状态

```bash
energy-share import occupancy sample_data/occupancy.csv
```

状态CSV格式：
```csv
room_number,start_date,end_date,is_vacant
1-301,2025-01-01,2025-03-31,1
2-102,2025-01-15,2025-02-28,1
```

- `is_vacant=1` 表示空置
- 空置房按空置天数计算有效面积

### 3. 导入公区账单

```bash
energy-share import bill sample_data/meter_bill.csv
```

账单CSV格式：
```csv
billing_month,electricity_kwh,electricity_unit_price,water_tons,water_unit_price,total_amount
2025-01,5000,0.8,200,4.5,4900
```

### 4. 导入减免记录（可选）

```bash
energy-share import reductions sample_data/reductions.csv
```

减免CSV格式：
```csv
room_number,billing_month,reduction_type,reduction_percent,reduction_amount,reason
1-101,2025-01,低保户减免,50,,经济困难家庭
2-201,2025-01,电梯费减免,,100,长期不使用电梯
```

- `reduction_percent`: 比例减免（0-100）
- `reduction_amount`: 定额减免金额

### 5. 试算分摊

```bash
energy-share trial 2025-01
```

试算会：
- 验证数据有效性
- 生成问题清单（面积缺失、空置跨月、减免异常等）
- 计算每户分摊金额
- 状态变为 "trial"（试算）

### 6. 确认账单

```bash
energy-share confirm 2025-01 --operator admin
```

确认后账单状态变为 "confirmed"，不能再重复导入。

### 7. 导出给业主的明细

#### CSV格式：
```bash
energy-share export details 2025-01 output/bill_details.csv
```

#### 文本报告（给业主看的详细说明）：
```bash
energy-share export report 2025-01 output/owner_report.txt
```

## 账单状态流转

```
draft (草稿) 
  ↓ trial
trial (试算) 
  ↓ confirm
confirmed (已确认) 
  ↓ revise / cancel
revised (修订中) / cancelled (已撤销)
  ↓ trial (重新试算)
draft
```

## 争议管理

### 记录争议
```bash
energy-share dispute add 2025-01 1-101 50 "认为分摊金额过高"
```

### 查看争议
```bash
energy-share dispute list
energy-share dispute list --status pending
energy-share dispute list --month 2025-01
```

### 解决争议
```bash
energy-share dispute resolve 1 "已与客户沟通，调整金额"
```

## 审计和历史记录

### 查看账单操作历史
```bash
energy-share audit history 2025-01
```

### 查看版本差异
```bash
energy-share audit versions 2025-01
```

## 修订和撤销

### 修订已确认的账单
```bash
energy-share revise 2025-01 --operator admin --reason "电表读数有误"
energy-share trial 2025-01           # 重新计算
energy-share confirm 2025-01         # 重新确认
```

### 撤销账单
```bash
energy-share cancel 2025-01 --operator admin --reason "数据错误"
```

## 数据验证问题清单

试算时自动检查：
- **面积缺失**: 房屋面积为空或为0/负数
- **空置日期跨月**: 空置期开始于上月或结束于下月
- **减免比例异常**: 比例超出 [0, 100] 范围
- **减免金额异常**: 金额为负数

## 分摊计算规则

### 基本公式

```
每户分摊金额 = 公区总费用 × 有效面积权重
有效面积 = 房屋面积 × (1 - 空置天数/当月天数)
有效面积权重 = 单户有效面积 / 总有效面积
```

### 减免规则

1. **比例减免**: 按比例从分摊金额中扣除
2. **定额减免**: 固定金额扣除
3. 多减免项可以叠加

### 最终金额

```
最终应缴 = max(0, 分摊金额 - 减免金额)
```

## 样例数据

sample_data 目录包含：
- `houses.csv`: 12套房屋信息
- `occupancy.csv`: 入住状态（含空置房）
- `meter_bill.csv`: 2025年1月、2月账单
- `reductions.csv`: 3条减免记录
- `bad_data/`: 用于测试问题检测的坏数据

## 命令参考

```
energy-share --help
energy-share import --help
energy-share trial --help
energy-share confirm --help
energy-share revise --help
energy-share cancel --help
energy-share list --help
energy-share regenerate --help
energy-share dispute --help
energy-share export --help
energy-share audit --help
```

## 数据库

默认使用 SQLite 数据库 `energy_share.db`，可通过环境变量修改：
```bash
export ENERGY_SHARE_DB=/path/to/my.db
```
