# 导出脱敏策略 API

一个面向技术的全栈 Web 应用，用于管理不同角色的数据导出脱敏规则。

## 项目架构

```
├── backend/          # Node.js + Express 后端
│   ├── src/
│   │   ├── database/ # SQLite 数据库初始化
│   │   ├── routes/   # API 路由
│   │   ├── utils/    # 脱敏工具
│   │   └── server.js # 服务入口
│   └── tests/        # 测试脚本
└── frontend/         # React + Ant Design 前端
    ├── public/
    └── src/
```

## 核心功能

### 后端 API
- `POST /api/tasks/create` - 创建导出任务
- `GET /api/tasks/list` - 查询任务列表
- `GET /api/tasks/:id` - 任务详情
- `POST /api/tasks/:id/approve` - 审批通过
- `POST /api/tasks/:id/reject` - 审批拒绝
- `POST /api/tasks/:id/retry` - 重试失败任务
- `GET /api/tasks/:id/download` - 下载导出数据
- `GET /api/tasks/statistics/overview` - 统计概览

### 数据模型
- **export_roles** - 导出角色（管理员、运营、客服、审计）
- **field_strategies** - 字段脱敏策略
- **export_tasks** - 导出任务
- **approval_records** - 审批记录
- **download_logs** - 下载日志

### 脱敏规则
| 角色 | 手机号 | 身份证号 | 策略版本 | 需审批 |
|------|--------|----------|----------|--------|
| 管理员 | 不脱敏 | 不脱敏 | v2.0 | 否 |
| 运营人员 | 中间脱敏 | 中间脱敏 | v2.0 | 是 |
| 客服人员 | 全脱敏 | 全脱敏 | v1.0 | 是 |
| 审计人员 | 仅后4位 | 仅后4位 | v2.0 | 是 |

## 快速开始

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 2. 运行自检脚本

```bash
cd backend
npm test
```

### 3. 启动后端服务

```bash
cd backend
npm start
# 服务运行在 http://localhost:3001
```

### 4. 启动前端服务

```bash
cd frontend
npm start
# 服务运行在 http://localhost:3000
```

## 控制台功能

### 总览面板
- 任务总数统计
- 今日新增任务
- 处理中任务数
- 失败任务告警

### 任务管理
- 创建新的导出任务
- 查看任务列表和状态
- 审批/拒绝待处理任务
- 重试失败任务
- 下载已完成任务

### 详情页面
- 基本信息展示
- 脱敏策略配置
- 审批记录时间线
- 下载日志审计
- 错误信息展示（失败任务）

### 策略配置
- 各角色脱敏策略展示
- 策略版本管理
- 脱敏样例展示

## 关键特性

1. **幂等性处理** - UUID 任务ID，防重复提交
2. **状态机流转** - pending → processing → completed/failed
3. **异常重试机制** - 支持手动重试失败任务
4. **审批工作流** - 非管理员角色需审批才能导出
5. **违规拦截** - 检测未正确脱敏的数据并拦截
6. **操作审计** - 完整的审批和下载日志链
7. **策略版本化** - 支持脱敏规则版本管理

## API 示例

### 创建任务
```bash
curl -X POST http://localhost:3001/api/tasks/create \
  -H "Content-Type: application/json" \
  -d '{"role_code": "operator", "task_name": "月度导出", "created_by": "admin"}'
```

### 下载导出
```bash
curl "http://localhost:3001/api/tasks/{taskId}/download?downloaded_by=admin"
```

## 自检脚本验证

自检脚本验证以下关键规则：
- 4种角色的手机号脱敏规则正确性
- 4种角色的身份证号脱敏规则正确性
- 批量脱敏策略应用一致性
- 违规数据拦截机制
- 空值异常处理
- 策略覆盖完整性

---

**技术栈**: Node.js + Express + SQLite + React + Ant Design
