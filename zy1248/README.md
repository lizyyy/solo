# HTTP 协议演练台

一个本地 HTTP 协议演练工具，帮助团队复盘"为什么这次请求是 200/304/206/301/412，为什么浏览器拿到旧内容"。

## 功能特性

### 🔧 核心模拟能力

- **完整的请求响应链模拟**: 模拟客户端 → 缓存代理 → 源站的完整链路
- **HTTP 缓存模拟**: 完整实现 RFC 7234 缓存规范
- **条件请求模拟**: 支持 If-Match, If-None-Match, If-Modified-Since, If-Unmodified-Since
- **Range 请求模拟**: 支持 206 Partial Content 和断点续传
- **重定向链模拟**: 支持 301/302/303/307/308 重定向
- **CORS 预检模拟**: 支持跨域请求和 OPTIONS 预检

### 📊 详细追踪与分析

- **每一步报文记录**: 记录客户端、缓存代理、源站的每一次请求和响应
- **缓存决策追踪**: 明确记录缓存命中/过期/重新验证的原因
- **旧值证据保存**: 保存缓存的旧值和过期原因
- **状态码深度分析**: 对 200/304/206/301/412 等状态码提供详细解释

### 📋 预设场景

内置 9 个典型 HTTP 场景，快速开始演练：

| 场景名称 | 描述 | 核心知识点 |
|---------|------|-----------|
| 缓存命中场景 | 演示浏览器如何使用缓存的资源 | 200 from cache |
| 304 Not Modified 场景 | 演示缓存过期后重新验证 | 304 条件请求 |
| 206 Partial Content 场景 | 演示 Range 请求 | 断点续传 |
| 301 永久重定向场景 | 演示永久重定向行为 | 301 缓存 |
| 412 Precondition Failed 场景 | 演示条件请求失败 | 乐观锁 |
| Vary 头场景 | 演示 Vary 头如何影响缓存键 | Vary 头 |
| CORS 预检场景 | 演示跨域请求预检 | OPTIONS 预检 |
| no-cache 和 no-store 场景 | 演示两者区别 | 缓存控制 |
| 重定向链场景 | 演示多层重定向 | 重定向链 |

### 📤 报告导出

- **Markdown 格式**: 适合团队文档和复盘会议
- **JSON 格式**: 适合自动化分析和系统集成

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

或使用开发模式（自动重启）：

```bash
npm run dev
```

服务启动后访问：http://localhost:3000

### 运行测试

```bash
npm test
```

## 使用指南

### 1. 创建会话

首次访问页面会自动创建一个会话。每个会话独立维护：
- 源站资源配置
- 缓存状态
- 请求历史

### 2. 配置资源

在"配置"标签页配置源站上的资源：

```javascript
// 示例资源配置
{
  path: '/static/style.css',
  body: 'body { background: white; }',
  contentType: 'text/css',
  etag: '"abc123"',
  lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
  cacheControl: 'public, max-age=3600',
  vary: 'Accept-Encoding',
  redirect: null // 或配置重定向
}
```

**关键参数说明**：

| 参数 | 说明 | 示例 |
|-----|------|------|
| path | 资源路径，必须以 / 开头 | /api/data |
| body | 资源内容 | '{"data": "value"}' |
| contentType | 内容类型 | application/json |
| etag | 实体标签，必须用双引号包裹 | '"abc123"' |
| lastModified | 最后修改时间，HTTP 日期格式 | Wed, 21 Oct 2020 07:28:00 GMT |
| cacheControl | 缓存控制指令 | public, max-age=3600 |
| vary | Vary 头，影响缓存键生成 | Accept-Encoding |
| redirect | 重定向配置（可选） | { statusCode: 301, location: '/new' } |

### 3. 配置请求

在"执行请求"标签页配置请求：

**请求方法**: GET, HEAD, POST, PUT, DELETE, OPTIONS, PATCH

**请求头预设**:
- 强制重新验证: Cache-Control: no-cache
- 强制过期: Cache-Control: max-age=0
- 范围请求: Range: bytes=0-99
- 条件请求: If-None-Match / If-Modified-Since
- 仅使用缓存: Cache-Control: only-if-cached

**CORS 配置**:
- 启用/禁用 CORS 模拟
- 配置 Access-Control-Allow-Origin

### 4. 查看结果

在"结果分析"标签页查看详细分析：

**请求摘要**:
- 原始请求和响应报文
- 状态码和耗时

**状态码分析**:
- 详细的状态码含义解释
- 触发条件和常见场景

**缓存状态**:
- 缓存项列表
- 新鲜度状态（新鲜/已过期）
- 当前年龄和新鲜期
- 启发式过期警告

**请求追踪链路**:
按时间顺序显示完整的请求处理流程：
1. 客户端 (Client) - 蓝色
2. 缓存代理 (Cache Proxy) - 粉色
3. 源站 (Origin Server) - 绿色

每个步骤包含：
- 动作描述
- 详细的请求/响应信息
- 缓存决策原因

### 5. 导出报告

在结果分析页面点击"导出报告"：

**Markdown 报告包含**:
- 基本信息
- 请求摘要
- 状态码分析
- 缓存状态
- 请求追踪链路
- 关键发现与建议

**JSON 报告包含**:
- 完整的结构化数据
- 适合自动化处理

## 核心概念

### HTTP 缓存机制

#### 新鲜度生命周期

```
请求到达
    ↓
检查 Cache-Control 请求头
    ↓
┌─────────────────┐
│  no-cache?     │──是──→ 强制重新验证
└─────────────────┘
    ↓ 否
检查缓存是否存在
    ↓
┌─────────────────┐
│  缓存不存在?    │──是──→ 转发到源站
└─────────────────┘
    ↓ 否
计算新鲜度
    ↓
┌─────────────────┐
│  缓存新鲜?      │──是──→ 从缓存返回
└─────────────────┘
    ↓ 否
┌─────────────────┐
│  only-if-cached?│──是──→ 504 Gateway Timeout
└─────────────────┘
    ↓ 否
发送条件请求重新验证
    ↓
┌─────────────────┐
│  304?          │──是──→ 使用缓存，更新新鲜期
└─────────────────┘
    ↓ 否
使用新响应，更新缓存
```

#### Cache-Control 指令速查

| 指令 | 作用 | 适用场景 |
|-----|------|---------|
| `public` | 任何缓存都可以存储 | CDN 缓存静态资源 |
| `private` | 仅浏览器缓存 | 用户特定数据 |
| `no-cache` | 使用前必须重新验证 | 需要最新数据 |
| `no-store` | 不存储任何内容 | 敏感数据 |
| `max-age=N` | 缓存有效期 N 秒 | 静态资源版本控制 |
| `s-maxage=N` | 共享缓存有效期 | CDN 专用 |
| `must-revalidate` | 过期后必须重新验证 | 不能使用过期数据 |
| `proxy-revalidate` | 共享缓存必须重新验证 | CDN 专用 |
| `immutable` | 有效期内不会改变 | 带指纹的静态资源 |

#### 条件请求头

| 请求头 | 作用 | 常见场景 |
|-------|------|---------|
| `If-Match` | ETag 匹配才执行 | 乐观锁、防止覆盖 |
| `If-None-Match` | ETag 不匹配才执行 | 缓存验证 |
| `If-Modified-Since` | 指定时间后修改才返回 | 缓存验证 |
| `If-Unmodified-Since` | 指定时间后未修改才执行 | 防止覆盖 |
| `If-Range` | 范围请求的条件验证 | 断点续传 |

### 常见状态码分析

#### 200 OK

**含义**: 标准的成功响应

**缓存行为**:
- 如果响应包含缓存头，浏览器会缓存此响应
- 后续请求相同资源时，如果缓存未过期，可能直接使用缓存（显示 200 from disk cache/memory cache）
- 缓存过期后会发送条件请求重新验证

**常见场景**:
- 首次请求资源
- 缓存过期后重新验证成功
- 强制刷新（Ctrl+F5）

#### 304 Not Modified

**含义**: 资源自上次请求后未修改

**工作原理**:
1. 浏览器发送带条件头的请求（If-None-Match 或 If-Modified-Since）
2. 服务器比较 ETag 或 Last-Modified
3. 如未修改，返回 304（无响应体）
4. 浏览器使用本地缓存的资源

**缓存行为**:
- 304 响应会更新缓存的新鲜期
- 响应体不会改变
- 缓存的响应头可能会更新

**常见场景**:
- 缓存过期后重新验证
- 刷新页面（F5）
- 带 Cache-Control: max-age=0 的请求

#### 206 Partial Content

**含义**: 服务器成功处理了部分 GET 请求

**触发条件**:
- 请求包含 Range 头，表示只请求资源的一部分
- 服务器支持范围请求

**Range 头格式**:
```
Range: bytes=0-99      // 前 100 字节
Range: bytes=-500      // 最后 500 字节
Range: bytes=9500-     // 从第 9500 字节到末尾
```

**常见场景**:
- 视频播放器分段加载视频
- 下载工具断点续传
- 大文件分块下载

#### 301 Moved Permanently

**含义**: 资源已永久移动到新位置

**关键特性**:
- 这是永久重定向
- 浏览器会缓存这个重定向
- 搜索引擎会更新书签和索引

**缓存行为**:
- 301 响应默认会被浏览器缓存
- 除非响应中有明确的缓存控制头禁止缓存
- 后续请求会直接使用缓存的重定向，不访问原 URL

**常见场景**:
- 网站域名变更
- URL 结构永久调整
- 旧版页面合并

#### 302 Found

**含义**: 资源临时移动到新位置

**与 301 的区别**:
- 302 是临时的，浏览器不会缓存
- 搜索引擎不会更新索引
- 后续请求仍会访问原 URL

**常见场景**:
- 临时维护页面
- A/B 测试
- 基于地理位置重定向

#### 412 Precondition Failed

**含义**: 服务器不满足请求中的条件头

**常见原因**:
1. If-Match 失败: 提供的 ETag 与服务器不匹配
2. If-Unmodified-Since 失败: 资源在指定时间后已修改

**使用场景**:
- 乐观锁并发控制
- 防止意外覆盖修改后的资源
- 条件更新操作

#### 504 Gateway Timeout

**含义**: 网关或代理服务器超时

**在演练台中的含义**:
- 当请求包含 Cache-Control: only-if-cached 且无缓存时返回
- 表示必须使用缓存，但缓存不存在

**常见场景**:
- 强制使用缓存的请求
- 离线模式下的请求

## 项目结构

```
http-sandbox/
├── server/
│   ├── index.js              # Express 服务器入口
│   ├── simulators/
│   │   ├── origin.js         # 源站模拟器
│   │   ├── cache.js          # 缓存代理模拟器
│   │   ├── client.js         # 客户端模拟器
│   │   └── __tests__/
│   │       ├── origin.test.js
│   │       └── cache.test.js
│   ├── scenarios/
│   │   └── seeds.js          # 预设场景配置
│   └── utils/
│       ├── validator.js      # 参数验证器
│       └── reporter.js       # 报告生成器
├── public/
│   └── index.html            # 前端页面
├── package.json
└── README.md
```

## API 文档

### 会话管理

#### 创建新会话

```
POST /api/sessions
```

**响应**:
```json
{
  "success": true,
  "sessionId": "uuid",
  "createdAt": 1234567890
}
```

#### 获取会话信息

```
GET /api/sessions/:sessionId
```

### 资源管理

#### 添加资源

```
POST /api/sessions/:sessionId/resources
```

**请求体**:
```json
{
  "resources": [
    {
      "path": "/test",
      "body": "content",
      "contentType": "text/plain",
      "etag": "\"abc123\"",
      "lastModified": "Wed, 21 Oct 2020 07:28:00 GMT",
      "cacheControl": "public, max-age=3600",
      "vary": ""
    }
  ]
}
```

#### 获取所有资源

```
GET /api/sessions/:sessionId/resources
```

### 执行请求

```
POST /api/sessions/:sessionId/execute
```

**请求体**:
```json
{
  "request": {
    "method": "GET",
    "url": "/test",
    "headers": {},
    "body": "",
    "corsConfig": {
      "enabled": true,
      "allowOrigin": "*"
    }
  }
}
```

### 缓存管理

#### 清除缓存

```
POST /api/sessions/:sessionId/cache/clear
```

#### 获取缓存状态

```
GET /api/sessions/:sessionId/cache
```

### 场景管理

#### 获取所有场景

```
GET /api/scenarios
```

#### 加载场景

```
POST /api/sessions/:sessionId/scenarios/:scenarioId
```

### 历史记录

#### 获取历史记录

```
GET /api/sessions/:sessionId/history
```

#### 获取单个历史记录

```
GET /api/sessions/:sessionId/history/:historyId
```

### 报告导出

#### 导出 Markdown 报告

```
GET /api/sessions/:sessionId/history/:historyId/export/markdown
```

#### 导出 JSON 报告

```
GET /api/sessions/:sessionId/history/:historyId/export/json
```

## 常见问题

### Q: 为什么浏览器显示 200 from cache，但源站日志显示没有请求？

这是正常的缓存命中行为。当浏览器缓存中的资源仍然新鲜时，浏览器会直接使用缓存，不会发送请求到源站。

**如何验证**:
1. 检查 Cache-Control 的 max-age 值
2. 检查是否设置了 immutable 指令
3. 在演练台中查看缓存状态

### Q: 为什么设置了 max-age=3600，但浏览器还是发送请求到源站？

可能的原因：
1. 用户点击了刷新（F5），会发送 max-age=0
2. Cache-Control 包含 no-cache 指令
3. 缓存已经过期
4. 使用了 must-revalidate 且缓存已过期

### Q: ETag 和 Last-Modified 有什么区别？

| 特性 | ETag | Last-Modified |
|-----|------|--------------|
| 精度 | 精确（内容哈希） | 粗略（秒级） |
| 适用场景 | 频繁更新的资源 | 静态资源 |
| 条件请求 | If-Match / If-None-Match | If-Modified-Since / If-Unmodified-Since |
| 格式要求 | 必须用双引号包裹 | HTTP 日期格式 |

**最佳实践**: 同时使用 ETag 和 Last-Modified，ETag 作为主要验证方式。

### Q: 301 和 302 应该怎么选？

- **使用 301**: 当 URL 永久变更时
  - 域名迁移
  - URL 结构重构
  - 页面永久合并

- **使用 302**: 当 URL 临时变更时
  - 临时维护页面
  - A/B 测试
  - 基于用户状态的重定向

**注意**: 301 会被浏览器缓存，所以要谨慎使用。如果不确定，先用 302。

### Q: no-cache 和 no-store 有什么区别？

| 指令 | 行为 | 适用场景 |
|-----|------|---------|
| `no-cache` | 可以存储，但使用前必须重新验证 | 需要最新数据，但可以缓存 |
| `no-store` | 完全不存储任何内容 | 敏感数据、一次性数据 |

**常见误解**: no-cache 并不意味着"不缓存"，而是"使用前必须验证"。

## 扩展开发

### 添加新场景

在 `server/scenarios/seeds.js` 中添加新场景：

```javascript
{
  id: 'my-scenario',
  name: '我的场景',
  description: '场景描述',
  category: 'cache',
  resources: [
    // 资源配置
  ],
  testRequests: [
    // 测试请求
  ]
}
```

### 扩展验证器

在 `server/utils/validator.js` 中添加新的验证逻辑。

### 扩展报告生成器

在 `server/utils/reporter.js` 中修改报告模板。

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生 HTML/CSS/JavaScript
- **测试**: Jest
- **其他**: uuid, cors

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
