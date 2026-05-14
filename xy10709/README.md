# 文件上传扫描流水线

一个完整的文件上传安全扫描系统，包含后端 API 和前端管理界面。

## 技术栈

- **后端**: FastAPI + SQLAlchemy + SQLite
- **前端**: React 18 + TypeScript + Vite
- **样式**: Tailwind CSS
- **状态管理**: React Query

## 功能特性

- 📤 文件上传与安全扫描
- 🔍 文件指纹提取（MD5、SHA256）
- 🛡️ 恶意内容检测（关键词、脚本标签）
- 📋 可执行文件类型拦截
- 🔒 隔离与人工放行机制
- ⏪ 回滚功能
- 📝 安全日志记录
- 🏢 组织管理（支持批量导入）
- 📊 数据统计仪表盘

## 快速开始

### 环境要求

- Python 3.8+
- Node.js 16+
- npm 或 yarn

### 1. 安装依赖

#### 后端

```bash
cd backend
pip install -r requirements.txt
```

#### 前端

```bash
cd frontend
npm install
```

### 2. 初始化数据

```bash
cd backend
python init_data.py
```

这会创建：
- 4 个示例组织
- 3 条扫描规则
- 4 个示例上传任务（包含安全文件、警告文件、严重威胁文件）
- 1 个已人工放行的任务（用于展示状态差异）

### 3. 启动服务

#### 启动后端服务

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端 API 文档: http://localhost:8000/docs

#### 启动前端服务

```bash
cd frontend
npm run dev
```

前端访问地址: http://localhost:3000

## API 接口说明

### 文件上传

```bash
POST /api/upload
Content-Type: multipart/form-data

参数:
- file: 上传的文件
- organization_id: 组织ID（可选）
- uploaded_by: 上传人（可选）
```

### 扫描任务

```bash
POST /api/upload/{task_id}/scan
```

### 放行隔离文件

```bash
POST /api/upload/{task_id}/release
Content-Type: application/x-www-form-urlencoded

参数:
- released_by: 操作人
- reason: 放行原因
```

### 回滚隔离

```bash
POST /api/upload/{task_id}/rollback
Content-Type: application/x-www-form-urlencoded

参数:
- rolled_back_by: 操作人
- reason: 回滚原因
```

### 获取任务列表

```bash
GET /api/upload?status={status}&organization_id={org_id}
```

### 获取任务详情

```bash
GET /api/upload/{task_id}
```

### 安全日志

```bash
GET /api/security-logs?severity={level}
POST /api/security-logs/{log_id}/resolve
```

### 组织管理

```bash
GET /api/organizations
POST /api/organizations
POST /api/organizations/batch-import  # 批量导入
```

### 扫描规则

```bash
GET /api/scan-rules
POST /api/scan-rules
```

### 统计数据

```bash
GET /api/stats
```

## 会被规则拦截的操作

### 1. 内容关键词匹配

文件内容包含以下关键词会被拦截：
- `virus` - 病毒
- `trojan` - 木马
- `malware` - 恶意软件
- `ransomware` - 勒索软件
- `exploit` - 漏洞利用

### 2. XSS 攻击检测

文件内容包含 `<script>` 标签会被拦截，用于防范 XSS 攻击。

### 3. 可执行文件类型

上传以下类型的文件会被拦截：
- `.exe` - Windows 可执行文件
- `.bat` - 批处理文件
- `.cmd` - 命令脚本

## 状态说明

### 任务状态

- **pending**: 待处理 - 文件已上传但未扫描
- **scanned**: 已扫描 - 文件安全
- **quarantined**: 已隔离 - 检测到威胁，等待人工审核
- **released**: 已放行 - 人工审核通过后放行
- **rolled_back**: 已回滚 - 从放行状态回滚到隔离

### 威胁等级

- **safe**: 安全 - 未检测到威胁
- **warning**: 警告 - 检测到少量威胁特征
- **critical**: 严重 - 检测到多个威胁特征

## 示例数据说明

初始化数据中包含以下任务用于展示系统功能：

1. **safe_document.txt** - 安全文件
   - 状态: scanned / allowed
   - 威胁等级: safe

2. **suspicious_file.txt** - 含警告关键词（已人工放行）
   - 状态: released
   - 威胁等级: warning
   - 展示人工放行后的状态差异

3. **malicious_file.txt** - 含多个恶意关键词
   - 状态: quarantined / isolated
   - 威胁等级: critical

4. **program.exe** - 可执行文件
   - 状态: quarantined / isolated
   - 威胁等级: warning

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI 主应用
│   │   ├── models.py        # SQLAlchemy 模型
│   │   ├── schemas.py       # Pydantic 数据模型
│   │   ├── crud.py          # 业务逻辑
│   │   └── database.py      # 数据库配置
│   ├── init_data.py         # 数据初始化脚本
│   └── requirements.txt     # Python 依赖
├── frontend/
│   ├── src/
│   │   ├── components/      # React 组件
│   │   ├── pages/           # 页面组件
│   │   ├── api.ts           # API 调用封装
│   │   ├── types.ts         # TypeScript 类型
│   │   ├── App.tsx          # 主应用
│   │   └── main.tsx         # 入口文件
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── uploads/                  # 文件上传目录
└── README.md
```

## 开发说明

### 后端开发

- 数据库: SQLite（file_scanner.db）
- 自动生成 API 文档: Swagger UI
- 支持跨域请求

### 前端开发

- 组件式架构
- React Query 管理服务器状态
- 响应式设计
- Tailwind CSS 样式

## 扩展建议

1. 集成真实的杀毒引擎（ClamAV 等）
2. 添加文件沙箱分析功能
3. 实现规则引擎的正则表达式支持
4. 添加用户认证与权限管理
5. 支持大文件分片上传
6. 添加邮件告警功能
7. 支持威胁情报订阅
8. 添加文件类型深度检测（基于魔数）
