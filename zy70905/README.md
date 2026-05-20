# 连锁门店会员积分计算 API

## 项目概述

解决连锁门店运营中积分计算混乱问题：线下补录积分、退货扣回和活动倍率容易算错。本系统支持小票CSV上传、会员数据管理、活动规则配置，自动将处理结果分为正常项、待确认项、失败项，并支持全程追溯。

## 核心功能

### ✅ 已实现功能

1. **数据导入**
   - 小票CSV文件上传（支持中英文表头）
   - 会员JSON数据导入
   - 活动规则JSON配置

2. **规则引擎**
   - **退货冲正**：自动查找原始消费记录，按比例扣回积分
   - **倍率边界**：最高10倍上限保护，防止异常倍率
   - **重复补录检测**：小票号去重，同一批次幂等处理
   - 活动时间、金额、会员等级、门店多维度条件匹配

3. **结果分类**
   - **成功项**：正常计算，积分已生效
   - **待确认项**：有警告或需人工核实（如退货无原始记录）
   - **失败项**：保留原始字段 + 错误码 + 建议处理方式

4. **追溯能力**
   - 按批次号查询完整报告
   - 按TraceID单条明细追溯
   - 按会员手机号查历史记录
   - 按小票号查处理历史

5. **幂等性保证**
   - 相同内容批次重复提交不重复生效
   - 基于内容哈希的去重机制

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 3. 运行测试脚本

新开一个终端窗口：

```bash
cd test-data
chmod +x test-api.sh
./test-api.sh
```

## API 接口说明

### 基础地址

`http://localhost:3000`

---

### 1. 上传小票CSV

**POST** `/api/upload/receipts`

Content-Type: `multipart/form-data`

| 参数 | 类型 | 说明 |
|------|------|------|
| file | File | CSV格式小票文件 |

**响应示例：**
```json
{
  "success": true,
  "batchId": "BATCH-XXXXXXXXXXXX",
  "totalProcessed": 7,
  "report": {
    "totalCount": 7,
    "successCount": 5,
    "pendingCount": 1,
    "failedCount": 1,
    "totalPoints": 6820,
    "items": {
      "success": [...],
      "pending": [...],
      "failed": [...]
    }
  }
}
```

---

### 2. 上传会员数据

**POST** `/api/upload/members`

Content-Type: `multipart/form-data`

| 参数 | 类型 | 说明 |
|------|------|------|
| file | File | JSON格式会员文件 |

---

### 3. 上传活动规则

**POST** `/api/upload/rules`

Content-Type: `multipart/form-data`

| 参数 | 类型 | 说明 |
|------|------|------|
| file | File | JSON格式规则文件 |

---

### 4. 直接处理JSON数据

**POST** `/api/process`

Content-Type: `application/json`

```json
{
  "receipts": [...],
  "members": [...],
  "rules": [...]
}
```

---

### 5. 查询批次报告

**GET** `/api/batch/:batchId`

查询整个批次的处理结果和统计。

---

### 6. 单条明细追溯

**GET** `/api/trace/:traceId`

从单条明细一路查到原始数据和处理过程。

---

### 7. 会员积分记录

**GET** `/api/member/:phone`

查询指定会员的所有积分变动记录。

---

### 8. 小票处理历史

**GET** `/api/receipt/:receiptNo`

查询指定小票的所有处理记录。

---

### 9. 健康检查

**GET** `/health`

## 数据格式说明

### 小票CSV格式

| 字段 | 必填 | 说明 |
|------|------|------|
| receiptNo | 是 | 小票号 |
| memberPhone | 是 | 会员手机号 |
| transactionTime | 是 | 交易时间 (YYYY-MM-DD HH:mm:ss) |
| transactionType | 是 | purchase/return 或 消费/退货 |
| amount | 是 | 交易金额 |
| storeId | 是 | 门店ID |
| productName | 否 | 商品名称 |
| operator | 否 | 操作员 |

### 活动规则配置

```json
{
  "id": "RULE_001",
  "name": "618母婴节双倍积分",
  "type": "multiplier",
  "startTime": "2026-05-20 00:00:00",
  "endTime": "2026-06-20 23:59:59",
  "conditions": {
    "minAmount": 100,
    "memberLevels": ["gold", "diamond"],
    "storeIds": ["STORE001"]
  },
  "multiplier": 2,
  "priority": 10,
  "enabled": true
}
```

## 错误码说明

| 错误码 | 说明 | 建议 |
|--------|------|------|
| MEMBER_NOT_FOUND | 会员不存在 | 检查手机号或先注册 |
| RETURN_WITHOUT_PURCHASE | 退货无原始记录 | 核实小票是否属于本系统 |
| DUPLICATE_RECEIPT | 小票重复提交 | 请勿重复上传 |
| MULTIPLIER_OVER_LIMIT | 倍率超出上限 | 已按最高10倍计算 |
| INVALID_TIME_FORMAT | 时间格式错误 | 使用 YYYY-MM-DD HH:mm:ss |

## 项目结构

```
.
├── src/
│   ├── index.ts              # 服务入口和API路由
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── database/
│   │   └── index.ts          # SQLite数据库层
│   └── services/
│       ├── rulesEngine.ts    # 规则引擎核心
│       └── dataParser.ts     # 数据解析器
├── test-data/
│   ├── members.json          # 测试会员数据
│   ├── rules.json            # 测试活动规则
│   ├── receipts.csv          # 测试小票数据
│   └── test-api.sh           # 一键测试脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 复跑说明

如需完整复现测试流程：

```bash
# 1. 清理数据库（可选）
rm -f points.db

# 2. 启动服务
npm install
npm run dev

# 3. 运行测试（新开终端）
cd test-data
./test-api.sh
```

## 典型场景验证

### 场景1：正常消费 + 活动倍率
- 输入：钻石会员消费1580元，符合3倍规则
- 预期：1580 × 3 = 4740积分

### 场景2：退货冲正
- 输入：原始消费328元得656积分，退货164元
- 预期：扣回 328积分（按比例）

### 场景3：倍率边界保护
- 输入：配置15倍活动规则
- 预期：系统自动限制为最高10倍

### 场景4：重复提交
- 输入：同一CSV上传两次
- 预期：第二次提示"已处理过"

### 场景5：单条追溯
- 输入：TraceID
- 预期：返回原始小票、应用规则、计算过程、所属批次
