# 烘焙工坊订单排炉 CLI 系统

一个专为烘焙工坊设计的订单排产调度系统，核心解决早晨订单集中时，烤箱容量、醒发时间和配送窗口三者的协调问题。

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 从空数据到最终报表 - 完整流程

#### 第一步：初始化系统

```bash
python main.py init
```

查看默认配置：
```bash
python main.py config products
python main.py config ovens
python main.py config windows
```

#### 第二步：导入订单

系统支持 CSV 和 JSON 两种格式导入。使用提供的示例数据：

```bash
python main.py import-orders csv sample_orders.csv
```

或者使用 JSON 格式：
```bash
python main.py import-orders json sample_orders.json
```

查看已导入的订单：
```bash
python main.py orders list
```

#### 第三步：运行排炉调度

这是核心步骤，系统会自动考虑：
- **烤箱容量约束**：不同产品占用不同单位容量
- **醒发时间约束**：必须在烘焙前完成醒发
- **配送窗口约束**：必须在配送开始前完成烘焙

```bash
python main.py run
```

如果需要重新排产（例如新增订单后）：
```bash
python main.py run --reschedule
```

#### 第四步：查看排产结果

查看订单详情（包含醒发和烘焙计划）：
```bash
python main.py orders show <订单ID>
```

查看控制台看板：
```bash
python main.py report dashboard
```

#### 第五步：查询异常

如果有订单无法排产或导入失败：
```bash
python main.py anomalies
python main.py anomalies --unresolved
```

标记异常为已解决：
```bash
python main.py resolve <异常ID>
```

#### 第六步：生成业务报表

生成 CSV 格式报表（同时生成 JSON 摘要）：
```bash
python main.py report daily production_report.csv
```

生成 JSON 格式报表：
```bash
python main.py report daily production_report.json --format json
```

### 3. 重复导入和增量处理

系统支持重复导入，会自动处理：

**测试重复提交：**
```bash
python main.py import-orders csv sample_orders.csv
```

第二次导入时，系统会识别重复记录并跳过。

**测试状态冲突：**
先运行排产，然后尝试重新导入相同订单：
```bash
python main.py run
python main.py import-orders csv sample_orders.csv
```

已在处理中的订单会记录状态冲突异常。

**增量导入新订单：**
创建包含新订单的文件，再次导入即可：
```bash
python main.py import-orders csv new_orders.csv
python main.py run
```

## 核心约束说明

### 烤箱容量

系统中有3个烤箱，容量各不相同：
- 一号烤箱 (O001): 10单位，04:00-10:00
- 二号烤箱 (O002): 15单位，04:00-10:00
- 三号烤箱 (O003): 8单位，05:00-11:00

不同产品每单位数量占用的烤箱容量：
- 法式长棍 (P001): 2单位/个
- 羊角面包 (P002): 1单位/个
- 全麦面包 (P003): 3单位/个
- 丹麦酥 (P004): 1单位/个
- 甜甜圈 (P005): 1单位/个

### 醒发时间

每个产品有固定的醒发时间要求：
- 法式长棍: 60分钟
- 羊角面包: 90分钟
- 全麦面包: 45分钟
- 丹麦酥: 120分钟
- 甜甜圈: 30分钟

排产时，醒发必须在烘焙之前完成。

### 配送窗口

早间订单集中在四个配送窗口：
- W001 (06:00-07:00): 早间配送-第一批
- W002 (07:00-08:00): 早间配送-第二批
- W003 (08:00-09:00): 早间配送-第三批
- W004 (09:00-10:00): 午间配送

烘焙必须在配送窗口开始前10分钟完成。

## 订单数据格式

### CSV 格式

```csv
source_system,source_record_id,product_id,quantity,customer_name,delivery_window_id,priority,notes
ERP,SRC001,P002,5,星巴克咖啡,W001,1,首批配送重点客户
```

### JSON 格式

```json
[
  {
    "source_system": "ERP",
    "source_record_id": "SRC001",
    "product_id": "P002",
    "quantity": 5,
    "customer_name": "星巴克咖啡",
    "delivery_window_id": "W001",
    "priority": 1,
    "notes": "首批配送重点客户"
  }
]
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| source_system | string | 是 | 来源系统标识（用于去重） |
| source_record_id | string | 是 | 来源系统中的记录ID（用于去重） |
| product_id | string | 是 | 产品ID |
| quantity | integer | 是 | 产品数量（>0） |
| customer_name | string | 是 | 客户名称 |
| delivery_window_id | string | 是 | 配送窗口ID |
| priority | integer | 否 | 优先级（数字越大越优先） |
| notes | string | 否 | 备注 |

## 命令参考

### 系统管理

- `python main.py init` - 初始化数据库
- `python main.py reset` - 重置数据库（清空所有数据）

### 配置查看

- `python main.py config products` - 查看产品配置
- `python main.py config ovens` - 查看烤箱配置
- `python main.py config windows` - 查看配送窗口配置

### 订单导入

- `python main.py import-orders csv <文件路径>` - 从CSV导入
- `python main.py import-orders json <文件路径>` - 从JSON导入

### 排产调度

- `python main.py run` - 运行排产（仅处理待排产订单）
- `python main.py run --reschedule` - 重新排产所有订单

### 订单查询

- `python main.py orders list` - 列出所有订单
- `python main.py orders list --status <状态>` - 按状态筛选
- `python main.py orders show <订单ID>` - 查看订单详情

### 异常管理

- `python main.py anomalies` - 查看所有异常
- `python main.py anomalies --unresolved` - 查看未解决异常
- `python main.py anomalies --order-id <订单ID>` - 查看订单相关异常
- `python main.py resolve <异常ID>` - 标记异常为已解决

### 报表生成

- `python main.py report dashboard` - 控制台看板
- `python main.py report daily <输出文件>` - 生成每日报表
- `python main.py report daily <输出文件> --format json` - JSON格式报表

## 项目结构

```
.
├── bakery_scheduler/
│   ├── __init__.py
│   ├── models.py           # 数据模型定义
│   ├── database.py         # SQLite 数据存储层
│   ├── order_importer.py   # 订单导入和验证
│   ├── scheduler.py        # 排炉调度算法
│   └── cli.py              # 命令行界面
├── sample_orders.csv       # 示例订单（CSV格式）
├── sample_orders.json      # 示例订单（JSON格式）
├── requirements.txt        # 依赖清单
├── main.py                 # 程序入口
└── README.md               # 本文档
```

## 排产算法逻辑

1. **订单排序**：按优先级（降序）和配送窗口（升序）排序
2. **时间推算**：从配送窗口开始时间倒推，计算最晚烘焙结束时间 → 最晚烘焙开始时间 → 最晚醒发结束时间 → 最晚醒发开始时间
3. **烤箱查找**：从最早可用烤箱开始，查找能容纳订单容量的时间槽
4. **容量检查**：确保同一时间烤箱内所有订单的容量占用不超过最大容量
5. **冲突处理**：无法安排的订单标记为错误状态并记录异常

## 测试场景

### 正常流程测试

```bash
# 1. 初始化
python main.py init

# 2. 导入订单
python main.py import-orders csv sample_orders.csv

# 3. 运行排产
python main.py run

# 4. 查看结果
python main.py report dashboard

# 5. 生成报表
python main.py report daily report.csv
```

### 边界情况测试

```bash
# 测试重复提交
python main.py import-orders csv sample_orders.csv  # 第二次导入
python main.py anomalies

# 测试状态冲突
python main.py run
python main.py import-orders csv sample_orders.csv  # 订单已在处理中
python main.py anomalies --unresolved

# 测试来源记录缺失
python main.py import-orders csv nonexistent.csv
python main.py anomalies
```

### 增量导入测试

```bash
# 第一次导入
python main.py import-orders csv sample_orders.csv
python main.py run

# 查看当前状态
python main.py orders list

# 导入新订单
python main.py import-orders csv more_orders.csv
python main.py run  # 只排产新增的待处理订单
```
