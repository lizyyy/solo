# 宠物医院药房管理系统后端

## 功能特性

- 药品管理（剂量上下限配置）
- 宠物信息管理（体重剂量自动计算）
- 库存批号管理（过期校验）
- 处方开具与审核（禁忌组合检查）
- 批量操作（失败重试不破坏成功记录）
- 完整审核留痕
- 所有操作带原因说明

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入样例数据

```bash
npm run seed
```

### 4. 启动服务

```bash
npm start
```

服务运行在: http://localhost:3000

### 5. 运行测试样例

```bash
npm test
```

## API 接口文档

### 基础响应格式

```json
{
  "success": true/false,
  "message": "操作结果说明",
  "data": {},
  "reason": "拦截/放行原因"
}
```

### 批量操作响应格式

```json
{
  "success": false,
  "message": "批量操作部分成功",
  "data": {
    "successCount": 2,
    "failCount": 1,
    "results": [
      {"index": 0, "success": true, "id": 1, "reason": "创建成功"},
      {"index": 1, "success": true, "id": 2, "reason": "创建成功"},
      {"index": 2, "success": false, "error": "剂量超出安全范围", "reason": "剂量0.5mg/kg超出上限0.3mg/kg"}
    ]
  }
}
```

---

### 药品管理 API

#### 1. 创建药品

**POST** `/api/medicines`

**请求体:**
```json
{
  "name": "阿莫西林",
  "specification": "250mg/片",
  "manufacturer": "某制药厂",
  "dosageMin": 0.01,
  "dosageMax": 0.05,
  "dosageUnit": "g/kg",
  "frequency": "每日2次",
  "contraindications": ["头孢类", "青霉素过敏"]
}
```

**字段说明:**
- `dosageMin`: 最小剂量 (单位/kg)
- `dosageMax`: 最大剂量 (单位/kg)
- `contraindications`: 禁忌药品名称列表

#### 2. 查询所有药品

**GET** `/api/medicines`

#### 3. 查询单个药品

**GET** `/api/medicines/:id`

#### 4. 批量创建药品

**POST** `/api/medicines/batch`

```json
{
  "medicines": [
    {"name": "阿莫西林", "dosageMin": 0.01, "dosageMax": 0.05},
    {"name": "头孢氨苄", "dosageMin": 0.015, "dosageMax": 0.03}
  ]
}
```

---

### 宠物管理 API

#### 1. 创建宠物

**POST** `/api/pets`

```json
{
  "name": "豆豆",
  "species": "犬",
  "breed": "金毛",
  "weight": 25.5,
  "weightUnit": "kg",
  "age": 3,
  "gender": "公",
  "ownerName": "张三",
  "ownerPhone": "13800138000"
}
```

#### 2. 查询所有宠物

**GET** `/api/pets`

#### 3. 查询单个宠物

**GET** `/api/pets/:id`

---

### 库存管理 API

#### 1. 添加库存

**POST** `/api/inventory`

```json
{
  "medicineId": 1,
  "batchNumber": "BATCH2024001",
  "quantity": 100,
  "unit": "片",
  "productionDate": "2024-01-15",
  "expiryDate": "2026-01-15"
}
```

#### 2. 查询库存列表

**GET** `/api/inventory`

#### 3. 查询药品可用库存（排除过期）

**GET** `/api/inventory/medicine/:medicineId/available`

---

### 处方管理 API

#### 1. 创建处方（自动校验）

**POST** `/api/prescriptions`

```json
{
  "petId": 1,
  "doctor": "李医生",
  "diagnosis": "呼吸道感染",
  "items": [
    {
      "medicineId": 1,
      "inventoryId": 1,
      "dosage": 0.02,
      "dosageUnit": "g/kg",
      "quantity": 14,
      "notes": "饭后服用"
    }
  ]
}
```

**校验规则:**
- 剂量在药品配置的 [dosageMin, dosageMax] 范围内
- 药品组合无禁忌
- 库存批号未过期
- 库存数量充足

#### 2. 查询处方列表

**GET** `/api/prescriptions`

#### 3. 查询单个处方详情

**GET** `/api/prescriptions/:id`

#### 4. 审核处方

**POST** `/api/prescriptions/:id/review`

```json
{
  "reviewer": "王主任",
  "action": "approve",
  "comments": "剂量合理，同意发药"
}
```

**action 可选值:**
- `approve`: 通过
- `reject`: 驳回

#### 5. 批量创建处方

**POST** `/api/prescriptions/batch`

```json
{
  "prescriptions": [
    {"petId": 1, "doctor": "李医生", "items": [...]},
    {"petId": 2, "doctor": "王医生", "items": [...]}
  ]
}
```

---

### 审核日志 API

#### 查询审核日志

**GET** `/api/audit-logs`

**参数:**
- `prescriptionId`: 按处方筛选
- `type`: 按类型筛选 (prescription/inventory/medicine)

---

## 业务规则说明

### 1. 剂量校验规则

- 系统根据宠物体重自动计算总剂量
- 单药剂量必须在药品配置的安全范围内
- 超剂量处方会被拦截并显示具体原因

### 2. 禁忌组合校验

- 创建处方时自动检查药品组合
- 发现禁忌组合立即拦截并列出禁忌药品

### 3. 批号过期校验

- 自动检查库存批号有效期
- 过期批号不允许用于处方
- 查询可用库存时自动过滤过期批号

### 4. 审核留痕

- 所有处方状态变更都有完整日志
- 记录操作人、时间、动作、意见
- 可追溯每一步操作

### 5. 批量操作保证

- 逐条处理，成功的提交，失败的记录
- 重试时跳过已成功的记录
- 返回详细的每条处理结果

## 样例数据说明

执行 `npm run seed` 后会导入:
- 5种常用药品（含剂量范围和禁忌）
- 3只宠物（不同体重和品种）
- 3条库存记录（含一条即将过期）
- 2张处方（一张正常、一张异常）

## 测试样例

### 正常场景

1. **正常剂量处方**
   - 宠物：25kg金毛
   - 药品：阿莫西林 (0.01-0.05g/kg)
   - 剂量：0.02g/kg
   - 预期：通过，总剂量 0.5g/次

2. **多药正常组合**
   - 阿莫西林 + 氨溴索
   - 预期：通过，无禁忌

### 异常场景

1. **剂量超标**
   - 宠物：2kg吉娃娃
   - 药品：阿莫西林 (最大0.05g/kg)
   - 剂量：0.1g/kg
   - 预期：拦截，原因：剂量超出上限

2. **禁忌组合**
   - 阿莫西林 + 头孢氨苄
   - 预期：拦截，原因：存在禁忌组合

3. **过期批号**
   - 使用过期库存
   - 预期：拦截，原因：批号已过期

4. **库存不足**
   - 处方数量 > 库存数量
   - 预期：拦截，原因：库存不足
