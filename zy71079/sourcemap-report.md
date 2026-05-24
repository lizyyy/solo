# Sourcemap 泄漏检查报告

## 扫描概览

| 项目 | 数值 |
|------|------|
| 扫描时间 | 2026/5/24 20:41:16 |
| 扫描耗时 | 8ms |
| 总文件数 | 3 |
| 已扫描文件 | 2 |
| 例外排除文件 | 1 |
| 问题总数 | 7 |
| 过期例外规则 | 1 |

## 问题分级统计

- **严重**: 5
- **高危**: 1
- **中等**: 1
- **轻微**: 0

## 问题详情

### 🔴 严重问题

#### 发现 sourcemap 文件

- **文件**: `app.js.map`
- **描述**: 发现 sourcemap 文件: app.js.map
- **建议修复**: 删除 sourcemap 文件或配置构建工具不生成 sourcemap

#### Sourcemap 可能公开可访问

- **文件**: `app.js.map`
- **描述**: Sourcemap 文件公开可访问: https://example.com/assets/app.js.map
- **建议修复**: 从 Web 服务器配置中禁止 .map 文件访问，或删除 sourcemap 文件
- **公开 URL**: `https://example.com/assets/app.js.map`

#### Sourcemap 可能公开可访问

- **文件**: `app.js` (行 5，列 1)
- **描述**: Sourcemap 可能公开可访问: https://example.com/assets/app.js.map
- **建议修复**: 确保 sourcemap 文件不会被公开访问，或从构建产物中移除
- **引用详情**:
  - 类型: comment
  - 值: `app.js.map`
- **公开 URL**: `https://example.com/assets/app.js.map`

#### 发现隐藏的 sourcemap 引用

- **文件**: `app.js` (行 5，列 5)
- **描述**: 发现 隐藏的 sourcemap 引用: "app.js.map"
- **建议修复**: 检查代码中隐藏的 sourcemap 引用，可能在字符串或变量中
- **引用详情**:
  - 类型: hidden
  - 值: `app.js.map`

#### Sourcemap 可能公开可访问

- **文件**: `app.js` (行 5，列 5)
- **描述**: Sourcemap 可能公开可访问: https://example.com/assets/app.js.map
- **建议修复**: 确保 sourcemap 文件不会被公开访问，或从构建产物中移除
- **引用详情**:
  - 类型: hidden
  - 值: `app.js.map`
- **公开 URL**: `https://example.com/assets/app.js.map`

### 🟠 高危问题

#### 发现 sourcemap 引用

- **文件**: `app.js` (行 5，列 1)
- **描述**: 发现 sourcemap 注释引用: "app.js.map"
- **建议修复**: 移除 sourceMappingURL 注释，或确保引用的 sourcemap 不公开
- **引用详情**:
  - 类型: comment
  - 值: `app.js.map`

### 🟡 中等问题

#### 例外规则已过期

- **文件**: `**/old-file.js`
- **描述**: 例外规则已过期: **/old-file.js
- **建议修复**: 更新例外规则的过期时间，或移除该例外并修复问题
- **例外规则**:
  - 路径: **/old-file.js
  - 原因: 已过期的例外
  - 创建人: test-user
  - 创建时间: 2023-01-01
  - 过期时间: 2024-01-01 ❌ 已过期

## 例外规则

### ✅ 生效中的例外规则

| 路径 | 原因 | 创建人 | 创建时间 | 过期时间 |
|------|------|--------|----------|----------|
| `**/chunk.js` | 测试例外规则 | test-user | 2026-01-01 | 2027-12-31 |

### ❌ 已过期的例外规则

| 路径 | 原因 | 创建人 | 创建时间 | 过期时间 |
|------|------|--------|----------|----------|
| `**/old-file.js` | 已过期的例外 | test-user | 2023-01-01 | 2024-01-01 |

## 附录

- 工具版本: 1.0.0
- 扫描命令参数:
  ```json
  {
    "dist": "test-dist",
    "publicPath": "https://example.com/assets/",
    "exceptions": "smcheck-exceptions.json",
    "output": "./sourcemap-report",
    "failOnLeak": true,
    "verbose": false,
    "quiet": false
  }
  ```
