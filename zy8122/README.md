# Design Token 发布回放台

一个用于分析 Design Token 变更、检测破坏性变更、评估组件影响、生成回滚建议的本地工具。

## 功能特性

- 📝 **Token 变更分析** - 对比两个版本的 tokens 文件，识别新增、删除、修改的 token
- 🔗 **别名依赖解析** - 自动解析 `{token.path}` 格式的别名引用，构建依赖图
- ♻️ **循环别名检测** - 使用 DFS 算法检测循环引用，标记为破坏性变更
- 🎨 **单位/颜色转换** - 自动识别颜色和尺寸类型，转换为多种格式（HEX/RGB/HSL，数值+单位）
- 💥 **破坏性变更检测** - 根据规则判断哪些变更属于破坏性变更
- 👁️ **对比度风险检测** - 基于 WCAG 标准检测颜色变更的可访问性风险
- 🧩 **组件影响分析** - 分析组件使用日志，识别受影响的组件
- ↩️ **回滚建议生成** - 根据变更严重程度生成优先级建议
- 📄 **报告导出** - 支持导出 JSON 和 Markdown 格式的分析报告

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 使用示例数据

打开浏览器访问 `http://localhost:3000`，点击「加载示例数据」按钮即可体验完整功能。

## 使用说明

### 1. 准备数据文件

你需要准备以下文件（至少需要前两个）：

| 文件 | 必需 | 格式 | 说明 |
|------|------|------|------|
| tokens-v1.json | ✅ | JSON | 旧版本 Design Token |
| tokens-v2.json | ✅ | JSON | 新版本 Design Token |
| 组件使用日志 | ❌ | JSON/JSONL | 组件使用 token 的记录 |
| 对比规则 | ❌ | YAML/JSON | 自定义检测规则配置 |

### 2. 上传文件

在页面上依次上传准备好的文件，然后点击「分析变更」按钮。

### 3. 查看分析结果

分析完成后，你可以在四个标签页中查看：

- **Token 变更** - 按分类展示所有变更，支持折叠/展开，点击查看详情
- **受影响组件** - 展示受变更影响的组件列表
- **对比度风险** - 检测颜色变更后的可访问性问题
- **回滚建议** - 根据变更严重程度生成优先级建议

### 4. 导出报告

点击「导出 JSON 报告」或「导出 Markdown 报告」按钮下载分析报告。

## 数据格式说明

### Design Token 格式

支持标准的 Design Token 格式（类似：

```json
{
  "color": {
    "primary": {
      "$value": "#1890ff",
      "$type": "color",
      "$description": "品牌主色"
    }
  },
  "spacing": {
    "md": {
      "$value": "16px",
      "$type": "dimension",
      "$description": "中间距"
    }
  },
  "component": {
    "button": {
      "primaryBg": {
        "$value": "{color.primary}",
        "$type": "alias",
        "$description": "主按钮背景色"
      }
    }
  }
}
```

**支持的类型：**
- `color` - 颜色值
- `dimension` - 尺寸值（带单位）
- `number` - 数值
- `string` - 字符串
- `alias` - 别名引用（格式：`{token.path}`）

### 组件使用日志格式

支持 JSON 数组或 JSONL 格式（每行一个 JSON 对象）：

```json
[
  {
    "component": "Button",
    "tokens": [
      "component.button.primaryBg",
      "component.button.height"
    ],
    "usage": "background: var(--component-button-primaryBg);",
    "count": 156
  }
]
```

**字段说明：**
- `component` / `componentName` - 组件名称
- `tokens` - 使用的 token 路径数组
- `tokenPath` - 单个 token 路径
- `usage` - 使用示例代码
- `count` - 使用次数
- `lastUsed` - 最后使用时间

### 对比规则格式

支持 YAML 或 JSON 格式：

```yaml
breakingChanges:
  removedTokens: true        # 删除 token 是否为破坏性变更
  typeChanges: true         # 类型变更是否为破坏性变更
  valueChanges:
    color: true           # 颜色值变更是否为破坏性变更
    dimension: true       # 尺寸值变更是否为破坏性变更
    number: true          # 数值变更是否为破坏性变更
    string: false          # 字符串变更是否为破坏性变更
  unitChanges: true       # 单位变更是否为破坏性变更

contrast:
  minRatio:
    normal: 4.5           # 普通文本最小对比度（WCAG AA）
    large: 3              # 大文本最小对比度（WCAG AA）
```

## 边界情况处理

### 1. 循环别名引用

系统会自动检测循环别名引用，并标记为破坏性变更。

**示例：**
```
A → B → C → A  # 循环引用
```

**处理：
- 使用 DFS 算法检测循环
- 标记所有循环引用的 token 都会被标记为破坏性变更
- 在详情面板中显示循环路径

### 2. 旧组件引用已删除 token

系统会检测组件日志中引用了已删除 token 的情况。

**示例场景：
- tokens-v2 中删除了 `color.text.disabled`
- 组件日志中 Button 组件仍在使用此 token

**处理：**
- 识别引用已删除 token 的组件会被标记为「高影响」
- 在回滚建议中会优先建议恢复被删除的 token
- 显示受影响的组件列表

## API 接口

### POST /api/analyze

分析 token 变更。

**请求体（multipart/form-data）：**
- `tokensV1` - 旧版本 tokens 文件
- `tokensV2` - 新版本 tokens 文件
- `componentLogs` (可选) - 组件使用日志文件
- `rules` (可选) - 对比规则文件

**响应：**
```json
{
  "success": true,
  "data": {
    "changes": [...],
    "componentImpacts": [...],
    "rollbackSuggestions": [...]
  }
}
```

### GET /api/sample

获取示例数据分析结果。

### POST /api/export/json

导出 JSON 格式报告。

### POST /api/export/markdown

导出 Markdown 格式报告。

## 项目结构

```
.
├── data/                    # 示例数据文件
│   ├── tokens-v1.json      # 旧版本 tokens
│   ├── tokens-v2.json      # 新版本 tokens
│   ├── rules.yaml            # 对比规则（YAML）
│   ├── rules.json          # 对比规则（JSON）
│   └── component-logs.json  # 组件使用日志
├── public/
│   └── index.html          # 前端页面
├── server/
│   ├── index.js          # Express 服务入口
│   ├── tokenAnalyzer.js   # Token 解析器
│   └── changeDetector.js  # 变更检测器
├── package.json
└── README.md
```

## 核心模块说明

### TokenAnalyzer (`server/tokenAnalyzer.js`)

负责解析 tokens 扁平化：
- `flattenTokens()` - 将嵌套的 tokens 结构展开为扁平的路径映射
- `buildAliasGraph()` - 构建别名依赖图
- `detectCycles()` - 检测循环别名引用
- `resolveAllAliases()` - 解析所有别名引用
- `convertValue()` - 自动类型转换（颜色、尺寸）
- `calculateContrast()` - 计算颜色对比度

### ChangeDetector (`server/changeDetector.js`)

负责变更检测：
- `detectChanges()` - 检测 token 变更
- `analyzeComponentImpacts()` - 分析组件影响
- `generateRollbackSuggestions()` - 生成回滚建议
- `checkContrastRisks()` - 检测对比度风险

## 许可证

MIT
