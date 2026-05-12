# 二手车检测估价 API

一个完整的二手车估价系统，结合检测项、事故记录、里程异常、整备成本和报价历史进行综合估价。

## 功能概述

### 核心业务模块

1. **车辆档案管理** - 存储车辆基本信息（品牌、型号、里程、使用性质等）
2. **检测项管理** - 管理外观、内饰、发动机、变速箱、底盘、安全系统等检测结果
3. **事故记录** - 记录事故类型、严重程度、受损部位、理赔情况
4. **里程校验** - 检测里程异常、疑似回调、历史记录比对
5. **整备成本** - 管理各项整备项目的预估费用和优先级
6. **估价试算** - 自动计算基础价格、各项扣减、最终估价
7. **报价版本** - 支持多版本报价，记录报价历史和客户信息

### 业务规则

- **重大事故扣分**：重大事故扣20-30分，结构性损伤追加扣分，气囊弹出追加扣分
- **里程疑似回调**：表显里程低于预期15%以上标记为疑似回调，需人工审核
- **检测项缺失**：必填检测项未完成需标记并扣分
- **整备成本超阈值**：整备成本超过估价8%时触发风险标记
- **重复报价检测**：同一客户对同一车辆不能重复报价

### 状态流转

```
草稿 → 待检测 → 检测中 → 检测完成 → 待审核 → 审核通过 → 估价完成 → 已报价 → 已成交
       ↓          ↓           ↓            ↓            ↓             ↓            ↓
     已作废      已作废       已作废       已作废        已作废         已作废        已作废
```

### 幂等性与可追溯

- 使用 `request_id` 实现创建操作幂等
- 每一步状态变更都记录历史（包含操作人、时间、原因）
- 人工修正必须记录前后差异和操作者
- 异常处理记录失败原因并标记需人工审核

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库并造数

```bash
npm run seed
```

这会创建3个演示样例：

| 样例 | 描述 | 特点 |
|------|------|------|
| 正常估价 | 无事故、里程正常的车辆 | 完整流程 + 报价版本对比 |
| 事故车降价 | 有重大事故记录 | 重大事故扣分规则演示 |
| 里程异常待审 | 表显里程疑似回调 | 里程异常检测 + 人工审核 |

### 3. 启动服务

```bash
npm run start
```

服务将在 `http://localhost:3000` 启动

### 4. 健康检查

```bash
curl http://localhost:3000/health
```

## 主要演示路径

### 正常估价流程

#### 步骤1: 创建估价

```bash
curl -X POST http://localhost:3000/api/valuations \
  -H "Content-Type: application/json" \
  -H "x-operator: 张销售" \
  -d '{
    "request_id": "req-001",
    "vehicle_profile": {
      "vin": "LSVNF2188D2123999",
      "brand": "丰田",
      "model": "凯美瑞 2.5G",
      "year": 2021,
      "mileage": 50000,
      "market_reference_price": 180000
    },
    "inspection_items": [
      { "category": "外观", "item_name": "车身漆面", "inspection_result": "正常", "is_required": true },
      { "category": "发动机", "item_name": "发动机工况", "inspection_result": "正常", "is_required": true }
    ]
  }'
```

#### 步骤2: 推进状态

```bash
# 草稿 → 待检测
curl -X POST http://localhost:3000/api/valuations/{id}/advance \
  -H "Content-Type: application/json" \
  -H "x-operator: 李检测" \
  -d '{ "target_status": "待检测" }'

# 待检测 → 检测中
curl -X POST http://localhost:3000/api/valuations/{id}/advance \
  -H "Content-Type: application/json" \
  -H "x-operator: 李检测" \
  -d '{ "target_status": "检测中" }'

# 检测中 → 检测完成
curl -X POST http://localhost:3000/api/valuations/{id}/advance \
  -H "Content-Type: application/json" \
  -H "x-operator: 李检测" \
  -d '{ "target_status": "检测完成" }'

# 检测完成 → 待审核
curl -X POST http://localhost:3000/api/valuations/{id}/advance \
  -H "Content-Type: application/json" \
  -H "x-operator: 王审核" \
  -d '{ "target_status": "待审核" }'

# 待审核 → 审核通过
curl -X POST http://localhost:3000/api/valuations/{id}/advance \
  -H "Content-Type: application/json" \
  -H "x-operator: 王审核" \
  -d '{ "target_status": "审核通过" }'

# 审核通过 → 估价完成（触发自动计算）
curl -X POST http://localhost:3000/api/valuations/{id}/advance \
  -H "Content-Type: application/json" \
  -H "x-operator: 系统" \
  -d '{ "target_status": "估价完成" }'
```

#### 步骤3: 查询估价详情

```bash
curl http://localhost:3000/api/valuations/{id}
```

#### 步骤4: 生成销售解释报告

```bash
curl http://localhost:3000/api/valuations/{id}/report
```

#### 步骤5: 创建报价版本

```bash
curl -X POST http://localhost:3000/api/valuations/{id}/quote-versions \
  -H "Content-Type: application/json" \
  -H "x-operator: 张销售" \
  -d '{
    "version_name": "首次报价",
    "quoted_price": 120000,
    "customer_name": "刘先生",
    "customer_phone": "13800138000",
    "quote_status": "已报价",
    "change_reason": "首次向客户报价"
  }'
```

#### 步骤6: 查看历史记录

估价详情中会包含完整的操作历史：
- 每个状态变更的时间和操作人
- 每次人工修正的前后差异
- 异常处理的失败原因

## 失败路径演示

### 场景1: 非法状态流转

**尝试从"草稿"直接推进到"估价完成"**

```bash
curl -X POST http://localhost:3000/api/valuations/{id}/advance \
  -H "Content-Type: application/json" \
  -d '{ "target_status": "估价完成" }'
```

**预期结果**: 返回错误 `"无法从\"草稿\"转换到\"估价完成\"状态"`

**业务意义**: 确保流程合规，不能跳过检测和审核环节

---

### 场景2: 重复报价

**给同一客户对同一辆车报两次价**

```bash
# 第一次报价
curl -X POST http://localhost:3000/api/valuations/{id1}/quote-versions \
  -H "Content-Type: application/json" \
  -d '{
    "quoted_price": 100000,
    "customer_name": "客户A",
    "customer_phone": "13999999999",
    "quote_status": "已报价"
  }'

# 对同一辆车再次报价（会失败）
curl -X POST http://localhost:3000/api/valuations/{id1}/quote-versions \
  -H "Content-Type: application/json" \
  -d '{
    "quoted_price": 95000,
    "customer_name": "客户A",
    "customer_phone": "13999999999",
    "quote_status": "已报价"
  }'
```

**预期结果**: 返回错误 `"重复报价：该客户在估价单 xxx 中已有有效报价"`

**业务意义**: 防止对同一客户进行价格欺诈或重复报价

---

### 场景3: 人工修正未提供操作人

```bash
curl -X POST http://localhost:3000/api/valuations/{id}/manual-corrections \
  -H "Content-Type: application/json" \
  -d '{
    "correction_type": "最终价格调整",
    "before_value": { "final_price": 100000 },
    "after_value": { "final_price": 95000 },
    "reason": "市场行情变化"
  }'
```

**预期结果**: 返回错误 `"缺少操作人信息，请在请求头中提供 x-operator"`

**业务意义**: 所有人工操作必须可追溯到具体操作人

---

### 场景4: 记录系统异常

```bash
curl -X POST http://localhost:3000/api/valuations/{id}/handle-error \
  -H "Content-Type: application/json" \
  -H "x-operator: 系统管理员" \
  -d '{ "error_message": "检测系统连接超时" }'
```

**预期结果**: 异常记录到历史，估价标记为需要人工审核

**业务意义**: 异常情况必须被记录和跟踪

## 内置样例说明

### 样例1: 正常估价（V-DEMO-NORMAL）

**车辆信息**: 大众帕萨特，2020年，7.5万公里
**特点**:
- 无事故记录
- 里程正常递增
- 检测项基本正常（仅内饰轻微磨损）
- 已推进到"估价完成"状态
- 有2个报价版本用于对比

**查看报告**:
```bash
curl http://localhost:3000/api/valuations/{normal-id}/report
```

**关注内容**:
- 完整的价格明细（基础估价 - 各项扣减 = 最终估价）
- 操作历史记录
- 报价版本对比
- 销售解释说明

---

### 样例2: 事故车降价（V-DEMO-ACCIDENT）

**车辆信息**: 宝马320Li，2021年，4.5万公里
**事故记录**:
- 2022年11月：重大事故（高速追尾，左侧A柱变形，左前纵梁修复）
  - 结构性损伤 ✅
  - 理赔金额32,000元
- 2023年3月：轻微事故（倒车剐蹭）

**规则应用**:
- 重大事故：扣20分，降价20%
- 结构性损伤：追加扣10分，降价10%
- 累计：扣30分，降价30%

**关注内容**:
- 事故扣减金额
- 风险等级（极高风险）
- 扣分原因明细

---

### 样例3: 里程异常待审（V-DEMO-MILEAGEANOMALY）

**车辆信息**: 丰田凯美瑞，2018年，表显3.8万公里
**问题**:
- 历史保养记录显示2021年已达6.5万公里
- 方向盘和座椅磨损严重
- 当前表显与车况不符

**系统判断**:
- 年预期里程：8年 × 2万 = 16万公里
- 表显里程：3.8万公里
- 偏差：76% > 15%阈值
- 结果：疑似回调，需人工审核

**关注内容**:
- 里程异常标记
- 人工修正记录
- 审核流程触发

## API 接口汇总

### 估价接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/valuations` | 创建估价（支持幂等） |
| GET | `/api/valuations` | 查询估价列表 |
| GET | `/api/valuations/:id` | 查询估价详情 |
| POST | `/api/valuations/:id/advance` | 推进状态 |
| POST | `/api/valuations/:id/quote-versions` | 创建报价版本 |
| POST | `/api/valuations/:id/manual-corrections` | 人工修正 |
| GET | `/api/valuations/:id/report` | 生成报告（JSON） |
| GET | `/api/valuations/:id/report/export` | 导出报告（TXT） |
| POST | `/api/valuations/:id/handle-error` | 异常处理 |

### 请求头

- `x-operator`: 操作人标识（用于审计）

### 响应格式

```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

## 运行演示脚本

### 正常流程演示

```bash
# 先启动服务
npm run start

# 在另一个终端运行
npm run demo
```

### 失败路径演示

```bash
# 先启动服务
npm run start

# 在另一个终端运行
npm run demo-failure
```

## 项目结构

```
used-car-valuation-api/
├── src/
│   ├── config/
│   │   └── database.js          # 数据库配置
│   ├── models/
│   │   ├── index.js             # 模型加载器
│   │   ├── VehicleProfile.js    # 车辆档案
│   │   ├── InspectionItem.js    # 检测项
│   │   ├── AccidentRecord.js    # 事故记录
│   │   ├── MileageVerification.js # 里程校验
│   │   ├── RepairCost.js        # 整备成本
│   │   ├── Valuation.js         # 估价主表
│   │   ├── ValuationHistory.js  # 估价历史
│   │   ├── QuoteVersion.js      # 报价版本
│   │   └── ManualCorrection.js  # 人工修正
│   ├── services/
│   │   ├── ValuationRulesService.js  # 估价规则引擎
│   │   └── ValuationService.js       # 估价业务服务
│   ├── routes/
│   │   └── valuations.js        # API路由
│   └── index.js                 # 应用入口
├── scripts/
│   ├── seed.js                  # 初始化样例数据
│   ├── demo.js                  # 正常流程演示
│   └── demo-failure.js          # 失败路径演示
├── data/                        # SQLite数据库目录
├── package.json
└── README.md
```

## 核心规则参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 年均预期里程 | 20,000公里 | 用于里程异常检测 |
| 里程偏差阈值 | 15% | 超过此值标记异常 |
| 整备成本阈值 | 8% | 超过基础价的8%触发风险 |
| 重大事故扣分 | 20-30分 | 根据事故类型 |
| 一般事故扣分 | 10分 | - |
| 轻微事故扣分 | 5分 | - |
| 结构性损伤追加 | 10分 | 叠加在事故扣分上 |
| 气囊弹出追加 | 8分 | 叠加在事故扣分上 |
| 严重检测异常扣分 | 5分/项 | - |
| 中度检测异常扣分 | 2分/项 | - |
| 轻微检测异常扣分 | 1分/项 | - |

## 输出示例

### 销售解释报告

```
【车辆基础信息】
品牌型号：大众 帕萨特 330TSI DSG尊荣版
出厂年份：2020年
表显里程：75000公里

【价格调整说明】
1. 内饰-座椅内饰: 轻微异常，扣1分

【整备明细】
1. [必须] 更换机油机滤 - ¥600
   说明: 常规保养，使用全合成机油
2. [建议] 前保险杠划痕修复 - ¥800
   说明: 保险杠有轻微划痕，不影响使用

【报价依据】
基础估价：¥96,200
事故扣减：¥0
里程扣减：¥0
检测扣减：¥0
整备成本：¥1,400
─────────────────────
最终估价：¥68,450
建议售价：¥75,295

【风险提示】
风险等级：中风险
⚠️ 方向盘和座椅磨损严重
```

## 许可证

MIT
