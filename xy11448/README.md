# 充电桩巡检验收回放链路系统

## 系统概述

本系统用于充电桩巡检、告警、对账、回放链路的全流程管理，替代传统临时对账表。系统实现了：

- **桩端告警**：接收和管理充电桩的离线、异常、故障等告警
- **巡检表**：记录巡检结果，发现异常项
- **客服投诉单**：管理用户投诉记录
- **主管批注**：对关键记录添加主管意见
- **对账链路**：串联告警-工单-巡检-投诉，发现"告警恢复但工单挂着"等问题
- **坏数据处理**：数据质量检查，坏数据不进汇总但可在失败列表查看
- **回放异常**：按时间回放整个异常链路
- **审计日志**：所有HTTP读写操作留痕
- **报表导出**：月报故障时长可追溯到单条记录

## 快速开始

### 1. 安装依赖
```bash
pip3 install -r requirements.txt
pip3 install 'python-jose[cryptography]' 'passlib[bcrypt]' python-multipart openpyxl python-dateutil pydantic-settings requests
```

### 2. 初始化数据库
```bash
python3 init_db.py
```

### 3. 启动服务
```bash
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### 4. 访问API文档
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## 默认账号

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 主管 | admin | admin123 | 全部权限 |
| 复核 | reviewer | reviewer123 | 复核、对账、导出 |
| 录入 | operator | operator123 | 数据录入、修改 |
| 只读 | viewer | viewer123 | 仅查看 |

## 核心功能

### 1. 权限控制

四种角色有不同的可见字段和可操作动作：

- **只读**：只能查看基本信息，不能修改
- **录入**：可创建、修改告警/巡检/投诉数据
- **复核**：可审核数据质量、对账、导出报表
- **主管**：可添加批注、删除数据、用户管理

### 2. 数据质量检查

所有数据录入前自动校验：
- 必填字段检查
- 关联数据存在性（如充电桩ID是否存在）
- 时间逻辑校验（结束时间不能早于开始时间）

坏数据会被拦截并记录到**失败数据列表**，可查看原因、重试或标记解决。

### 3. 对账链路服务

自动关联告警、巡检、投诉、工单：
- 发现告警恢复但工单仍挂着的问题
- 计算单条故障时长和月度累计时长
- 月报数字可追溯到具体告警记录

### 4. 审计日志

所有HTTP请求自动记录：
- 操作人、操作时间、IP地址
- 请求方法、路径、请求体
- 响应数据

### 5. 异常回放

按时间范围回放充电桩的异常链路：
- 展示告警链
- 关联的巡检、投诉、工单
- 完整的故障时间线

## 目录结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # 主入口
│   ├── config.py            # 配置
│   ├── database.py          # 数据库连接
│   ├── models.py            # 数据模型
│   ├── schemas.py           # Pydantic Schema
│   ├── auth.py              # 认证与权限
│   ├── middleware.py        # 中间件（审计日志）
│   ├── services.py          # 业务服务
│   └── api/                 # API路由
│       ├── __init__.py
│       ├── auth.py
│       ├── piles.py
│       ├── alerts.py
│       ├── inspections.py
│       ├── complaints.py
│       ├── comments.py
│       ├── work_orders.py
│       ├── reconciliation.py
│       ├── playback.py
│       ├── failed_data.py
│       ├── audit.py
│       └── reports.py
├── init_db.py               # 数据库初始化脚本
├── test_flow.py             # 完整流程测试脚本
├── requirements.txt         # 依赖列表
├── charging_pile.db         # SQLite数据库（自动生成）
└── exports/                 # 导出报表目录（自动创建）
```

## 核心API

### 认证
- `POST /api/v1/auth/login` - 登录获取Token
- `GET /api/v1/auth/me` - 获取当前用户信息
- `GET /api/v1/auth/permissions` - 获取权限列表

### 桩端告警
- `POST /api/v1/alerts/` - 创建告警
- `GET /api/v1/alerts/` - 查询告警列表
- `POST /api/v1/alerts/{id}/review` - 复核数据质量

### 对账链路
- `POST /api/v1/reconciliation/create/{alert_id}` - 创建对账记录
- `GET /api/v1/reconciliation/work-order-status/{alert_id}` - 检查工单状态
- `GET /api/v1/reconciliation/link/{alert_id}` - 获取关联链路

### 回放异常
- `POST /api/v1/playback/alert-chain` - 回放告警链路

### 失败数据
- `GET /api/v1/failed-data/` - 查看失败数据列表
- `POST /api/v1/failed-data/{id}/retry` - 重试导入
- `POST /api/v1/failed-data/{id}/resolve` - 标记已解决

### 报表导出
- `GET /api/v1/reports/monthly` - 获取月报数据
- `GET /api/v1/reports/monthly/export` - 导出Excel月报
- `GET /api/v1/reports/trace/{type}/{id}` - 数据追溯

### 审计日志
- `GET /api/v1/audit/` - 查询审计日志
- `GET /api/v1/audit/summary` - 审计统计

## 使用场景示例

### 场景1：告警恢复但工单挂着

1. 复核员登录系统
2. 调用对账API：`POST /api/v1/reconciliation/create/4`
3. 系统自动检测：告警已恢复（recovered）但工单仍挂着（pending）
4. 返回对账结果，提示需要核实工单处理情况

### 场景2：坏数据处理

1. 录入员创建告警时使用不存在的充电桩ID
2. 系统自动拦截，记录到失败数据列表
3. 复核员查看失败原因："充电桩ID 999 不存在"
4. 修正数据后重试导入

### 场景3：月报数据追溯

1. 主管导出月报，发现某桩故障时长偏大
2. 点击追溯功能，查看具体是哪几条告警贡献了时长
3. 查看每条告警的来源、创建人、时间等详情

## 片区经理关注点

系统为片区经理提供技术层面的透明度：

1. **命令脚本**：所有操作都可以通过curl命令复现
2. **HTTP读写**：审计日志记录了所有HTTP请求和响应
3. **本地持久化**：所有数据保存在SQLite数据库中，可直接查询

## 技术栈

- **框架**: FastAPI 0.104.1
- **数据库**: SQLite + SQLAlchemy 2.0
- **认证**: JWT (python-jose)
- **密码**: bcrypt
- **报表**: pandas + openpyxl

## 数据库表

- `users` - 用户表
- `charging_piles` - 充电桩表
- `pile_alerts` - 桩端告警表
- `inspections` - 巡检表
- `customer_complaints` - 客服投诉单
- `supervisor_comments` - 主管批注
- `work_orders` - 工单表
- `reconciliations` - 对账记录表
- `failed_data` - 失败数据表
- `audit_logs` - 审计日志表
- `playback_records` - 回放记录表

## 本地复现步骤

1. **初始化数据库**
   ```bash
   python3 init_db.py
   ```
   创建默认用户、6个充电桩、5条告警、4个工单、3条巡检、2条投诉、3条主管批注、2条失败数据

2. **启动服务**
   ```bash
   python3 -m uvicorn app.main:app --port 8001
   ```

3. **触发坏数据**
   ```bash
   # 使用不存在的充电桩ID创建告警
   curl -X POST http://localhost:8001/api/v1/alerts/ \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"pile_id":9999,"alert_type":"offline","start_time":"2024-01-01T00:00:00"}'
   ```

4. **人工修正**
   - 登录复核员账号
   - 查看失败数据列表
   - 修正后点击重试

5. **生成报告**
   ```bash
   curl "http://localhost:8001/api/v1/reports/monthly/export?year=2026&month=5" \
     -H "Authorization: Bearer <token>" \
     -o report.xlsx
   ```
