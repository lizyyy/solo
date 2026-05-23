# 实验室仪器预约 API

提供实验室高价仪器预约管理功能，包括时段锁定、风险申报、超时处罚、取消释放和报告导出。

## 技术栈
- Python 3.8+
- FastAPI
- SQLAlchemy
- SQLite
- Pandas

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据
```bash
python init_data.py
```
这将创建3个课题组、4台仪器、3条预约记录、1条样本风险评估、1条取消记录、1份使用报告和1条异常处理记录。

### 3. 启动服务
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档 (Swagger UI): http://localhost:8000/docs
- ReDoc 文档: http://localhost:8000/redoc

## 核心功能模块

1. **课题组管理** - 管理课题组信息，维护信用分
2. **仪器管理** - 管理高价仪器信息和状态
3. **预约管理** - 时段锁定、冲突检测、状态推进
4. **样本风险评估** - 高风险样本申报与审批
5. **取消记录** - 取消预约、自动计算罚款、信用分扣减
6. **使用报告** - 记录实际使用时长、超时处罚、样本污染记录
7. **异常处理** - 记录异常请求、保存原始输入、处理结论
8. **人工修正** - 管理员手动调整预约状态、豁免罚款
9. **数据导出** - 导出使用报告为 Excel/CSV

## 核心业务规则

### 时段锁定规则
- 预约时段冲突检测，防止重复预约
- 每台仪器有最大预约时长限制
- 支持预约状态流转：pending -> confirmed -> in_use -> completed

### 风险申报规则
- 特定仪器需要样本风险评估
- 风险等级：low / medium / high
- 生物危害等级 0-3
- 审批通过后预约状态自动变为 confirmed

### 超时处罚规则
- 超时部分按1.5倍费率计算罚款
- 超时处罚会扣减课题组信用分（每200元扣1分）
- 信用分低于60分无法创建新预约

### 取消释放规则
- 提前24小时以上取消：无罚款
- 提前6-24小时取消：50%费率罚款
- 提前6小时内取消：100%费率罚款
- 罚款会扣减课题组信用分（每200元扣1分）

### 样本污染处罚
- 确认样本污染后，仪器状态变为 maintenance
- 课题组信用分扣减20分

## API 接口调用示例

### 1. 查询所有仪器
```bash
curl -X GET "http://localhost:8000/instruments/" -H "accept: application/json"
```

### 2. 创建新预约
```bash
curl -X POST "http://localhost:8000/reservations/" \
  -H "Content-Type: application/json" \
  -d '{
    "instrument_id": 1,
    "group_id": 1,
    "user_name": "测试用户",
    "start_time": "2024-12-20T09:00:00",
    "end_time": "2024-12-20T13:00:00",
    "sample_type": "测试样品",
    "purpose": "测试预约"
  }'
```

### 3. 提交样本风险评估
```bash
curl -X POST "http://localhost:8000/sample-risks/" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 2,
    "risk_level": "high",
    "contamination_risk": true,
    "biohazard_level": 2,
    "special_requirements": "需要生物安全柜操作"
  }'
```

### 4. 审批样本风险
```bash
curl -X PUT "http://localhost:8000/sample-risks/1/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "approved_by": "实验室管理员"
  }'
```

### 5. 取消预约
```bash
curl -X POST "http://localhost:8000/cancellations/" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 2,
    "cancelled_by": "李四",
    "reason": "样品制备失败"
  }'
```

### 6. 提交使用报告
```bash
curl -X POST "http://localhost:8000/usage-reports/" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 1,
    "issues_found": "仪器工作正常",
    "sample_contamination": false,
    "submitted_by": "张三"
  }'
```

### 7. 人工修正预约（豁免罚款）
```bash
curl -X POST "http://localhost:8000/manual-corrections/" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 3,
    "corrected_by": "系统管理员",
    "reason": "仪器故障导致取消，豁免罚款",
    "waive_penalty": true
  }'
```

### 8. 导出使用报告（Excel格式）
```bash
curl -X POST "http://localhost:8000/export/" \
  -H "Content-Type: application/json" \
  -d '{
    "export_format": "excel"
  }' --output report.xlsx
```

### 9. 查看异常记录
```bash
curl -X GET "http://localhost:8000/exceptions/?resolved=false" -H "accept: application/json"
```

## 坏数据路径测试示例

### 1. 预约不存在的仪器
```bash
curl -X POST "http://localhost:8000/reservations/" \
  -H "Content-Type: application/json" \
  -d '{
    "instrument_id": 999,
    "group_id": 1,
    "user_name": "测试",
    "start_time": "2024-12-20T09:00:00",
    "end_time": "2024-12-20T13:00:00"
  }'
```
预期返回：400 Bad Request - "Instrument not found"

### 2. 预约时段冲突
```bash
curl -X POST "http://localhost:8000/reservations/" \
  -H "Content-Type: application/json" \
  -d '{
    "instrument_id": 1,
    "group_id": 2,
    "user_name": "李四",
    "start_time": "2024-12-20T10:00:00",
    "end_time": "2024-12-20T14:00:00"
  }'
```
预期返回：400 Bad Request - "Time slot conflict"

### 3. 取消已完成的预约
```bash
curl -X POST "http://localhost:8000/cancellations/" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 1,
    "cancelled_by": "张三",
    "reason": "不想做了"
  }'
```
预期返回：400 Bad Request - "Reservation cannot be cancelled"

## 数据库结构

- **research_groups**: 课题组表
- **instruments**: 仪器表
- **reservations**: 预约记录表
- **sample_risks**: 样本风险评估表
- **cancellation_records**: 取消记录表
- **usage_reports**: 使用报告表
- **exception_logs**: 异常日志表

## 项目结构
```
.
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库配置
│   ├── models.py        # 数据模型
│   ├── schemas.py       # Pydantic 模式
│   ├── crud.py          # CRUD 操作
│   └── main.py          # API 主入口
├── init_data.py         # 样例数据初始化
├── requirements.txt     # 依赖列表
└── README.md
```
