# 实时协作文档锁系统

这是一个面向数据工程师的技术向全栈练习项目，实现了实时协作文档的编辑锁、冲突处理、离线合并异常等功能。

## ✨ 功能特性

- **文档会话管理**：创建、查看文档会话
- **编辑锁机制**：乐观锁控制，防止并发编辑冲突
- **冲突检测与解决**：版本冲突检测，支持多种合并策略
- **离线合并异常处理**：脏数据拦截，长时间离线冲突规则
- **版本回放功能**：支持回滚到历史版本
- **协作日志**：完整记录所有操作，支持搜索和过滤
- **前端交互**：重试按钮、错误详情展示、搜索框

## 🚀 本地启动

### 1. 启动后端服务

```bash
cd backend

# 创建虚拟环境（可选但推荐）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
python app.py
```

后端服务将运行在 `http://localhost:5000`

### 2. 启动前端服务

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

前端服务将运行在 `http://localhost:3000`

## 📦 初始化数据

启动服务后，在前端首页点击 **📦 初始化示例数据** 按钮，系统将创建：

1. **项目需求文档** - 正常协作的文档
2. **技术架构设计** - 单用户编辑文档
3. **脏数据测试文档** - 包含预建冲突，展示脏数据离线合并被拦截的场景

## 🔌 常用接口

### 文档会话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 获取所有会话 |
| POST | `/api/sessions` | 创建新会话 |
| GET | `/api/sessions/{id}` | 获取单个会话详情 |

### 编辑锁

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions/{id}/lock` | 获取编辑锁 |
| DELETE | `/api/sessions/{id}/lock` | 释放编辑锁 |
| GET | `/api/sessions/{id}/lock-status` | 获取锁状态 |

### 内容更新

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions/{id}/update` | 更新文档内容（需要锁 + 版本校验） |

### 离线合并

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions/{id}/offline-merge` | 提交离线合并 |

请求参数：
```json
{
  "user_id": "user_abc",
  "offline_content": "离线编辑的内容",
  "offline_duration": 1800,
  "is_dirty": false
}
```

### 冲突处理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions/{id}/resolve-conflict` | 解决冲突 |
| POST | `/api/sessions/{id}/version-replay` | 版本回放 |

### 协作日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/collaboration-logs` | 获取全部日志 |
| GET | `/api/collaboration-logs?session_id={id}` | 获取指定会话日志 |

### 数据初始化

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/init-sample-data` | 初始化示例数据 |

## 🚫 会被规则挡住的操作

### 1. 无锁更新

如果你没有持有编辑锁就尝试更新文档，会被规则拦截：
```json
{
  "error": "Lock required"
}
```

### 2. 版本冲突

如果你的本地版本与服务器版本不一致，会触发冲突检测：
```json
{
  "error": "Version conflict",
  "conflict": {
    "id": "abc123",
    "type": "version_conflict",
    "client_version": 1,
    "server_version": 2
  }
}
```

### 3. 脏数据离线合并（重点展示）

当提交的离线内容被标记为脏数据时，会被规则拦截，保留原始输入供对比：
```json
{
  "merged": false,
  "reason": "dirty_data",
  "message": "检测到脏数据，合并被拦截。请使用版本回放功能解决冲突。",
  "original_input": "这是包含非法字符\x00的脏数据内容",
  "current_server_content": "当前服务器的正常内容"
}
```

### 4. 长时间离线冲突

离线时长超过 3600 秒（1小时），会触发长时间离线冲突规则：
```json
{
  "merged": false,
  "reason": "long_offline",
  "message": "离线时间过长，需要手动合并"
}
```

## 🧪 测试场景建议

### 场景一：正常协作流程
1. 创建新文档
2. 获取编辑锁
3. 修改并保存内容
4. 释放编辑锁
5. 查看协作日志

### 场景二：锁竞争测试
1. 打开两个浏览器窗口（代表两个用户）
2. 用户A获取编辑锁
3. 用户B尝试获取锁，观察被拦截效果
4. 查看错误详情和协作日志

### 场景三：脏数据拦截（重点）
1. 进入"脏数据测试文档"
2. 在离线合并区域勾选"标记为脏数据"
3. 填写离线内容并提交
4. 观察合并被拦截的效果
5. 查看原始输入与服务器内容的差异
6. 使用版本回放或手动合并功能解决

### 场景四：版本冲突
1. 获取编辑锁
2. 在不刷新页面的情况下，用另一个客户端（或直接调用API）更新同一文档
3. 尝试保存更新，观察版本冲突检测

## 🏗️ 技术栈

### 后端
- Python 3.8+
- Flask 3.0 - Web 框架
- Flask-CORS - 跨域支持

### 前端
- React 18
- React Router 6 - 路由
- Axios - HTTP 客户端

## 📁 项目结构

```
.
├── backend/
│   ├── app.py              # 主应用入口
│   └── requirements.txt    # Python依赖
├── frontend/
│   ├── src/
│   │   ├── App.js         # 主组件
│   │   ├── App.css        # 样式
│   │   ├── index.js       # 入口文件
│   │   └── pages/         # 页面组件
│   │       ├── Home.js
│   │       ├── SessionDetail.js
│   │       └── CollaborationLogs.js
│   ├── public/
│   └── package.json
└── README.md
```

## 🎯 学习要点

1. **乐观锁机制**：理解版本号如何控制并发
2. **冲突检测策略**：何时触发冲突、如何处理
3. **脏数据识别**：业务规则层的数据校验
4. **日志追踪**：如何通过日志回溯问题
5. **用户体验**：错误提示、重试按钮、详情展示

这个项目可以帮助数据工程师理解协作系统的核心技术点，为构建数据协作平台打下基础。
