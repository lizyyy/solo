# 配置分发一致性台

一个偏技术方向的全栈Web/API应用，用于解决多个服务拉取配置时间不一致、说不清哪台机器用旧值的问题。

## 功能特性

### 控制台功能
- **总览**: 统计概览、拉取状态分布、生效状态分布、补偿状态分布、最近发布版本
- **配置管理**: 创建、编辑、发布配置项，旧值检测，强制刷新
- **服务实例**: 管理服务实例，查看实例状态和心跳
- **分发版本**: 查看版本发布详情、拉取进度
- **拉取记录**: 查看所有拉取记录，失败重试
- **差异报告**: 生成配置差异报告，导出CSV
- **异常详情**: 拉取失败列表、待补偿列表，手动补偿入口

### 核心规则（后端实现）
1. **版本发布**: 草稿→已发布，自动创建分发任务
2. **实例确认**: 服务拉取后上报实际版本，更新生效状态
3. **旧值检测**: 自动检测版本不一致的实例
4. **强制刷新**: 触发所有实例重新拉取配置
5. **差异导出**: 导出配置差异和生效状态报告

### 重要保障机制
1. **脏数据处理**: 拉取失败支持重试，最多3次
2. **重复请求防护**: 基于数据库的分布式锁，30秒防重复
3. **补偿机制**: 版本未生效的实例可强制刷新补偿

## 技术栈

### 后端
- Node.js + Express + TypeScript
- Prisma ORM + SQLite
- csv-writer 导出CSV
- crypto 实现分布式锁

### 前端
- React 18 + TypeScript
- Vite
- Ant Design 5.x
- React Router
- Recharts 图表库
- Day.js 日期处理

## 项目结构

```
.
├── backend/                 # 后端项目
│   ├── src/
│   │   ├── controllers/    # 控制器层
│   │   ├── services/       # 业务服务层
│   │   ├── middleware/     # 中间件
│   │   ├── routes.ts       # 路由配置
│   │   ├── prisma.ts       # Prisma客户端
│   │   └── index.ts        # 入口文件
│   ├── prisma/
│   │   ├── schema.prisma   # 数据模型
│   │   └── seed.ts         # 种子数据
│   ├── tsconfig.json
│   └── package.json
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API服务
│   │   ├── types/         # 类型定义
│   │   ├── App.tsx        # 主应用
│   │   ├── main.tsx       # 入口文件
│   │   └── index.css      # 全局样式
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── package.json            # 根目录配置
└── README.md
```

## 数据模型

1. **ConfigItem (配置项)**: key, value, description, status, version
2. **ServiceInstance (服务实例)**: instanceId, serviceName, ipAddress, env, status, lastHeartbeat
3. **DistributionVersion (分发版本)**: configId, version, releasedBy, releaseNote, isForce
4. **PullRecord (拉取记录)**: configId, instanceId, distributionId, requestedVersion, actualVersion, pullStatus, errorMessage, retryCount
5. **EffectiveState (生效状态)**: configId, instanceId, currentVersion, effectiveStatus, compensateStatus
6. **DiffReport (差异报告)**: configId, baseVersion, targetVersion, diffContent, affectedInstances
7. **RequestLock (请求锁)**: requestKey, lockedAt, expiresAt

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
# 一键安装所有依赖
npm run install:all
```

### 初始化数据库

```bash
cd backend

# 生成Prisma客户端
npx prisma generate

# 执行数据库迁移
npx prisma migrate dev --name init

# 插入种子数据
npx prisma db seed
```

或者使用根目录命令：
```bash
npm run prisma:init
```

### 启动开发服务

```bash
# 启动后端服务 (端口: 3001)
npm run dev:backend

# 新开终端，启动前端服务 (端口: 3000)
npm run dev:frontend
```

### 访问应用
- 前端控制台: http://localhost:3000
- 后端API: http://localhost:3001/api

## API接口列表

### 总览
- `GET /api/overview/statistics` - 获取统计数据
- `GET /api/overview/activity` - 获取最近活动
- `GET /api/overview/failed` - 获取异常详情

### 配置
- `POST /api/configs` - 创建配置
- `GET /api/configs` - 获取配置列表
- `GET /api/configs/:id` - 获取配置详情
- `PUT /api/configs/:id` - 更新配置
- `DELETE /api/configs/:id` - 删除配置

### 分发
- `POST /api/distributions/publish` - 发布版本
- `GET /api/distributions/config/:configId` - 获取配置的所有版本
- `GET /api/distributions/:id` - 获取版本详情
- `POST /api/distributions/refresh/:configId` - 强制刷新

### 拉取
- `POST /api/pulls/report` - 上报拉取结果
- `GET /api/pulls` - 获取拉取记录列表
- `GET /api/pulls/failed` - 获取失败记录
- `POST /api/pulls/:id/retry` - 重试拉取
- `GET /api/pulls/old-values/:configId` - 检测旧值

### 实例
- `POST /api/instances` - 创建实例
- `GET /api/instances` - 获取实例列表
- `GET /api/instances/:id` - 获取实例详情
- `POST /api/instances/heartbeat` - 心跳上报
- `PUT /api/instances/:id/status` - 更新状态
- `DELETE /api/instances/:id` - 删除实例

### 差异报告
- `POST /api/diff-reports` - 生成差异报告
- `GET /api/diff-reports` - 获取报告列表
- `GET /api/diff-reports/:id` - 获取报告详情
- `GET /api/diff-reports/:id/export` - 导出报告CSV
- `GET /api/effective-states/:configId/export` - 导出生效状态CSV

## 操作指南

### 1. 创建配置并发布
1. 进入"配置项"页面
2. 点击"新建配置"按钮，填写配置信息
3. 在配置列表中找到刚创建的配置（状态为DRAFT）
4. 点击"发布"按钮确认发布

### 2. 处理脏数据
1. 进入"异常详情"页面
2. 在"拉取失败"标签页查看失败记录
3. 点击"重试"按钮重新拉取（最多重试3次）
4. 超过3次重试需要手动排查服务实例问题

### 3. 重复请求防护说明
- 后端自动对非GET请求加锁
- 相同请求内容+IP，30秒内只能执行一次
- 重复提交会返回409错误，提示"请求正在处理中"
- 请求处理完成或超时后自动释放锁

### 4. 手动补偿操作
1. 进入"异常详情" → "待补偿"标签页
2. 找到版本未生效的实例
3. 点击"强制刷新"按钮触发重新拉取
4. 或在"配置项"页面点击"强制刷新"按钮刷新所有实例

### 5. 旧值检测
1. 进入"配置项"页面
2. 点击配置项的"旧值检测"按钮
3. 查看存在旧值的实例列表
4. 根据情况选择手动补偿或强制刷新

### 6. 导出报告
1. 进入"差异报告"页面
2. 点击"生成报告"按钮，选择基准和目标版本
3. 在列表中点击"导出"按钮下载CSV
4. 或在"配置项"页面直接导出生效状态

## 开发说明

### 添加新配置
```typescript
// 前端调用API
const result = await configApi.create({
  key: 'feature.newFlag',
  value: 'true',
  description: '新功能开关',
});
```

### 服务上报拉取结果
```typescript
// 服务端调用示例
await pullApi.reportPullResult({
  configId: 'clxxxxxx',
  instanceId: 'service-001',
  actualVersion: 2,
  pullStatus: PullStatus.SUCCESS,
});
```

### 分布式锁原理
1. 请求进入时生成唯一key: `method:path:bodyHash:ip`
2. 尝试在RequestLock表插入记录
3. 插入成功则继续处理，失败则返回409
4. 响应发送后自动删除锁记录
5. 锁超时时间30秒，过期自动清理

## 构建部署

```bash
# 构建后端
cd backend && npm run build

# 构建前端
cd frontend && npm run build

# 或一键构建
npm run build
```

## License

MIT
