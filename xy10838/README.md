# 数据保留删除 API 系统

一个面向企业级数据保留和删除场景的全栈应用，解决各模块执行口径不一致、回执不完整的痛点。

## 核心特性

### 业务规则
- **保留期校验**：按数据域配置自动校验数据是否达到删除条件
- **分域删除**：按数据域拆分执行任务，统一处理口径
- **失败补偿**：支持任务重试、失败记录人工处理
- **回执生成**：自动生成标准化客户回执，包含完整执行摘要
- **审计报告**：全链路操作追踪，支持合规审计

### 功能模块
- 删除申请管理（创建、审批、执行、关闭）
- 数据域管理（保留期配置）
- 执行任务监控（进度、重试、失败处理）
- 客户回执管理（生成、发送、确认）
- 审计日志与报告
- 数据导出功能

## 技术栈

### 后端
- Node.js + Express
- SQLite 数据库（可扩展）
- 内置自检脚本

### 前端
- React 18
- React Router
- 纯CSS样式（无需UI框架）

## 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend && npm install && cd ..

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 2. 运行自检脚本（验证核心规则）

```bash
cd backend
npm run self-check
```

该脚本会验证：
- 数据库初始化
- 数据域与保留期配置
- 删除申请完整流程
- 任务执行与失败处理
- 回执生成
- 审计日志记录

### 3. 启动后端服务

```bash
cd backend
npm run dev
```

后端服务运行在 http://localhost:3001

### 4. 启动前端服务

```bash
cd frontend
npm start
```

前端应用运行在 http://localhost:3000

## API 接口

### 删除申请
- `POST /api/requests` - 创建删除申请
- `GET /api/requests` - 查询申请列表
- `GET /api/requests/:id` - 查询申请详情
- `PUT /api/requests/:id/status` - 更新申请状态

### 执行任务
- `POST /api/tasks/:id/execute` - 执行任务
- `POST /api/tasks/:id/retry` - 重试失败任务

### 数据域
- `GET /api/domains` - 获取数据域列表
- `POST /api/domains` - 创建数据域

### 回执与审计
- `POST /api/requests/:id/receipts` - 生成客户回执
- `GET /api/requests/:id/audit-logs` - 获取审计日志
- `GET /api/requests/:id/audit-report` - 生成审计报告

### 导出
- `GET /api/export/requests` - 导出申请列表
- `GET /api/export/tasks` - 导出任务列表
- `GET /api/export/failed-items` - 导出失败记录
- `GET /api/export/audit-logs` - 导出审计日志

## 数据模型

### 核心实体关系
```
删除请求 (Deletion Request)
    ├─ 执行任务 (Execution Task) - 按数据域拆分
    │    └─ 失败记录 (Failed Item)
    ├─ 客户回执 (Customer Receipt)
    └─ 审计日志 (Audit Log)
```

### 状态流转
```
草稿 → 待审批 → 已批准 → 执行中 → 已完成
                ↓        ↓        ↓
              拒绝      失败   部分完成
```

## 项目结构

```
.
├── backend/
│   ├── src/
│   │   ├── server.js          # 服务入口
│   │   ├── routes.js          # API路由
│   │   ├── database.js        # 数据库连接
│   │   └── services/          # 业务服务层
│   │       ├── deletionService.js
│   │       ├── retentionService.js
│   │       ├── receiptService.js
│   │       └── exportService.js
│   ├── scripts/
│   │   └── self-check.js      # 自检脚本
│   └── data/                  # SQLite数据库文件
├── frontend/
│   └── src/
│       ├── index.js           # 入口文件
│       ├── App.js             # 路由配置
│       ├── styles.css         # 全局样式
│       └── pages/             # 页面组件
│           ├── Dashboard.js
│           ├── RequestList.js
│           ├── RequestDetail.js
│           └── CreateRequest.js
└── README.md
```

## 使用说明

### 1. 创建删除申请
- 填写客户信息和删除原因
- 提交审批

### 2. 审批申请
- 审批人查看申请详情
- 批准或驳回申请

### 3. 执行删除
- 批准后系统自动按数据域生成删除任务
- 可手动触发任务执行
- 支持失败任务重试（最多3次）

### 4. 查看结果
- 在详情页查看各数据域执行结果
- 查看失败记录详情
- 生成客户回执
- 查看完整审计轨迹

### 5. 导出数据
- 支持导出申请列表、任务列表、失败记录、审计日志
- 导出格式为CSV

## 核心优势

1. **统一口径**：所有数据域使用统一的保留规则和执行流程
2. **完整回执**：标准化回执格式，包含所有数据域执行摘要
3. **故障恢复**：内置重试机制，支持断点续传
4. **合规审计**：全链路操作追踪，满足合规要求
5. **可扩展性**：模块化设计，易于新增数据域和规则

## 开发说明

### 新增数据域
```javascript
// 调用API创建
POST /api/domains
{
  "name": "新数据域",
  "description": "描述",
  "retentionDays": 365
}
```

### 自定义删除规则
在 `backend/src/services/retentionService.js` 中扩展 `applyDeletionRules` 方法。

## License

MIT
