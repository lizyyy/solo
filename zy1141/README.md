# msctl - 微服务治理命令行工具

`msctl` 是一个用于微服务治理的命令行工具，帮助团队管理服务目录、OpenAPI 文档、调用关系和发布计划。

## 功能特性

- **初始化工作空间**: 创建统一的微服务治理工作空间
- **数据导入**: 导入 services.yaml、OpenAPI 文档、call-edges.jsonl、deploy-plan.yaml、owners.csv 和 policies.yaml
- **Schema 校验**: 校验输入数据的格式和内容正确性，指出具体文件、字段路径
- **深度分析**:
  - 破坏性契约变更识别
  - 未声明调用检测
  - 孤儿接口发现
  - 依赖环检测
  - Owner 缺失检查
  - SLO/限流策略不匹配分析
- **发布计划验证**:
  - 准入结论（通过/拒绝/警告）
  - 阻断问题标识
  - 发布顺序建议
  - 受影响服务分析
  - 回滚影响面评估
- **多格式报告导出**: Markdown、JSON、CSV

## 安装

```bash
# 克隆或下载项目后，在项目根目录执行
go build -o msctl ./cmd/msctl

# 或者直接运行
go run ./cmd/msctl
```

## 快速开始

### 1. 初始化工作空间

```bash
# 在当前目录初始化
msctl init

# 或指定目录和名称
msctl init ./my-workspace -n "My Microservices" -d "我的微服务治理工作空间"
```

这会创建以下目录结构：
```
my-workspace/
├── workspace.yaml      # 工作空间配置
├── data/
│   ├── openapi/        # OpenAPI 文档目录
│   ├── services.yaml   # 服务定义（导入后生成）
│   ├── call-edges.jsonl # 调用关系（导入后生成）
│   ├── owners.csv      # 负责人信息（导入后生成）
│   ├── policies.yaml   # 策略配置（导入后生成）
│   └── deploy-plan.yaml # 发布计划（导入后生成）
└── reports/            # 分析报告输出目录
```

### 2. 准备数据文件

项目提供了两套示例数据：

- **data/seeds/**: 正常的种子数据，可用于演示完整流程
- **data/bad-samples/**: 包含各种问题的坏样例，用于测试校验和分析功能

#### 数据文件格式说明

**services.yaml** - 服务定义：
```yaml
services:
  - name: user-service
    version: 2.1.0
    description: 用户服务
    language: go
    contract_version: 2.1.0
    tags:
      - core
    endpoints:
      - method: POST
        path: /api/v1/users
        summary: 注册新用户
        parameters:
          - name: request
            in: body
            required: true
            schema:
              type: object
              required:
                - username
                - email
              properties:
                username:
                  type: string
                  min_length: 3
```

**call-edges.jsonl** - 服务调用关系（每行一个 JSON）：
```json
{"source_service": "order-service", "target_service": "user-service", "method": "GET", "path": "/api/v1/users/{id}"}
{"source_service": "order-service", "target_service": "product-service", "method": "GET", "path": "/api/v1/products/{id}"}
```

**owners.csv** - 服务负责人：
```csv
service_name,primary,secondary,team,slack_channel,email
user-service,zhang_san,li_si,user-team,#team-user,user@example.com
order-service,wang_wu,zhao_liu,order-team,#team-order,order@example.com
```

**policies.yaml** - SLO 和限流策略：
```yaml
policies:
  - service_name: user-service
    slo:
      availability: 0.999
      latency_p99_ms: 200
      latency_p95_ms: 100
      error_budget: 0.001
    rate_limit:
      max_requests: 10000
      window_seconds: 60
      burst: 5000
```

**deploy-plan.yaml** - 发布计划：
```yaml
title: v2.3.0 版本发布计划
date: 2024-06-15

batches:
  - name: batch-1
    order: 1
    services:
      - payment-service
    delay_minutes: 30
    canary: true
    canary_percent: 10

rollback_plan:
  strategy: automated
  max_retries: 2
```

### 3. 导入数据

```bash
cd ./my-workspace

# 导入所有数据
msctl import \
  --services ../data/seeds/services.yaml \
  --call-edges ../data/seeds/call-edges.jsonl \
  --owners ../data/seeds/owners.csv \
  --policies ../data/seeds/policies.yaml \
  --deploy-plan ../data/seeds/deploy-plan.yaml

# 也可以分开导入
msctl import --services ../data/seeds/services.yaml
msctl import --owners ../data/seeds/owners.csv
```

### 4. 校验数据

```bash
# 校验整个工作空间
msctl validate

# 或校验单个文件
msctl validate services.yaml
msctl validate call-edges.jsonl policies.yaml
```

### 5. 执行分析

```bash
# 执行分析并显示摘要
msctl analyze

# 执行分析并保存结果到工作空间
msctl analyze --save

# 执行分析并导出报告
msctl analyze --format md --output analysis-report.md
msctl analyze --format json --output analysis-report.json
msctl analyze --format csv --output analysis-report.csv
```

**分析内容包括：**

| 检测项 | 说明 | 严重程度 |
|--------|------|----------|
| 破坏性契约变更 | 必需字段新增限制、废弃接口等 | HIGH/MEDIUM |
| 未声明调用 | 调用了服务契约中未定义的端点 | CRITICAL |
| 孤儿接口 | 定义了但从未被调用的端点 | LOW |
| 依赖环 | 服务间形成循环依赖 | CRITICAL |
| Owner 缺失 | 服务没有分配负责人 | MEDIUM/LOW |
| 策略不匹配 | SLO/限流配置无效或引用不存在的服务 | MEDIUM |

### 6. 验证发布计划

```bash
# 执行发布计划分析
msctl plan

# 执行分析并导出报告
msctl plan --format md --output plan-report.md
```

**发布计划分析内容：**

- **准入结论**: 通过/拒绝/警告
- **阻断问题**: 必须解决才能发布的问题
- **发布顺序建议**: 基于依赖关系的最优发布顺序
- **受影响服务**: 按风险等级排序的服务列表
- **回滚影响面**: 回滚顺序和影响评估

### 7. 导出报告

```bash
# 导出所有报告到默认目录
msctl export

# 指定格式和输出目录
msctl export --format md --output ./my-reports
msctl export --format json
msctl export --format csv

# 指定报告类型
msctl export --type analysis  # 仅导出分析报告
msctl export --type plan      # 仅导出计划报告
msctl export --type all       # 导出所有（默认）
```

## 完整工作流示例

### 场景 1: 使用种子数据（正常流程）

```bash
# 1. 初始化
msctl init ./demo-workspace -n "Demo Workspace"
cd ./demo-workspace

# 2. 导入种子数据
msctl import \
  --services ../data/seeds/services.yaml \
  --call-edges ../data/seeds/call-edges.jsonl \
  --owners ../data/seeds/owners.csv \
  --policies ../data/seeds/policies.yaml \
  --deploy-plan ../data/seeds/deploy-plan.yaml

# 3. 校验数据
msctl validate

# 4. 执行分析
msctl analyze

# 5. 验证发布计划
msctl plan

# 6. 导出报告
msctl export --format md
```

### 场景 2: 使用坏样例测试问题检测

```bash
# 1. 初始化
msctl init ./bad-demo -n "Bad Demo"
cd ./bad-demo

# 2. 导入坏样例数据
msctl import \
  --services ../data/bad-samples/services.yaml \
  --call-edges ../data/bad-samples/call-edges.jsonl \
  --owners ../data/bad-samples/owners.csv \
  --policies ../data/bad-samples/policies.yaml \
  --deploy-plan ../data/bad-samples/deploy-plan.yaml

# 3. 校验（会发现错误）
msctl validate

# 4. 分析（会发现各种问题）
msctl analyze

# 5. 导出报告查看详情
msctl export --format md --output ./issues
```

## 坏样例包含的问题

| 问题类型 | 位置 | 说明 |
|----------|------|------|
| 破坏性变更 | services.yaml | user-service 的 username 最小长度从 3 增加到 6 |
| 未声明调用 | call-edges.jsonl | 调用了不存在的 nonexistent-service 和端点 |
| 依赖环 | call-edges.jsonl | service-a → service-b → service-c → service-a |
| Owner 缺失 | owners.csv | product-service 没有 primary owner |
| 策略无效 | policies.yaml | availability > 1、负的 rate limit 值 |
| 发布计划错误 | deploy-plan.yaml | 重复的 order、负的 order、无效的 canary_percent |

## 报告格式说明

### Markdown 报告

包含以下章节：
- 摘要（总体状态、服务统计、问题统计）
- 问题详情（按严重程度排序）
- 依赖环详情
- 建议行动
- 发布计划分析（如适用）

### JSON 报告

完整的结构化数据，包含：
```json
{
  "summary": {
    "total_services": 6,
    "total_endpoints": 15,
    "issues_by_severity": {
      "CRITICAL": 0,
      "HIGH": 0,
      "MEDIUM": 0,
      "LOW": 0
    },
    "passed": true
  },
  "issues": [],
  "service_graph": {
    "nodes": [],
    "edges": [],
    "cycles": []
  }
}
```

### CSV 报告

问题列表，包含：
- 类型、问题 ID、严重程度
- 服务、端点
- 消息、证据、建议

## 运行测试

```bash
# 运行所有测试
go test ./...

# 运行特定包的测试
go test ./pkg/utils/... -v
go test ./internal/validator/... -v
go test ./internal/analyzer/... -v
```

## 命令参考

```bash
msctl -h          # 查看帮助
msctl init -h     # 查看 init 命令帮助
msctl import -h   # 查看 import 命令帮助
msctl validate -h # 查看 validate 命令帮助
msctl analyze -h  # 查看 analyze 命令帮助
msctl plan -h     # 查看 plan 命令帮助
msctl export -h   # 查看 export 命令帮助
```

## 项目结构

```
.
├── cmd/
│   └── msctl/           # 主程序入口
├── internal/
│   ├── analyzer/        # 分析引擎
│   ├── commands/        # Cobra 命令定义
│   ├── importer/        # 数据导入器
│   ├── models/          # 数据模型定义
│   ├── plan/            # 发布计划分析器
│   ├── report/          # 报告生成器
│   ├── validator/       # 数据校验器
│   └── workspace/       # 工作空间管理器
├── pkg/
│   └── utils/           # 工具函数
├── data/
│   ├── seeds/           # 正常的种子数据
│   └── bad-samples/     # 包含问题的测试数据
└── go.mod
```

## 常见问题

**Q: 如何添加新的服务？**

更新 services.yaml 文件，添加新的服务定义，然后重新导入：
```bash
msctl import --services ./updated-services.yaml
```

**Q: 如何添加新的调用关系？**

在 call-edges.jsonl 中添加新的行（每行一个 JSON），然后重新导入：
```bash
msctl import --call-edges ./updated-call-edges.jsonl
```

**Q: 分析发现了依赖环怎么办？**

依赖环会导致无法确定安全的发布顺序。建议：
1. 分析环中的服务职责
2. 提取共享模块解耦
3. 使用事件驱动架构
4. 调整服务边界

**Q: 发布计划被拒绝了怎么办？**

查看报告中的阻断问题，逐项解决后重新分析。常见的阻断问题包括：
- 未声明调用
- 依赖环
- CRITICAL 级别的问题
