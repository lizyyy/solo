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

### `com.example` → `INFO`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `com.example` | `INFO` | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml` | 优先级 102000 - 来自 配置文件: /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml |

### `com.example.service` → `DEBUG`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `com.example.service` | `DEBUG` | `LOG4J_LOGGER_COM_EXAMPLE_SERVICE` | 优先级 303000 - 来自 系统环境变量: LOG4J_LOGGER_COM_EXAMPLE_SERVICE |
| `com.example.service` | `WARN` | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml` | 优先级 103000 - 来自 配置文件: /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml |
| `com.example` | `INFO` | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml` | 优先级 100200 - 来自 配置文件: /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml |

### `com.example.service.order` → `DEBUG`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `com.example.service` | `DEBUG` | `LOG4J_LOGGER_COM_EXAMPLE_SERVICE` | 优先级 300300 - 来自 系统环境变量: LOG4J_LOGGER_COM_EXAMPLE_SERVICE |
| `com.example.service` | `WARN` | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml` | 优先级 100300 - 来自 配置文件: /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml |
| `com.example` | `INFO` | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml` | 优先级 100200 - 来自 配置文件: /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml |

### `com.example.web.controller` → `INFO`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `com.example` | `INFO` | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml` | 优先级 100200 - 来自 配置文件: /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml |

### `com.example.user.dao` → `DEBUG`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `com.example.*.dao` | `DEBUG` | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml` | 优先级 100360 - 来自 配置文件: /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml |
| `com.example` | `INFO` | `/Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml` | 优先级 100200 - 来自 配置文件: /Users/lzy/pro/solo/workspaces/zy71095/examples/log4j2.xml |

### `org.springframework` → `INFO`

| 规则 | 级别 | 来源 | 原因 |
|------|------|------|------|
| `org.springframework` | `INFO` | `LOG4J_LOGGER_ORG_SPRINGFRAMEWORK` | 优先级 302000 - 来自 系统环境变量: LOG4J_LOGGER_ORG_SPRINGFRAMEWORK |

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
