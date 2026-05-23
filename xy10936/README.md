# 废品回收称重 API 服务

本地后端 API 服务，提供废品回收称重、价格管理、结算报告等功能，解决客户质疑毛重、皮重和当日价格被篡改的问题。

## 核心特性

- ✅ **重量复核机制**：称重后二次复核，差异过大自动记录异常
- ✅ **价格版本管理**：所有价格变动保留历史版本，可追溯
- ✅ **智能扣杂计算**：按品类自动计算扣杂比例
- ✅ **重复结算拦截**：防止同一称重记录被多次结算
- ✅ **异常路径追踪**：保存原始输入和处理结论
- ✅ **人工修正留痕**：所有修改记录操作人和原因
- ✅ **CSV报表导出**：支持结算报告和称重记录导出

## 技术栈

- Node.js + TypeScript
- Express.js
- SQLite (本地持久化)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 验证核心流程（可选）

运行端到端测试，验证称重到结算的完整闭环：

```bash
npm test
```

测试内容包括：创建数据、称重、复核、录价、生成报告、确认结算、重复结算拦截、异常处理。

### 3. 初始化数据库和样例数据

```bash
npm run init-data
```

将自动创建：
- 3个客户（张三废品站、李四回收站、王五回收点）
- 5个品类（废铁、废铝、废铜、废纸、废塑料）
- 5套价格版本
- 5个扣杂比例规则

### 4. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 5. 构建生产版本

```bash
npm run build
npm start
```

### 清理数据库

```bash
npm run clean
```

## API 接口文档

### 健康检查

```bash
curl http://localhost:3000/api/health
```

### 客户管理

#### 获取所有客户
```bash
curl http://localhost:3000/api/customers
```

#### 创建新客户
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "赵六回收站",
    "phone": "13900139001",
    "address": "北京市西城区环保路88号"
  }'
```

### 品类管理

#### 获取所有品类
```bash
curl http://localhost:3000/api/categories
```

#### 创建新品类
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -d '{
    "name": "废钢",
    "code": "ST001",
    "description": "钢材类废料"
  }'
```

#### 设置品类价格（支持版本管理）
```bash
curl -X POST http://localhost:3000/api/categories/1/prices \
  -H "Content-Type: application/json" \
  -d '{
    "price": 2.8,
    "effective_date": "2024-01-15",
    "created_by": "管理员"
  }'
```

#### 查看品类价格历史
```bash
curl http://localhost:3000/api/categories/1/prices
```

### 称重管理

#### 创建称重记录
```bash
curl -X POST http://localhost:3000/api/weighing \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "category_id": 1,
    "gross_weight": 1050.5,
    "tare_weight": 50.5,
    "operator": "张师傅"
  }'
```

#### 获取称重记录列表
```bash
curl http://localhost:3000/api/weighing
```

#### 按客户查询称重记录
```bash
curl http://localhost:3000/api/weighing?customer_id=1
```

#### 按状态查询称重记录
```bash
curl http://localhost:3000/api/weighing?status=pending
```

#### 重量复核
```bash
curl -X POST http://localhost:3000/api/weighing/1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "gross_weight": 1050.3,
    "tare_weight": 50.2,
    "verifier": "李复核",
    "remark": "重量正常"
  }'
```

#### 录入价格
```bash
curl -X POST http://localhost:3000/api/weighing/1/apply-price
```

#### 计算结算金额
```bash
curl http://localhost:3000/api/weighing/1/amount
```

#### 人工修正称重记录
```bash
curl -X POST http://localhost:3000/api/weighing/1/correct \
  -H "Content-Type: application/json" \
  -d '{
    "field_name": "gross_weight",
    "new_value": "1060.0",
    "reason": "仪表读数错误，重新称重",
    "operator": "王主管"
  }'
```

#### 查看复核历史
```bash
curl http://localhost:3000/api/weighing/1/verifications
```

#### 查看修正历史
```bash
curl http://localhost:3000/api/weighing/1/corrections
```

### 结算管理

#### 生成结算报告
```bash
curl -X POST http://localhost:3000/api/settlement/generate \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "generated_by": "财务小张"
  }'
```

#### 确认结算（防止重复结算）
```bash
curl -X POST http://localhost:3000/api/settlement/1/confirm
```

#### 查看结算报告详情
```bash
curl http://localhost:3000/api/settlement/1
```

#### 导出结算报告为CSV
```bash
curl -o settlement.csv http://localhost:3000/api/settlement/1/export
```

#### 导出所有称重记录
```bash
curl -o weighing.csv http://localhost:3000/api/settlement/export/weighing
```

### 异常处理

#### 查看所有异常记录
```bash
curl http://localhost:3000/api/exceptions
```

#### 查看未处理异常
```bash
curl http://localhost:3000/api/exceptions?handled=false
```

#### 处理异常
```bash
curl -X POST http://localhost:3000/api/exceptions/1/handle \
  -H "Content-Type: application/json" \
  -d '{
    "handled_by": "主管",
    "conclusion": "已与客户沟通，确认重量差异，按新重量结算"
  }'
```

## 坏数据路径测试

### 测试1：毛重小于等于皮重
```bash
curl -X POST http://localhost:3000/api/weighing \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "category_id": 1,
    "gross_weight": 50.0,
    "tare_weight": 100.0,
    "operator": "测试员"
  }'
```

**预期结果**：返回错误 "毛重必须大于皮重"，并在异常记录表中保存原始输入。

### 测试2：重量复核差异过大
```bash
# 先创建称重记录
curl -X POST http://localhost:3000/api/weighing \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "category_id": 1,
    "gross_weight": 1000.0,
    "tare_weight": 50.0,
    "operator": "测试员"
  }'

# 复核时差异超过阈值
curl -X POST http://localhost:3000/api/weighing/1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "gross_weight": 1500.0,
    "tare_weight": 50.0,
    "verifier": "测试复核"
  }'
```

**预期结果**：返回错误并记录异常，差异超过0.5kg自动触发异常。

### 测试3：未复核就录入价格
```bash
# 先创建称重记录（状态为pending）
curl -X POST http://localhost:3000/api/weighing \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "category_id": 1,
    "gross_weight": 1000.0,
    "tare_weight": 50.0,
    "operator": "测试员"
  }'

# 直接尝试录入价格
curl -X POST http://localhost:3000/api/weighing/1/apply-price
```

**预期结果**：返回错误 "只有已复核的记录可以录入价格"。

### 测试4：重复结算拦截
```bash
# 1. 完成称重流程后生成并确认结算报告
# 2. 再次尝试将同一记录加入其他结算报告

# 或者尝试重复确认同一报告
curl -X POST http://localhost:3000/api/settlement/1/confirm
curl -X POST http://localhost:3000/api/settlement/1/confirm
```

**预期结果**：第二次确认返回错误 "该报告已确认，不能重复确认"。

### 测试5：修改已结算记录
```bash
# 尝试修改已结算的称重记录
curl -X POST http://localhost:3000/api/weighing/1/correct \
  -H "Content-Type: application/json" \
  -d '{
    "field_name": "gross_weight",
    "new_value": "2000.0",
    "reason": "测试修改已结算记录",
    "operator": "测试员"
  }'
```

**预期结果**：返回错误 "已结算的记录不能修改"。

## 业务流程说明

```
称重记录创建
      ↓
[状态: pending]
      ↓
  重量复核  → 差异过大 → 异常记录 → 人工处理
      ↓                ↓
[状态: verified]     保存原始数据
      ↓
  录入价格  → 无有效价格 → 返回错误
      ↓
[状态: priced]
      ↓
  生成结算报告
      ↓
  确认结算  → 检查是否已结算
      ↓
[状态: settled]  ← 防止重复结算
      ↓
  导出报表
```

## 数据模型

1. **customers** - 客户信息
2. **categories** - 废品品类
3. **price_versions** - 价格版本历史
4. **deduction_ratios** - 扣杂比例规则
5. **weighing_records** - 称重记录
6. **weight_verifications** - 重量复核记录
7. **settlement_reports** - 结算报告
8. **settlement_items** - 结算明细
9. **exception_records** - 异常处理记录
10. **manual_corrections** - 人工修正记录

## 项目结构

```
src/
├── app.ts              # 应用入口
├── database/
│   ├── db.ts           # 数据库配置
│   └── init.ts         # 数据库初始化
├── routes/
│   ├── customers.ts    # 客户管理路由
│   ├── categories.ts   # 品类管理路由
│   ├── weighing.ts     # 称重管理路由
│   ├── settlement.ts   # 结算管理路由
│   └── exceptions.ts   # 异常处理路由
├── services/
│   ├── weighingService.ts      # 称重业务逻辑
│   ├── settlementService.ts    # 结算业务逻辑
│   └── exportService.ts        # 导出服务
├── dao/                # 数据访问层
├── types/              # 类型定义
└── scripts/
    └── initData.ts     # 样例数据脚本
```

## 异常记录字段

所有异常路径都会保存：
- 异常类型
- 原始输入数据（JSON格式）
- 错误信息
- 创建时间
- 处理状态
- 处理人
- 处理结论
- 处理时间

确保每一笔异常操作都可追溯、可审计。
