# CSS Token 对比度分析报告

生成时间: 2026/5/24 22:26:10

## 摘要

| 指标 | 数值 |
|------|------|
| 总组合数 | 10 |
| ✅ 通过 | 9 |
| ❌ 失败 | 1 |
| ⚠️ 警告 | 0 |
| 📈 通过率 | 90% |

## WCAG 阈值说明

- **AA (正常文本)**: 4.5:1
- **AA (大文本)**: 3:1
- **AAA (正常文本)**: 7:1
- **AAA (大文本)**: 4.5:1

## ❌ 失败的组合

| 等级 | 对比度 | 前景 Token | 背景 Token | 组件 | 颜色值 |
|------|--------|------------|------------|------|--------|
| FAIL | 3.13:1 | `color.text-white` | `color.success` | Button | `#ffffff` on `#28a745` |

## ✅ 通过的组合

| 等级 | 对比度 | 前景 Token | 背景 Token | 组件 | 颜色值 |
|------|--------|------------|------------|------|--------|
| AA | 5.57:1 | `color.text-white` | `color.primary` | Button | `#ffffff` on `#0066cc` |
| AAA | 14.63:1 | `color.text-primary` | `color.bg-secondary` | Button | `#212529` on `#f8f9fa` |
| AAA | 9.46:1 | `color.text-primary` | `color.warning` | Button | `#212529` on `#ffc107` |
| AA | 4.53:1 | `color.text-white` | `color.danger` | Button | `#ffffff` on `#dc3545` |
| AAA | 15.43:1 | `color.text-primary` | `color.bg-primary` | Card | `#212529` on `#ffffff` |
| AAA | 15.43:1 | `color.text-white` | `color.bg-dark` | Card | `#ffffff` on `#212529` |
| AA | 4.62:1 | `color.primary-dark` | `color.primary-light` | Alert | `#004080` on `#66b3ff` |
| AA | 5.57:1 | `color.text-white` | `color.primary` | Badge | `#ffffff` on `#0066cc` |
| AAA | 15.43:1 | `color.text-white` | `color.bg-dark` | Navbar | `#ffffff` on `#212529` |

## 📝 计算详情

### color.text-white-on-color.primary

- **对比度**: 5.57:1
- **WCAG 等级**: AA
- **阈值**: 4.5:1

#### 前景色
- Token: `color.text-white`
- 原始值: `{color.white}`
- 解析值: `#ffffff`
- HEX: `#ffffff`
- 亮度: 1
- 别名链: `color.text-white` → `color.white`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:89

#### 背景色
- Token: `color.primary`
- 原始值: `#0066cc`
- 解析值: `#0066cc`
- HEX: `#0066cc`
- 亮度: 0.1386
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:4

### color.text-primary-on-color.bg-secondary

- **对比度**: 14.63:1
- **WCAG 等级**: AAA
- **阈值**: 4.5:1

#### 前景色
- Token: `color.text-primary`
- 原始值: `{color.gray-900}`
- 解析值: `#212529`
- HEX: `#212529`
- 亮度: 0.0181
- 别名链: `color.text-primary` → `color.gray-900`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:77

#### 背景色
- Token: `color.bg-secondary`
- 原始值: `{color.gray-100}`
- 解析值: `#f8f9fa`
- HEX: `#f8f9fa`
- 亮度: 0.9461
- 别名链: `color.bg-secondary` → `color.gray-100`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:97

### color.text-white-on-color.success

- **对比度**: 3.13:1
- **WCAG 等级**: FAIL
- **阈值**: 4.5:1

#### 前景色
- Token: `color.text-white`
- 原始值: `{color.white}`
- 解析值: `#ffffff`
- HEX: `#ffffff`
- 亮度: 1
- 别名链: `color.text-white` → `color.white`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:89

#### 背景色
- Token: `color.success`
- 原始值: `#28a745`
- 解析值: `#28a745`
- HEX: `#28a745`
- 亮度: 0.2852
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:21

### color.text-primary-on-color.warning

- **对比度**: 9.46:1
- **WCAG 等级**: AAA
- **阈值**: 4.5:1

#### 前景色
- Token: `color.text-primary`
- 原始值: `{color.gray-900}`
- 解析值: `#212529`
- HEX: `#212529`
- 亮度: 0.0181
- 别名链: `color.text-primary` → `color.gray-900`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:77

#### 背景色
- Token: `color.warning`
- 原始值: `#ffc107`
- 解析值: `#ffc107`
- HEX: `#ffc107`
- 亮度: 0.5942
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:25

### color.text-white-on-color.danger

- **对比度**: 4.53:1
- **WCAG 等级**: AA
- **阈值**: 4.5:1

#### 前景色
- Token: `color.text-white`
- 原始值: `{color.white}`
- 解析值: `#ffffff`
- HEX: `#ffffff`
- 亮度: 1
- 别名链: `color.text-white` → `color.white`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:89

#### 背景色
- Token: `color.danger`
- 原始值: `#dc3545`
- 解析值: `#dc3545`
- HEX: `#dc3545`
- 亮度: 0.1819
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:29

### color.text-primary-on-color.bg-primary

- **对比度**: 15.43:1
- **WCAG 等级**: AAA
- **阈值**: 4.5:1

#### 前景色
- Token: `color.text-primary`
- 原始值: `{color.gray-900}`
- 解析值: `#212529`
- HEX: `#212529`
- 亮度: 0.0181
- 别名链: `color.text-primary` → `color.gray-900`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:77

#### 背景色
- Token: `color.bg-primary`
- 原始值: `{color.white}`
- 解析值: `#ffffff`
- HEX: `#ffffff`
- 亮度: 1
- 别名链: `color.bg-primary` → `color.white`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:93

### color.text-white-on-color.bg-dark

- **对比度**: 15.43:1
- **WCAG 等级**: AAA
- **阈值**: 4.5:1

#### 前景色
- Token: `color.text-white`
- 原始值: `{color.white}`
- 解析值: `#ffffff`
- HEX: `#ffffff`
- 亮度: 1
- 别名链: `color.text-white` → `color.white`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:89

#### 背景色
- Token: `color.bg-dark`
- 原始值: `{color.gray-900}`
- 解析值: `#212529`
- HEX: `#212529`
- 亮度: 0.0181
- 别名链: `color.bg-dark` → `color.gray-900`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:101

### color.primary-dark-on-color.primary-light

- **对比度**: 4.62:1
- **WCAG 等级**: AA
- **阈值**: 4.5:1

#### 前景色
- Token: `color.primary-dark`
- 原始值: `#004080`
- 解析值: `#004080`
- HEX: `#004080`
- 亮度: 0.0523
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:13

#### 背景色
- Token: `color.primary-light`
- 原始值: `#66b3ff`
- 解析值: `#66b3ff`
- HEX: `#66b3ff`
- 亮度: 0.4228
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:9

### color.text-white-on-color.primary

- **对比度**: 5.57:1
- **WCAG 等级**: AA
- **阈值**: 4.5:1

#### 前景色
- Token: `color.text-white`
- 原始值: `{color.white}`
- 解析值: `#ffffff`
- HEX: `#ffffff`
- 亮度: 1
- 别名链: `color.text-white` → `color.white`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:89

#### 背景色
- Token: `color.primary`
- 原始值: `#0066cc`
- 解析值: `#0066cc`
- HEX: `#0066cc`
- 亮度: 0.1386
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:4

### color.text-white-on-color.bg-dark

- **对比度**: 15.43:1
- **WCAG 等级**: AAA
- **阈值**: 4.5:1

#### 前景色
- Token: `color.text-white`
- 原始值: `{color.white}`
- 解析值: `#ffffff`
- HEX: `#ffffff`
- 亮度: 1
- 别名链: `color.text-white` → `color.white`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:89

#### 背景色
- Token: `color.bg-dark`
- 原始值: `{color.gray-900}`
- 解析值: `#212529`
- HEX: `#212529`
- 亮度: 0.0181
- 别名链: `color.bg-dark` → `color.gray-900`
- 位置: /Users/lzy/pro/solo/workspaces/zy71069/examples/tokens.json:101

## 命令参数

```json
{
  "outputDir": "./contrast-report",
  "threshold": 4.5,
  "mode": "both",
  "tokens": "examples/tokens.json",
  "pairs": "examples/component-pairs.json",
  "formats": [
    "terminal",
    "json",
    "markdown"
  ]
}
```
