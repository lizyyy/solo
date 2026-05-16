# 日志脱敏回归测试报告

## 📊 执行摘要

| 指标 | 数值 |
|------|------|
| 扫描时间 | 2026-05-17T02:35:23.199404 |
| 日志目录 | `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty` |
| 规则文件 | `/Users/lzy/pro/solo/workspaces/zy10450/rules.json` |
| 扫描文件数 | 1 |
| 总行数 | 14 |
| 脱敏行数 | 8 |
| 失败行数 | 0 |
| 风险行数 | 11 |
| 应用规则数 | 6 |
| 成功率 | 100.0% |

## 📁 文件扫描结果

### 📄 bad.log

- **路径**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **总行数**: 14
- **脱敏行数**: 8
- **失败行数**: 0
- **风险行数**: 11

## ⚠️ 风险词检测结果

### 风险样本 #1

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 1
- **检测到的风险词**: 手机号
- **脱敏后内容**:
```
2024-01-15 10:00:01 INFO 用户登录成功，用户：***，手机号：138****0000，IP：***.***.***.***
```

### 风险样本 #2

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 2
- **检测到的风险词**: 身份证
- **脱敏后内容**:
```
2024-01-15 10:00:02 INFO 会员注册成功，姓名：***，邮箱：u***@example.com，身份证号：110101138****00004
```

### 风险样本 #3

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 3
- **检测到的风险词**: 银行卡
- **脱敏后内容**:
```
2024-01-15 10:00:03 INFO 订单支付完成，客户：***，银行卡号：110***********00003
```

### 风险样本 #4

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 4
- **检测到的风险词**: 密码, password
- **脱敏后内容**:
```
2024-01-15 10:00:04 DEBUG 系统正常运行，password=123456 这里有密码！
```

### 风险样本 #5

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 5
- **检测到的风险词**: token
- **脱敏后内容**:
```
2024-01-15 10:00:05 INFO 用户：*** 发起查询，token=abc123def456，IP：***.***.***.***
```

### 风险样本 #6

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 6
- **检测到的风险词**: 手机号
- **脱敏后内容**:
```
2024-01-15 10:00:06 WARNING 操作超时，手机号：138****0000，重试中
```

### 风险样本 #7

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 7
- **检测到的风险词**: 身份证
- **脱敏后内容**:
```
2024-01-15 10:00:07 INFO 这里的身份证号 110101138****00008 没有被正确匹配
```

### 风险样本 #8

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 8
- **检测到的风险词**: secret, 敏感
- **脱敏后内容**:
```
2024-01-15 10:00:08 INFO secret_key=my_secret_123 敏感信息泄露
```

### 风险样本 #9

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 9
- **检测到的风险词**: 密码, password
- **脱敏后内容**:
```
2024-01-15 10:00:09 ERROR 数据库连接失败，用户密码：password123
```

### 风险样本 #10

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 13
- **检测到的风险词**: 机密
- **脱敏后内容**:
```
2024-01-15 10:00:13 INFO 机密数据：这是机密内容，不应该出现
```

### 风险样本 #11

- **文件**: `/Users/lzy/pro/solo/workspaces/zy10450/test_logs/dirty/bad.log`
- **行号**: 14
- **检测到的风险词**: 手机号
- **脱敏后内容**:
```
2024-01-15 10:00:14 INFO 手机号 138****0000 也需要脱敏
```

## 🛠️ 使用说明

本报告由日志脱敏回归测试工具自动生成。
- **JSON 结果**: 包含完整的逐行检测数据，用于自动化分析
- **失败样本**: 所有处理失败的行及其文件位置
- **风险样本**: 脱敏后仍包含风险词的行，可能需要调整脱敏规则

