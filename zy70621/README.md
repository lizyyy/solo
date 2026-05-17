# 物业催办外包派单完工复核后端API

小区业主报修管理系统，支持超时提醒、重复催办合并、外包派单、完工复核等功能。

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy
- **测试**: pytest
- **导出**: openpyxl (Excel导出)

## 核心功能

### 业务规则
1. **超时规则**: 根据紧急程度自动判断是否超时
   - 低: 72小时
   - 中: 24小时
   - 高: 4小时
   - 紧急: 30分钟

2. **重复催办合并**: 1小时内相同内容的催办自动标记为重复

3. **工单状态流转**:
   - pending (待处理)
   - assigned (已分配)
   - outsourced (已外包)
   - in_progress (处理中)
   - completed (已完成)
   - verified (已复核)
   - closed (已关闭)
   - cancelled (已取消)

### 审计日志
所有操作均保留审计记录，包括：
- 原始输入
- 操作人
- 处理结论
- 变更原因

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- ReDoc文档: http://localhost:8000/redoc

### 3. 生成测试数据

```bash
python seed_data.py
```

将生成以下测试数据:
- 6个楼栋房间
- 4个处理人（含2个外包人员）
- 6个报修工单（含超时、已分配、已外包、已完成等状态）
- 催办记录和完工证明

## API 接口

### 楼栋房间管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /buildings/ | 创建楼栋房间 |
| GET | /buildings/ | 查询楼栋列表 |
| GET | /buildings/{id} | 查询单个楼栋 |

### 处理人管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /handlers/ | 创建处理人 |
| GET | /handlers/ | 查询处理人列表 |
| GET | /handlers/{id} | 查询单个处理人 |

### 报修工单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /repairs/ | 创建报修工单 |
| GET | /repairs/ | 查询工单列表（支持按状态、超时、外包等筛选） |
| GET | /repairs/{id} | 查询单个工单 |
| GET | /repairs/no/{order_no} | 按工单号查询 |
| GET | /repairs/overdue | 查询超时工单 |
| GET | /repairs/outsourced | 查询外包工单 |
| GET | /repairs/duplicate-reminders | 查询有重复催办的工单 |
| PATCH | /repairs/{id}/status | 更新工单状态 |
| PUT | /repairs/{id} | 更新工单信息 |
| POST | /repairs/{id}/reminders | 添加催办记录 |
| POST | /repairs/{id}/outsourcing | 外包派单 |
| GET | /repairs/{id}/outsourcing | 查询外包记录 |
| POST | /repairs/{id}/completion-proof | 添加工单完工证明 |
| PATCH | /repairs/completion-proof/{id}/verify | 复核完工证明 |
| POST | /repairs/{id}/merge | 合并重复工单 |
| POST | /repairs/{id}/manual-correction | 人工修正 |
| POST | /repairs/{id}/close | 关闭工单 |
| POST | /repairs/{id}/cancel | 撤回/取消工单 |
| GET | /repairs/{id}/audit-logs | 查询审计日志 |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /export/repairs | 导出工单列表（Excel） |
| GET | /export/overdue | 导出超时工单（Excel） |
| GET | /export/outsourced | 导出外包工单（Excel） |
| GET | /export/audit-logs | 导出审计日志（Excel） |
| GET | /export/statistics | 导出统计报表（Excel） |

## cURL 主流程示例

### 1. 创建楼栋房间

```bash
curl -X POST "http://localhost:8000/buildings/" \
  -H "Content-Type: application/json" \
  -d '{
    "building_name": "1号楼",
    "unit_number": "1单元",
    "room_number": "101",
    "owner_name": "张三",
    "owner_phone": "13800138001"
  }'
```

### 2. 创建处理人

```bash
# 内部维修人员
curl -X POST "http://localhost:8000/handlers/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张维修",
    "phone": "13900139001",
    "department": "工程部",
    "is_outsourcer": false
  }'

# 外包人员
curl -X POST "http://localhost:8000/handlers/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王师傅",
    "phone": "13900139003",
    "department": "外包队A",
    "is_outsourcer": true,
    "company_name": "诚信维修公司",
    "skills": "水电,空调"
  }'
```

### 3. 创建报修工单

```bash
curl -X POST "http://localhost:8000/repairs/" \
  -H "Content-Type: application/json" \
  -d '{
    "building_id": 1,
    "reporter_name": "张三",
    "reporter_phone": "13800138001",
    "repair_type": "水管漏水",
    "description": "厨房水管漏水严重",
    "urgency": "high"
  }'
```

### 4. 查询工单列表

```bash
# 全部工单
curl "http://localhost:8000/repairs/"

# 超时工单
curl "http://localhost:8000/repairs/overdue"

# 外包工单
curl "http://localhost:8000/repairs/outsourced"

# 按状态筛选
curl "http://localhost:8000/repairs/?status=pending"
```

### 5. 更新工单状态

```bash
curl -X PATCH "http://localhost:8000/repairs/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "assigned",
    "operator": "管理员",
    "reason": "已分配给张维修",
    "conclusion": "任务已分配，预计2小时内到达"
  }'
```

### 6. 添加催办记录

```bash
curl -X POST "http://localhost:8000/repairs/1/reminders" \
  -H "Content-Type: application/json" \
  -d '{
    "reminder_method": "电话",
    "reminder_content": "漏水越来越严重，请尽快处理",
    "reminder_by": "张三"
  }'
```

### 7. 外包派单

```bash
curl -X POST "http://localhost:8000/repairs/1/outsourcing?operator=管理员" \
  -H "Content-Type: application/json" \
  -d '{
    "outsourcer_id": 3,
    "expected_completion": null,
    "cost_estimate": 200,
    "notes": "需要更换水管零件"
  }'
```

### 8. 添加工单完工证明

```bash
curl -X POST "http://localhost:8000/repairs/1/completion-proof" \
  -H "Content-Type: application/json" \
  -d '{
    "proof_type": "照片",
    "proof_url": "http://example.com/proofs/001.jpg",
    "description": "维修完成现场照片",
    "uploaded_by": "王师傅"
  }'
```

### 9. 复核完工证明

```bash
curl -X PATCH "http://localhost:8000/repairs/completion-proof/1/verify?verified_by=李主管"
```

### 10. 关闭工单

```bash
curl -X POST "http://localhost:8000/repairs/1/close?operator=管理员&reason=维修完成，业主满意"
```

## 冲突/异常场景示例

### 1. 查询不存在的工单

```bash
curl "http://localhost:8000/repairs/99999"
# 返回 404 Not Found
```

### 2. 重复催办（系统自动识别）

```bash
# 第一次催办
curl -X POST "http://localhost:8000/repairs/1/reminders" \
  -H "Content-Type: application/json" \
  -d '{"reminder_content": "请尽快处理", "reminder_by": "张三"}'

# 1小时内相同内容第二次催办（自动标记为重复）
curl -X POST "http://localhost:8000/repairs/1/reminders" \
  -H "Content-Type: application/json" \
  -d '{"reminder_content": "请尽快处理", "reminder_by": "张三"}'
```

### 3. 人工修正（保留审计记录）

```bash
curl -X POST "http://localhost:8000/repairs/1/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "field_name": "repair_type",
    "old_value": "水管漏水",
    "new_value": "下水道堵塞",
    "operator": "管理员",
    "reason": "报修类型录入错误，业主确认是下水道问题"
  }'
```

### 4. 撤回工单

```bash
curl -X POST "http://localhost:8000/repairs/1/cancel?operator=管理员&reason=业主自行解决，取消报修"
```

### 5. 合并重复工单

```bash
curl -X POST "http://localhost:8000/repairs/2/merge" \
  -H "Content-Type: application/json" \
  -d '{
    "target_order_id": 1,
    "operator": "管理员",
    "reason": "同一业主同一问题重复报单，合并处理"
  }'
```

## 导出示例

### 导出全部工单

```bash
curl -O "http://localhost:8000/export/repairs"
```

### 导出统计报表

```bash
curl -O "http://localhost:8000/export/statistics"
```

## 运行测试

```bash
# 运行全部测试
pytest test_main.py -v

# 运行测试并生成覆盖率报告
pytest test_main.py --cov=app --cov-report=html

# 运行特定测试
pytest test_main.py::test_create_repair_order -v
```

测试覆盖以下场景:
- 基础CRUD操作
- 状态流转
- 外包派单
- 催办记录
- 工单关闭/取消
- 审计日志
- 数据导出
- 异常场景（404等）

## 项目结构

```
.
├── main.py              # 应用入口
├── requirements.txt     # 依赖列表
├── seed_data.py         # 测试数据生成脚本
├── test_main.py         # pytest测试用例
├── property_management.db  # SQLite数据库（运行后生成）
├── README.md            # 项目文档
└── app/
    ├── __init__.py
    ├── database.py      # 数据库配置
    ├── models.py        # 数据模型
    ├── schemas.py       # Pydantic模式
    ├── crud.py          # 业务逻辑
    └── routers/         # API路由
        ├── __init__.py
        ├── buildings.py
        ├── handlers.py
        ├── repairs.py
        └── export.py
```

## 数据模型说明

1. **Building (楼栋房间)**: 存储楼栋、单元、房间号及业主信息
2. **Handler (处理人)**: 存储维修人员信息，支持外包标记
3. **RepairOrder (报修工单)**: 核心工单数据，包含状态、紧急程度、超时标记等
4. **ReminderRecord (催办记录)**: 存储催办历史，支持重复标记
5. **OutsourcingRecord (外包记录)**: 存储外包派单信息
6. **CompletionProof (完工证明)**: 存储完工凭证及审核状态
7. **AuditLog (审计日志)**: 记录所有操作变更及原因

---

*注: 本项目为演示项目，生产环境请考虑添加认证、权限控制、数据备份等安全措施。*
