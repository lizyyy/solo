# 园区能耗系统异常电表复核 API

本地可运行的 RESTful API 服务，用于电表读数异常检测与复核流程管理。

## 功能特性

- ✅ 电表管理（创建、查询、换表）
- ✅ 读数录入与异常自动检测
- ✅ 复核记录与状态流转
- ✅ 历史变更轨迹追踪
- ✅ CSV 批量导入（含坏行处理）
- ✅ CSV 数据导出
- ✅ 换表后读数倒挂特殊处理逻辑

## 状态定义

| 状态码 | 状态说明 |
|--------|----------|
| normal | 正常 |
| abnormal_pending | 异常待查 |
| corrected | 已修正 |
| confirmed | 已确认 |
| pending_manual | 待人工处理 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 3. 生成测试数据

```bash
npm run seed
```

此脚本将生成：
- 4 个电表（含换表演示）
- 多组正常读数序列
- 1 条读数倒挂异常记录（完整状态流转）
- 1 条换表后倒挂记录（待人工处理）
- 测试用 CSV 导入文件（含坏行）

## API 接口文档

### 健康检查

```bash
curl http://localhost:3000/api/health
```

### 获取状态列表

```bash
curl http://localhost:3000/api/status
```

---

### 电表管理

#### 创建电表

```bash
curl -X POST http://localhost:3000/api/meters \
  -H "Content-Type: application/json" \
  -d '{
    "meter_no": "METER-TEST-001",
    "meter_name": "测试电表",
    "location": "测试位置"
  }'
```

#### 查询所有电表

```bash
curl http://localhost:3000/api/meters
```

#### 电表换表

```bash
curl -X POST http://localhost:3000/api/meters/METER-003/replace \
  -H "Content-Type: application/json" \
  -d '{
    "meter_no": "METER-003-NEW-2",
    "meter_name": "新电表",
    "location": "相同位置"
  }'
```

---

### 读数管理

#### 添加读数

```bash
curl -X POST http://localhost:3000/api/readings \
  -H "Content-Type: application/json" \
  -d '{
    "meter_id": 1,
    "reading_value": 1500.5,
    "reading_time": "2024-01-15 08:00:00",
    "collector": "采集员A"
  }'
```

**重要**: 当读数出现倒挂时，系统会自动创建复核记录并返回异常信息。

#### 查询电表读数历史

```bash
curl http://localhost:3000/api/meters/1/readings
```

#### 校正读数

```bash
curl -X POST http://localhost:3000/api/readings/2/correct \
  -H "Content-Type: application/json" \
  -d '{
    "new_value": 2180.0,
    "note": "抄表错误校正",
    "reviewed_by": "审核员A"
  }'
```

---

### 复核记录管理

#### 查询复核记录列表

```bash
# 全部
curl http://localhost:3000/api/reviews

# 按状态筛选
curl "http://localhost:3000/api/reviews?status=abnormal_pending"

# 按电表号筛选
curl "http://localhost:3000/api/reviews?meter_no=METER-002"
```

#### 查询复核详情（含历史）

```bash
curl http://localhost:3000/api/reviews/1
```

#### 更新复核状态

```bash
curl -X PUT http://localhost:3000/api/reviews/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "corrected",
    "note": "已核实并修正",
    "reviewed_by": "审核员A"
  }'
```

---

### 导入导出

#### CSV 批量导入

```bash
curl -X POST http://localhost:3000/api/import \
  -F "file=@test-import.csv"
```

**返回示例**（含坏行信息）:
```json
{
  "success": true,
  "data": {
    "batchNo": "BATCH-1705300000000",
    "totalCount": 5,
    "successCount": 3,
    "failedCount": 2,
    "failed": [
      {
        "row": 4,
        "data": {...},
        "error": "缺少必填字段"
      }
    ]
  }
}
```

#### 查询导入批次

```bash
curl http://localhost:3000/api/import/batches
```

#### 导出复核记录

```bash
curl -X POST http://localhost:3000/api/export/reviews \
  -H "Content-Type: application/json" \
  -d '{}'
```

下载导出文件:
```bash
curl -O http://localhost:3000/api/exports/reviews_export_YYYYMMDD_HHmmss.csv
```

---

## 验收测试流程

按以下顺序执行，验证完整功能：

### 前置准备

```bash
# 1. 安装依赖
npm install

# 2. 启动服务（新开终端）
npm start

# 3. 生成测试数据（新开终端）
npm run seed
```

### 1. 完整流转验证 - 从异常到确认

```bash
# 查看复核列表，找到已确认的记录
curl http://localhost:3000/api/reviews

# 查看某条复核的详情与历史轨迹
curl http://localhost:3000/api/reviews/1
```

**预期结果**:
- 状态流转轨迹清晰可见：异常待查 → 已修正 → 已确认
- 每步操作有复核说明和操作人
- 列表、详情、历史数据互相对应

### 2. 冲突记录验证 - 读数倒挂

```bash
# 查询状态为"待人工处理"的复核记录
curl "http://localhost:3000/api/reviews?status=pending_manual"

# 查看详情中的异常说明
curl http://localhost:3000/api/reviews/2
```

**预期结果**:
- 可解释的原因说明："电表换表后读数倒挂：旧表读数(5000) -> 新表读数(100)，需人工核实换表底度和计费规则"
- 状态为 `pending_manual`（待人工处理）

### 3. 导入坏行验证

```bash
# 执行导入（使用生成的测试文件）
curl -X POST http://localhost:3000/api/import \
  -F "file=@test-import.csv"

# 查看导入批次详情
curl http://localhost:3000/api/import/batches
```

**预期结果**:
- totalCount = 5
- successCount = 3 或 4
- failedCount > 0
- failed 数组包含具体错误行号和错误原因

### 4. 导出验证

```bash
# 导出所有复核记录
curl -X POST http://localhost:3000/api/export/reviews \
  -H "Content-Type: application/json" \
  -d '{}'

# 记下返回的文件名，然后下载（替换文件名）
# curl -O http://localhost:3000/api/exports/reviews_export_xxx.csv
```

**预期结果**:
- CSV 文件包含所有复核记录
- 字段完整：电表号、读数、时间、状态、异常说明、复核人等

### 5. 互相对账验证

执行以下查询，确认数据一致性：

```bash
# 1. 复核列表总数
curl http://localhost:3000/api/reviews

# 2. 导出文件记录数
# （打开CSV文件对比）

# 3. 各状态数量统计
curl "http://localhost:3000/api/reviews?status=normal"
curl "http://localhost:3000/api/reviews?status=confirmed"
curl "http://localhost:3000/api/reviews?status=pending_manual"
```

---

## 数据模型

### 电表 (meters)
- id: 主键
- meter_no: 电表编号（唯一）
- meter_name: 电表名称
- location: 安装位置
- type: 类型
- is_active: 是否启用
- replaced_from: 替换自哪个电表
- replace_time: 换表时间
- created_at, updated_at

### 读数 (meter_readings)
- id: 主键
- meter_id: 电表ID
- reading_value: 读数值
- reading_time: 采集时间
- collector: 采集人
- import_batch: 导入批次
- is_valid: 是否有效

### 复核记录 (review_records)
- id: 主键
- meter_id: 电表ID
- reading_id: 关联读数ID
- status: 状态
- anomaly_type: 异常类型
- anomaly_detail: 异常详情
- previous_reading: 上次读数
- current_reading: 当前读数
- review_note: 复核说明
- reviewed_by: 复核人

### 复核历史 (review_history)
- id: 主键
- review_id: 复核记录ID
- old_status: 旧状态
- new_status: 新状态
- change_note: 变更说明
- changed_by: 操作人
- created_at
