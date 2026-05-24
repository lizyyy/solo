# Log4j 配置链分析报告

**退出码**: `0` - 执行成功

## 配置源

| 类型 | 路径 |
|------|------|
| Log4j 配置 | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j.properties` |

## Root Logger

- **最终级别**: `INFO`
- **来源**: `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j.properties`
- **优先级**: 10

## 包级别解析

### `com.example` → `INFO`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `com.example` | `INFO` | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j.properties` | 优先级 102000 - 来自 配置文件: /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j.properties |

### `org.springframework` → `ERROR`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `org.springframework` | `ERROR` | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j.properties` | 优先级 102000 - 来自 配置文件: /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j.properties |

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
