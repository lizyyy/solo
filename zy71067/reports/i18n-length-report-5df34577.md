# 多语言长度溢出检测报告

生成时间: 2026/5/24 19:48:27
配置哈希: `5df34577`

## 摘要

| 指标 | 数值 |
|------|------|
| 总检测数 | 126 |
| 🔴 严重 | 55 |
| ⚠️ 警告 | 0 |
| ℹ️ 提示 | 2 |
| ✅ 安全 | 69 |
| 溢出问题 | 15 |
| 占位符问题 | 42 |

## 🔴 严重问题

| Key | 语言 | 位置 | 原文 | 宽度 | 限制 | 溢出 | 说明 |
|-----|------|------|------|------|------|------|------|
| sms.verificationCode | en | 登录按钮 | Your verification code is: ... | 68 | 30 | 38 | 严重溢出: 超出限制 126.7% (68/30) |
| sms.verificationCode | ja | 登录按钮 | 認証コード：{code}、5分以内に入力してください | 49 | 25 | 24 | 严重溢出: 超出限制 96.0% (49/25) |
| toast.error | ja | 登录按钮 | 操作に失敗しました、後でもう一度お試しください | 46 | 25 | 21 | 严重溢出: 超出限制 84.0% (46/25) |
| sms.verificationCode | zh-CN | 登录按钮 | 您的验证码是：{code}，请在5分钟内输入 | 41 | 20 | 21 | 严重溢出: 超出限制 105.0% (41/20) |
| sms.verificationCode | en | Toast提示 | Your verification code is: ... | 68 | 50 | 18 | 严重溢出: 超出限制 36.0% (68/50) |
| sms.welcome | zh-CN | 登录按钮 | 尊敬的{username}，欢迎回来！ | 38 | 20 | 18 | 严重溢出: 超出限制 90.0% (38/20) |
| sms.welcome | ja | 登录按钮 | {username}様、おかえりなさい！ | 40 | 25 | 15 | 严重溢出: 超出限制 60.0% (40/25) |
| toast.loading | ja | 登录按钮 | 処理中です、しばらくお待ちください... | 37 | 25 | 12 | 严重溢出: 超出限制 48.0% (37/25) |
| sms.passwordReset | zh-CN | 登录按钮 | 您的密码重置验证码是：{code} | 32 | 20 | 12 | 严重溢出: 超出限制 60.0% (32/20) |
| sms.passwordReset | ja | 登录按钮 | パスワードリセットコード：{code} | 36 | 25 | 11 | 严重溢出: 超出限制 44.0% (36/25) |
| sms.welcome | en | 登录按钮 | Dear {username}, welcome back! | 40 | 30 | 10 | 严重溢出: 超出限制 33.3% (40/30) |
| toast.error | en | 登录按钮 | Operation failed, please tr... | 40 | 30 | 10 | 严重溢出: 超出限制 33.3% (40/30) |
| sms.passwordReset | en | 登录按钮 | Your password reset code is... | 39 | 30 | 9 | 严重溢出: 超出限制 30.0% (39/30) |
| button.login | en | 短信验证码 | Sign In | 7 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.logout | en | 短信验证码 | Sign Out | 8 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.submit | en | 短信验证码 | Submit Form | 11 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.confirm | en | 短信验证码 | Confirm and Continue | 20 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.cancel | en | 短信验证码 | Cancel Operation | 16 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| sms.verificationCode | en | 短信验证码 | Your verification code is: ... | 68 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误; 字符数超出: 68/35 |
| sms.welcome | en | 短信验证码 | Dear {username}, welcome back! | 40 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误; 字符数超出: 40/35 |
| sms.passwordReset | en | 短信验证码 | Your password reset code is... | 39 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误; 字符数超出: 39/35 |
| toast.success | en | 短信验证码 | Operation completed success... | 32 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| toast.error | en | 短信验证码 | Operation failed, please tr... | 40 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误; 字符数超出: 40/35 |
| toast.loading | en | 短信验证码 | Processing, please wait... | 26 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [zero] | en | 短信验证码 | No items | 8 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [one] | en | 短信验证码 | 1 item | 6 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [other] | en | 短信验证码 | {count} items | 16 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.login | ja | 短信验证码 | ログイン | 8 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.logout | ja | 短信验证码 | ログアウト | 10 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.submit | ja | 短信验证码 | フォームを送信 | 14 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.confirm | ja | 短信验证码 | 確認して続行 | 12 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.cancel | ja | 短信验证码 | キャンセル | 10 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| sms.verificationCode | ja | 短信验证码 | 認証コード：{code}、5分以内に入力してください | 49 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| sms.welcome | ja | 短信验证码 | {username}様、おかえりなさい！ | 40 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| sms.passwordReset | ja | 短信验证码 | パスワードリセットコード：{code} | 36 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| toast.success | ja | 短信验证码 | 操作が正常に完了しました | 24 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| toast.error | ja | 短信验证码 | 操作に失敗しました、後でもう一度お試しください | 46 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| toast.loading | ja | 短信验证码 | 処理中です、しばらくお待ちください... | 37 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [zero] | ja | 短信验证码 | アイテムなし | 12 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [one] | ja | 短信验证码 | 1 アイテム | 10 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [other] | ja | 短信验证码 | {count} アイテム | 19 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.login | zh-CN | 短信验证码 | 登录 | 4 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.logout | zh-CN | 短信验证码 | 退出登录 | 8 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.submit | zh-CN | 短信验证码 | 提交表单 | 8 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.confirm | zh-CN | 短信验证码 | 确认并继续 | 10 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| button.cancel | zh-CN | 短信验证码 | 取消操作 | 8 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| sms.verificationCode | zh-CN | 短信验证码 | 您的验证码是：{code}，请在5分钟内输入 | 41 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| sms.welcome | zh-CN | 短信验证码 | 尊敬的{username}，欢迎回来！ | 38 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| sms.passwordReset | zh-CN | 短信验证码 | 您的密码重置验证码是：{code} | 32 | 70 | 0 | 缺失 1 个占位符，可能导致运行时错误 |
| toast.success | zh-CN | 短信验证码 | 操作成功完成 | 12 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| toast.error | zh-CN | 短信验证码 | 操作失败，请稍后重试 | 20 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| toast.loading | zh-CN | 短信验证码 | 正在处理中，请稍候... | 21 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [zero] | zh-CN | 短信验证码 | 没有项目 | 8 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [one] | zh-CN | 短信验证码 | 1 个项目 | 8 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |
| plural.itemCount [other] | zh-CN | 短信验证码 | {count} 个项目 | 17 | 70 | 0 | 缺失 2 个占位符，可能导致运行时错误 |

## ℹ️ 提示信息

| Key | 语言 | 位置 | 原文 | 宽度 | 限制 | 溢出 | 说明 |
|-----|------|------|------|------|------|------|------|
| toast.success | en | 登录按钮 | Operation completed success... | 32 | 30 | 2 | 轻微溢出: 超出限制 6.7% |
| toast.loading | zh-CN | 登录按钮 | 正在处理中，请稍候... | 21 | 20 | 1 | 轻微溢出: 超出限制 5.0% |

## 配置信息

### 输入文件

- `/Users/lzy/pro/solo/workspaces/zy71067/examples/locales/en.json`
- `/Users/lzy/pro/solo/workspaces/zy71067/examples/locales/ja.json`
- `/Users/lzy/pro/solo/workspaces/zy71067/examples/locales/zh-CN.json`

### 检测配置

- **登录按钮** (zh-CN):
  - 最大宽度: 20 单位
- **登录按钮** (en):
  - 最大宽度: 30 单位
- **登录按钮** (ja):
  - 最大宽度: 25 单位
- **短信验证码** (*):
  - 最大宽度: 70 单位
  - 最大字符数: 35
  - 预期占位符: {code}, {username}
- **Toast提示** (*):
  - 最大宽度: 50 单位
