# 🖥️ 服务集群演练台

一个本地服务集群模拟演练工具，用于学习和测试服务发现、健康检查、故障转移和负载均衡决策。

## ✨ 功能特性

### 🔧 集群管理
- 创建/编辑/删除集群
- 配置负载均衡策略
- 设置健康检查间隔
- 实时监控集群状态

### ⚙️ 实例控制
- 注册/注销服务实例
- 手动设置实例宕机/恢复
- 调整实例权重
- 管理主从角色切换

### 🎮 演练模拟
- 发送测试请求，观察负载均衡决策
- 手动让主节点宕机，触发故障转移
- 手动选举新主节点
- 重置连接数

### 📋 事件日志
- 完整记录所有操作和决策
- 支持按集群/类型/级别筛选
- 可清空日志
- 详情JSON展示

### 📊 分析报告
- 事件类型统计
- 请求路由数量统计
- 故障转移次数统计
- 配置警告统计

### 📥 导出复盘
- 导出 JSON 格式数据
- 导出 Markdown 格式复盘报告
- 支持按单个集群或全部导出

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

或者使用开发模式（自动重载）：

```bash
npm run dev
```

服务启动后访问：**http://localhost:3000**

### 加载示例数据

启动后，在前端页面点击「🌱 加载示例数据」按钮，或运行：

```bash
npm run seed
```

## 📁 项目结构

```
.
├── data/                    # 数据存储目录（JSON文件）
├── public/                  # 前端静态资源
│   ├── index.html          # 主页面
│   └── app.js              # 前端逻辑
├── src/
│   └── server/
│       ├── index.js        # 服务器入口
│       ├── seed.js         # 示例数据
│       ├── models/         # 数据模型
│       │   ├── Cluster.js
│       │   ├── EventLog.js
│       │   └── Instance.js
│       ├── routes/         # API路由
│       │   ├── clusters.js
│       │   ├── events.js
│       │   └── instances.js
│       ├── services/       # 核心服务
│       │   ├── ExportService.js
│       │   ├── HealthCheckService.js
│       │   ├── LoadBalancer.js
│       │   └── ServiceDiscovery.js
│       └── storage/        # 数据存储
│           └── DataStore.js
├── package.json
└── README.md
```

## 🎯 核心功能说明

### 负载均衡策略

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| **ROUND_ROBIN (轮询)** | 按顺序依次分配请求 | 实例配置相近，负载均匀 |
| **WEIGHTED_ROUND_ROBIN (加权轮询)** | 根据权重比例分配 | 实例配置有差异，权重高分配多 |
| **LEAST_CONNECTIONS (最小连接数)** | 选择连接数最少的实例 | 长连接场景，如数据库 |
| **RANDOM (随机)** | 随机选择可用实例 | 简单场景，负载测试 |

### 故障转移机制

1. **检测故障**：连续3次健康检查失败标记为不健康
2. **触发转移**：主节点故障时自动触发故障转移
3. **选举规则**：
   - 优先选择权重高的从节点
   - 权重相同时选择注册时间较早的实例
4. **标记剔除**：连续5次失败标记为 DOWN 状态

### 实例状态说明

| 状态 | 说明 | 是否接收请求 |
|------|------|--------------|
| **HEALTHY (健康)** | 实例正常运行 | ✅ 是 |
| **UNHEALTHY (不健康)** | 连续3次健康检查失败 | ❌ 否 |
| **DOWN (宕机)** | 连续5次失败，已被剔除 | ❌ 否 |
| **MAINTENANCE (维护中)** | 手动设置维护模式 | ❌ 否 |

### 配置警告提示

系统会自动检测以下配置问题并发出警告：

1. **无主节点警告**：集群没有主节点
2. **超过半数不可用**：超过50%实例不健康或宕机
3. **单点故障风险**：集群只有一个实例

## 📡 API 接口

### 集群管理

```
GET    /api/clusters                    # 获取所有集群
POST   /api/clusters                    # 创建集群
GET    /api/clusters/:id                # 获取单个集群
PUT    /api/clusters/:id                # 更新集群
DELETE /api/clusters/:id                # 删除集群
POST   /api/clusters/:id/elect-master   # 手动选举主节点
POST   /api/clusters/:id/route-request  # 路由请求
GET    /api/clusters/:id/analysis       # 获取分析数据
GET    /api/clusters/:id/export/json    # 导出JSON
GET    /api/clusters/:id/export/markdown # 导出Markdown
```

### 实例管理

```
GET    /api/instances                    # 获取所有实例
POST   /api/instances                    # 注册实例
GET    /api/instances/:id                # 获取单个实例
PUT    /api/instances/:id                # 更新实例
DELETE /api/instances/:id                # 删除实例
POST   /api/instances/:id/set-down       # 标记宕机
POST   /api/instances/:id/recover        # 恢复实例
PUT    /api/instances/:id/weight         # 更新权重
```

### 事件日志

```
GET    /api/events                       # 获取事件日志
GET    /api/events/types                 # 获取事件类型枚举
GET    /api/events/analysis              # 获取分析数据
DELETE /api/events                       # 清空日志
```

### 元数据

```
GET    /api/health                       # 健康检查
GET    /api/strategies                   # 获取负载均衡策略说明
GET    /api/instance-statuses            # 获取实例状态说明
GET    /api/instance-roles               # 获取实例角色说明
POST   /api/seed                         # 加载示例数据
GET    /api/export/json                  # 导出全部JSON
GET    /api/export/markdown              # 导出全部Markdown
```

## 🎓 使用场景示例

### 场景1：测试故障转移

1. 创建一个集群，注册2个实例（主+从）
2. 点击「让主节点宕机」
3. 观察事件日志，确认故障转移已触发
4. 查看新的主节点选举结果

### 场景2：测试负载均衡

1. 选择「加权轮询」策略
2. 注册3个实例，设置不同权重（如 10, 5, 5）
3. 发送20个测试请求
4. 观察请求分配比例是否符合权重比例

### 场景3：模拟高可用演练

1. 创建包含3个实例的集群
2. 手动让其中一个从节点宕机
3. 发送请求，确认流量只流向健康实例
4. 恢复宕机实例，观察重新加入

## 📝 复盘报告示例

导出的 Markdown 报告包含以下内容：

1. **集群概览**：所有集群的配置和状态
2. **实例列表**：每个实例的详细信息
3. **事件日志**：按类型分类展示
4. **统计汇总**：请求、故障转移、警告计数
5. **附录**：策略说明、状态说明、故障转移规则

## 🔧 配置说明

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |

### 内置常量

在 `src/server/services/HealthCheckService.js` 中可调整：

```javascript
const MAX_FAILED_CHECKS = 3;    // 标记不健康的连续失败次数
const EVICTION_THRESHOLD = 5;    // 标记剔除的连续失败次数
```

## 📊 数据存储

所有数据保存在 `data/` 目录下的 JSON 文件：

- `clusters.json` - 集群数据
- `instances.json` - 实例数据
- `eventLogs.json` - 事件日志

数据会自动持久化，重启服务后保留。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**🎉 开始你的服务集群演练之旅吧！**
