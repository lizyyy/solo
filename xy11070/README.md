# 舞蹈排练室超时计费系统

基于 Flask + SQLite 的 RESTful API 服务，实现舞蹈排练室预约、超时计费、数据导入导出等核心功能。

## 核心特性

- **超时冲突检测**: 检测上一个团队超时是否影响下一个团队
- **计费明细一致性**: 禁止静默覆盖已结算的计费记录
- **完整的导入导出流程**: 支持 CSV 批量导入，带详细错误日志
- **真实业务字段**: 包含排练室、团队、预约时间、实际时间、费用明细等

## 安装运行

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python app.py
```

服务启动后访问 `http://localhost:5000`

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/studios | 获取所有排练室 |
| GET | /api/teams | 获取所有团队 |
| GET | /api/bookings | 获取所有预约 |
| POST | /api/bookings | 创建预约 |
| POST | /api/bookings/{id}/checkin | 签到 |
| POST | /api/bookings/{id}/checkout | 签出并计费 |
| GET | /api/billing | 获取计费记录 |
| POST | /api/import | 导入预约数据(CSV) |
| GET | /api/export | 导出计费记录(CSV) |
| GET | /api/import-logs | 获取导入日志 |

## 验收流程

### 准备工作：启动服务
```bash
python app.py
```

系统会自动初始化样例数据：
- 3个排练室（主排练厅A101、小型排练室B202、VIP排练室C303）
- 4个舞蹈团队
- 3条预约记录（含1条正常计费、1条超时冲突计费、1条待预约）

---

### 验收1：查询正常记录（GET /api/billing）

**请求**
```bash
curl http://localhost:5000/api/billing
```

**预期响应**
```json
[
  {
    "id": 1,
    "team_name": "天鹅湖舞团",
    "scheduled_hours": 2.0,
    "scheduled_amount": 300.0,
    "overtime_minutes": 0,
    "total_amount": 300.0,
    "has_conflict": false
  },
  {
    "id": 2,
    "team_name": "青春舞蹈队",
    "overtime_minutes": 30,
    "overtime_amount": 112.5,
    "total_amount": 412.5,
    "has_conflict": true
  }
]
```

**验证点**
- 记录1：无超时，费用正常
- 记录2：超时30分钟，有冲突标记

---

### 验收2：创建冲突预约（POST /api/bookings）

**请求**
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "studio_id": 1,
    "team_id": 1,
    "booking_date": "'"$(date +%Y-%m-%d)"'",
    "scheduled_start": "10:00",
    "scheduled_end": "12:00"
  }'
```

**预期响应 (409 Conflict)**
```json
{
  "error": "Booking conflict detected",
  "message": "This time slot overlaps with existing bookings",
  "conflicts": [
    {
      "booking_id": 1,
      "team_name": "天鹅湖舞团",
      "scheduled_start": "09:00",
      "scheduled_end": "11:00"
    }
  ]
}
```

**验证点**
- 返回409状态码
- 明确说明冲突原因和冲突的预约详情

---

### 验收3：导入坏行测试（POST /api/import）

使用项目根目录的 `test_import.csv` 测试文件

**请求**
```bash
curl -X POST http://localhost:5000/api/import \
  -F "file=@test_import.csv"
```

**预期响应**
```json
{
  "message": "Import completed",
  "success_count": 1,
  "error_count": 2,
  "errors": [
    {
      "row": 3,
      "error": "Booking conflict: [...]",
      "data": {...}
    },
    {
      "row": 4,
      "error": "Studio INVALID_ROOM not found",
      "data": {...}
    }
  ]
}
```

**验证点**
- 第2行导入成功（B202，无冲突）
- 第3行导入失败（时间冲突）
- 第4行导入失败（排练室不存在）

---

### 验收4：导出CSV验证（GET /api/export）

**请求**
```bash
curl http://localhost:5000/api/export -o billing_export.csv
```

**导出CSV格式验证**
```csv
计费ID,预约ID,排练室,团队名称,预约日期,预定开始,预定结束,实际开始,实际结束,预定时长(小时),预定费用,超时分钟,超时费用,总费用,是否冲突,冲突详情,是否已结算
1,1,主排练厅,天鹅湖舞团,2024-01-15,09:00,11:00,09:05,10:55,2.0,300.0,0,0.0,300.0,否,,是
2,2,主排练厅,青春舞蹈队,2024-01-15,11:00,13:00,11:15,13:30,2.0,300.0,30,112.5,412.5,是,超时30分钟，影响下一个预约,是
```

**验证点**
- 导出字段完整（17个业务字段）
- 正常记录与冲突记录可区分
- 费用计算与API返回一致

---

### 验收5：禁止覆盖已结算记录

先签出一个预约产生已结算记录，再次签出验证

**请求**
```bash
# 第一次签出（正常）
curl -X POST http://localhost:5000/api/bookings/3/checkout \
  -H "Content-Type: application/json" \
  -d '{"actual_end": "15:30"}'

# 再次签出（应该失败）
curl -X POST http://localhost:5000/api/bookings/3/checkout \
  -H "Content-Type: application/json" \
  -d '{"actual_end": "16:00"}'
```

**第二次签出预期响应 (409)**
```json
{
  "error": "Billing record already finalized",
  "message": "Cannot overwrite existing finalized billing record",
  "existing_billing_id": 3
}
```

**验证点**
- 静默覆盖被禁止
- 返回明确的错误信息和已存在的计费ID

---

## 数据模型说明

### Studio（排练室）
- `room_number`: 房间号（唯一）
- `hourly_rate`: 每小时费用
- `overtime_rate_multiplier`: 超时费率倍数

### Booking（预约）
- `scheduled_start/end`: 预定时间
- `actual_start/end`: 实际时间
- `status`: scheduled/in_progress/completed

### BillingRecord（计费记录）
- `scheduled_hours/amount`: 预定时长费用
- `overtime_minutes/amount`: 超时时长费用
- `has_conflict`: 是否冲突标记
- `is_finalized`: 是否已结算（禁止修改）

## 异常处理重点

1. **预约时间冲突**: 创建预约时检测时间重叠，返回409
2. **超时影响后续团队**: 签出时计算对后续预约的影响，返回警告
3. **计费记录一致性**: 已结算记录禁止重复结算，防止覆盖
4. **导入错误明细**: 导入时逐行验证，记录详细错误日志
