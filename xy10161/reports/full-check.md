# 日志脱敏检查报告

- **生成时间**: 2026-05-09T14:32:21.989Z
- **检查状态**: ❌ 阻断发布
- **扫描目标**: samples/
- **扫描类型**: full-check
- **加载规则数**: 5
- **白名单条目**: 2
- **扫描文件数**: 3

## 检查摘要

| 严重级别 | 数量 |
|---------|------|
| Critical (致命) | 4 |
| High (高危) | 2 |
| Medium (中危) | 2 |
| Low (低危) | 0 |
| 白名单排除 | 2 |
| **总计** | **8** |

## 阻断码

- `BLOCK_IDCARD`
- `BLOCK_TOKEN`
- `BLOCK_PHONE`
- `BLOCK_EMAIL`
- `BLOCK_BANKCARD`

## 发现的问题

### Critical (致命) (3)

**1. 身份证号** (`BLOCK_IDCARD`)
- 匹配内容: `110101199001011234`
- 位置: /Users/mac/pro/solo/workspaces/xy10161/samples/log-sample-1.txt:8:35
- 描述: 18位或15位身份证号

**2. 调试Token** (`BLOCK_TOKEN`)
- 匹配内容: `token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`
- 位置: /Users/mac/pro/solo/workspaces/xy10161/samples/log-sample-1.txt:9:29
- 描述: 常见调试 token 模式

**3. 银行卡号** (`BLOCK_BANKCARD`)
- 匹配内容: `6222021234567890123`
- 位置: /Users/mac/pro/solo/workspaces/xy10161/samples/log-sample-2.txt:6:37
- 描述: 常见银行卡号（以62开头）

### High (高危) (2)

**1. 手机号** (`BLOCK_PHONE`)
- 匹配内容: `13800138000`
- 位置: /Users/mac/pro/solo/workspaces/xy10161/samples/log-sample-1.txt:7:36
- 描述: 中国大陆手机号，11位数字

**2. 手机号** (`BLOCK_PHONE`)
- 匹配内容: `13900139000`
- 位置: /Users/mac/pro/solo/workspaces/xy10161/samples/log-sample-2.txt:8:35
- 描述: 中国大陆手机号，11位数字

### Medium (中危) (1)

**1. 邮箱** (`BLOCK_EMAIL`)
- 匹配内容: `user@example.com`
- 位置: /Users/mac/pro/solo/workspaces/xy10161/samples/log-sample-1.txt:3:35
- 描述: 电子邮箱地址

## 白名单排除的问题

1. **调试Token**: `token: internal-debug-token-12345` - 内部测试 token，生产环境不会暴露
2. **邮箱**: `test@example.com` - 测试用例示例邮箱，安全无害
