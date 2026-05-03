# 移动 App 深链路发布预检工具

一个基于 TypeScript 的 CLI 工具，用于在发布前检查移动 App 深链路配置的正确性。

## 功能特性

- ✅ **URL 参数检查**：验证 URL scheme、path 和参数是否完整
- 🔐 **登录态验证**：检查需要登录的路由在未登录状态下的行为
- ⚠️ **废弃路由检测**：识别已标记为废弃的路由和旧短链
- 📊 **埋点缺失检查**：验证目标屏幕要求的埋点事件是否完整
- 🎯 **灰度规则匹配**：检查用户上下文是否符合灰度发布规则
- 📋 **边界情况处理**：支持同一路由参数缺失、旧短链仍被投放等场景

## 安装

```bash
npm install
```

## 快速开始

### 1. 初始化项目（创建示例配置）

```bash
npm run build
npm start init
```

这会在 `./config` 目录下创建示例配置文件：
- `routes.yaml` - 路由配置
- `screens.json` - 屏幕配置
- `events.jsonl` - 埋点事件样例
- `policy.yaml` - 灰度规则

### 2. 运行检查

```bash
# 使用默认配置路径
npm start check

# 或者使用完整命令
npm start check -- \
  --routes ./config/routes.yaml \
  --screens ./config/screens.json \
  --events ./config/events.jsonl \
  --policy ./config/policy.yaml \
  --output ./output
```

### 3. 查看报告

检查完成后，会在输出目录生成：
- `issues.csv` - 问题列表（CSV 格式）
- `deeplink_report.md` - 详细报告（Markdown 格式）

## 命令行选项

### `check` 命令

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-r, --routes <path>` | 路由配置文件路径 | `./config/routes.yaml` |
| `-s, --screens <path>` | 屏幕配置文件路径 | `./config/screens.json` |
| `-e, --events <path>` | 埋点事件文件路径 | `./config/events.jsonl` |
| `-p, --policy <path>` | 灰度规则文件路径 | `./config/policy.yaml` |
| `-t, --test-cases <path>` | 测试用例文件路径（可选） | 无 |
| `-o, --output <directory>` | 输出目录 | `./output` |
| `--user-segment <segment>` | 测试用户分群 | 无 |
| `--user-version <version>` | 测试 App 版本 | 无 |
| `--user-region <region>` | 测试用户地区 | 无 |
| `--user-id <id>` | 测试用户 ID | 无 |
| `--logged-in` | 测试登录状态 | `true` |
| `--not-logged-in` | 测试未登录状态 | `false` |

### `init` 命令

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-d, --directory <path>` | 配置文件目录 | `./config` |

## 配置文件说明

### 1. routes.yaml - 路由配置

```yaml
defaultScheme: myapp

routes:
  # 首页
  - path: /home
    scheme: myapp
    targetScreen: home_screen
    requiredParams: []
    optionalParams:
      - tab
      - source
    requiresLogin: false
    isDeprecated: false

  # 商品详情页（需要参数）
  - path: /product/detail
    scheme: myapp
    targetScreen: product_detail_screen
    requiredParams:
      - productId
    optionalParams:
      - source
    requiresLogin: false
    isDeprecated: false

  # 已废弃的路由
  - path: /old/product
    scheme: myapp
    targetScreen: product_detail_screen
    requiredParams:
      - id
    requiresLogin: false
    isDeprecated: true
    redirectTo: /product/detail
```

**字段说明**：
- `path`: 路由路径
- `scheme`: URL scheme
- `targetScreen`: 目标屏幕 ID
- `requiredParams`: 必填参数列表
- `optionalParams`: 可选参数列表
- `requiresLogin`: 是否需要登录
- `isDeprecated`: 是否已废弃
- `redirectTo`: 废弃路由的重定向目标

### 2. screens.json - 屏幕配置

```json
{
  "screens": [
    {
      "id": "home_screen",
      "name": "首页",
      "requiredEvents": [
        "page_view_home",
        "home_impression"
      ],
      "deprecated": false,
      "minimumAppVersion": "1.0.0"
    }
  ]
}
```

**字段说明**：
- `id`: 屏幕唯一标识
- `name`: 屏幕名称
- `requiredEvents`: 该屏幕必须触发的埋点事件列表
- `deprecated`: 是否已废弃
- `minimumAppVersion`: 最低支持的 App 版本

### 3. events.jsonl - 埋点事件样例

每行一个 JSON 对象：

```jsonl
{"eventName":"page_view_home","screenId":"home_screen","routePath":"/home","timestamp":"2026-05-03T10:00:00Z","userId":"user_001","properties":{"source":"push"}}
{"eventName":"home_impression","screenId":"home_screen","routePath":"/home","timestamp":"2026-05-03T10:00:01Z","userId":"user_001","properties":{"tab":"recommend"}}
```

**字段说明**：
- `eventName`: 事件名称
- `screenId`: 屏幕 ID
- `routePath`: 路由路径
- `timestamp`: 时间戳
- `userId`: 用户 ID
- `properties`: 事件属性

### 4. policy.yaml - 灰度规则

```yaml
defaultPolicy: allow

rules:
  # VIP 用户专属功能
  - id: rule_001
    name: VIP 用户专属功能
    type: user_segment
    value: ["vip", "svip"]
    routes:
      - /order/detail

  # 版本限制
  - id: rule_002
    name: 2.0 版本以上功能
    type: version
    value: ["2.0.0", "2.1.0"]
    routes:
      - /order/detail

  # 百分比灰度
  - id: rule_003
    name: 10% 用户灰度
    type: percentage
    value: 10
    routes:
      - /new-feature/*

  # 地区限制
  - id: rule_004
    name: 中国大陆地区专属
    type: region
    value: ["CN", "HK", "TW"]
    routes:
      - /region-specific/*
```

**规则类型**：
- `user_segment`: 用户分群匹配
- `version`: App 版本匹配
- `percentage`: 百分比灰度（基于用户 ID 哈希）
- `region`: 地区匹配

## 演示命令

### 使用示例数据运行检查

```bash
# 1. 构建项目
npm run build

# 2. 初始化示例配置
npm start init

# 3. 运行基础检查
npm start check

# 4. 模拟未登录用户检查
npm start check -- --not-logged-in

# 5. 模拟 VIP 用户检查灰度规则
npm start check -- --user-segment vip --user-version 2.0.0

# 6. 使用自定义输出目录
npm start check -- --output ./my-report
```

### 查看输出报告

```bash
# 查看 Markdown 报告
cat ./output/deeplink_report.md

# 查看 CSV 问题列表
cat ./output/issues.csv
```

## 项目结构

```
.
├── src/
│   ├── index.ts      # CLI 入口
│   ├── types.ts      # 类型定义
│   ├── parser.ts     # 解析模块
│   ├── rules.ts      # 规则引擎
│   └── reporter.ts   # 报告导出
├── samples/          # 示例数据文件
│   ├── routes.yaml
│   ├── screens.json
│   ├── events.jsonl
│   └── policy.yaml
├── tests/            # 测试文件
├── package.json
├── tsconfig.json
└── README.md
```

## 检查项详解

### 1. URL 参数检查

- 验证必填参数是否存在且非空
- 检查可选参数格式（如果提供）
- 检测参数缺失的边界情况

### 2. 登录态要求检查

- 识别需要登录的路由
- 验证在未登录状态下的行为
- 标记严重问题（需要登录但未登录）

### 3. 废弃路由检查

- 检测已标记 `isDeprecated: true` 的路由
- 检查重定向目标是否存在
- 识别旧短链格式（如 `/s/xxx`、`/short/xxx`）

### 4. 埋点缺失检查

- 对比屏幕配置的 `requiredEvents`
- 检查实际埋点数据中是否存在对应事件
- 标记缺失的埋点事件

### 5. 灰度规则匹配

- 根据用户上下文（分群、版本、地区、ID）
- 检查是否符合灰度规则要求
- 识别规则不匹配的路由

## 边界情况处理

### 1. 同一路由参数缺失

- 支持同一基础路径下的不同参数组合
- 检查必填参数是否完整
- 可选参数为空时给出警告

### 2. 旧短链仍被投放

- 检测常见短链格式（`/s/`、`/short/`）
- 标记为中等优先级问题
- 建议更新为完整路径或检查映射配置

### 3. 灰度规则多重匹配

- 支持同一路由的多个灰度规则
- 分别检查每个规则的匹配情况
- 汇总所有不匹配的规则

## 测试

```bash
# 运行所有测试
npm test
```

## 许可证

MIT License
