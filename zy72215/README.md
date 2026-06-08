# 交易员绩效归因报表 - 风控系统

> 这是给风控值班老秦交接用的，不是评测说明书

## 一句话说明白

系统专门管"金额为 0 但备注写着已冲正"这种破事，保证页面、导出、接口看的都是同一份数据，尾差调整的来龙去脉都留着，风控同事追问时能回到证据。

---

## 核心边界规则（别靠口头约定！）

### 规则1：什么算"金额为0但备注已冲正"？
> 代码位置: [ReversalDetector.ts](file:///Users/lzy/pro/solo/workspaces/zy72215/src/core/ReversalDetector.ts#L6-L12)

- **金额判定**: `|金额| < 0.001` 就算 0（浮点精度问题，别死磕）
- **备注关键字**: 备注里包含 `已冲正`、`冲正`、`冲销`、`reverse`、`reversed` 任一
- **同时满足**以上两条才会被标记，状态自动设为 `ZERO_WITH_REVERSAL`

### 规则2：碰到这种记录怎么办？
> 代码位置: [StatusFlowHandler.ts](file:///Users/lzy/pro/solo/workspaces/zy72215/src/core/StatusFlowHandler.ts#L5-L23) / [ALLOWED_TRANSITIONS](file:///Users/lzy/pro/solo/workspaces/zy72215/src/types/index.ts#L76-L84)

**别急着归正常！** 按三步走，**系统会强制拦住跳步**：

```
第一步：导入
   ↓
系统自动识别 → 标记为 "金额为0-待冲正复核"
   ↓ （老秦你先别慌，放着）
第二步：老秦补看托管确认页
   ↓
老秦找到托管确认页 → 提交复核 → 填托管页参考号
   ↓ （状态变成 "待风控复核"）
第三步：风控同事复核
   ↓
├─ 情况A：确实正常 → 复核通过-正常
├─ 情况B：需要调数 → 复核通过-已调整（填调整后金额）
└─ 情况C：搞错了 → 回滚（填原因）
第四步：纳入负责人摘要
```

**非法路径会被拦截**（代码里写死了，不是口头约定）：
- `ZERO_WITH_REVERSAL` 直接调 `reviewAsNormal` → ❌ 被拦，提示"允许的目标状态: 待风控复核"
- `ZERO_WITH_REVERSAL` 直接调 `markAsSummarized` → ❌ 被拦
- `ZERO_WITH_REVERSAL` 直接调 `reviewWithAdjustment` → ❌ 被拦
- `PENDING_REVIEW` 直接调 `markAsSummarized` → ❌ 被拦，必须先复核
- `SUMMARIZED` 是终态，任何操作 → ❌ 被拦

正常交易（IMPORTED）可以直接纳入摘要，不用走复核流程。

### 规则3：尾差调整条要留什么？
> 代码位置: [types/index.ts](file:///Users/lzy/pro/solo/workspaces/zy72215/src/types/index.ts#L25-L32)

每条尾差调整记录必须保存：
- **原始行号**: 导入文件里的第几行（别找不着来源）
- **原始金额**: 导入时的金额（改了也能看到最初是什么样）
- **人工改动**: 调了多少（正负数都有）
- **当前处理状态**: 到哪一步了
- **复核依据来源**: 是看了尾差调整条，还是托管确认页
- **托管页参考**: 托管确认页的页码/编号

### 规则4：数据一致性怎么保证？
> 代码位置: [UnifiedDataService.ts](file:///Users/lzy/pro/solo/workspaces/zy72215/src/data/UnifiedDataService.ts)

**页面展示、接口返回、导出文件都读同一份数据！**

- 页面数据: `getPageData()` → 突出需要关注的记录
- 接口数据: `getApiData()` → 完整结构
- 导出数据: `getExportData()` → 格式化好的中文列名

谁也别自己算汇总数，都从 `DataStore` 里拿。

### 规则5：怎么回滚？
> 代码位置: [StatusFlowHandler.ts](file:///Users/lzy/pro/solo/workspaces/zy72215/src/core/StatusFlowHandler.ts#L138-L161)

任何状态都能回滚，回滚路径：
```
已纳入摘要 → 复核通过-正常 → 待风控复核 → 金额为0-待冲正复核 → 已导入
```
**回滚必须填原因**，审计日志留痕。

---

## 三步完整流程示例

### 第一步：第一次导入

老秦拿到交易明细，导入系统：

```bash
curl -X POST http://localhost:3000/api/performance-attribution/import \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "风控值班-老秦",
    "records": [
      {
        "tradeDate": "2024-06-03",
        "traderId": "TRADER001",
        "instrumentId": "600519",
        "instrumentName": "贵州茅台",
        "quantity": 1000,
        "amount": 0,
        "remark": "已冲正-尾差调整",
        "originalLineNumber": 15
      },
      {
        "tradeDate": "2024-06-03",
        "traderId": "TRADER001",
        "instrumentId": "000001",
        "instrumentName": "平安银行",
        "quantity": 5000,
        "amount": 52300.50,
        "remark": "正常交易",
        "originalLineNumber": 16
      }
    ]
  }'
```

系统会自动识别：第15行金额为0且备注有"已冲正"，标记为待复核。

### 第二步：老秦补看托管确认页

老秦翻托管确认页，找到第15行对应的那笔在托管第 `C-20240603-042` 页，提交复核：

```bash
curl -X POST http://localhost:3000/api/performance-attribution/record/{记录ID}/submit-review \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "风控值班-老秦",
    "custodianPageRef": "C-20240603-042"
  }'
```

现在状态变成"待风控复核"，等着同事来审。

### 第三步：风控同事复核

同事核对后发现应该是 `1250.35`，做调整：

```bash
curl -X POST http://localhost:3000/api/performance-attribution/record/{记录ID}/review-adjust \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "风控复核-小张",
    "adjustedAmount": 1250.35,
    "remark": "核对托管确认页C-20240603-042，确认应为1250.35，原金额0为系统冲正标记"
  }'
```

然后把复核通过的记录纳入摘要：

```bash
curl -X POST http://localhost:3000/api/performance-attribution/record/{记录ID}/summarize \
  -H "Content-Type: application/json" \
  -d '{"operator": "风控复核-小张"}'
```

负责人看的摘要就更新了。

---

## 常用查询接口

### 看今天有多少待复核的
```bash
curl http://localhost:3000/api/performance-attribution/zero-reversal/2024-06-03
```

### 看某条记录的完整审计 trail
```bash
curl http://localhost:3000/api/performance-attribution/record/{记录ID}/audit
```

### 导出报表数据
```bash
curl http://localhost:3000/api/performance-attribution/export/2024-06-03
```

### 给负责人看的摘要
```bash
curl http://localhost:3000/api/performance-attribution/summary/manager/2024-06-03
```

---

## 审计日志里有什么？

每次操作都会记：
- 时间戳
- 操作人（必填！别填"系统"）
- 动作（导入、提交复核、调整、回滚...）
- 旧值 → 新值
- 备注/原因

老秦你每次操作都留名，以后出问题知道找谁，也知道当时为什么这么做。

---

## 启动服务

```bash
npm install
npm run dev
```

服务跑在 `http://localhost:3000`

---

## 代码结构

```
src/
├── types/index.ts           # 类型定义（状态、接口）
├── core/
│   ├── ReversalDetector.ts  # 冲正识别逻辑
│   ├── StatusFlowHandler.ts # 状态流转
│   └── TradeRecordFactory.ts # 记录创建
├── data/
│   ├── DataStore.ts         # 统一数据存储
│   └── UnifiedDataService.ts # 统一数据访问
├── services/
│   └── PerformanceAttributionService.ts # 业务服务
├── api/
│   └── routes.ts            # API路由
└── index.ts                 # 入口
```

---

## 给老秦的提醒

1. **金额为0已冲正的记录不会自动消失**，必须有人复核
2. **别跳过托管确认页**，尾差调整条和托管页谁可信？以托管为准，但两边都要留参考
3. **调整金额要填原因**，别只改数不留话
4. **所有操作都有日志**，慎重操作，但也别怕，能回滚
5. **导出、页面、接口都是同一份数据**，不用自己对账
