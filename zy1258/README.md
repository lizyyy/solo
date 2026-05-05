# CDN 缓存混版排查工作台

一个用于排查前端白屏问题（CDN 缓存混版）的本地排查台，支持数据导入、模拟场景、风险检测和报告导出。

## 功能特性

### 数据导入
- **manifest.json**: 导入 Webpack/Vite 生成的资源清单，包含版本信息和资源 hash
- **edge-logs.jsonl**: 导入 CDN 边缘节点日志，分析缓存命中状态
- **purge-events.yaml**: 导入 purge 操作记录，分析漏节点情况

### 模拟排查
- **灰度发布模拟**: 模拟部分用户使用新版本、部分使用旧版本的场景，检测"旧 HTML 引新 JS"风险
- **回滚访问模拟**: 模拟回滚后浏览器仍缓存新版本资源的场景，检测"回滚资源缺失"风险
- **SW 残留模拟**: 模拟 Service Worker 缓存旧版本资源的场景
- **Purge 漏节点模拟**: 模拟部分边缘节点未被 purge 的场景

### 风险检测
自动检测以下风险类型：
- 🔴 **OLD_HTML_NEW_JS**: 旧 HTML 引用新 JS（严重）
- 🔴 **NEW_HTML_OLD_CSS**: 新 HTML 命中旧 CSS/浏览器缓存污染（严重）
- 🔴 **ROLLBACK_MISSING_RESOURCES**: 回滚资源缺失（严重）
- 🔴 **JS_ERRORS_LIKELY_CACHE_MISMATCH**: 疑似缓存混版导致的 JS 错误（严重）
- 🟠 **CANARY_DISTRIBUTION_ISSUE**: 灰度分发异常
- 🟠 **PURGE_SKIPPED_NODES**: Purge 漏节点
- 🟠 **MULTIPLE_HASHES_SAME_RESOURCE**: 同一资源存在多个版本
- 🟡 **STALE_CACHE_HITS**: 过期缓存命中
- 🟡 **PURGE_NOT_EFFECTIVE**: Purge 效果不明显

### 报告导出
- Markdown 格式报告
- JSON 格式报告

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn

### 安装依赖

```bash
# 安装所有依赖
npm install
```

### 初始化数据库

```bash
# 进入 server 目录
cd server

# 初始化 Prisma 并创建数据库
npx prisma db push
```

### 填充测试数据（Seed）

```bash
# 运行 seed 脚本，会创建两个版本和一些混版数据
npm run seed --workspace=server
```

### 启动开发服务器

```bash
# 同时启动前后端
npm run dev
```

或者分别启动：

```bash
# 启动后端（端口 3001）
npm run dev:server

# 启动前端（端口 3000）
npm run dev:client
```

### 访问应用

打开浏览器访问：http://localhost:3000

## 项目结构

```
cdn-cache-debugger/
├── server/                          # 后端服务
│   ├── src/
│   │   ├── index.ts                 # 入口文件
│   │   ├── prisma.ts                # Prisma 客户端
│   │   ├── types.ts                 # 类型定义
│   │   ├── routes/
│   │   │   ├── import.ts            # 导入相关路由
│   │   │   ├── simulation.ts        # 模拟相关路由
│   │   │   └── query.ts             # 查询相关路由
│   │   └── services/
│   │       ├── ImportService.ts     # 数据导入服务
│   │       ├── SimulationService.ts # 模拟引擎服务
│   │       ├── RiskDetectionService.ts # 风险检测服务
│   │       └── ReportService.ts     # 报告导出服务
│   ├── prisma/
│   │   ├── schema.prisma            # 数据库模型
│   │   └── seed.ts                  # 测试数据生成
│   └── examples/                    # 示例数据文件
│       ├── manifest-good.json
│       ├── manifest-bad-mixed-version.json
│       ├── edge-logs-mixed-cache.jsonl
│       └── purge-events-with-skipped-nodes.yaml
├── client/                          # 前端应用
│   ├── src/
│   │   ├── main.ts                  # 入口文件
│   │   ├── App.vue                  # 根组件
│   │   ├── api/index.ts             # API 调用
│   │   ├── router/index.ts          # 路由配置
│   │   └── views/                   # 页面组件
│   │       ├── Dashboard.vue        # 仪表盘
│   │       ├── DataImport.vue       # 数据导入
│   │       ├── ReleaseBatches.vue   # 发布批次列表
│   │       ├── BatchDetail.vue      # 批次详情
│   │       ├── Simulation.vue       # 模拟排查
│   │       ├── Risks.vue            # 风险检测
│   │       ├── Tasks.vue            # 任务列表
│   │       └── TaskDetail.vue       # 任务详情
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── package.json
```

## 使用示例

### 1. 导入真实数据

```bash
# 示例文件位于 server/examples/
# 可以直接使用这些文件进行测试
```

在前端的"数据导入"页面：
1. 上传 `manifest-good.json` 创建一个发布批次
2. 上传 `edge-logs-mixed-cache.jsonl` 导入边缘日志（可选关联到刚才创建的批次）
3. 上传 `purge-events-with-skipped-nodes.yaml` 导入 purge 记录

### 2. 运行模拟场景

在"模拟排查"页面，选择一个场景：

**灰度发布模拟**：
- 选择旧版本和新版本批次
- 设置灰度比例（如 30%）
- 选择受影响的边缘节点
- 运行模拟 → 检测"旧 HTML 引新 JS"风险

**回滚访问模拟**：
- 选择要回滚的新版本和回滚目标旧版本
- 设置缺失的资源路径
- 运行模拟 → 检测"回滚资源缺失"风险

**SW 残留模拟**：
- 选择新旧版本
- 设置 SW 缓存的 URL
- 设置更新频率（越低越容易残留）
- 运行模拟 → 检测 SW 缓存残留风险

**Purge 漏节点模拟**：
- 选择目标版本
- 设置跳过的边缘节点
- 设置遗漏的 URL
- 运行模拟 → 检测 purge 漏节点风险

### 3. 手动风险检测

在"发布批次"页面：
1. 选择一个批次
2. 点击"检测风险"按钮
3. 系统会分析该批次的所有日志和资源，生成风险报告

### 4. 导出报告

在"排查任务"页面：
1. 选择一个已完成的任务
2. 点击"详情"查看完整结果
3. 点击"导出 Markdown"或"导出 JSON"

## 示例数据说明

### 好样例（server/examples/manifest-good.json）

一个正常的 manifest 文件，所有资源引用同一版本的 hash：
- 版本号: 1.1.0
- 所有资源 hash: xyz9876543（一致）
- 可用于测试正常的发布流程

### 坏样例 1（server/examples/manifest-bad-mixed-version.json）

模拟 HTML 和 JS/CSS 使用不同版本 hash 的情况：
- HTML 使用旧 hash: oldhash1234
- JS 使用新 hash: newhash5678
- CSS 使用旧 hash: oldhash1234
- 导入后检测会发现版本不匹配风险

### 坏样例 2（server/examples/edge-logs-mixed-cache.jsonl）

模拟边缘节点混版缓存的日志：
- 节点 HKG: 正常 MISS/HIT 混合
- 节点 TOK: 全是旧缓存（HIT，age 很大）
- 节点 SGP: 有 STALE 缓存
- 包含 404 错误（模拟资源缺失）

### 坏样例 3（server/examples/purge-events-with-skipped-nodes.yaml）

模拟 purge 漏节点的记录：
- 跳过了 node-tok-001 节点
- 该节点的缓存不会被清理
- 导入后会检测到漏节点风险

## API 接口

### 导入接口

```
POST /api/import/manifest        # 导入 manifest.json
POST /api/import/edge-logs       # 导入 edge-logs.jsonl
POST /api/import/purge-events    # 导入 purge-events.yaml
```

### 模拟接口

```
POST /api/simulate/canary        # 灰度发布模拟
POST /api/simulate/rollback      # 回滚访问模拟
POST /api/simulate/sw-residue    # SW 残留模拟
POST /api/simulate/purge-miss    # Purge 漏节点模拟
```

### 查询接口

```
GET  /api/query/statistics              # 获取统计数据
GET  /api/query/release-batches         # 获取发布批次列表
GET  /api/query/release-batches/:id     # 获取批次详情
GET  /api/query/debug-tasks             # 获取任务列表
GET  /api/query/debug-tasks/:id         # 获取任务详情
POST /api/query/detect-risks/:batchId  # 执行风险检测
GET  /api/query/report/:id/markdown     # 导出 Markdown 报告
GET  /api/query/report/:id/json         # 导出 JSON 报告
```

## 数据库模型

- **ReleaseBatch**: 发布批次
- **Resource**: 资源文件
- **HitChain**: 边缘请求命中链
- **AnomalyUser**: 异常用户
- **PurgeEvent**: Purge 操作记录
- **DebugTask**: 排查任务
- **Risk**: 检测到的风险

## 常见问题

### Q: 白屏的常见原因有哪些？

1. **旧 HTML 引用新 JS**: HTML 是旧版本，但引用了新版本的 JS（hash 不同），JS 可能不存在或不兼容
2. **新 HTML 命中旧 CSS**: HTML 是新版本，但 CSS 被浏览器/CDN 缓存了旧版本
3. **回滚资源缺失**: 回滚后，新版本的资源被删除，但用户仍缓存了引用新资源的 HTML
4. **Purge 漏节点**: 部分边缘节点未被 purge，仍返回旧版本
5. **SW 残留**: Service Worker 缓存了旧版本资源，不更新

### Q: 如何预防缓存混版？

1. **资源命名**: 使用 content hash 命名所有资源文件（JS、CSS、图片等）
2. **HTML 不缓存**: 确保 HTML 入口文件不被缓存或缓存时间很短（< 5分钟）
3. **全量 Purge**: 每次发布后对 HTML 入口和所有资源执行全量 purge
4. **版本校验**: 在应用中添加版本校验，发现混版时强制刷新
5. **SW 策略**: Service Worker 要正确处理版本更新，使用 skipWaiting 和 clients.claim

### Q: 为什么要排查边缘日志？

边缘日志可以帮助你：
- 查看每个请求的缓存状态（HIT/MISS/STALE/EXPIRED）
- 追踪请求经过的边缘节点
- 分析不同节点的缓存年龄
- 发现哪些节点仍在返回旧版本

## License

MIT
