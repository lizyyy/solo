# 电商赠品履约CLI - 快速使用指南

## 一、本地启动

### 1. 环境要求
- Python 3.8+
- pip

### 2. 安装依赖
```bash
cd /Users/mac/pro/solo/workspaces/xy10556
pip install -r requirements.txt
```

### 3. 安装CLI工具（可选，方便全局使用）
```bash
pip install -e .
```

### 4. 初始化系统
```bash
# 使用内置样例数据一键初始化
python -m src.cli init --with-samples

# 或者先初始化，后手动加载样例
python -m src.cli init
python -m src.cli load-samples
```

### 5. 查看帮助
```bash
python -m src.cli --help
python -m src.cli check --help
python -m src.cli detail --help
```

---

## 二、内置样例数据说明

### 活动规则
- **活动ID**: ACT_2026_SPRING
- **名称**: 2026春季满赠活动
- **门槛**: 满500元
- **赠品**: 精美保温杯 (GIFT_SK001)
- **数量**: 每单1个
- **规则**: 退货后金额低于门槛则扣费

### 测试订单 (7个)

| 订单ID | 用户 | 实付金额 | 场景说明 |
|--------|------|----------|----------|
| ORD_001_NORMAL | USER_001 | 699元 | 正常赠送场景(满500) |
| ORD_002_STOCK_SHORTAGE | USER_002 | 888元 | 库存不足演示用 |
| ORD_003_PARTIAL_RETURN | USER_003 | 1200元 | 部分退货扣费场景 |
| ORD_004_SPLIT_A | USER_004 | 300元 | 拆单场景A(单独300<500) |
| ORD_004_SPLIT_B | USER_004 | 400元 | 拆单场景B(合计700≥500) |
| ORD_005_NO_ACTIVITY | USER_005 | 1000元 | 无关联活动(不送) |
| ORD_006_BELOW_THRESHOLD | USER_006 | 399元 | 金额不足(不送) |

### 初始库存
- GIFT_SK001: 100件可用

---

## 三、主要演示路径

### 路径1: 正常赠送流程 (ORD_001_NORMAL)

```bash
# 1. 初始化并加载样例
python -m src.cli init --with-samples

# 2. 规则校验
python -m src.cli check
# 预期: ORD_001_NORMAL 状态变为 "符合条件"

# 3. 查看订单详情
python -m src.cli detail ORD_001_NORMAL
# 预期: 
# - 实际金额: 699元
# - 活动门槛: 500元
# - 是否达标: 是
# - 赠品状态: 符合条件

# 4. 分配库存
python -m src.cli allocate
# 预期: 分配1件，剩余可用99件

# 5. 模拟发货回调
python -m src.cli import-data shipment test_data/shipment_normal.json
# 预期: 发货成功，发货ID: SHIP_xxxx

# 6. 再次查看详情
python -m src.cli detail ORD_001_NORMAL
# 预期: 
# - 赠品状态: 已发货
# - 已发货: 1件
# - 发货记录: 1条
```

### 路径2: 拆单场景 (ORD_004_SPLIT_A + ORD_004_SPLIT_B)

```bash
# 1. 初始化
python -m src.cli init --with-samples

# 2. 规则校验
python -m src.cli check
# 预期: 
# - ORD_004_SPLIT_A: 符合条件 (拆单合计 300+400=700 ≥ 500)
# - ORD_004_SPLIT_B: 符合条件

# 3. 查看详情
python -m src.cli detail ORD_004_SPLIT_A
# 预期: 实际金额显示为 700 元(拆单汇总)
```

### 路径3: 部分退货扣费场景 (ORD_003_PARTIAL_RETURN)

```bash
# 1. 初始化
python -m src.cli init --with-samples

# 2. 规则校验
python -m src.cli check
# 预期: ORD_003_PARTIAL_RETURN 符合条件(1200≥500)

# 3. 分配库存
python -m src.cli allocate

# 4. 发货
python -m src.cli import-data shipment test_data/shipment_normal.json
# 需要临时修改 shipment_normal.json 中的 order_id 为 ORD_003_PARTIAL_RETURN

# 5. 模拟退货(退800元)
python -m src.cli import-data return test_data/return_partial.json
# 预期: 
# - 退货成功
# - 赠品状态变更: 已扣费
# - 扣费金额: 100元 (原1200-800=400 < 门槛500，差100元)

# 6. 查看详情
python -m src.cli detail ORD_003_PARTIAL_RETURN
# 预期:
# - 实际金额: 400元
# - 是否达标: 否
# - 赠品状态: 已扣费
# - 是否扣费: 是
# - 扣费金额: 100元
```

### 路径4: 补发流程

```bash
# 1. 初始化
python -m src.cli init --with-samples

# 2. 校验+分配
python -m src.cli check
python -m src.cli allocate

# 3. 创建补发任务(假设物流丢件)
python -m src.cli reissue create ORD_001_NORMAL --reason "物流丢件需补发" --operator "OP_001"
# 预期: 创建补发任务成功

# 4. 查看订单详情
python -m src.cli detail ORD_001_NORMAL
# 预期: 
# - 赠品状态: 待补发
# - 补发次数: 1
# - 补发任务: 1条

# 5. 处理补发
python -m src.cli reissue process REISSUE_xxxxxx --operator "OP_001"
# (使用上一步返回的任务ID)

# 6. 再次查看
python -m src.cli detail ORD_001_NORMAL
# 预期: 
# - 赠品状态: 已补发
# - 已发货: 2件
```

### 路径5: 生成整体报告

```bash
python -m src.cli report
# 查看内容:
# - 系统状态
# - 数据概览(订单数、活动数、发货数等)
# - 赠品状态分布
# - 库存情况
# - 异常订单
# - 待处理补发任务
# - 财务摘要(扣费总额)
```

---

## 四、失败路径演示

### 失败场景1: 库存不足

```bash
# 1. 初始化(不加载样例，使用低库存)
python -m src.cli init

# 2. 导入活动和订单
python -m src.cli import-data activity test_data/sample_activity.json
python -m src.cli import-data order test_data/sample_order.json

# 3. 导入低库存(只有1件)
python -m src.cli load-low-stock

# 4. 校验
python -m src.cli check

# 5. 分配(会失败)
python -m src.cli allocate
# 预期: 提示库存不足

# 6. 查看报告中的异常订单
python -m src.cli report
# 预期: 异常订单列表中显示该订单(符合条件但未分配成功)
```

### 失败场景2: 重复发货回调(幂等测试)

```bash
# 1. 走正常流程到发货
python -m src.cli init --with-samples
python -m src.cli check
python -m src.cli allocate
python -m src.cli import-data shipment test_data/shipment_normal.json

# 2. 再次调用相同发货
python -m src.cli import-data shipment test_data/shipment_normal.json
# 预期: 
# - 提示"重复发货回调"
# - 显示幂等保护已生效
# - 不重复扣库存
```

### 失败场景3: 人工修正(演示差异记录)

```bash
# 1. 初始化
python -m src.cli init --with-samples
python -m src.cli check

# 2. 人工修正订单状态
python -m src.cli manual-fix order ORD_001_NORMAL \
  --updates '{"gift_status":"已发货","gift_shipped_qty":1}' \
  --reason "系统异常，人工修正" \
  --operator "ADMIN_001"
# 预期:
# - 修正成功
# - 显示操作者: ADMIN_001
# - 显示原因: 系统异常，人工修正
# - 显示变更差异

# 3. 查看审计日志
python -m src.cli list-audits --entity-type order --entity-id ORD_001_NORMAL
# 预期: 能看到人工修正的完整日志记录
```

---

## 五、数据存储位置

所有数据存储在 `./data/` 目录下的JSON文件中：

```
data/
├── orders.json           # 订单数据
├── activity_rules.json   # 活动规则
├── gift_inventory.json   # 赠品库存
├── shipment_records.json # 发货记录
├── return_records.json   # 退货记录
├── reissue_tasks.json    # 补发任务
├── inventory_operations.json # 库存操作日志
├── audit_logs.json       # 审计日志
└── system_state.json     # 系统状态
```

如需重置数据，直接删除 `data/` 目录即可。

---

## 六、完整命令列表

| 命令 | 说明 |
|------|------|
| `gift init` | 初始化系统 |
| `gift load-samples` | 加载内置样例数据 |
| `gift load-low-stock` | 加载低库存样例 |
| `gift check` | 执行规则校验 |
| `gift check --order-id ORD_xxx` | 校验指定订单 |
| `gift allocate` | 分配赠品库存 |
| `gift allocate --order-id ORD_xxx` | 分配指定订单 |
| `gift detail ORD_xxx` | 查看订单详情 |
| `gift report` | 生成整体报告 |
| `gift import-data activity file.json` | 导入活动规则 |
| `gift import-data order file.json` | 导入订单 |
| `gift import-data inventory file.json` | 导入库存 |
| `gift import-data shipment file.json` | 处理发货回调 |
| `gift import-data return file.json` | 处理退货回调 |
| `gift reissue create ORD_xxx --reason xxx` | 创建补发任务 |
| `gift reissue process TASK_xxx` | 处理补发任务 |
| `gift manual-fix ...` | 人工修正 |
| `gift list-audits` | 查看审计日志 |
| `gift list-inv-ops` | 查看库存操作日志 |

---

## 七、如何判断业务闭环

通过 `gift report` 命令，你可以看到：

1. **赠品去向**: 赠品状态分布表，清楚每个订单的赠品状态
2. **异常订单**: 自动识别异常订单(已扣费、待补发、分配失败)
3. **库存占用**: 库存总览表，查看可用/已占用/已发货/已补发数量
4. **补发任务**: 待处理补发任务列表
5. **财务摘要**: 赠品扣费总金额
6. **审计追踪**: `list-audits` 可查看所有人工操作和系统动作的完整记录

**无需看源码，只需看报告输出就能判断业务是否闭环。**
