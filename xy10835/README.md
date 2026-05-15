# 审计日志导出 API

一个面向合规审计场景的全栈Web应用，支持按人员和时间导出操作日志，核心规则在后端实现，确保筛选条件不会丢失。

## 技术架构

### 后端
- **框架**: Node.js + Express
- **数据库**: SQLite
- **核心功能**: 
  - 筛选条件快照存储
  - 异步导出处理
  - 权限校验
  - 下载过期控制
  - 操作取证留痕

### 前端
- **技术**: 原生 HTML/JavaScript (无框架依赖)
- **功能页面**:
  - 日志查询筛选
  - 导出任务列表
  - 任务详情时间线
  - 报告下载
  - 测试场景验证

## 核心特性

### 1. 筛选条件快照
- 创建导出任务时，将所有筛选条件序列化存储到数据库
- 后端在导出时使用存储的筛选条件，不依赖前端状态
- 任务详情页可查看完整的筛选条件历史

### 2. 异步导出处理
- 创建任务后立即返回，后台异步处理导出
- 任务状态: pending → processing → completed/failed
- 支持任务失败后的重试和修正

### 3. 权限校验
- 仅任务创建者或管理员可下载导出文件
- 支持授权其他用户下载
- 下载权限带过期时间

### 4. 过期下载控制
- 导出文件默认 24 小时后过期
- 过期后无法下载，需重新创建导出任务

### 5. 取证留痕
- 记录所有关键操作: 创建任务、状态变更、下载、授权等
- 包含操作人、时间、详细信息
- 提供完整的审计追踪

## 数据模型

```
users
  ├── id (PK)
  ├── username
  ├── name
  ├── role
  ├── department
  └── created_at

operation_events
  ├── id (PK)
  ├── event_type
  ├── module
  ├── operator_id (FK)
  ├── operator_name
  ├── ip_address
  ├── details
  ├── status
  └── created_at

export_tasks
  ├── id (PK)
  ├── task_name
  ├── creator_id (FK)
  ├── creator_name
  ├── filter_snapshot (JSON)
  ├── status
  ├── total_count
  ├── exported_count
  ├── file_path
  ├── file_name
  ├── file_size
  ├── expire_at
  ├── error_message
  ├── created_at
  └── updated_at

task_status_history
  ├── id (PK)
  ├── task_id (FK)
  ├── from_status
  ├── to_status
  ├── operator_id
  ├── operator_name
  ├── reason
  └── created_at

download_permissions
  ├── id (PK)
  ├── task_id (FK)
  ├── user_id (FK)
  ├── granted_by
  ├── granted_at
  └── expires_at

evidence_records
  ├── id (PK)
  ├── task_id (FK)
  ├── action_type
  ├── operator_id
  ├── operator_name
  ├── details (JSON)
  └── created_at
```

## API 接口

### 导出任务
- `POST /api/tasks` - 创建导出任务
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/:id` - 获取任务详情（含状态历史和取证记录）
- `POST /api/tasks/:id/retry` - 重试失败任务
- `POST /api/tasks/:id/correct` - 修正筛选条件并重试
- `GET /api/tasks/:id/download` - 下载导出文件
- `POST /api/tasks/:id/permission` - 授予下载权限

### 其他接口
- `GET /api/events` - 查询操作日志
- `GET /api/users` - 获取用户列表
- `GET /health` - 健康检查

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 初始化数据（造数）

运行造数脚本，会创建 5 个测试用户和 200 条操作日志：

```bash
npm run seed
```

造数内容：
- 用户: 张三、李四、王五（合规部）、赵六（审计部）、系统管理员
- 操作日志: 包含登录、登出、创建、更新、删除、查看、导出、审批等类型
- 模块: 用户管理、角色管理、权限配置、日志查询、报表导出、系统设置、数据备份、审批流程

### 3. 启动后端服务

```bash
npm start
```

服务将在 `http://localhost:3001` 启动。

### 4. 打开前端页面

直接在浏览器中打开 `frontend/index.html` 文件即可。

或者使用任意静态文件服务器：

```bash
# 方式一: 使用 Python
cd frontend && python -m http.server 8080

# 方式二: 使用 Node.js (需安装 http-server)
npx http-server frontend -p 8080
```

然后访问 `http://localhost:8080`。

## 测试场景验证

系统内置 4 个测试场景，可在前端"测试场景"页面点击验证：

### 1. 成功导出场景
- 选择有效的操作人员和时间范围
- 系统创建导出任务
- 异步处理完成后状态变为 completed
- 可下载 CSV 格式的报告

### 2. 失败导出场景
- 选择未来的时间范围（无数据）
- 任务最终状态变为 failed
- 显示错误信息: "筛选条件下没有匹配的数据"

### 3. 重复提交场景
- 快速提交两个相同筛选条件的任务
- 第二个任务会被系统拦截
- 返回错误: "存在相同筛选条件的待处理任务，请等待完成后重试"

### 4. 人工修正场景
- 先创建一个会失败的任务（无数据）
- 系统自动修正筛选条件（扩大时间范围/增加操作人员）
- 任务重新处理，最终成功完成

## 调用接口示例

### 创建导出任务

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "task_name": "月度审计导出",
    "filter_snapshot": {
      "operator_ids": ["user-id-1", "user-id-2"],
      "start_time": "2024-01-01T00:00:00.000Z",
      "end_time": "2024-01-31T23:59:59.000Z",
      "event_types": ["login", "logout", "export"],
      "modules": ["用户管理", "日志查询"],
      "statuses": ["success"]
    }
  }'
```

### 获取任务列表

```bash
curl http://localhost:3001/api/tasks
```

### 获取任务详情

```bash
curl http://localhost:3001/api/tasks/{taskId}
```

### 下载导出文件

```bash
curl -O -J http://localhost:3001/api/tasks/{taskId}/download
```

## 项目目录结构

```
audit-log-export-api/
├── backend/
│   ├── src/
│   │   ├── server.js              # 服务入口
│   │   ├── database/
│   │   │   ├── schema.js          # 数据库初始化
│   │   │   └── dao.js             # 数据访问对象
│   │   ├── services/
│   │   │   └── exportService.js   # 导出业务逻辑
│   │   ├── controllers/
│   │   │   └── exportController.js # 接口控制器
│   │   ├── routes/
│   │   │   └── exportRoutes.js    # 路由定义
│   │   └── scripts/
│   │       ├── seedData.js        # 造数脚本
│   │       └── testScenarios.js   # 测试脚本
│   ├── data/                      # SQLite 数据库文件
│   ├── exports/                   # 导出文件存储
│   └── package.json
├── frontend/
│   └── index.html                 # 单页应用
└── README.md
```

## 核心规则实现位置

所有核心规则都在后端 `backend/src/services/exportService.js` 中实现：

| 规则 | 位置 | 函数 |
|------|------|------|
| 筛选条件快照 | 第44-50行 | `createTask` |
| 异步导出 | 第78-158行 | `processExport` |
| 重复提交检查 | 第39-42行 | `createTask` |
| 权限校验 | 第270-307行 | `downloadTask` |
| 过期下载 | 第280-282行 | `downloadTask` |
| 取证留痕 | 各处调用 | `EvidenceRecordDAO.create` |

## 注意事项

1. **筛选条件不会丢失**: 所有筛选条件在创建任务时就被序列化存储到数据库，导出时使用存储的条件，不会因为前端状态变化而丢失。

2. **后端校验优先**: 所有关键校验都在后端实现，前端校验仅作为用户体验优化。

3. **异步处理**: 导出任务是异步处理的，创建任务后请刷新列表查看最新状态。

4. **文件过期**: 导出文件默认 24 小时后过期，过期后需重新导出。

5. **取证记录**: 所有关键操作都会留下取证记录，可在任务详情页查看。

## 问题排查

### 任务一直处于 pending 状态
- 检查后端服务是否正常运行
- 查看后端控制台日志是否有错误信息

### 下载失败
- 检查任务状态是否为 completed
- 检查文件是否已过期（24小时后过期）
- 检查导出目录是否存在

### 造数失败
- 确保 `backend/data` 目录存在且可写
- 检查 SQLite 驱动是否正确安装

## 许可证

MIT
