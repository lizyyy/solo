# 生鲜缺货对账 CLI 工具

处理生鲜缺货后的退款、换货、补券对账工作，告别手工对表。

## 功能特性

- 📦 **本地持久化存储** - 使用 SQLite 数据库，重启后数据不丢失
- 📥 **数据导入** - 支持 JSON 和 CSV 格式批量导入
- ✅ **订单复核** - 支持退款、换货、补券三种处理方式
- 🔍 **多维度筛选** - 按负责人、时间、状态、异常类型筛选
- 📊 **统计摘要** - 实时查看对账进度和统计数据
- 📤 **报告导出** - 导出一致的 CSV/JSON 报告

## 快速开始

### 安装依赖

```bash
npm install
```

### 链接命令（可选，方便全局使用）

```bash
npm link
```

## 使用指南

### 1. 查看统计摘要

查看当前数据库中的订单统计情况：

```bash
npm start stats
# 或者如果已链接
reconcile stats
```

### 2. 导入订单数据

导入样例数据：

```bash
# 导入 JSON 格式
npm start -- import examples/sample-orders.json

# 导入 CSV 格式
npm start -- import examples/sample-orders.csv
```

数据格式说明：

| 字段 | 说明 | 必填 |
|------|------|------|
| orderNo | 订单号 | 是 |
| customerName | 客户姓名 | 是 |
| phone | 联系电话 | 否 |
| productName | 商品名称 | 是 |
| originalAmount | 订单金额 | 是 |
| handler | 负责人 | 否 |
| status | 状态 | 否 |
| exceptionType | 异常类型 | 否 |
| createdAt | 创建时间 | 否 |

### 3. 查询订单列表

查看所有订单：

```bash
npm start query
```

按条件筛选：

```bash
# 按负责人筛选
npm start -- query --handler 李小红

# 按状态筛选
npm start -- query --status pending

# 按异常类型筛选
npm start -- query --exception-type amount_mismatch

# 按日期范围筛选
npm start -- query --start-date 2024-05-01 --end-date 2024-05-03

# 组合筛选
npm start -- query --handler 李小红 --status exception
```

### 4. 订单复核处理

#### 4.1 退款处理

```bash
npm start -- review ORD20240001 --action refund --amount 89.90 --notes "商品缺货全额退款"
```

#### 4.2 换货处理

```bash
npm start -- review ORD20240002 --action exchange --product "国产樱桃 500g" --notes "等价替换"
```

#### 4.3 补券处理

```bash
npm start -- review ORD20240003 --action coupon --coupon COUPON2024001 --amount 68.00 --notes "发放优惠券"
```

#### 4.4 标记异常

```bash
npm start -- review ORD20240005 --status exception --exception-type customer_complaint
```

### 5. 查看订单详情

```bash
npm start -- detail ORD20240001
```

### 6. 导出数据

导出所有订单：

```bash
# 导出 CSV
npm start -- export orders.csv

# 导出 JSON
npm start -- export orders.json

# 导出包含操作记录
npm start -- export orders-full.json --with-actions
```

按筛选条件导出：

```bash
# 导出待处理订单
npm start -- export pending.csv --status pending

# 导出某位负责人的订单
npm start -- export xiaohong.csv --handler 李小红

# 导出异常订单
npm start -- export exceptions.csv --status exception
```

### 7. 生成对账报告

```bash
# 生成默认文件名的报告
npm start report

# 指定输出文件名
npm start -- report reconciliation-report.json
```

## 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| reviewed | 已复核 |
| completed | 已完成 |
| exception | 异常 |

## 异常类型

| 类型 | 说明 |
|------|------|
| amount_mismatch | 金额不符 |
| data_incomplete | 数据不全 |
| customer_complaint | 客户投诉 |
| other | 其他 |

## 操作类型

| 类型 | 说明 |
|------|------|
| refund | 退款 |
| exchange | 换货 |
| coupon | 补券 |

## 数据存储

数据默认存储在当前目录的 `.reconcile` 文件夹下：

```
.reconcile/
└── reconcile.db    # SQLite 数据库文件
```

## 完整使用示例

```bash
# 1. 安装依赖
npm install

# 2. 导入样例数据
npm start -- import examples/sample-orders.csv

# 3. 查看统计
npm start stats

# 4. 查询待处理订单
npm start -- query --status pending

# 5. 处理几个订单
npm start -- review ORD20240001 --action refund --amount 89.90
npm start -- review ORD20240002 --action exchange --product "国产樱桃 500g"
npm start -- review ORD20240005 --status exception --exception-type amount_mismatch

# 6. 再次查看统计确认
npm start stats

# 7. 导出异常订单
npm start -- export exceptions.csv --status exception

# 8. 生成完整报告
npm start report
```

## 项目结构

```
.
├── src/
│   ├── index.js          # CLI 入口
│   ├── db.js             # 数据库操作
│   └── commands/
│       ├── import.js     # 导入命令
│       ├── review.js     # 复核命令
│       ├── query.js      # 查询命令
│       └── export.js     # 导出命令
├── examples/
│   ├── sample-orders.json
│   └── sample-orders.csv
├── package.json
└── README.md
```
