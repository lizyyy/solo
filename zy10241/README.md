# 水质采样瓶流转系统

环保检测站采样瓶全生命周期管理 API，包含任务管理、状态流转、冷藏记录、时限校验等功能。

## 功能特性

- ✅ **瓶号管理**：防止重复绑定任务
- ✅ **状态机流转**：CREATED → BINDED → SAMPLED → COLD_STORED → TRANSFERRED → RECEIVED → TESTED → RETURNED
- ✅ **冷藏校验**：采样后必须冷藏才能交接
- ✅ **时限校验**：根据任务要求限制送检超时
- ✅ **退样管理**：退样后无法接收
- ✅ **轨迹查询**：每个瓶子完整流转记录
- ✅ **本地持久化**：JSON 文件存储，无需数据库

## 项目结构

```
.
├── src/
│   ├── types.ts          # 类型定义
│   ├── storage.ts        # 本地持久化存储
│   ├── services.ts       # 业务逻辑服务
│   ├── seed.ts           # 种子数据
│   ├── server.ts         # Express API 服务
│   └── test-flow.ts      # 流程测试脚本
├── data/                  # 数据存储目录 (运行时自动生成)
├── package.json
└── tsconfig.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行流程测试

```bash
npm run test
```

此命令将运行完整的业务流程测试，验证所有业务规则。

### 3. 启动 API 服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

## API 接口

### 基础操作

- `GET /api/health` - 健康检查
- `POST /api/seed` - 重置并加载种子数据

### 任务管理

- `GET /api/tasks` - 获取所有采样任务
- `GET /api/tasks/:id` - 获取单个任务详情

### 采样瓶管理

- `GET /api/bottles` - 获取所有采样瓶
- `GET /api/bottles/:bottleNo` - 获取单个瓶子详情
- `GET /api/bottles/:bottleNo/trail` - 获取瓶子完整流转轨迹

### 流转操作

- `POST /api/bottles/:bottleNo/bind` - 绑定任务
  ```json
  { "taskId": "任务ID", "handler": "处理人姓名" }
  ```

- `POST /api/bottles/:bottleNo/sample` - 采样
  ```json
  { "handler": "处理人姓名" }
  ```

- `POST /api/bottles/:bottleNo/cold-store` - 冷藏
  ```json
  { "handler": "处理人姓名", "temperature": 4 }
  ```

- `POST /api/bottles/:bottleNo/transfer` - 交接送检
  ```json
  { "handler": "处理人姓名" }
  ```

- `POST /api/bottles/:bottleNo/receive` - 实验室接收
  ```json
  { "handler": "处理人姓名" }
  ```

- `POST /api/bottles/:bottleNo/reject` - 退样
  ```json
  { "handler": "处理人姓名", "reason": "退样原因" }
  ```

- `POST /api/bottles/:bottleNo/test` - 完成检测
  ```json
  { "handler": "处理人姓名" }
  ```

- `POST /api/bottles/:bottleNo/return` - 归还采样瓶
  ```json
  { "handler": "处理人姓名" }
  ```

## 业务规则验证

测试脚本 `npm run test` 将验证以下规则：

1. **瓶号重复绑定** - 已绑定任务的瓶子不能再次绑定
2. **状态跳跃校验** - 必须按顺序流转，不能跳过中间状态
3. **采样后未冷藏** - 采样后必须冷藏才能交接和接收
4. **送检超时校验** - 采样后必须在任务时限内送检
5. **退样后再接收** - 已退样的瓶子无法被接收
6. **重复提交校验** - 同一操作不能重复执行
7. **完整轨迹查询** - 可查询每个瓶子的所有流转历史

## 数据持久化

所有数据存储在 `data/` 目录下的 JSON 文件中：

- `tasks.json` - 采样任务数据
- `bottles.json` - 采样瓶数据
- `flow-records.json` - 流转记录
- `cold-storage.json` - 冷藏记录

## 技术栈

- Node.js
- TypeScript
- Express
- UUID
