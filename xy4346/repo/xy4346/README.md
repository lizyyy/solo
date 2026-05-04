# 社区共享厨房预订风控 API

一个基于 Flask + SQLite 的社区共享厨房本地预订风控系统，用于管理厨房时段、设备占用、食材冷藏格、负责人资质和活动人数的预订与风控检查。

## 功能特性

- 📅 **时段预订**: 志愿者录入厨房时段申请
- 🍳 **设备管理**: 管理厨房设备及其占用情况
- ❄️ **冷藏格管理**: 管理冷藏格容量和使用情况
- 👤 **负责人资质**: 管理志愿者负责人及其食品安全资质
- 👥 **人数控制**: 活动人数限制和检查
- 🔍 **自动风控**: 创建申请时自动检查：
  - 同一时段设备冲突
  - 冷藏格容量不足
  - 负责人资质过期
  - 超人数风险
- ✅ **人工审核**: 支持人工改判、确认排期
- 📋 **材料追踪**: 查询待补材料名单
- 📄 **值班交接**: 导出 Markdown 格式值班交接单

## 技术栈

- **Web 框架**: Flask 2.3.3
- **ORM**: SQLAlchemy 2.0.23
- **数据库**: SQLite
- **日期处理**: python-dateutil

## 安装与运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务启动后，访问地址: `http://localhost:5001`

## 数据库模型

### 主要数据表

| 表名 | 说明 |
|------|------|
| `equipment` | 设备信息 |
| `fridge` | 冷藏格信息 |
| `volunteer` | 志愿者/负责人信息 |
| `application` | 预订申请 |
| `audit_log` | 审核日志 |
| `equipment_usage` | 设备使用记录 |
| `fridge_usage` | 冷藏格使用记录 |

### 申请状态流转

```
pending (待审核) → approved (已通过) → confirmed (已确认排期)
                    ↓
                rejected (已拒绝)
                    ↓
                need_materials (待补材料)
```

## API 接口

所有接口前缀: `/api`

### 基础数据管理

#### 设备管理

**获取所有设备**
```bash
GET /api/equipment
```

**获取单个设备**
```bash
GET /api/equipment/<id>
```

**创建设备**
```bash
POST /api/equipment
Content-Type: application/json

{
    "name": "烤箱 A",
    "type": "烤箱",
    "status": "available"
}
```

**更新设备**
```bash
PUT /api/equipment/<id>
Content-Type: application/json

{
    "name": "烤箱 A-1",
    "status": "maintenance"
}
```

**删除设备**
```bash
DELETE /api/equipment/<id>
```

#### 冷藏格管理

**获取所有冷藏格**
```bash
GET /api/fridges
```

**创建冷藏格**
```bash
POST /api/fridges
Content-Type: application/json

{
    "name": "冷藏柜 1",
    "type": "cold",
    "total_capacity": 500.0,
    "status": "available"
}
```

#### 志愿者/负责人管理

**获取所有负责人**
```bash
GET /api/volunteers
```

**创建负责人**
```bash
POST /api/volunteers
Content-Type: application/json

{
    "name": "张三",
    "phone": "13800138000",
    "email": "zhangsan@example.com",
    "qualification_type": "食品安全管理员证",
    "qualification_number": "FS2024001",
    "qualification_valid_from": "2024-01-01",
    "qualification_valid_until": "2026-12-31",
    "status": "active"
}
```

### 申请管理

#### 创建申请

创建申请时会自动执行风控检查。

```bash
POST /api/applications
Content-Type: application/json

{
    "applicant_name": "李四",
    "applicant_phone": "13900139000",
    "activity_name": "社区亲子烘焙活动",
    "activity_description": "社区组织的亲子烘焙体验活动",
    "participant_count": 20,
    "start_time": "2026-05-10T09:00:00",
    "end_time": "2026-05-10T12:00:00",
    "volunteer_id": 1,
    "equipment_ids": [1, 2],
    "fridge_usage": [
        {"fridge_id": 1, "usage_capacity": 50.0}
    ]
}
```

**返回示例**:
```json
{
    "id": 1,
    "applicant_name": "李四",
    "status": "pending",
    "risk_level": "low",
    "risk_check": {
        "passed": true,
        "risk_level": "low",
        "warnings": [],
        "errors": []
    }
}
```

#### 查询申请

**获取所有申请**
```bash
GET /api/applications
```

**按状态筛选**
```bash
GET /api/applications?status=pending
```

**获取单个申请**
```bash
GET /api/applications/<id>
```

#### 手动执行风控检查

```bash
POST /api/applications/<id>/check-risk
```

#### 人工改判

```bash
POST /api/applications/<id>/review
Content-Type: application/json

{
    "status": "approved",
    "reviewer_name": "王审核",
    "review_notes": "风控检查通过，同意申请"
}
```

**状态可选值**:
- `approved` - 通过
- `rejected` - 拒绝
- `need_materials` - 待补材料
- `pending` - 待审核

**标记为待补材料示例**:
```bash
POST /api/applications/<id>/review
Content-Type: application/json

{
    "status": "need_materials",
    "reviewer_name": "王审核",
    "review_notes": "需要补充活动安全预案",
    "materials_needed": [
        "活动安全预案",
        "参与人员名单",
        "紧急联系人信息"
    ]
}
```

#### 确认排期

只有状态为 `approved` 或 `need_materials` 的申请可以确认排期。

```bash
POST /api/applications/<id>/confirm
```

确认排期后会：
1. 创建设备使用记录
2. 创建冷藏格使用记录
3. 更新申请状态为 `confirmed`

#### 查询待补材料名单

```bash
GET /api/applications/need-materials
```

#### 导出值班交接单

```bash
GET /api/applications/export/handover
```

**指定日期导出**:
```bash
GET /api/applications/export/handover?date=2026-05-10
```

返回 Markdown 格式文件，可直接下载保存。

#### 查询审核日志

```bash
GET /api/applications/<id>/audit-logs
```

### 统计接口

```bash
GET /api/statistics
```

**返回示例**:
```json
{
    "today_applications": 5,
    "pending_count": 3,
    "confirmed_count": 10,
    "need_materials_count": 2,
    "today_confirmed": 1
}
```

## 风控规则说明

### 1. 设备冲突检查

- 检查同一时段设备是否已被其他申请占用
- 时间重叠判断规则: `新开始 < 已结束 && 新结束 > 已开始`

### 2. 冷藏格容量检查

- 检查申请使用容量是否超过可用容量
- 可用容量 = 总容量 - 同时段其他申请已占用容量
- **警告阈值**: 使用率超过 80% 时发出警告

### 3. 负责人资质检查

- 检查负责人状态是否为 `active`
- 检查资质有效期是否覆盖活动日期
- **警告阈值**: 资质过期前 7 天发出警告

### 4. 人数风险检查

- 检查人数是否大于 0
- 检查人数是否超过最大限制（默认 50 人）
- **警告阈值**: 人数超过最大限制的 80% 时发出警告

### 风险等级

| 等级 | 说明 |
|------|------|
| `low` | 低风险，无警告和错误 |
| `medium` | 中风险，存在警告但无错误 |
| `high` | 高风险，存在错误，风控检查不通过 |

## 测试示例

### 完整流程测试

#### 1. 准备基础数据

```bash
# 创建设备
curl -X POST http://localhost:5001/api/equipment \
  -H "Content-Type: application/json" \
  -d '{"name": "烤箱 A", "type": "烤箱", "status": "available"}'

curl -X POST http://localhost:5001/api/equipment \
  -H "Content-Type: application/json" \
  -d '{"name": "搅拌机 B", "type": "搅拌机", "status": "available"}'

# 创建冷藏格
curl -X POST http://localhost:5001/api/fridges \
  -H "Content-Type: application/json" \
  -d '{"name": "冷藏柜 1", "type": "cold", "total_capacity": 500.0, "status": "available"}'

# 创建负责人
curl -X POST http://localhost:5001/api/volunteers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "phone": "13800138000",
    "qualification_type": "食品安全管理员证",
    "qualification_valid_from": "2024-01-01",
    "qualification_valid_until": "2026-12-31",
    "status": "active"
  }'
```

#### 2. 创建申请（自动风控检查）

```bash
curl -X POST http://localhost:5001/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_name": "李四",
    "applicant_phone": "13900139000",
    "activity_name": "社区亲子烘焙活动",
    "activity_description": "社区组织的亲子烘焙体验活动",
    "participant_count": 20,
    "start_time": "2026-05-10T09:00:00",
    "end_time": "2026-05-10T12:00:00",
    "volunteer_id": 1,
    "equipment_ids": [1, 2],
    "fridge_usage": [{"fridge_id": 1, "usage_capacity": 50.0}]
  }'
```

#### 3. 人工审核通过

```bash
curl -X POST http://localhost:5001/api/applications/1/review \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "reviewer_name": "王审核",
    "review_notes": "风控检查通过，同意申请"
  }'
```

#### 4. 确认排期

```bash
curl -X POST http://localhost:5001/api/applications/1/confirm
```

#### 5. 导出值班交接单

```bash
curl -O http://localhost:5001/api/applications/export/handover?date=2026-05-10
```

### 风控测试场景

#### 测试设备冲突

```bash
# 先创建第一个申请
curl -X POST http://localhost:5001/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_name": "申请1",
    "activity_name": "活动1",
    "participant_count": 10,
    "start_time": "2026-05-10T09:00:00",
    "end_time": "2026-05-10T12:00:00",
    "equipment_ids": [1]
  }'

# 确认排期
curl -X POST http://localhost:5001/api/applications/1/review \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
curl -X POST http://localhost:5001/api/applications/1/confirm

# 创建第二个申请（同一时段使用同一设备）
curl -X POST http://localhost:5001/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_name": "申请2",
    "activity_name": "活动2",
    "participant_count": 10,
    "start_time": "2026-05-10T10:00:00",
    "end_time": "2026-05-10T11:00:00",
    "equipment_ids": [1]
  }'
```

**预期结果**: 第二个申请的风控检查会报告设备冲突，风险等级为 `high`。

## 配置说明

在 `config.py` 中可以调整风控参数：

```python
class Config:
    # 最大活动人数
    MAX_PARTICIPANTS = 50
    
    # 冷藏格容量警告阈值（使用率比例）
    FRIDGE_CAPACITY_WARNING_THRESHOLD = 0.8
    
    # 资质过期警告提前天数
    QUALIFICATION_EXPIRY_WARNING_DAYS = 7
```

## 项目结构

```
.
├── app.py              # Flask 应用入口
├── config.py           # 配置文件
├── models.py           # 数据库模型
├── services.py         # 业务服务层
├── risk_control.py     # 风控校验逻辑
├── export_service.py   # 导出服务
├── routes.py           # API 路由
├── requirements.txt    # 依赖文件
└── kitchen.db          # SQLite 数据库（运行后生成）
```

## 许可证

MIT License
