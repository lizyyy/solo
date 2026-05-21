# 文档脱敏任务 API 系统

一个基于 FastAPI + 原生 JavaScript 的全栈文档脱敏任务管理系统。

## 功能特性

### 后端 (FastAPI)
- ✅ 完整的任务状态机（创建 → 扫描 → 复核 → 版本生成 → 授权 → 导出）
- ✅ 敏感信息脱敏规则引擎（姓名、身份证号、手机号、邮箱、住址）
- ✅ 状态历史追踪（每一步变更都有记录）
- ✅ 异常队列处理（失败任务可重试）
- ✅ RESTful API 设计
- ✅ SQLite 数据库存储

### 前端 (原生 JS)
- ✅ 仪表盘统计概览
- ✅ 待复核任务队列
- ✅ 异常任务队列
- ✅ 文档详情页（敏感命中、状态轨迹、复核记录、版本管理）
- ✅ 脱敏规则展示
- ✅ 响应式设计

## 快速启动

### 方式一：使用启动脚本（推荐）
```bash
chmod +x start.sh
./start.sh
```

### 方式二：手动启动
```bash
# 后端
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 前端（新开终端）
# 直接用浏览器打开 frontend/index.html 即可
```

## 访问地址

- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs
- **前端页面**: 直接打开 `frontend/index.html`

## 使用流程

1. **创建文档** → 点击右上角"新建文档"
2. **开始扫描** → 进入文档详情，点击"开始扫描"
3. **人工复核** → 在"待复核"队列中处理
   - 可选择"通过"或"驳回"
   - 驳回后进入异常队列
4. **版本生成** → 复核通过后自动生成版本
5. **下载授权** → 对版本进行授权
6. **导出下载** → 授权后可下载导出

## API 接口列表

### 文档管理
- `POST /api/documents/` - 创建文档
- `GET /api/documents/` - 获取所有文档
- `GET /api/documents/{id}` - 获取文档详情
- `POST /api/documents/{id}/scan` - 开始扫描
- `POST /api/documents/{id}/retry` - 重试扫描
- `PATCH /api/documents/{id}/status` - 更新状态

### 队列管理
- `GET /api/queue/pending-review` - 待复核队列
- `GET /api/queue/exception` - 异常队列

### 复核管理
- `POST /api/documents/{id}/reviews` - 创建复核记录
- `GET /api/documents/{id}/reviews` - 获取复核记录

### 版本管理
- `POST /api/documents/{id}/versions` - 创建版本
- `GET /api/documents/{id}/versions` - 获取版本列表
- `POST /api/versions/{id}/authorize` - 授权下载
- `POST /api/versions/{id}/download` - 下载导出

### 其他
- `GET /api/documents/{id}/hits` - 敏感命中列表
- `GET /api/documents/{id}/history` - 状态历史
- `GET /api/rules/` - 脱敏规则列表
- `POST /api/rules/` - 创建脱敏规则

## 数据模型

- **Document**: 文档文件
- **MaskingRule**: 脱敏规则
- **SensitiveHit**: 敏感命中记录
- **Review**: 复核意见
- **ExportVersion**: 导出版本
- **DownloadRecord**: 下载记录
- **StatusHistory**: 状态变更历史

## 技术栈

- **后端**: Python 3.8+, FastAPI, SQLAlchemy, Uvicorn
- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **数据库**: SQLite
