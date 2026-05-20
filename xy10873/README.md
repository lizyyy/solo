# 作业判分回调台

一个偏技术方向的全栈 Web/API 应用，用于解决在线判分结果异步返回时，老师无法看到哪些提交卡在回调阶段的问题。

## 功能特性

### 核心规则覆盖
- ✅ **异步判分流程**：提交 → 判分中 → 已判分 → 回调处理 → 成功
- ✅ **回调验签机制**：HMAC-SHA256 签名验证，防止伪造回调
- ✅ **成绩写入管理**：跟踪成绩是否成功写入系统
- ✅ **失败补发机制**：支持手动重试回调操作
- ✅ **异常统计监控**：记录和追踪所有异常情况

### API 接口
- **创建**：作业提交、判分任务、回调载荷
- **查询**：提交列表、详情、统计、异常列表
- **状态推进**：更新提交状态、完成判分、写入成绩
- **异常处理**：验证签名、记录异常、解决异常
- **导出**：支持按状态/课程导出数据

### 前端功能
- 📊 **总览仪表盘**：实时统计各状态数量
- 🔍 **提交列表**：支持按状态筛选，快速定位问题
- 📋 **详情页面**：完整展示提交的所有关联数据
  - 基本信息
  - 判分任务记录
  - 回调载荷详情（含原始数据）
  - 异常日志
  - 操作历史时间线
- 🔧 **复核操作**：
  - 手动更新状态
  - 重新验证签名
  - 手动写入成绩
  - 重试回调流程

## 技术架构

### 后端
- **框架**：FastAPI (Python)
- **数据库**：SQLite + SQLAlchemy ORM
- **认证**：HMAC-SHA256 签名验证
- **导出**：pandas + openpyxl

### 前端
- **原生**：HTML5 + JavaScript (无框架依赖)
- **样式**：纯 CSS (简洁实用)
- **交互**：fetch API + DOM 操作

## 项目结构

```
xy10873/
├── backend/
│   ├── __init__.py
│   ├── database.py      # 数据库连接配置
│   ├── models.py        # 数据模型定义
│   ├── schemas.py       # Pydantic 数据验证
│   ├── services.py      # 核心业务逻辑
│   └── main.py          # FastAPI 应用入口
├── frontend/
│   └── index.html       # 前端单页应用
├── requirements.txt     # Python 依赖
├── test_suite.py        # 测试套件
└── README.md
```

## 数据模型

### Submission (作业提交)
- submission_id: 唯一标识
- student_id: 学生ID
- assignment_id: 作业ID
- course_id: 课程ID
- status: 状态 (pending/grading/graded/callback_pending/callback_failed/success/manual_review)
- final_score: 最终分数

### GradingTask (判分任务)
- task_id: 任务ID
- submission_id: 关联提交
- grader_type: 判分类型
- started_at/completed_at: 时间戳
- raw_score: 原始分数
- grading_details: 判分详情

### CallbackPayload (回调载荷)
- payload_id: 载荷ID
- submission_id: 关联提交
- raw_payload: 原始载荷JSON
- signature: HMAC签名
- is_signature_valid: 签名是否有效
- score: 解析出的分数
- grade_written: 成绩是否已写入

### ExceptionLog (异常日志)
- exception_id: 异常ID
- submission_id: 关联提交
- exception_type: 异常类型
- error_message: 错误信息
- stack_trace: 堆栈追踪
- occurred_at: 发生时间
- resolved: 是否已解决

### RetryRecord (重试记录)
- retry_id: 重试ID
- submission_id: 关联提交
- retry_count: 重试次数
- retry_type: 重试类型
- previous_status/new_status: 状态变化
- triggered_by: 触发人
- triggered_at: 触发时间

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
uvicorn backend.main:app --reload
```

服务将在 http://localhost:8000 启动

### 3. 访问前端

直接在浏览器中打开 `frontend/index.html` 文件

或者使用任意 HTTP 服务器：
```bash
cd frontend && python -m http.server 8080
```

然后访问 http://localhost:8080

### 4. API 文档

启动后端后，访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 运行测试

确保后端服务已启动，然后运行：

```bash
python test_suite.py
```

测试套件将验证以下核心功能：
1. API 健康检查
2. 创建/查询作业提交
3. 创建/完成判分任务
4. 创建回调载荷（有效/无效签名）
5. 手动验证签名
6. 写入成绩
7. 更新提交状态
8. 重试回调操作
9. 获取统计数据
10. 获取提交详情（含关联数据）
11. 获取异常列表
12. 按状态筛选

## 使用说明

### 典型工作流程

1. **学生提交作业** → 状态: pending
2. **创建判分任务** → 状态: grading
3. **完成判分** → 状态: graded
4. **接收回调** → 状态: callback_pending (签名有效) 或 callback_failed (签名无效)
5. **写入成绩** → 状态: success

### 异常处理场景

1. **签名验证失败** → 自动标记 callback_failed，记录异常
2. **成绩写入失败** → 支持手动重试写入
3. **回调超时** → 支持人工复核，标记 manual_review

### 复核操作

在详情页面可执行：
- **更新状态**：手动调整提交状态
- **验证签名**：重新验证回调签名
- **写入成绩**：手动触发成绩写入
- **重试回调**：重新执行回调处理流程

## API 端点示例

### 创建提交
```bash
curl -X POST "http://localhost:8000/api/submissions/" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "test-001",
    "student_id": "STU001",
    "assignment_id": "ASSN001",
    "course_id": "COURSE001"
  }'
```

### 获取统计
```bash
curl "http://localhost:8000/api/statistics/"
```

### 导出数据
```bash
curl -X POST "http://localhost:8000/api/export/" \
  -H "Content-Type: application/json" \
  -d '{"status": "callback_failed"}'
```

## 签名验证说明

系统使用 HMAC-SHA256 进行回调签名验证：

```python
import hmac
import hashlib

secret = "grading_callback_secret_2024"
payload = '{"submission_id": "...", "score": 85}'

signature = hmac.new(
    secret.encode('utf-8'),
    payload.encode('utf-8'),
    hashlib.sha256
).hexdigest()
```

## 状态流转

```
pending → grading → graded → callback_pending → success
                                 ↓
                          callback_failed → manual_review
                                 ↓
                              (可重试)
```

## 扩展建议

1. **添加定时任务**：自动重试失败的回调
2. **Webhook 集成**：支持实时通知回调状态
3. **权限管理**：区分教师/管理员操作权限
4. **日志审计**：完整的操作日志记录
5. **批量操作**：支持批量复核和导出
