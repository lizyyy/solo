# 外勤维修工单台账系统 (xy4010)

一个给小团队用的全栈 Web 应用，用于管理物业维修工单的完整生命周期。

## 功能特性

- **工单管理**：创建、编辑、删除、查看工单
- **状态流转**：待派单 → 处理中 → 待验收 → 已完成 / 已逾期（带校验）
- **智能派单**：分配给不同维修师傅
- **材料管理**：记录工单使用的材料
- **多维度筛选**：按师傅、状态、日期范围筛选
- **数据统计**：工单状态分布、材料使用排行、师傅工作量统计
- **数据持久化**：SQLite 文件存储，重启数据不丢
- **工单编号**：自动生成不重复的工单编号（格式：WDYYYYMM0001）

## 技术栈

**后端**：
- Node.js + TypeScript
- Express.js
- Prisma ORM
- SQLite 数据库
- Vitest 测试框架

**前端**：
- React 18 + TypeScript
- Vite 构建工具
- React Router 6
- Tailwind CSS（CDN）

## 目录结构

```
xy4010/
├── package.json           # 根项目配置（npm workspaces）
├── tsconfig.json          # 根 TypeScript 配置
├── README.md              # 本文档
├── server/                # 后端服务
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── prisma/
│   │   └── schema.prisma  # 数据库模型
│   └── src/
│       ├── index.ts       # 服务入口
│       ├── types.ts       # 类型定义
│       ├── lib/
│       │   └── prisma.ts  # Prisma 客户端
│       ├── services/
│       │   ├── ticketService.ts      # 工单核心业务
│       │   ├── technicianService.ts  # 师傅管理
│       │   ├── statisticsService.ts  # 统计服务
│       │   └── __tests__/
│       │       └── ticketService.test.ts
│       └── routes/
│           ├── tickets.ts      # 工单 API
│           ├── technicians.ts  # 师傅 API
│           └── statistics.ts   # 统计 API
└── client/                # 前端应用
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx       # 入口
        ├── App.tsx        # 路由布局
        ├── types.ts       # 前端类型
        ├── lib/
        │   └── api.ts     # API 客户端
        └── pages/
            ├── TicketList.tsx    # 工单列表页
            ├── TicketForm.tsx    # 工单表单页
            └── Statistics.tsx    # 统计页
```

## 安装步骤

### 前置要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
# 进入项目目录
cd /Users/mac/pro/solocoder/pro/xy4010/repo/xy4010

# 安装所有依赖（根目录执行，使用 npm workspaces）
npm install
```

### 初始化数据库

```bash
# 进入 server 目录
cd server

# 生成 Prisma 客户端
npx prisma generate

# 执行数据库迁移（首次会创建 SQLite 数据库文件）
npx prisma migrate dev --name init
```

## 启动项目

### 开发模式（同时启动前后端）

```bash
# 根目录执行
npm run dev
```

这会同时启动：
- **后端**：http://localhost:3001
- **前端**：http://localhost:3000（API 代理到 3001）

### 单独启动

```bash
# 只启动后端
npm run dev:server

# 只启动前端
npm run dev:client
```

## 运行测试

```bash
# 运行后端测试
npm run test
```

## 构建生产版本

```bash
npm run build
```

## 使用指南

### 1. 首次使用

启动后访问 http://localhost:3000

**注意**：首次使用需要先添加维修师傅。可以通过 API 添加：

```bash
# 添加师傅（示例）
curl -X POST http://localhost:3001/api/technicians \
  -H "Content-Type: application/json" \
  -d '{"name":"张师傅"}'

curl -X POST http://localhost:3001/api/technicians \
  -H "Content-Type: application/json" \
  -d '{"name":"李师傅"}'
```

或者在工单列表页新建工单后，在编辑页面选择师傅。

### 2. 工单状态流转规则

```
待派单 ──→ 处理中 ──→ 待验收 ──→ 已完成
             │           │
             │           ↓
             └──→ 已逾期 ──→ 可返回处理中或直接完成
```

**校验规则**：
- 未派单（PENDING_ASSIGNMENT）不能直接完成
- 已完成（COMPLETED）不能再修改材料、派单信息
- 只能流转到允许的下一个状态

### 3. API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tickets | 工单列表（支持 query 参数：status, assignedToId, startDate, endDate） |
| POST | /api/tickets | 创建工单 |
| GET | /api/tickets/:id | 获取单个工单 |
| PUT | /api/tickets/:id | 更新工单 |
| POST | /api/tickets/:id/transition | 状态流转（body: { status: "..." }） |
| PUT | /api/tickets/:id/materials | 更新材料（body: { materials: [...] }） |
| DELETE | /api/tickets/:id | 删除工单 |
| GET | /api/technicians | 师傅列表 |
| POST | /api/technicians | 创建师傅 |
| DELETE | /api/technicians/:id | 删除师傅 |
| GET | /api/statistics | 统计数据（支持 query 参数：startDate, endDate） |
| GET | /api/health | 健康检查 |

### 4. 工单编号规则

自动生成，格式：`WDYYYYMM0001`
- `WD`：固定前缀（Work Order）
- `YYYY`：年份
- `MM`：月份
- `0001`：当月第 N 个工单，4 位补零

每月从 0001 重新开始计数。

## 关键实现点

### 后端

1. **状态流转校验** (`server/src/services/ticketService.ts`)
   - `statusTransitions` 定义了合法的状态转移图
   - `canTransition()` 函数校验是否允许跳转
   - 非法跳转抛出友好错误信息

2. **工单编号生成** (`server/src/services/ticketService.ts`)
   - `generateTicketNumber()` 按月统计，确保不重复
   - 使用数据库事务级别的 count 查询

3. **材料修改限制**
   - 已完成工单禁止修改材料
   - 材料字段非空校验

### 前端

1. **多维度筛选** (`client/src/pages/TicketList.tsx`)
   - 状态筛选
   - 师傅筛选
   - 日期范围筛选
   - 一键清除筛选

2. **表单联动** (`client/src/pages/TicketForm.tsx`)
   - 已完成工单自动禁用相关字段
   - 状态流转按钮根据当前状态动态显示

3. **数据统计** (`client/src/pages/Statistics.tsx`)
   - 从后端 API 聚合真实数据
   - 状态分布可视化
   - 材料使用排行（Top 10）
   - 师傅工作量及完成率

## 待办事项

- [ ] 前端添加维修师傅管理页面
- [ ] 添加更多自动化测试
- [ ] 用户登录与权限控制
- [ ] 工单附件上传
- [ ] 消息通知（派单、逾期提醒）
- [ ] 工单导出（Excel/PDF）
- [ ] 移动端适配优化

## 许可证

MIT
