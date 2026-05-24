# Log4j 配置链分析报告

**退出码**: `0` - 执行成功

## 配置源

| 类型 | 路径 |
|------|------|
| Log4j 配置 | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml` |
| 环境文件 | `/Users/lzy/pro/solo/workspaces/zy71095/examples/.env` |

## Root Logger

- **最终级别**: `DEBUG`
- **来源**: `LOG4J_ROOT_LEVEL`
- **优先级**: 30

## 包级别解析

### `com.example` → `DEBUG`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `root` | `DEBUG` | `LOG4J_ROOT_LEVEL` | 使用 root logger 配置作为默认值 |

### `com.example.service` → `DEBUG`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `root` | `DEBUG` | `LOG4J_ROOT_LEVEL` | 使用 root logger 配置作为默认值 |

### `com.example.service.order` → `DEBUG`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `root` | `DEBUG` | `LOG4J_ROOT_LEVEL` | 使用 root logger 配置作为默认值 |

### `com.example.web.controller` → `DEBUG`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `root` | `DEBUG` | `LOG4J_ROOT_LEVEL` | 使用 root logger 配置作为默认值 |

### `com.example.user.dao` → `DEBUG`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `root` | `DEBUG` | `LOG4J_ROOT_LEVEL` | 使用 root logger 配置作为默认值 |

### `org.springframework` → `DEBUG`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `root` | `DEBUG` | `LOG4J_ROOT_LEVEL` | 使用 root logger 配置作为默认值 |

### `org.hibernate` → `DEBUG`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `root` | `DEBUG` | `LOG4J_ROOT_LEVEL` | 使用 root logger 配置作为默认值 |

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
