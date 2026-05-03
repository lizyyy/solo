# 插件沙盒权限演练器

一个本地的插件沙盒安全审计工具，用于在将第三方小插件接入内部工具平台前进行权限演练和安全审计。

## 功能特性

- **🔌 插件发现与 Manifest 校验**：自动发现 plugins 目录中的插件，验证 manifest.json 格式
- **🛡️ VM 沙盒运行器**：使用 Node.js VM 模块创建隔离的执行环境
- **📊 权限审计**：对比声明权限与实际调用，检测越权行为
- **📝 事件总线**：支持事件的发布、订阅和回放
- **💾 日志持久化**：运行日志和控制台输出持久化保存
- **📄 报告导出**：支持 JSON 和 Markdown 格式的审计报告
- **🌐 Web 报告页面**：本地 Web 服务器可视化展示报告
- **🎯 示例插件**：包含 3 个演示用例（正常、越权、崩溃/超时）

## 支持的权限

| 权限名称 | 描述 |
|----------|------|
| `fs:read` | 读取文件系统 - 读取文件、检查文件存在、列出目录 |
| `fs:write` | 写入文件系统 - 创建、修改文件 |
| `fs:delete` | 删除文件系统 - 删除文件和目录 |
| `network:fetch` | 网络请求 - 使用 fetch API |
| `network:http` | HTTP 请求 - 底层 HTTP 操作 |
| `env:read` | 读取环境变量 |
| `env:write` | 写入环境变量 |
| `event:subscribe` | 订阅事件总线 |
| `event:publish` | 发布事件到事件总线 |
| `process:spawn` | 创建子进程 |
| `process:exec` | 执行 shell 命令 |

## 快速开始

### 安装

```bash
npm install
```

### 查看命令帮助

```bash
npx tsx src/cli.ts --help
```

### 列出所有插件

```bash
npx tsx src/cli.ts list
```

### 验证插件 Manifest

```bash
npx tsx src/cli.ts validate
```

### 运行所有插件并生成审计报告

```bash
npx tsx src/cli.ts run -v
```

### 运行指定插件

```bash
npx tsx src/cli.ts run -n normal-plugin
```

### 运行并启动 Web 报告服务器

```bash
npx tsx src/cli.ts run --serve --port 3000
```

然后浏览器访问 http://localhost:3000 查看报告

### 查看支持的权限列表

```bash
npx tsx src/cli.ts permissions
```

## 目录结构

```
.
├── src/                      # 源代码目录
│   ├── cli.ts               # 命令行入口
│   ├── types.ts             # TypeScript 类型定义
│   ├── sandbox-runner.ts    # VM 沙盒运行器（核心）
│   ├── plugin-manager.ts    # 插件发现与 Manifest 管理
│   ├── permission-auditor.ts # 权限审计引擎
│   ├── report-generator.ts  # 报告生成器（JSON/Markdown/HTML）
│   ├── web-server.ts        # Web 报告服务器
│   ├── event-bus.ts         # 事件总线
│   └── logger.ts            # 日志持久化
├── plugins/                  # 插件目录
│   ├── normal-plugin/       # 正常插件示例
│   │   ├── manifest.json
│   │   └── index.js
│   ├── privilege-escalation-plugin/ # 越权插件示例
│   │   ├── manifest.json
│   │   └── index.js
│   └── crash-timeout-plugin/ # 崩溃和超时测试插件
│       ├── manifest.json
│       └── index.js
├── output/                   # 输出目录（运行时生成）
│   └── run-<timestamp>/
│       ├── batch-audit-report.json
│       ├── batch-audit-report.md
│       └── <plugin-name>/
│           ├── audit-report.json
│           └── audit-report.md
├── package.json
└── tsconfig.json
```

## 插件开发规范

每个插件必须包含以下文件：

### 1. manifest.json

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "作者",
  "main": "index.js",
  "permissions": [
    "fs:read",
    "fs:write",
    "event:publish"
  ],
  "timeout": 5000
}
```

### 2. 入口脚本 (index.js)

插件中可使用的沙盒 API：

```javascript
// 文件系统 API
await fs.readFile('path/to/file', { encoding: 'utf-8' });
await fs.writeFile('path/to/file', 'content');
await fs.appendFile('path/to/file', 'content');
await fs.delete('path/to/file');
const exists = await fs.exists('path/to/file');
const files = await fs.readDir('path/to/dir');

// 网络 API
const response = await network.fetch('https://example.com');

// 环境变量 API
const value = env.get('KEY');
env.set('KEY', 'value');

// 事件总线 API
event.subscribe('event:name', (data) => {
  console.log('收到事件:', data);
});
event.publish('event:name', { key: 'value' });

// 进程 API（默认阻止）
process.exec('command');
process.spawn('command', ['arg1']);

// 控制台输出
console.log('日志');
console.error('错误');
console.warn('警告');
console.info('信息');
console.debug('调试');
```

## 审计规则

### 检测的违规类型

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| **未声明却使用** | 插件调用了 manifest 中未声明的权限 | Critical |
| **运行崩溃** | 插件执行过程中抛出未捕获异常 | Critical |
| **运行超时** | 插件运行超过 manifest 中声明的超时时间 | High |
| **越权事件订阅** | 尝试订阅事件但未声明 event:subscribe 权限 | High |
| **越权事件发布** | 尝试发布事件但未声明 event:publish 权限 | High |
| **能力调用失败** | 权限调用被沙盒阻止（通常因为越权） | Medium |

### 检测的警告类型

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| **声明但未使用** | 插件声明了权限但实际运行中未使用 | Low |

## 示例插件说明

### 1. normal-plugin（正常插件）

- **Manifest 权限声明**：`fs:read`, `fs:write`, `event:subscribe`, `event:publish`
- **实际调用**：使用所有声明的权限
- **预期结果**：✅ 通过审计，无违规

### 2. privilege-escalation-plugin（越权插件）

- **Manifest 权限声明**：仅 `fs:read`
- **实际调用**：尝试使用 `fs:write`, `network:fetch`, `env:read`, `process:exec`
- **预期结果**：❌ 4 个越权违规被检测

### 3. crash-timeout-plugin（崩溃和越权混合）

- **Manifest 权限声明**：仅 `fs:read`
- **实际行为**：
  - 抛出未捕获异常（测试崩溃检测）
  - 尝试使用多种未声明权限
- **预期结果**：❌ 1 个崩溃 + N 个越权违规

## 报告格式

### JSON 报告示例

```json
{
  "runId": "1777789776556-normal-plugin-vfica1",
  "generatedAt": 1777789776658,
  "pluginName": "normal-plugin",
  "pluginVersion": "1.0.0",
  "manifest": {
    "name": "normal-plugin",
    "version": "1.0.0",
    "permissions": ["fs:read", "fs:write", "event:subscribe", "event:publish"]
  },
  "runSummary": {
    "success": true,
    "crashed": false,
    "timeout": false,
    "duration": 102
  },
  "permissionAudits": [
    {
      "permission": "fs:read",
      "declared": true,
      "used": true,
      "callCount": 1,
      "status": "declared_used"
    }
  ],
  "findings": [],
  "capabilityCalls": [],
  "events": [],
  "consoleOutput": []
}
```

### Markdown 报告

每个插件会生成详细的 Markdown 报告，包含：
- 插件基本信息
- 运行摘要（成功/失败/超时/崩溃）
- 审计发现（按严重程度排序）
- 权限审计详情（声明 vs 使用）
- 统计信息
- 控制台输出

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI 入口                             │
│                     (src/cli.ts)                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ PluginManager │  │ SandboxRunner │  │ ReportGenerator│
│  (插件发现)   │  │  (VM 沙盒)   │  │  (报告生成)   │
└───────────────┘  └───────────────┘  └───────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ EventBus      │  │ PermAuditor   │  │ Logger        │
│  (事件总线)   │  │  (权限审计)   │  │  (日志持久化) │
└───────────────┘  └───────────────┘  └───────────────┘
```

## 安全特性

1. **VM 隔离执行**：使用 Node.js `vm` 模块，在隔离上下文中执行插件代码
2. **受控 API 暴露**：只暴露受控的沙盒 API，不直接暴露 `require` 或全局 `process`
3. **权限按需声明**：插件必须在 manifest 中显式声明所需权限
4. **越权即时阻止**：沙盒会在调用时检查权限，未声明的能力调用被阻止
5. **超时自动终止**：超过 manifest 声明的超时时间后自动终止
6. **异常隔离捕获**：插件中的异常不会传播到主进程
7. **Timer 管理**：自动清理插件创建的定时器

## 注意事项

⚠️ **重要**：这是一个用于安全审计的演练工具，不能替代生产级别的安全沙盒。

- 此工具主要用于**审计目的**，检测插件的权限违规行为
- 生产环境的插件沙盒需要更严格的隔离机制（如隔离进程、容器等）
- 沙盒不会真正执行网络请求或危险操作（会被模拟或阻止）
- 插件代码中的 `require`, `import`, `process` 等全局变量不可用

## 开发

### 构建

```bash
npm run build
```

### 开发模式运行

```bash
npm run dev
```

### 运行测试

```bash
npm run test
```

## License

MIT
