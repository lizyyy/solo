# 数据库迁移预演 API

一个偏技术方向的全栈 Web/API 应用，用于在生产环境上线前预演数据库迁移脚本，提供风险评估数据。

## 项目结构

```
.
├── server/                 # 后端服务
│   ├── src/
│   │   ├── database/    # 数据库配置
│   │   ├── middleware/  # 中间件
│   │   ├── routes/      # 路由
│   │   ├── services/    # 业务逻辑
│   │   └── utils/       # 工具函数
│   └── scripts/        # 初始化脚本
│   └── package.json
├── client/              # 前端应用
│   ├── src/
│   │   ├── components/ # 组件
│   │   ├── pages/       # 页面
│   │   └── services/    # API 服务
│   └── package.json
└── package.json
```

## 核心功能

### 数据模型

1. **迁移脚本 (Migration Scripts)**
   - 脚本名称、描述、内容、作者、版本
   - 关联目标数据库
   - 支持回滚脚本

2. **目标库 (Target Databases)**
   - 数据库连接配置
   - 支持多环境（生产、预发布、开发、测试）

3. **预演批次 (Preview Batches)**
   - 批次状态流转：待执行 → 执行中 → 待确认 → 已确认/需回滚 → 已补偿
   - 影响行数、影响表数量、慢查询数量
   - 错误信息、操作人、备注

4. **影响表 (Affected Tables)**
   - 表名、操作类型、影响行数
   - 关联预演批次

5. **慢语句 (Slow Queries)**
   - SQL 语句、执行时间、扫描行数
   - 关联预演批次

6. **回滚脚本 (Rollback Scripts)**
   - 回滚验证结果、验证人

7. **补偿操作 (Compensation Actions)**
   - 补偿类型、操作内容、执行状态
   - 执行结果、执行人

### 业务规则

1. **预演执行** - 模拟执行迁移脚本，收集影响数据
2. **影响统计** - 统计影响的表和行数
3. **慢语句记录** - 捕获执行时间超过阈值的查询
4. **人工确认** - 预演完成后需人工确认是否继续
5. **回滚校验** - 验证回滚脚本的有效性

## 快速开始

### 环境要求

- Node.js >= 16
- npm >= 8

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd server && npm install

# 安装前端依赖
cd ../client && npm install
```

### 初始化数据库

```bash
cd server
node scripts/init-db.js
```

### 启动服务

```bash
# 方式一：分别启动
# 终端1 - 后端
cd server && npm run dev

# 终端2 - 前端
cd client && npm run dev

# 方式二：根目录同时启动（需要安装 concurrently）
npm run dev
```

- 后端服务: http://localhost:3001
- 前端应用: http://localhost:3000

## API 接口

### 幂等性说明

所有 POST/PUT/PATCH 请求都需要在请求头中携带 `x-idempotency-key`，用于防止重复调用。

前端已自动处理，每次操作前会生成唯一的幂等性键。

### 迁移脚本接口

```
GET    /api/migration/scripts          # 获取脚本列表
GET    /api/migration/scripts/:id      # 获取脚本详情
POST   /api/migration/scripts          # 创建脚本
```

### 目标数据库接口

```
GET    /api/migration/databases        # 获取数据库列表
GET    /api/migration/databases/:id    # 获取数据库详情
POST   /api/migration/databases        # 创建数据库配置
```

### 预演批次接口

```
GET    /api/migration/batches          # 获取批次列表（支持筛选）
GET    /api/migration/batches/:id      # 获取批次详情
GET    /api/migration/batches/:id/details  # 获取批次完整详情（含影响表、慢查询等）
GET    /api/migration/batches/:id/export # 导出批次数据
POST   /api/migration/batches          # 创建批次
PATCH  /api/migration/batches/:id/status # 更新批次状态
POST   /api/migration/batches/:id/execute # 执行预演
```

### 回滚校验接口

```
POST   /api/migration/batches/:id/rollback-validation  # 创建回滚校验
```

### 补偿操作接口

```
POST   /api/migration/batches/:id/compensation-actions  # 创建补偿操作
POST   /api/migration/compensation-actions/:id/execute  # 执行补偿操作
```

### 统计接口

```
GET    /api/migration/statistics       # 获取统计数据
```

## 关键测试路径

### 1. 防止脏数据

**操作步骤：**

1. 创建目标数据库
2. 创建迁移脚本
3. 创建预演批次
4. 执行预演
5. 查看批次详情，确认影响表和慢查询数据已正确记录
6. 更新批次状态（确认通过/需要回滚）

**预期结果：**
- 所有关联数据正确关联批次ID
- 状态流转符合预期
- 无孤立数据

### 2. 重复请求处理

**操作步骤：**

1. 打开浏览器开发者工具（Network 面板）
2. 创建一个新的预演批次
3. 观察请求头中的 `x-idempotency-key`
4. 使用相同的幂等性键重复发送相同请求（可以使用 curl 或 Postman）
5. 查看返回结果

**预期结果：**
- 重复请求返回与第一次相同的结果
- 数据库中只创建一条记录
- 不会产生重复数据

**测试命令：**

```bash
# 第一次请求
curl -X POST http://localhost:3001/api/migration/batches \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: test-key-001" \
  -d '{"migration_script_id": "your-script-id", "target_database_id": "your-db-id", "operator": "test"}'

# 重复请求（使用相同的 key）
curl -X POST http://localhost:3001/api/migration/batches \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: test-key-001" \
  -d '{"migration_script_id": "your-script-id", "target_database_id": "your-db-id", "operator": "test"}'
```

### 3. 补偿操作流程

**操作步骤：**

1. 创建预演批次并执行
2. 更新批次状态为 "需要回滚" 或让批次执行失败
3. 进入批次详情页的"补偿操作"标签页
4. 点击"创建补偿"按钮
5. 填写补偿类型和内容（如手动修复、数据恢复等）
6. 保存后，点击补偿操作卡片上的"执行"按钮
7. 观察批次状态变化

**预期结果：**
- 补偿操作成功创建
- 执行补偿后批次状态变为"已补偿"
- 补偿记录中包含执行人和执行时间
- 可以查看补偿历史

## 状态流转图

```
pending (待执行)
    ↓
running (执行中)
    ↓
┌─────────────────────────────────────┐
│  completed (执行完成)              │
│         ↓                          │
│  waiting_confirmation (待确认)     │
│         ↓                          │
│  ┌─────────────┬──────────────┐ │
│  │ confirmed   │ rollback_required │
│  │ (已确认)    │ (需要回滚)    │ │
│  └─────────────┴──────────────┘ │
└─────────────────────────────────────┘
         ↓                      ↓
    [完成]              compensated (已补偿)
```

## 前端页面说明

### 总览页面 (Dashboard)
- 批次状态分布统计
- 影响行数、慢查询总数
- 各状态批次数量统计

### 预演批次页面 (Batches)
- 批次列表（支持按状态、脚本、数据库筛选）
- 创建批次按钮
- 执行预演按钮
- 查看详情、导出数据

### 批次详情页面 (Batch Detail)
- 概览：基本信息、执行统计、错误信息（如果有）
- 影响表：本次预演影响的所有表和行数
- 慢查询：执行时间超过阈值的查询
- 回滚校验：回滚脚本的验证记录
- 补偿操作：创建和执行补偿操作

### 迁移脚本页面 (Scripts)
- 脚本列表展示
- 创建新的迁移脚本（含回滚脚本）

### 目标数据库页面 (Databases)
- 数据库配置列表
- 添加新的数据库连接配置

## 技术栈

### 后端
- **框架**: Express.js
- **数据库**: SQLite（可扩展为 MySQL/PostgreSQL）
- **日志**: Winston
- **验证**: Joi
- **幂等性**: 自定义中间件 + 数据库存储

### 前端
- **框架**: React 18
- **构建工具**: Vite
- **路由**: React Router
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **HTTP**: Axios

## 注意事项

1. **幂等性键过期时间**: 24小时，过期后会自动清理
2. **数据库路径**: server/data/database.db
3. **日志路径**: server/logs/
4. **生产环境部署前请更换为正式数据库（MySQL/PostgreSQL）
5. **建议添加用户认证和权限控制
6. **实际使用时需要实现真实的数据库连接和执行逻辑

## 扩展建议

1. 接入真实的数据库连接池
2. 实现实际的 SQL 执行和分析引擎
3. 添加用户认证和 RBAC 权限控制
4. 增加 WebSocket 实时推送执行状态
5. 添加邮件/短信通知
6. 集成 CI/CD 流水线
7. 添加更多的监控和告警
8. 支持数据库性能分析报告
