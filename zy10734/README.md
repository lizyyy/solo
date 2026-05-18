# 配送改派记录骑手补偿核算 CLI

自动核算配送改派的骑手补偿金额，支持系统改派、骑手拒单、重复补偿识别，漏文件和重复行自动检测。

## 功能特性

- ✅ 系统改派补偿核算（固定8元）
- ✅ 骑手拒单按原因分级补偿（补偿系数/固定金额）
- ✅ 重复订单自动识别跳过
- ✅ 已结算订单不再补偿
- ✅ 数据验证错误捕获和日志
- ✅ 详细的核算结果和统计汇总

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 准备输入数据

将以下CSV文件放入 `data/` 目录：

#### 改派记录 (redispatch_records.csv)
```csv
订单编号,原骑手ID,原骑手姓名,新骑手ID,新骑手姓名,改派时间,改派类型,改派原因,补偿金额
DD20240501001,R001,张三,R002,李四,2024-05-01 10:30:00,系统改派,订单超时自动改派,8
```

#### 骑手结算 (rider_settlements.csv)
```csv
骑手ID,骑手姓名,结算日期,总订单数,总补偿金额,已补偿订单列表
R001,张三,2024-05-01,12,48,DD20240501001;DD20240501003
```

#### 拒单原因 (rejection_reasons.csv)
```csv
原因编码,原因名称,补偿系数,固定补偿金额,是否可补偿
R001,个人原因,0,0,否
R002,地址过远,1,0,是
```

### 3. 运行核算 - 正常路径

```bash
# 标准命令
node src/cli.js \
  -r ./data/redispatch_records.csv \
  -s ./data/rider_settlements.csv \
  -j ./data/rejection_reasons.csv \
  -o ./output/compensation_results.csv

# 简写命令
node src/cli.js -r ./data/redispatch_records.csv -s ./data/rider_settlements.csv -j ./data/rejection_reasons.csv
```

### 4. 运行核算 - 异常路径（验证错误处理）

```bash
# 使用错误数据测试
node src/cli.js \
  -r ./data/redispatch_records_error.csv \
  -s ./data/rider_settlements.csv \
  -j ./data/rejection_reasons.csv \
  -o ./output/compensation_results_error.csv
```

## 命令行参数

| 参数 | 别名 | 说明 | 必填 | 默认值 |
|------|------|------|------|--------|
| --redispatch | -r | 改派记录CSV文件路径 | ✅ | ./data/redispatch_records.csv |
| --settlement | -s | 骑手结算CSV文件路径 | ✅ | ./data/rider_settlements.csv |
| --rejection | -j | 拒单原因CSV文件路径 | ✅ | ./data/rejection_reasons.csv |
| --output | -o | 核算结果输出路径 | ❌ | ./output/compensation_results.csv |
| --error-output | -e | 错误日志输出路径 | ❌ | ./output/error_log.csv |
| --help | -h | 显示帮助信息 | - | - |

## 业务规则

### 系统改派
- 固定补偿：8元
- 触发条件：改派类型 = "系统改派"

### 骑手拒单
- 根据拒单原因匹配补偿规则
- 基础金额：5元 × 补偿系数
- 支持固定金额补偿
- 不可补偿原因：补偿0元

### 重复补偿识别
- 同一订单多次出现：仅首次核算
- 后续重复记录标记为"重复跳过"

### 已结算识别
- 骑手结算记录中已补偿的订单不再核算
- 标记为"已补偿"状态

## 输出结果说明

### 核算结果CSV字段
| 字段 | 说明 |
|------|------|
| 订单显示编号 | 改派订单_订单编号（便于识别） |
| 订单编号 | 原始订单号 |
| 原骑手ID/姓名 | 被改派的骑手信息 |
| 新骑手ID/姓名 | 接收订单的骑手信息 |
| 改派时间/类型/原因 | 改派详情 |
| 核算补偿金额 | 理论应补偿金额 |
| 历史已补偿金额 | 该骑手历史已补偿金额 |
| 本次实际补偿金额 | 最终应发放金额 |
| 补偿状态 | 待发放/已补偿/重复跳过/核算失败 |
| 补偿备注 | 详细的核算说明 |
| 是否重复记录 | 是/否 |
| 是否核算错误 | 是/否 |
| 错误信息 | 错误详情 |

### 汇总信息
输出文件底部包含汇总统计：
- 总记录数
- 核算成功/失败数
- 重复记录数
- 实际补偿记录数
- 跳过补偿记录数
- 补偿总金额

## 完整命令链示例

### 正常流程 - 从准备到验证

```bash
# 1. 创建目录结构
mkdir -p data output

# 2. 安装依赖
npm install

# 3. 查看帮助
node src/cli.js --help

# 4. 运行正常数据核算
node src/cli.js \
  -r ./data/redispatch_records.csv \
  -s ./data/rider_settlements.csv \
  -j ./data/rejection_reasons.csv \
  -o ./output/compensation_results_normal.csv

# 5. 验证核算结果
cat ./output/compensation_results_normal.csv

# 6. 查看错误日志（如有错误）
cat ./output/error_log.csv
```

### 异常流程 - 错误处理验证

```bash
# 1. 运行错误数据测试
node src/cli.js \
  -r ./data/redispatch_records_error.csv \
  -s ./data/rider_settlements.csv \
  -j ./data/rejection_reasons.csv \
  -o ./output/compensation_results_error.csv

# 2. 观察错误输出
# - 缺失订单编号 → 核算失败
# - 缺失骑手ID → 核算失败  
# - 缺失改派时间 → 核算失败
```

## 目录结构

```
.
├── data/                    # 输入数据目录
│   ├── redispatch_records.csv    # 改派记录
│   ├── rider_settlements.csv     # 骑手结算
│   └── rejection_reasons.csv     # 拒单原因
├── output/                  # 输出结果目录
│   ├── compensation_results.csv  # 核算结果
│   └── error_log.csv             # 错误日志
├── src/                     # 源代码
│   ├── cli.js                    # CLI入口
│   ├── calculator.js             # 核算核心逻辑
│   ├── csvHandler.js             # CSV读写处理
│   └── models.js                 # 数据模型
├── package.json
└── README.md
```

## 数据验证规则

所有改派记录必须包含以下字段，否则会标记为核算失败：
- 订单编号
- 原骑手ID
- 新骑手ID
- 改派时间

## 运行截图示例

正常路径运行输出：
```
========================================
  配送改派记录骑手补偿核算 CLI
========================================

[1/4] 正在读取输入文件...
✓ 改派记录: 11 条
✓ 骑手结算记录: 5 条
✓ 拒单原因配置: 5 条

[2/4] 正在核算补偿金额...
[3/4] 核算统计信息：
  总记录数: 11
  核算成功: 8
  核算失败: 3
  重复记录: 2
  实际补偿记录: 3
  跳过补偿记录: 5
  补偿总金额: ¥20.50

[错误明细]
  行 9 [未知订单_8]: 数据验证失败: 订单编号不能为空
  行 10 [DD20240501009]: 数据验证失败: 原骑手ID不能为空
  行 11 [DD20240501010]: 数据验证失败: 改派时间不能为空

[4/4] 正在写入输出文件...
✓ 核算结果已保存到: ./output/compensation_results_normal.csv
✓ 错误日志已保存到: ./output/error_log.csv

========================================
  配送改派补偿核算完成!
========================================
```
