# 示例项目 - Token Drift Detector

这是一个用于演示 Token Drift Detector 的示例项目。

## 项目结构

```
├── design-tokens/
│   └── tokens.json          # 设计 Token 定义
├── src/
│   ├── App.tsx              # 示例组件（包含故意的硬编码值）
│   └── variables.css        # CSS 变量定义
└── token-drift.config.json  # Token Drift 配置文件
```

## 包含的问题示例

### App.tsx 中的问题
1. **硬编码颜色**: `#ffffff`, `#1f2937`, `#3b82f6`, `#f3f4f6` 等
2. **硬编码间距**: `24px`, `16px`, `12px`, `20px` 等
3. **引用不存在的 Token**: `var(--color-nonexistent)`
4. **部分正确使用**: 使用了 Tailwind 类如 `bg-blue-500`, `text-gray-900`

### Token 定义问题
1. **未使用的 Token**: tokens.json 中定义了但 App.tsx 中未使用的 token
2. **主题不完整**: `dark.text.disabled`, `dark.border.primary` 等未定义

## 运行检测

```bash
# 在示例项目目录中运行
cd <示例项目目录>

# 扫描项目
token-drift scan

# 生成报告
token-drift report
```

## 预期检测到的问题

- 🔴 **严重 (Critical)**: 引用不存在的 Token
- 🟠 **高 (High)**: 硬编码颜色值、主题值不完整
- 🟡 **中 (Medium)**: 硬编码间距值
- 🟢 **低 (Low)**: 未使用的 Token

## 修复建议

1. 将所有硬编码的颜色值替换为 `var(--color-xxx)` 或使用 Design Token
2. 将所有硬编码的间距值替换为 `var(--spacing-xxx)`
3. 检查并修复不存在的 Token 引用
4. 为所有主题补充缺失的 Token 定义
5. 清理或使用未使用的 Token
