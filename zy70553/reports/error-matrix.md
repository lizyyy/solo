# gRPC 错误码矩阵报告

*生成时间: 2026/5/17 12:54:49*

## 摘要

| 指标 | 数值 |
|------|------|
| 总错误码数量 | 17 |
| SDK语言数量 | 3 |
| 可重试(Safe) | 4 |
| 不可重试(Never) | 10 |
| 有争议(Controversial) | 3 |
| 差异数量 | 3 |

## 重试分类

### ✅ 可重试 (Safe Retry)

- DEADLINE_EXCEEDED (4)
- RESOURCE_EXHAUSTED (8)
- ABORTED (10)
- UNAVAILABLE (14)

### ❌ 不可重试 (Never Retry)

- OK (0)
- CANCELLED (1)
- INVALID_ARGUMENT (3)
- NOT_FOUND (5)
- ALREADY_EXISTS (6)
- PERMISSION_DENIED (7)
- OUT_OF_RANGE (11)
- UNIMPLEMENTED (12)
- DATA_LOSS (15)
- UNAUTHENTICATED (16)

### ⚠️ 有争议 (Controversial)

- UNKNOWN (2): go=COND, java=COND, python=RETRY
- FAILED_PRECONDITION (9): go=COND, java=NO_RETRY, python=COND
- INTERNAL (13): go=COND, java=COND, python=RETRY

## 🔀 SDK差异

### UNKNOWN (2) - 重试策略不匹配

- go: code=2, retry=COND
- java: code=2, retry=COND
- python: code=2, retry=RETRY

### FAILED_PRECONDITION (9) - 重试策略不匹配

- go: code=9, retry=COND
- java: code=9, retry=NO_RETRY
- python: code=9, retry=COND

### INTERNAL (13) - 重试策略不匹配

- go: code=13, retry=COND
- java: code=13, retry=COND
- python: code=13, retry=RETRY

## SDK对比

| 错误码 | 名称 | GO | JAVA | PYTHON |
|--------|------|------|------|------|
| 0 | OK | NO_RETRY | NO_RETRY | NO_RETRY |
| 1 | CANCELLED | NO_RETRY | NO_RETRY | NO_RETRY |
| 2 | UNKNOWN | COND | COND | RETRY |
| 3 | INVALID_ARGUMENT | NO_RETRY | NO_RETRY | NO_RETRY |
| 4 | DEADLINE_EXCEEDED | RETRY | RETRY | RETRY |
| 5 | NOT_FOUND | NO_RETRY | NO_RETRY | NO_RETRY |
| 6 | ALREADY_EXISTS | NO_RETRY | NO_RETRY | NO_RETRY |
| 7 | PERMISSION_DENIED | NO_RETRY | NO_RETRY | NO_RETRY |
| 8 | RESOURCE_EXHAUSTED | RETRY | RETRY | RETRY |
| 9 | FAILED_PRECONDITION | COND | NO_RETRY | COND |
| 10 | ABORTED | RETRY | RETRY | RETRY |
| 11 | OUT_OF_RANGE | NO_RETRY | NO_RETRY | NO_RETRY |
| 12 | UNIMPLEMENTED | NO_RETRY | NO_RETRY | NO_RETRY |
| 13 | INTERNAL | COND | COND | RETRY |
| 14 | UNAVAILABLE | RETRY | RETRY | RETRY |
| 15 | DATA_LOSS | NO_RETRY | NO_RETRY | NO_RETRY |
| 16 | UNAUTHENTICATED | NO_RETRY | NO_RETRY | NO_RETRY |
