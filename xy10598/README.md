# 门店导购提成复核 CLI (Commission Review CLI)

一个围绕门店导购提成的完整复核系统，结合销售、退货、多人协作、活动扣减和跨店调拨等复杂业务场景的计算与复核工具。

## 功能特性

- **完整的提成计算引擎：支持跨月退货冲抵、多人分摊、活动商品提成降低、调拨销售归属
- **幂等机制**：重复导入小票、重复执行保持幂等
- **人工修正**：所有调整留下前后差异和操作者记录
- **完整审计**：操作历史、导入记录、失败原因可追溯
- **内置样例**：覆盖服饰、鞋包、配件三类商品场景

## 本地启动

### 前置要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
cd /path/to/workspace
npm install
```

### 快速开始

```bash
# 一键运行演示
npm run demo
```

## 命令列表

| 命令 | 说明 | 示例 |
|------|------|------|
| `init` | 初始化工作目录 | `npm run cli -- init --with-samples` |
| `import <type>` | 导入指定类型数据 | `npm run cli -- import sales -f samples/sales.csv` |
| `import-all` | 导入所有样例数据 | `npm run cli -- import-all` |
| `check <period>` | 数据完整性检查 | `npm run cli -- check 202603` |
| `calculate <period>` | 计算提成 | `npm run cli -- calculate 202603` |
| `detail <staff> <period>` | 查看导购明细 | `npm run cli -- detail S002 202603` |
| `adjust` | 人工调整提成 | `npm run cli -- adjust -s S002 -p 202603 -a 500 -r "特殊奖励" -o admin` |
| `history` | 查看操作历史 | `npm run cli -- history` |
| `report <period>` | 生成复核报告 | `npm run cli -- report 202603 --console` |

## 主要演示路径

### 路径一：完整正常流程

```bash
# 1. 初始化（带样例数据）
npm run cli -- init --with-samples

# 2. 导入所有数据
npm run cli -- import-all -o admin

# 3. 检查数据
npm run cli -- check 202603

# 4. 计算提成
npm run cli -- calculate 202603

# 5. 查看导购张美丽(S002)的明细
npm run cli -- detail S002 202603

# 6. 生成完整报告
npm run cli -- report 202603 --console

# 7. 查看操作历史
npm run cli -- history
```

### 路径二：人工修正场景

```bash
# 在计算完成后，人工调整导购提成
npm run cli -- adjust \
  -s S003 \
  -p 202603 \
  -a 800 \
  -r "客户投诉补偿，额外奖励" \
  -o manager

# 查看调整历史
npm run cli -- history -t adjustment
```

## 失败演示路径

### 场景一：重复导入订单

```bash
# 第一次导入（应该成功）
npm run cli -- import sales

# 第二次导入相同数据（应该报错：订单号已存在）
npm run cli -- import sales
```

### 场景二：分摊比例总和超过100%

```bash
# 创建一个测试CSV文件 bad-allocation.csv:
# order_no,staff_code,allocation_ratio
# SO001,S001,0.8
# SO001,S002,0.3

# 导入（应该报错：分摊比例总和超过100%）
npm run cli -- import allocations -f bad-allocation.csv
```

### 场景三：原订单不存在的退货

```bash
# 创建测试CSV bad-return.csv:
# return_no,original_order_no,return_date,store_code,total_amount,reason
# RO999,SO9999,2026-03-15,ST001,1000,测试

# 导入（应该报错：原销售订单不存在）
npm run cli -- import returns -f bad-return.csv
```

### 场景四：已计算期间重复计算

```bash
# 第一次计算
npm run cli -- calculate 202603

# 第二次计算（提示已计算）
npm run cli -- calculate 202603

# 强制重新计算
npm run cli -- calculate 202603 --force
```

## 核心业务规则

### 1. 多人分摊

销售单支持多个导购按比例分摊
- 订单 SO001：张美丽 60%，王芳芳 40%
- 计算时按分摊比例分配提成

### 2. 活动扣减

活动期间销售的商品，提成按活动乘数调整：
- PROMO001（春季新品）：提成 x 0.8
- PROMO002（鞋包满减）：提成 x 0.7
- PROMO003（会员专享）：提成 x 0.9

### 3. 跨月退货冲抵

退货单关联原订单时：
- 如果退货期间 != 原订单期间：计算时在退货期间冲抵
- 会在报告中标记为「跨月冲抵」

### 4. 调拨销售归属

商品从A店调拨到B店销售时：
- source_store_code 记录来源店
- is_transfer_sale 标记为调拨销售
- 提成归属销售门店，但记录来源

### 5. 幂等机制

- 订单号/退货单号唯一
- 计算期间已完成时，重复计算提示
- 强制计算需加 --force 参数

### 6. 人工修正

所有人工调整记录：
- 原金额 → 调整后金额
- 差额自动计算
- 调整原因必填
- 操作人必填
- 审计日志完整记录

## 样例数据说明

### 门店
- ST001 上海南京东路店（主力店）
- ST002 上海陆家嘴店
- ST003 杭州湖滨店
- ST004 北京三里屯店

### 商品分类
- 服饰（CLxxx）：连衣裙、西装、牛仔裤等（提成率 2%-3%）
- 鞋包（SHxxx）：皮鞋、运动鞋、包包等（提成率 2.5%-4%）
- 配件（ACxxx）：皮带、围巾、手表等（提成率 1.5%-5%）

### 典型场景订单

| 订单号 | 类型 | 导购 | 说明 |
|--------|------|------|------|
| SO001 | 服饰 | S002(60%) + S003(40%) | 多人分摊 + 活动扣减 |
| SO002 | 服饰 | S002(100%) | 单独接待 |
| SO003 | 鞋包 | S004(50%) + S005(50%) | 联合销售 + 活动扣减 |
| SO004 | 配件 | S003(100%) | 当月退货 |
| SO005 | 手表 | S007(70%) + S006(30%) | 店长配合 + 会员折扣 |
| SO006 | 鞋包 | S005(100%) | 当月退货 |
| SO012 | 服饰 | S002(100%) | 跨店调拨销售 |

### 退货场景

| 退货号 | 原订单 | 退货日期 | 说明 |
|--------|--------|-----------|------|
| RO001 | SO004 | 2026-03-14 | 当月退货，正常冲抵 |
| RO002 | SO002 | 2026-04-02 | 跨月退货，在4月冲抵 |
| RO003 | SO006 | 2026-03-20 | 质量问题退货 |

## 数据文件格式

所有导入文件均为 CSV 格式，UTF-8 编码。

### stores.csv（门店）
```csv
store_code,store_name
ST001,门店名称
```

### staff.csv（导购）
```csv
staff_code,staff_name,store_code,role,status
S001,张三,ST001,店长,active
```

### products.csv（商品）
```csv
sku,product_name,category,base_commission_rate
CL001,商品名称,服饰,0.03
```

### promotions.csv（活动）
```csv
promotion_code,promotion_name,start_date,end_date,discount_type,discount_value,commission_multiplier
PROMO001,活动名称,2026-03-01,2026-03-31,percentage,10,0.8
```

### sales.csv（销售单）
```csv
order_no,order_date,store_code,customer_phone,total_amount,discount_amount,net_amount,payment_method,status,promotion_code,source_store_code
SO001,2026-03-05,ST001,13800138001,2698,200,2498,支付宝,completed,PROMO001,ST001
```

### returns.csv（退货单）
```csv
return_no,original_order_no,return_date,store_code,total_amount,reason,status
RO001,SO004,2026-03-14,ST001,899,尺码不合适,completed
```

### allocations.csv（导购分摊）
```csv
order_no,staff_code,allocation_ratio,allocation_type,notes
SO001,S002,0.6,normal,主导购
```

### transfers.csv（调拨记录）
```csv
transfer_no,transfer_date,from_store_code,to_store_code,sku,quantity,sale_order_no,status
TF001,2026-03-29,ST003,ST001,CL002,1,SO012,completed
```

## 报告输出

报告文件保存在 `reports/` 目录下，包含：

1. **数据检查结果**：错误、警告、信息分类
2. **提成计算汇总**：销售提成、退货扣减、净额
3. **导购明细**：每人的销售/退货/净额
4. **待复核事项**：无分摊订单、跨月退货
5. **人工调整记录**：调整前后对比
6. **提成来源明细**：每笔订单的计算规则

## 项目结构

```
.
├── src/
│   ├── cli.js              # CLI 入口
│   ├── db.js               # 数据库管理
│   ├── importer.js          # 数据导入
│   ├── calculator.js        # 提成计算引擎
│   ├── checker.js           # 数据检查
│   ├── adjustment.js       # 人工调整
│   ├── reporter.js          # 报告生成
│   ├── sample-generator.js     # 样例数据生成
│   ├── demo.js              # 演示脚本
│   └── utils.js             # 工具函数
├── config.json                 # 配置文件
├── package.json
└── README.md
```

## 注意事项

1. 初始化后会在当前目录创建 `commission-review.db 数据库文件
2. 样例数据位于 `samples/` 目录
3. 报告输出到 `reports/` 目录
4. 所有操作都有审计日志可追溯
5. 幂等机制确保重复操作不会重复计算

## 技术栈

- Node.js
- better-sqlite3（数据库）
- commander（CLI框架）
- chalk（颜色输出）
- table（表格输出）
- fs-extra（文件操作）

