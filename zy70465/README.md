# 工单附件扫描服务

## 项目概述

本服务用于处理工单附件的自动化扫描、版本冲突检测、人工审核备注、清理回滚等功能。采用SQLite持久化存储，支持本地重启后数据保留。

## 启动方式

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化演示数据（可选）

```bash
python init_demo_data.py
```

### 3. 启动服务

```bash
python main.py
```

或使用uvicorn直接启动：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- 服务根路径: http://localhost:8000

## 样例来源

### 演示数据说明

初始化脚本创建3个过期数据擦除申请工单：

1. **DEL-2024-001** - 脏数据场景
   - 存在旧版本覆盖新版本的情况（版本3工单，上传了版本1的附件）
   - 包含人工审核备注
   - 状态：需人工审核 (review_required)

2. **DEL-2024-002** - 成功路径样例
   - 正常通过扫描
   - 无版本冲突
   - 状态：已通过 (approved)

3. **DEL-2024-003** - 失败路径样例
   - 无附件被驳回
   - 状态：已拒绝 (rejected)

## 主流程

### 工单附件扫描主流程

```
1. 创建工单
   ↓
2. 上传附件（支持多版本）
   ↓
3. 触发扫描
   ├─ 内容扫描（检测高风险关键词）
   └─ 版本校验（检测版本冲突）
   ↓
4. 生成扫描报告和结论
   ↓
5. 状态流转
   ├─ 全部通过 → APPROVED
   ├─ 发现异常 → REVIEW_REQUIRED
   └─ 严重错误（如无附件） → REJECTED
```

### 状态流转图

```
PENDING → SCANNING → APPROVED
                    → REVIEW_REQUIRED → (人工修正)
                    → REJECTED
                    
ROLLBACK_PENDING → ROLLED_BACK

APPROVED/REJECTED/ROLLED_BACK → CLEANED
```

## 失败路径

### 典型失败场景

1. **无附件被驳回**
   - 触发条件：工单创建后未上传任何附件即触发扫描
   - 处理结果：状态变为 REJECTED
   - 样例工单：DEL-2024-003

2. **版本冲突需审核**
   - 触发条件：附件版本低于工单当前版本（旧文件覆盖新文件）
   - 处理结果：标记 has_version_conflict=True，状态变为 REVIEW_REQUIRED
   - 样例工单：DEL-2024-001

3. **内容含高风险关键词**
   - 触发条件：附件内容包含"永久删除"、"不可逆"、"全部数据"等
   - 处理结果：扫描状态为 SUSPICIOUS，需人工复核

## 核心功能

### 1. 统一查询入口

所有工单（成功/失败/待审核）均可通过同一入口查询：

```bash
# 查询所有工单
GET /api/tickets/

# 查询单个工单详情（含附件、扫描记录、状态日志、人工备注）
GET /api/tickets/{ticket_no}
```

### 2. 人工修正保留备注

系统结论不会被直接覆盖，人工修改会留下完整记录：

```bash
POST /api/tickets/manual-note
{
    "ticket_no": "DEL-2024-001",
    "revised_conclusion": "经人工核实，版本冲突为操作失误",
    "operator": "审核员_周八",
    "remark": "已与上传人确认，无需重新上传"
}
```

### 3. 清理/回滚候选清单

执行操作前先生成候选清单，避免误伤真实数据：

```bash
# 生成可回滚工单清单
GET /api/tickets/candidates/rollback

# 生成可清理工单清单（支持指定保留天数）
GET /api/tickets/candidates/cleanup?retention_days=90
```

### 4. 状态日志追溯研发值班记录

每次状态变更都会记录完整的值班信息，复盘时可追溯：

```json
{
    "from_status": "scanning",
    "to_status": "review_required",
    "operator": "王五",
    "reason": "附件扫描完成",
    "duty_record": "扫描完成，共处理3个附件，最终状态: review_required",
    "created_at": "2024-05-10T08:00:00Z"
}
```

## API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tickets/ | 创建工单 |
| GET | /api/tickets/ | 查询所有工单 |
| GET | /api/tickets/{ticket_no} | 查询工单详情 |
| POST | /api/tickets/{ticket_no}/scan | 触发工单扫描 |
| POST | /api/tickets/{ticket_no}/attachments | 上传附件 |
| POST | /api/tickets/manual-note | 添加人工备注 |
| GET | /api/tickets/candidates/rollback | 获取回滚候选清单 |
| GET | /api/tickets/candidates/cleanup | 获取清理候选清单 |
| POST | /api/tickets/{ticket_id}/rollback | 执行回滚 |
| POST | /api/tickets/cleanup | 批量清理 |

## 数据持久化

- 数据库：SQLite (`ticket_scan.db`)
- 所有工单、附件、扫描记录、状态日志、人工备注均持久化存储
- 本地服务重启后数据完整保留

## 项目结构

```
.
├── main.py                 # 应用入口
├── requirements.txt        # 依赖配置
├── init_demo_data.py       # 演示数据初始化
├── ticket_scan.db          # SQLite数据库文件
├── README.md              # 项目文档
└── app/
    ├── __init__.py
    ├── database.py        # 数据库配置
    ├── models/            # 数据模型
    │   ├── __init__.py
    │   └── ticket.py
    ├── schemas/           # Pydantic模式
    │   ├── __init__.py
    │   └── ticket.py
    ├── services/          # 业务逻辑
    │   ├── __init__.py
    │   ├── ticket_service.py
    │   ├── scan_service.py
    │   └── candidate_service.py
    └── api/               # API接口
        ├── __init__.py
        └── tickets.py
```
