# Sourcemap 泄漏检查 CLI 工具

一个功能完整的命令行工具，用于扫描前端构建产物中的 sourcemap 泄漏问题。

## 功能特性

- 🔍 **多种扫描目标**: 支持扫描 dist 目录、单个 JS 文件、sourcemap 文件
- 🕵️ **深度检测**: 检测标准注释引用、隐藏引用、内联 sourcemap、URL 引用
- 🌐 **公开路径判断**: 根据配置的公开路径判断 sourcemap 是否可公开访问
- 📋 **例外规则**: 支持 glob 模式的例外规则，可设置过期时间
- ⚠️ **过期提醒**: 自动检测已过期的例外规则
- 📊 **多格式报告**: 终端摘要、机器可读 JSON、Markdown 报告
- 🎯 **精确定位**: 每个问题都能定位到具体文件行号和列号
- 🚦 **稳定退出码**: CI/CD 集成友好的退出码

## 安装

```bash
npm install
npm run build
npm link  # 全局安装 smcheck 命令
```

## 使用方法

### 基本扫描

```bash
# 扫描 dist 目录
smcheck --dist ./dist

# 指定公开路径
smcheck --dist ./dist --public-path https://example.com/assets/

# 扫描单个文件
smcheck --js ./app.js
smcheck --sourcemap ./app.js.map
```

### 选项说明

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--dist <path>` | `-d` | 构建产物目录 | - |
| `--sourcemap <path>` | `-s` | sourcemap 文件或目录 | - |
| `--js <path>` | `-j` | JS 文件或目录 | - |
| `--public-path <path>` | `-p` | 公开访问路径 | `/` |
| `--exceptions <path>` | `-e` | 例外规则 JSON 文件 | - |
| `--output <path>` | `-o` | 报告输出路径前缀 | `./sourcemap-report` |
| `--no-fail-on-leak` | - | 发现泄漏时不返回非零退出码 | - |
| `--verbose` | `-v` | 显示详细输出 | - |
| `--quiet` | `-q` | 静默模式 | - |

### 例外规则

初始化例外规则模板：

```bash
smcheck init -o smcheck-exceptions.json
```

例外规则格式：

```json
{
  "exceptions": [
    {
      "path": "**/vendor*.js",
      "reason": "第三方库文件允许 sourcemap",
      "expiresAt": "2025-12-31",
      "createdAt": "2024-01-01",
      "createdBy": "security-team"
    }
  ]
}
```

字段说明：
- `path`: glob 模式匹配文件路径
- `reason`: 例外原因（必填）
- `expiresAt`: 过期日期（可选，过期后自动失效）
- `createdAt`: 创建日期（必填）
- `createdBy`: 创建人（必填）

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功，未发现问题 |
| 1 | 发现 sourcemap 泄漏 |
| 2 | 参数验证失败 |
| 3 | 扫描过程出错 |
| 4 | 存在已过期的例外规则 |

## 输出示例

### 终端输出

```
🔍 开始扫描 sourcemap 泄漏...

═══════════════════════════════════════════════════════
           SOURCEMAP 泄漏检查报告
═══════════════════════════════════════════════════════
扫描时间: 2026/5/24 20:41:16
扫描耗时: 8ms
扫描文件: 2 / 3
例外排除: 1 个文件

❌ 发现 7 个问题

  问题分级: 5 严重 | 1 高危 | 1 中等

  [严重] 发现 sourcemap 文件: app.js.map
      文件: app.js.map
  ...
```

### 生成的报告

- `sourcemap-report.json`: 完整的机器可读 JSON 报告
- `sourcemap-report.md`: 给团队成员查看的 Markdown 报告

## 检测的问题类型

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| `sourcemap_file` | 严重 | 发现 .map 源文件 |
| `sourcemap_reference` | 高危 | 标准 sourcemap 注释引用 |
| `hidden_sourcemap` | 严重 | 隐藏的 sourcemap 引用 |
| `publicly_accessible` | 严重 | sourcemap 可能公开可访问 |
| `expired_exception` | 中等 | 例外规则已过期 |

## CI/CD 集成示例

### GitHub Actions

```yaml
- name: Check sourcemap leaks
  run: |
    npm run build
    smcheck --dist ./dist --public-path https://example.com/
```

### GitLab CI

```yaml
sourcemap-check:
  script:
    - npm run build
    - smcheck --dist ./dist --fail-on-leak
  allow_failure: false
```

## 项目结构

```
src/
├── cli/
│   ├── index.ts      # CLI 入口
│   └── options.ts    # 参数解析和验证
├── types.ts          # 类型定义
├── utils.ts          # 工具函数
├── parser.ts         # sourcemap 引用解析
├── scanner.ts        # 核心扫描器
├── exceptions.ts     # 例外规则管理
└── reporter.ts       # 报告生成器
```

## License

MIT
