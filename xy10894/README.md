# 制度审批发布 API 系统

一个完整的制度审批、发布、废止全流程管理系统，解决旧版本引用问题。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: React + Ant Design
- **核心特性**: 状态机管理、多渠道发布、引用检查、阅读确认、废止传播

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── models/         # 数据模型
│   │   ├── services/       # 业务逻辑
│   │   ├── routes/         # API 路由
│   │   └── database/       # 数据库配置
│   ├── tests/              # 自检脚本
│   └── package.json
├── frontend/               # 前端控制台
│   ├── src/
│   └── package.json
└── package.json            # 根项目配置
```

## 数据模型

1. **制度版本 (PolicyVersion)**: 制度的多版本管理
2. **审批节点 (ApprovalNode)**: 审批流程节点定义
3. **发布渠道 (PublishChannel)**: 多渠道发布配置
4. **阅读确认 (ReadingConfirmation)**: 员工阅读回执
5. **废止记录 (AbolishRecord)**: 废止历史记录
6. **引用关系 (PolicyReference)**: 制度间引用关系

## 核心业务规则

### 1. 审批状态机

```
DRAFT → PENDING_APPROVAL → APPROVING → APPROVED → PUBLISHING → PUBLISHED
                                 ↓
                              REJECTED
                                 ↓
                              ABOLISHED
```

- 只有草稿状态可以提交审批
- 审批节点必须按顺序通过
- 全部节点通过后状态变为已通过
- 任一节点驳回则状态变为已驳回

### 2. 渠道发布规则

- 只有审批通过的制度可以发布
- 支持多渠道并行发布
- 发布失败记录错误信息，支持重试
- 全部渠道成功后状态变为已发布

### 3. 阅读回执规则

- 只有已发布的制度可以确认阅读
- 每个用户只能确认一次
- 记录确认时间和用户信息

### 4. 废止传播规则

- 废止前检查是否有其他有效文档引用该制度
- 如果有引用，禁止废止（防止旧版本被引用时误删）
- 废止后记录历史

### 5. 引用检查

- 创建制度时可指定引用的其他制度
- 废止时自动检查所有引用关系
- 防止出现悬垂引用

## API 接口

### 制度管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/policies | 查询制度列表 |
| GET | /api/policies/:id | 获取制度详情 |
| POST | /api/policies | 创建制度 |
| POST | /api/policies/:id/submit-approval | 提交审批 |
| POST | /api/policies/:id/publish | 发布制度 |
| POST | /api/policies/:id/abolish | 废止制度 |

### 审批管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/policies/approval-nodes/:nodeId/approve | 审批通过 |
| POST | /api/policies/approval-nodes/:nodeId/reject | 审批驳回 |

### 发布管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/policies/publish-channels/:channelId/retry | 重试发布 |

### 阅读确认

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/policies/:id/confirm-reading | 确认阅读 |

### 导出和统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/policies/export/csv | 导出 CSV |
| GET | /api/policies/stats/summary | 统计概览 |

## 快速开始

### 1. 安装依赖

```bash
# 安装全部依赖
npm run install:all

# 或分别安装
cd backend && npm install
cd ../frontend && npm install
```

### 2. 运行自检脚本（验证核心规则）

```bash
cd backend
npm test
```

### 3. 启动后端服务

```bash
cd backend
npm run dev
# 服务运行在 http://localhost:3001
```

### 4. 启动前端控制台

```bash
cd frontend
npm start
# 前端运行在 http://localhost:3000
```

### 5. 同时启动前后端

```bash
npm run dev
```

## 前端控制台功能

### 总览页面

- 制度统计卡片（总数、各状态数量）
- 制度列表表格
- 支持创建新制度

### 详情页面

- 制度基本信息
- 审批流程进度显示
- 发布渠道状态
- 阅读确认记录
- 引用关系展示
- 手动操作入口（审批、发布、重试、废止）

### 导出功能

- 支持导出 CSV 格式
- 可按状态、创建人筛选

## 测试场景

自检脚本覆盖以下场景：

1. ✅ 创建制度（含审批节点、发布渠道、引用关系）
2. ✅ 提交审批
3. ✅ 多节点顺序审批流程
4. ✅ 多渠道发布（含失败场景）
5. ✅ 失败渠道重试
6. ✅ 阅读确认及防重复
7. ✅ 引用检查
8. ✅ 有引用时的废止保护
9. ✅ 无引用时的废止
10. ✅ 状态流转约束

## 核心问题解决

### 旧版本经常被引用的问题

1. **版本管理**: 每个制度有多版本，引用时指定版本号
2. **引用检查**: 废止时自动检查所有引用
3. **状态可见**: 已废止的制度仍保留记录，但状态明确标记
4. **传播机制**: 引用的制度更新时，可触发引用方提醒

## 开发说明

- 后端入口: `backend/src/server.js`
- 前端入口: `frontend/src/App.js`
- 数据库文件: `backend/data/policy.db`（自动创建）
- 自检脚本: `backend/tests/self-check.js`

## 注意事项

1. 生产环境请替换 SQLite 为 MySQL/PostgreSQL
2. 添加用户认证和权限控制
3. 发布渠道需要对接实际的第三方系统 API
4. 引用检查需要配合文档管理系统使用
