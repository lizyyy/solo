# OAuth 授权撤回中心

一个专门用于管理和追踪 OAuth 授权撤回的全栈 Web 应用，解决客户取消第三方授权后旧 token 仍可能被后台任务继续使用的问题。

## 核心特性

### 业务规则覆盖

1. **授权状态机** - 完整的授权生命周期管理
   - `active` -> `pending_revocation` -> `revoked`
   - 支持 `revoked` -> `compensated` 补偿流程

2. **Token 失效传播**
   - 撤回授权时自动失效所有关联 token
   - 包括 access token 和 refresh token

3. **后台任务拦截**
   - 任务执行前验证授权状态
   - 已撤回授权的任务自动被拦截

4. **重复撤回幂等**
   - 同一授权多次撤回请求幂等处理
   - 返回已存在的撤回事件

5. **影响导出**
   - 导出撤回记录 Excel
   - 导出单个授权的影响分析报告

### 数据模型

- **ClientApplication** - 第三方应用
- **UserConsent** - 用户授权同意
- **AccessToken** - 访问令牌
- **RefreshToken** - 刷新令牌
- **RevocationEvent** - 撤回事件
- **BackgroundTask** - 后台任务
- **RequestLog** - 请求审计日志

## 项目结构

```
.
├── backend/                 # 后端 FastAPI 应用
│   ├── main.py             # API 入口
│   ├── database.py         # 数据库模型
│   ├── services.py         # 业务逻辑
│   ├── requirements.txt    # Python 依赖
│   └── oauth_revocation.db # SQLite 数据库
└── frontend/               # 前端 Vue3 应用
    ├── src/
    │   ├── main.js         # 入口文件
    │   ├── router/         # 路由配置
    │   └── views/          # 页面组件
    ├── package.json        # Node 依赖
    └── vite.config.js      # Vite 配置
```

## 快速开始

### 后端启动

```bash
cd backend
pip install -r requirements.txt
python main.py
```

后端服务运行在: http://localhost:8000

API 文档: http://localhost:8000/docs

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端控制台运行在: http://localhost:3000

## 测试场景指南

### 1. 正常授权撤回流程

**目的**: 验证完整的授权撤回流程

**操作步骤**:
1. 进入"授权管理"页面（可通过应用详情进入）
2. 选择一个状态为 `active` 的授权
3. 复制授权 ID
4. 进入"撤回记录"页面
5. 点击"发起撤回"，填写授权 ID、用户 ID 和撤回原因
6. 点击"执行传播"，触发 token 失效

**预期结果**:
- 撤回事件状态从 `initiated` -> `propagating` -> `completed`
- 授权状态变为 `revoked`
- 关联的 token 状态变为 `revoked`
- 关联的 pending 任务状态变为 `intercepted`

### 2. 重复撤回幂等性测试

**目的**: 验证同一授权多次撤回不会产生脏数据

**操作步骤**:
1. 对已完成撤回的授权再次发起撤回请求
2. 使用相同参数多次调用撤回 API

**预期结果**:
- API 返回成功，提示幂等处理
- 不创建新的撤回事件
- 数据库状态保持一致，无重复记录

### 3. 后台任务拦截测试

**目的**: 验证授权撤回后，关联任务无法执行

**操作步骤**:
1. 找到一个关联了待执行任务的授权
2. 发起并完成该授权的撤回
3. 进入"任务管理"页面
4. 尝试执行该任务

**预期结果**:
- 任务被拦截，状态变为 `intercepted`
- 返回提示"任务已被拦截，因关联授权已撤回"
- 任务不会被实际执行

### 4. 补偿动作测试

**目的**: 验证错误撤回后的补偿机制

**操作步骤**:
1. 撤回一个授权（正常流程）
2. 调用补偿 API 恢复该授权
3. 验证授权和 token 状态

**API 调用示例**:
```bash
curl -X POST http://localhost:8000/api/compensations \
  -H "Content-Type: application/json" \
  -d '{"consent_id": "your-consent-id", "reason": "误撤回补偿"}'
```

**预期结果**:
- 授权状态变为 `compensated`
- 未过期的 token 恢复为 `valid`
- 操作记录保存到审计日志

### 5. 脏数据边界测试

**目的**: 验证系统对异常状态的处理

**测试场景**:
- 对 `revoked` 状态的授权再次发起撤回
- 对 `expired` 状态的授权发起撤回
- 对不存在的授权 ID 发起撤回

**预期结果**:
- 返回明确的错误提示
- 数据库状态不被破坏
- 所有请求都记录到审计日志

## API 概览

### 授权管理
- `GET /api/consents` - 查询授权列表
- `GET /api/consents/{id}` - 获取授权详情

### 撤回管理
- `POST /api/revocations` - 发起撤回
- `POST /api/revocations/{id}/propagate` - 执行撤回传播
- `GET /api/revocations` - 查询撤回记录

### 任务管理
- `GET /api/tasks` - 查询任务列表
- `POST /api/tasks/{id}/execute` - 执行任务

### 补偿机制
- `POST /api/compensations` - 执行补偿

### 数据导出
- `GET /api/export/revocations` - 导出撤回记录
- `GET /api/export/impact/{consent_id}` - 导出影响分析

### 审计日志
- `GET /api/audit-logs` - 查询审计日志

### 仪表盘
- `GET /api/dashboard/stats` - 获取统计数据

## 关键设计决策

### 1. 状态机 vs 直接修改
选择使用明确的状态机而非直接修改状态，原因：
- 状态转移可追踪
- 便于实现幂等性
- 支持中间状态（传播中）

### 2. 任务拦截时机
选择任务执行前拦截，而非撤回时直接取消，原因：
- 避免并发问题
- 保留任务记录便于审计
- 支持补偿后任务恢复执行

### 3. 请求审计设计
每个 API 请求都记录完整的输入输出，原因：
- 便于问题排查
- 合规审计需求
- 支持操作追溯

## 技术栈

**后端**:
- FastAPI - 现代、高性能的 Python Web 框架
- SQLAlchemy - ORM 工具
- SQLite - 轻量数据库
- OpenPyXL - Excel 导出

**前端**:
- Vue 3 - 渐进式 JavaScript 框架
- Vite - 下一代前端构建工具
- Element Plus - Vue 3 组件库
- Axios - HTTP 客户端
