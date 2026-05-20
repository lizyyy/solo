# 实验环境重置 API

一个用于培训实验环境管理的全栈应用，支持一键恢复学员环境同时保护提交文件不丢失。

## 功能特性

### 后端功能
- **数据模型**：实验空间、基础快照、学员改动、重置申请、保留文件、恢复日志
- **业务规则**：
  - 快照恢复：将实验环境恢复到指定基础快照
  - 改动保留：自动识别并保留学员提交文件
  - 权限确认：验证操作人权限
  - 重复重置拦截：防止同一空间短时间内重复重置
  - 日志报告：完整记录操作历史
- **API接口**：
  - 创建重置申请
  - 查询申请列表/详情
  - 状态推进（待审批→已批准→处理中→成功/失败）
  - 异常处理和拦截
  - 导出详细报告

### 前端功能
- **异常队列**：展示待处理、失败、被拦截的申请
- **状态按钮**：支持状态推进操作
- **历史轨迹**：时间线展示完整操作记录
- **导出入口**：支持导出JSON格式的详细报告
- **文件列表**：展示所有被保留的提交文件

## 技术栈

### 后端
- Python 3.8+
- FastAPI - Web API框架
- SQLAlchemy - ORM框架
- SQLite - 数据库

### 前端
- React 18+
- TypeScript
- Vite - 构建工具
- Axios - HTTP客户端

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install fastapi uvicorn sqlalchemy pydantic python-multipart

# 启动服务
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档将在 http://localhost:8000/docs 可用

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将在 http://localhost:3000 可用

## 使用说明

1. 访问前端页面 http://localhost:3000
2. 点击"初始化样例数据"按钮创建测试数据
3. 查看异常队列中的待处理申请
4. 点击"查看详情"进入申请详情页
5. 在详情页可以：
   - 查看状态说明
   - 推进状态（待审批→已批准→处理中→成功）
   - 查看历史轨迹时间线
   - 查看保留的学员文件
   - 导出详细JSON报告

## API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reset-requests | 获取所有重置申请 |
| POST | /api/reset-requests | 创建新的重置申请 |
| GET | /api/reset-requests/{id} | 获取申请详情 |
| PATCH | /api/reset-requests/{id}/status | 更新申请状态 |
| GET | /api/reset-requests/{id}/logs | 获取申请日志 |
| GET | /api/reset-requests/{id}/retained-files | 获取保留文件列表 |
| GET | /api/reset-requests/{id}/export | 导出详细报告 |
| POST | /api/reset-requests/init-sample-data | 初始化样例数据 |
| GET | /api/lab-spaces | 获取实验空间列表 |
| GET | /api/snapshots | 获取快照列表 |

## 状态流转

```
待审批 (pending)
   ↓
已批准 (approved)
   ↓
处理中 (processing)
  ↙   ↘
成功 (success)  失败 (failed)

另外还支持：
- 已拦截 (blocked)
- 已取消 (cancelled)
```

## 样例数据说明

系统内置的样例数据覆盖了以下场景：
1. **正常流程**：张三的Python实验环境 - 已成功重置，提交文件被保留
2. **拦截流程**：李四的Python实验环境 - 因频繁重置被系统拦截
3. **待审批流程**：王五的Java实验环境 - 新建申请等待助教审批
