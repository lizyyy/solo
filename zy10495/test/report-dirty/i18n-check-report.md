# i18n 占位符检查报告

**检查时间**: 2026/5/17 11:08:38

## 摘要

| 指标 | 数值 |
|------|------|
| 总键数 | 9 |
| 已检查 | 9 |
| 通过 | 4 |
| 错误 | 5 |
| 警告 | 1 |

## 元数据

- **源语言**: en
- **目标语言**: ja
- **处理文件**:
  - `/Users/lzy/pro/solo/workspaces/zy10495/test/locales/en.json`
  - `/Users/lzy/pro/solo/workspaces/zy10495/test/locales/ja.json`

## ❌ 错误详情 (缺失占位符)

### 1. greeting

- **语言**: en → ja
- **文件**: `/Users/lzy/pro/solo/workspaces/zy10495/test/locales/ja.json`
- **行号**: 2
- **源文案**: Hello, {name}!
- **译文案**: こんにちは！
- **缺失占位符**: `{name}`
- **建议修复**: こんにちは{name}！

### 2. welcome

- **语言**: en → ja
- **文件**: `/Users/lzy/pro/solo/workspaces/zy10495/test/locales/ja.json`
- **行号**: 3
- **源文案**: Welcome to {{appName}}
- **译文案**: ようこそ
- **缺失占位符**: `{appName}`
- **建议修复**: ようこそ{appName}

### 3. notification

- **语言**: en → ja
- **文件**: `/Users/lzy/pro/solo/workspaces/zy10495/test/locales/ja.json`
- **行号**: 5
- **源文案**: Your order %orderId% has been shipped
- **译文案**: 注文が発送されました
- **缺失占位符**: `%orderId%`
- **建议修复**: 注文が発送されました %orderId%

### 4. profile

- **语言**: en → ja
- **文件**: `/Users/lzy/pro/solo/workspaces/zy10495/test/locales/ja.json`
- **行号**: 7
- **源文案**: User: {username}, Age: {age}, Email: {email}
- **译文案**: ユーザー：{username}、メール：{email}
- **缺失占位符**: `{age}`
- **建议修复**: ユーザー：{username}、メール：{email}{age}

### 5. nested.title

- **语言**: en → ja
- **文件**: `/Users/lzy/pro/solo/workspaces/zy10495/test/locales/ja.json`
- **行号**: 10
- **源文案**: Nested title with {value}
- **译文案**: ネストされたタイトル
- **缺失占位符**: `{value}`
- **建议修复**: ネストされたタイトル{value}

## ⚠️ 警告详情 (额外占位符)

### 1. nested.description

- **语言**: en → ja
- **文件**: `/Users/lzy/pro/solo/workspaces/zy10495/test/locales/ja.json`
- **行号**: 11
- **源文案**: Nested description with {{var}}
- **译文案**: ネストされた説明には {{var}} と {extra} が含まれます
- **额外占位符**: `{extra}`

