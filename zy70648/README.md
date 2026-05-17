# 培训签到补签冲突合并结业资格系统

基于 FastAPI + SQLite 的培训机构签到管理系统，解决签到机导出数据与老师补签数据冲突问题，自动计算学员结业资格。

## 核心功能

- **签到记录管理**：支持签到机数据导入、查询
- **补签管理**：支持老师补签、审核、撤回
- **冲突检测**：自动检测签到与补签数据冲突
- **冲突解决**：支持人工审核、选择最终结果
- **数据合并**：合并多源数据生成最终出勤状态
- **结业资格**：根据出勤率自动计算结业资格（≥80%为合格）
- **数据导出**：支持导出统计报告
- **异常追踪**：记录异常操作和处理日志

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问：http://localhost:8000/docs

### 3. 初始化测试数据

```bash
python seed_data.py
```

测试数据包含：
- 5名学员（S001-S005）
- 5个课程场次（CLASS001-CLASS005）
- 14条签到记录
- 4条补签记录
- 自动生成3条冲突记录

## API 接口说明

### 学生管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/students/ | 创建学生 |
| GET | /api/students/ | 查询学生列表 |

### 课程场次

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/sessions/ | 创建课程场次 |
| GET | /api/sessions/ | 查询场次列表 |

### 签到记录

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/attendance/ | 创建设签到记录 |
| GET | /api/attendance/ | 查询签到记录 |

### 补签管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/makeup/ | 创建补签记录 |
| GET | /api/makeup/ | 查询补签记录 |
| PUT | /api/makeup/{id}/withdraw | 撤回补签 |

### 冲突处理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/conflicts/ | 查询所有冲突 |
| GET | /api/conflicts/pending | 查询待处理冲突 |
| PUT | /api/conflicts/{id}/resolve | 解决冲突 |
| PUT | /api/conflicts/{id}/close | 关闭冲突 |

### 数据合并

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/merge/ | 合并签到与补签数据 |

### 统计与结业

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/stats/ | 查询出勤统计 |
| POST | /api/graduation-report/ | 生成结业报告 |
| GET | /api/graduation-report/ | 查询结业报告 |
| POST | /api/export/ | 导出数据 |

### 异常日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/exception-logs/ | 查询异常日志 |

## Curl 示例 - 主流程

### 1. 创建学生

```bash
curl -X POST "http://localhost:8000/api/students/" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"S100","name":"测试学员","email":"test@example.com","phone":"13800000000"}'
```

### 2. 创建课程场次

```bash
curl -X POST "http://localhost:8000/api/sessions/" \
  -H "Content-Type: application/json" \
  -d '{"session_code":"TEST001","course_name":"测试课程","session_date":"2024-01-15T09:00:00","total_hours":4.0,"required_attendance_rate":0.8}'
```

### 3. 创建签到记录（缺勤）

```bash
curl -X POST "http://localhost:8000/api/attendance/" \
  -H "Content-Type: application/json" \
  -d '{"session_code":"TEST001","student_id":"S100","sign_in_time":"2024-01-15T09:00:00","sign_out_time":"2024-01-15T13:00:00","status":"absent","source":"machine"}'
```

### 4. 创建补签记录

```bash
curl -X POST "http://localhost:8000/api/makeup/" \
  -H "Content-Type: application/json" \
  -d '{"session_code":"TEST001","student_id":"S100","teacher_id":"T001","teacher_name":"王老师","reason":"学员当天身体不适请假","sign_date":"2024-01-15T10:00:00","status":"pending"}'
```

### 5. 查看待处理冲突

```bash
curl -X GET "http://localhost:8000/api/conflicts/pending"
```

### 6. 解决冲突（选择补签）

```bash
# 先获取冲突ID，然后执行
curl -X PUT "http://localhost:8000/api/conflicts/1/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolved_by":"管理员","resolution":"情况属实，同意补签","choose_makeup":true}'
```

### 7. 查看出勤统计

```bash
curl -X GET "http://localhost:8000/api/stats/"
```

### 8. 生成结业报告

```bash
curl -X POST "http://localhost:8000/api/graduation-report/" \
  -H "Content-Type: application/json" \
  -d '{"generated_by":"教务管理员"}'
```

### 9. 导出数据

```bash
curl -X POST "http://localhost:8000/api/export/" \
  -H "Content-Type: application/json" \
  -d '{"export_format":"json"}'
```

## Curl 示例 - 冲突场景演示

### 场景1：缺勤 vs 补签（最常见）

```bash
# 1. 签到机显示缺勤
curl -X POST "http://localhost:8000/api/attendance/" \
  -H "Content-Type: application/json" \
  -d '{"session_code":"CLASS001","student_id":"S001","sign_in_time":"2024-01-15T09:00:00","status":"absent","source":"machine"}'

# 2. 老师补签
curl -X POST "http://localhost:8000/api/makeup/" \
  -H "Content-Type: application/json" \
  -d '{"session_code":"CLASS001","student_id":"S001","teacher_id":"T001","teacher_name":"王老师","reason":"学员生病请假","sign_date":"2024-01-15T09:00:00","status":"pending"}'

# 3. 系统自动生成冲突记录
curl -X GET "http://localhost:8000/api/conflicts/pending"
```

### 场景2：已签到 vs 重复补签

```bash
# 1. 已正常签到
curl -X POST "http://localhost:8000/api/attendance/" \
  -H "Content-Type: application/json" \
  -d '{"session_code":"CLASS002","student_id":"S002","sign_in_time":"2024-01-16T09:00:00","status":"present","source":"machine"}'

# 2. 老师误操作补签
curl -X POST "http://localhost:8000/api/makeup/" \
  -H "Content-Type: application/json" \
  -d '{"session_code":"CLASS002","student_id":"S002","teacher_id":"T001","teacher_name":"王老师","reason":"学员迟到补签","sign_date":"2024-01-16T09:30:00","status":"pending"}'

# 3. 解决冲突（选择原始签到）
curl -X PUT "http://localhost:8000/api/conflicts/2/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolved_by":"管理员","resolution":"学员已正常签到，驳回补签","choose_makeup":false}'
```

### 场景3：撤回补签

```bash
# 撤回补签后，关联的待处理冲突会自动关闭
curl -X PUT "http://localhost:8000/api/makeup/1/withdraw"
```

## 核心规则说明

### 1. 冲突检测规则

| 签到状态 | 补签状态 | 冲突类型 | 说明 |
|---------|---------|---------|------|
| absent | pending/approved | absent_vs_makeup | 签到机显示缺勤但老师已补签 |
| present | pending/approved | present_vs_makeup | 已签到但重复补签 |
| late | pending/approved | late_vs_makeup | 迟到但老师补签 |

### 2. 冲突解决规则

- 选择补签：补签状态变为 approved，签到记录状态改为 makeup
- 选择签到：补签状态变为 rejected，签到记录保持原样
- 冲突记录保留原始数据，便于追溯

### 3. 数据合并规则

1. 优先使用已 approved 的补签记录
2. 其次使用签到机原始记录
3. pending 状态补签不影响最终出勤
4. 冲突待处理时会在合并结果中标注

### 4. 结业资格规则

- 出勤率 = (签到次数 + 有效补签次数) / 总课程次数
- 出勤率 ≥ 80%：符合结业资格
- 出勤率 < 80%：不符合结业资格

## 测试

### 运行 pytest

```bash
pytest test_attendance.py -v
```

### 测试用例覆盖

- ✅ 学生创建
- ✅ 课程场次创建
- ✅ 签到记录创建
- ✅ 补签记录创建
- ✅ 冲突自动检测
- ✅ 冲突解决流程
- ✅ 数据合并
- ✅ 出勤统计
- ✅ 结业报告生成
- ✅ 补签撤回
- ✅ 数据导出
- ✅ 待处理冲突查询
- ✅ 异常日志记录

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 验证模型
├── services.py          # 业务逻辑服务
├── database.py          # 数据库连接配置
├── seed_data.py         # 测试数据脚本
├── test_attendance.py   # pytest 测试用例
├── requirements.txt     # 依赖清单
└── README.md           # 项目说明文档
```

## 数据模型

### 核心表结构

1. **students** - 学生信息表
2. **course_sessions** - 课程场次表
3. **attendance_records** - 签到记录表
4. **makeup_signs** - 补签记录表
5. **conflict_records** - 冲突记录表（含原始数据快照）
6. **graduation_reports** - 结业报告表
7. **exception_logs** - 异常操作日志表

## 异常处理

所有 API 操作异常都会被记录到 exception_logs 表，包含：
- 操作类型
- 原始输入数据
- 处理人
- 处理结论
- 错误信息
- 发生时间

## 访问 Swagger UI

启动服务后，访问 http://localhost:8000/docs 可以：
- 查看所有 API 详细文档
- 在线测试接口
- 查看请求/响应示例
