# 代码片段运行配额台

Code Runner Quota Management Platform

一个面向教学场景的代码运行配额管理系统，支持多语言代码执行、配额控制、状态追踪、批量导入和报告导出。

## 功能特性

### 核心功能
- 🚀 **真实代码执行**: 基于 subprocess 的安全代码执行，支持多语言
- ⚡ **配额控制**: 每学生每小时配额限制，防止资源滥用
- 🔄 **重复提交合并**: 5分钟内相同代码自动合并，节省资源
- ⏱️ **超时终止**: 自动终止超时运行的代码（默认30秒）
- 📊 **状态追踪**: 完整的请求状态时间线
- 🔧 **人工修正**: 管理员可手动修正请求状态
- 📦 **执行环境隔离**: 独立进程执行，带内存和CPU限制

### 数据管理
- 📋 **请求列表**: 支持按学生、状态、语言筛选
- 📥 **批量导入**: 支持JSON格式批量导入请求
- 📊 **统计报告**: 每日统计、成功率、执行时间分析
- 📤 **导出功能**: 支持CSV和Excel格式导出报告

## 技术栈

### 后端
- **框架**: FastAPI (Python)
- **数据库**: SQLite + SQLAlchemy ORM
- **API规范**: RESTful API
- **代码执行**: 基于 subprocess 的安全执行引擎，支持超时控制
- **报告生成**: openpyxl (Excel导出)

### 前端
- **框架**: 原生 JavaScript + HTML5
- **样式**: Bootstrap 5
- **功能**: 响应式设计、状态可视化、时间线展示

## 项目结构

```
.
├── backend/                 # 后端代码
│   ├── app/
│   │   ├── api/           # API路由
│   │   ├── models/        # 数据模型
│   │   ├── schemas/       # Pydantic Schema
│   │   ├── services/      # 业务逻辑服务
│   │   └── core/          # 核心配置
│   ├── main.py            # 主入口
│   ├── requirements.txt   # Python依赖
│   ├── init_data.py       # 初始化数据脚本
│   └── test_api.py        # API测试脚本
├── frontend/              # 前端代码
│   ├── index.html         # 主页面
│   └── app.js             # 前端逻辑
├── run_backend.sh         # 启动后端脚本
├── run_frontend.sh        # 启动前端脚本
└── README.md
```

## 快速开始

### 1. 环境要求
- Python 3.8+
- pip 包管理器

### 2. 启动后端服务

方式一：使用启动脚本
```bash
chmod +x run_backend.sh
./run_backend.sh
```

方式二：手动启动
```bash
# 安装依赖
cd backend
pip install -r requirements.txt

# 初始化数据库和模拟数据
python init_data.py

# 启动服务
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

后端服务启动后，访问以下地址：
- API 文档: http://localhost:8000/docs (Swagger UI)
- ReDoc 文档: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/api/health

### 3. 启动前端服务

方式一：使用启动脚本
```bash
chmod +x run_frontend.sh
./run_frontend.sh
```

方式二：手动启动
```bash
cd frontend
python3 -m http.server 3000
```

前端访问地址: http://localhost:3000

## 核心数据模型

### Student (学生)
- `student_id`: 学生学号（唯一标识）
- `name`: 学生姓名
- `email`: 邮箱
- `quota_per_window`: 每窗口配额（默认10次/小时）
- `is_active`: 是否激活

### LanguageEnvironment (语言环境)
- `name`: 语言名称 (Python, JavaScript, Java, C++, Go等)
- `version`: 版本号
- `container_image`: 容器镜像
- `timeout_seconds`: 超时时间
- `memory_limit_mb`: 内存限制

### RunRequest (运行请求)
- `request_id`: 请求唯一ID
- `student_id`: 关联学生
- `language_id`: 关联语言
- `code_snippet`: 代码内容
- `status`: 运行状态
- `execution_time_ms`: 执行时间
- `stdout/stderr`: 标准输出/错误
- `exit_code`: 退出码
- `created_by_manual`: 是否人工创建/修改

### RequestStatus (请求状态)
- `pending`: 待处理
- `queued`: 排队中
- `running`: 运行中
- `success`: 成功
- `failed`: 失败
- `timeout`: 超时
- `cancelled`: 已取消
- `merged`: 已合并

## API 接口说明

### 学生管理
```
POST   /api/v1/students/          # 创建学生
GET    /api/v1/students/          # 获取学生列表
GET    /api/v1/students/{id}/quota # 检查学生配额
```

### 语言环境
```
POST   /api/v1/languages/         # 创建语言环境
GET    /api/v1/languages/         # 获取语言列表
```

### 运行请求
```
POST   /api/v1/requests/                 # 创建运行请求
GET    /api/v1/requests/                 # 获取请求列表（支持筛选）
GET    /api/v1/requests/{request_id}     # 获取请求详情
PATCH  /api/v1/requests/{request_id}     # 更新请求状态
POST   /api/v1/requests/{request_id}/cancel  # 取消请求
GET    /api/v1/requests/{request_id}/timeline # 获取状态时间线
```

### 批量导入
```
POST   /api/v1/requests/batch-import     # 批量导入请求
```

### 报告导出
```
GET    /api/v1/report/stats              # 获取统计数据
GET    /api/v1/report/export/csv         # 导出CSV报告
GET    /api/v1/report/export/excel       # 导出Excel报告
```

## 使用示例

### 示例1：创建代码运行请求
```bash
curl -X POST "http://localhost:8000/api/v1/requests/" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 1,
    "language_id": 1,
    "code_snippet": "print(\"Hello, World!\")"
  }'
```

### 示例2：查询请求列表（筛选）
```bash
curl "http://localhost:8000/api/v1/requests/?student_id=S001&status=success&page=1&page_size=20"
```

### 示例3：批量导入请求
```bash
curl -X POST "http://localhost:8000/api/v1/requests/batch-import" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"student_id": "S001", "language": "Python", "code_snippet": "print(1)"},
      {"student_id": "S002", "language": "Python", "code_snippet": "print(2)"}
    ]
  }'
```

### 示例4：人工修正状态
```bash
curl -X PATCH "http://localhost:8000/api/v1/requests/req-20240101-0001?manual=true" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "stdout": "人工修正的输出",
    "exit_code": 0
  }'
```

## 运行测试

启动后端服务后，运行API测试脚本：
```bash
cd backend
python test_api.py
```

测试脚本覆盖以下场景：
- ✅ 创建学生和语言环境
- ✅ 创建代码运行请求（真实代码执行）
- ✅ 测试成功执行场景（输出 stdout）
- ✅ 测试失败执行场景（语法错误，输出 stderr）
- ✅ 测试超时终止场景（无限循环被强制终止）
- ✅ 测试重复提交合并功能
- ✅ 查询请求列表和详情
- ✅ 获取状态时间线
- ✅ 人工修正状态
- ✅ 批量导入请求
- ✅ 报告统计查询
- ✅ 配额检查

## 业务规则说明

### 配额控制规则
1. **时间窗口**: 每小时为一个配额窗口
2. **默认配额**: 每学生每小时10次运行
3. **配额扣减**: 请求创建时立即扣减配额
4. **配额返还**: 取消请求时返还配额
5. **超额限制**: 配额用尽后拒绝新请求

### 重复提交合并规则
1. **检测范围**: 5分钟内的历史请求
2. **匹配条件**: 相同学生 + 相同语言 + 相同代码内容
3. **合并操作**: 原请求标记为merged状态
4. **配额处理**: 不额外扣减配额

### 状态流转规则
```
pending → queued → running → success
                                → failed
                                → timeout
                                → cancelled
```

## 前端功能说明

### 1. 运行请求页面
- **筛选功能**: 按学生、状态、语言筛选
- **列表展示**: 请求ID、学生、语言、状态、时间、执行时间
- **详情查看**: 弹窗展示完整信息，包括代码、输出、时间线
- **人工修正**: 管理员可手动修改请求状态

### 2. 批量导入页面
- **JSON输入**: 支持粘贴JSON格式的批量数据
- **结果反馈**: 实时显示每条记录的导入结果
- **错误提示**: 清晰显示导入失败的原因

### 3. 统计报告页面
- **统计卡片**: 总请求数、成功率、平均执行时间、统计周期
- **每日统计**: 折线图展示每日请求趋势
- **活跃排名**: TOP5活跃学生排行
- **导出功能**: 一键导出CSV或Excel报告

## 常见问题

### Q: 如何修改默认配额？
A: 编辑 `backend/app/core/config.py` 中的 `DEFAULT_QUOTA_PER_WINDOW` 参数。

### Q: 如何调整检测重复提交的时间窗口？
A: 修改 `backend/app/services/request_service.py` 中 `find_duplicate_request` 函数的时间阈值。

### Q: 数据库文件在哪里？
A: SQLite数据库文件位于 `backend/code_runner.db`。

### Q: 如何重置所有数据？
A: 删除 `backend/code_runner.db` 文件，重新运行 `init_data.py` 即可。

## 代码执行引擎说明

### 实现方式
系统使用 Python `subprocess` 模块实现安全的代码执行：
- **进程隔离**: 每个代码请求在独立子进程中执行
- **超时控制**: 使用 `subprocess.timeout` 强制终止超时进程
- **输出捕获**: 实时捕获 stdout 和 stderr
- **资源限制**: 支持内存和CPU使用限制
- **执行ID**: 每个执行环境分配唯一 `proc-` 前缀的ID

### 支持的语言
- **Python**: 使用系统 Python 解释器执行
- **JavaScript**: 使用 Node.js 执行（需安装 node）
- **Java**: 使用 javac + java 执行（需安装 JDK）
- **C++**: 使用 g++ 编译执行（需安装 g++）
- **Go**: 使用 go run 执行（需安装 Go）

### 安全说明
> ⚠️ **生产环境注意**: 当前实现使用本地系统解释器执行代码。
> 建议生产环境使用 Docker 容器或沙箱环境进一步隔离执行。

## 开发计划

- [ ] 支持 Docker 容器隔离执行代码
- [ ] 增加用户认证和权限管理
- [ ] 支持更多编程语言
- [ ] 增加 WebSocket 实时状态推送
- [ ] 支持代码语法高亮
- [ ] 增加运行日志审计功能
- [ ] 支持自定义配额规则

## 许可证

MIT License
