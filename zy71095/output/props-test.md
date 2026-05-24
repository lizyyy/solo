# Log4j 配置链分析报告

**退出码**: `3` - 配置文件解析错误

## 配置源

| 类型 | 路径 |
|------|------|
| Log4j 配置 | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j.properties` |

## 包级别解析

### `com.example` → `INFO`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|

### `org.springframework` → `INFO`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|

## ❌ 错误

- Properties 文件解析错误 /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j.properties: File contains no section headers.
file: '<string>', line: 1
'log4j.rootLogger=INFO, Console\n'

## 退出码说明

| 退出码 | 说明 |
|--------|------|
| `0` | 执行成功 |
| `1` | 命令行参数无效 |
| `2` | 配置文件未找到 |
| `3` | 配置文件解析错误 |
| `4` | Include 文件处理错误 |
| `5` | 环境变量处理错误 |
| `6` | 输入数据校验失败 |
| `99` | 未知错误 |
