# Service Orchestrator

服务启动顺序编排工具，让你告别人工管理服务依赖的烦恼！

## ✨ 功能特性

- **依赖图分析**：自动构建服务依赖关系图，检测循环依赖
- **拓扑排序**：智能计算正确的服务启动顺序
- **端口检查**：启动前验证端口是否可用
- **健康检查**：支持 HTTP、TCP、命令行三种健康检查方式
- **失败归因**：详细记录失败原因，帮助快速定位问题
- **多种输出格式**：终端彩色摘要、机器可读 JSON、适合分享的 Markdown 报告
- **配置验证**：严格的配置文件校验，保留坏行位置和原始值

## 📦 安装

### 方式一：直接安装

```bash
pip install -e .
```

### 方式二：开发模式

```bash
pip install -e ".[dev]"
```

安装完成后即可使用 `service-orchestrator` 命令。

## 🚀 快速开始

### 1. 生成示例配置

```bash
service-orchestrator example
```

这会在当前目录生成 `service-orchestrator-example.yaml` 文件。

### 2. 验证配置

```bash
service-orchestrator validate service-orchestrator-example.yaml
```

### 3. 查看启动计划

```bash
service-orchestrator plan service-orchestrator-example.yaml
```

加上 `--graph` 选项可以输出依赖关系图（DOT 格式）：

```bash
service-orchestrator plan service-orchestrator-example.yaml --graph --output deps.dot
```

### 4. 运行服务编排

```bash
service-orchestrator run service-orchestrator-example.yaml --output ./reports
```

## 📝 配置文件结构

### 完整示例

```yaml
services:
  - name: mysql                    # 服务名称（必填）
    port: 3306                     # 端口号（可选）
    dependencies: []               # 依赖的服务列表
    start_command: "docker run mysql"  # 启动命令（必填）
    stop_command: "docker stop mysql"  # 停止命令（可选）
    wait_before_start: 0           # 启动前等待秒数
    wait_after_start: 5            # 启动后等待秒数（再执行健康检查）
    
    health_check:                  # 健康检查配置
      type: tcp                    # 类型: http | tcp | command | none
      port: 3306                   # TCP 检查端口
      timeout: 5                   # 超时时间（秒）
      interval: 2                  # 重试间隔（秒）
      max_retries: 30              # 最大重试次数
    
    env:                           # 环境变量
      MYSQL_ROOT_PASSWORD: "secret"
    working_dir: "."               # 工作目录

  - name: api-gateway
    port: 8080
    dependencies:
      - mysql
      - redis
    start_command: "npm start"
    health_check:
      type: http
      endpoint: "http://localhost:8080/health"
      expected_status: 200
```

### 健康检查类型

| 类型 | 说明 | 必填字段 |
|------|------|----------|
| `http` | HTTP GET 请求 | `endpoint` |
| `tcp` | TCP 端口连接 | `port` |
| `command` | 执行自定义命令 | `command` |
| `none` | 不做健康检查 | 无 |

## 📊 输出格式

### 终端输出

运行时会显示：
- 验证错误表格（如果有）
- 循环依赖提示（如果有）
- 编排摘要面板
- 启动顺序表
- 每个服务的详细状态

### JSON 报告

```json
{
  "generated_at": "2024-01-15T10:30:00",
  "summary": {
    "total_services": 5,
    "successful": 4,
    "failed": 1,
    "skipped": 0,
    "total_time_seconds": 15.23
  },
  "start_order": ["mysql", "redis", "api-gateway", "web-app", "worker"],
  "results": {
    "mysql": {
      "status": "success",
      "start_order": 1,
      "port_check": { "port": 3306, "is_available": true },
      "health_check": { "success": true, "response_time_seconds": 0.05 }
    }
  },
  "validation_errors": [],
  "circular_dependencies": null
}
```

### Markdown 报告

适合直接发给同事或粘贴到文档中，包含：
- 总览表格
- 验证错误列表
- 循环依赖（如有）
- 启动顺序
- 每个服务的详细信息

## 🎯 命令参考

### `run` - 运行服务编排

```bash
service-orchestrator run <config-file> [OPTIONS]

选项:
  --output, -o PATH     报告输出目录
  --no-terminal         禁用终端输出
  --json / --no-json    是否生成 JSON 报告 (默认: 是)
  --markdown / --no-markdown  是否生成 Markdown 报告 (默认: 是)
```

### `plan` - 查看启动计划

```bash
service-orchestrator plan <config-file> [OPTIONS]

选项:
  --graph, -g           输出 DOT 格式的依赖图
  --output, -o PATH     依赖图保存路径
```

### `validate` - 验证配置

```bash
service-orchestrator validate <config-file>
```

### `example` - 生成示例配置

```bash
service-orchestrator example
```

## ❌ 错误处理

### 验证错误

配置文件解析时会保留：
- 行号（原始位置）
- 字段路径
- 错误信息
- 原始值

### 失败归因

服务启动失败时会记录：
- 端口冲突信息
- 健康检查失败原因
- 命令执行错误输出
- 依赖服务失败信息
- 退出码

## 📋 常见问题

### Q: 如何处理循环依赖？
A: 工具会自动检测并报告循环依赖链，请修正配置后重试。

### Q: 健康检查超时了怎么办？
A: 可以调整 `max_retries` 和 `interval` 参数，或者在启动命令后增加 `wait_after_start` 等待时间。

### Q: 如何跳过某个服务的健康检查？
A: 设置 `health_check.type: "none"`。

### Q: 端口被占用怎么办？
A: 工具会在启动前检查端口，如果端口被占用会直接失败并提示。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
