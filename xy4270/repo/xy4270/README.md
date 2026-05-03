# 提示词路由压测台 (Prompt Router Stress Tester)

本地可运行的 LLM 路由策略压测工具，帮助团队在灰度接入多个 LLM 服务商时验证路由策略的正确性。

## 核心功能

- **导入配置**：支持 JSONL 测试用例、YAML 模型价格/限额配置、路由策略
- **模拟机制**：完整模拟重试、熔断、降级、预算扣减、敏感标签拦截
- **结果存储**：保存每轮运行结果，支持历史追溯
- **策略比较**：对比两版策略的成本、延迟、失败率和命中原因
- **多格式导出**：支持 Markdown/CSV/JSON 报告

## 项目结构

```
prompt_router/
├── core/                    # 核心模块
│   ├── models.py           # 数据模型定义
│   ├── strategy_engine.py  # 策略引擎（路由决策）
│   └── simulator.py        # 模拟器（调用模拟）
├── storage/                 # 存储模块
│   └── store.py            # 结果保存与加载
├── analysis/                # 分析模块
│   └── comparator.py       # 比较分析
├── export/                  # 导出模块
│   └── exporters.py        # Markdown/CSV/JSON 导出
├── cli/                     # CLI 接口
│   └── main.py             # 命令行入口
└── api/                     # API 接口（预留）

examples/                    # 示例数据
├── test_cases.jsonl        # 测试用例
├── models.yaml             # 模型配置
├── policy_v1.yaml          # 策略版本1
└── policy_v2.yaml          # 策略版本2
```

## 快速开始

### 1. 安装

```bash
# 安装依赖
pip install -r requirements.txt

# 或安装为可执行包
pip install -e .
```

### 2. 运行压测

#### 基本命令

```bash
# 使用示例数据运行压测
python -m prompt_router.cli.main run \
    --test-cases examples/test_cases.jsonl \
    --models-config examples/models.yaml \
    --routing-policy examples/policy_v1.yaml \
    --save \
    --export
```

#### 常用参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--test-cases` | 测试用例 JSONL 文件路径（必需） | - |
| `--models-config` | 模型配置 YAML 文件路径（必需） | - |
| `--routing-policy` | 路由策略 YAML 文件路径（必需） | - |
| `--save` | 保存运行结果到磁盘 | False |
| `--export` | 导出报告 | False |
| `--format` | 导出格式（md,csv,json） | md,csv,json |
| `--deterministic` | 确定性模式（固定随机种子） | False |
| `--seed` | 随机种子 | 42 |

#### 模拟参数调整

```bash
# 自定义模拟参数
python -m prompt_router.cli.main run \
    --test-cases examples/test_cases.jsonl \
    --models-config examples/models.yaml \
    --routing-policy examples/policy_v1.yaml \
    --base-latency 800 \
    --failure-rate 0.1 \
    --timeout-rate 0.05 \
    --rate-limit-rate 0.03 \
    --save
```

### 3. 列出历史运行

```bash
# 查看所有运行记录
python -m prompt_router.cli.main list
```

输出示例：
```
============================================================
提示词路由压测台 - 运行记录列表
============================================================

  共 2 条运行记录:

  Run ID       策略                 用例数   成功率     成本      
  ----------------------------------------------------------------------
  abc123       conservative_route   15       80.00%   $0.0045
  def456       aggressive_route     15       93.33%   $0.0052
```

### 4. 比较两次运行

```bash
# 比较两次运行（使用 Run ID）
python -m prompt_router.cli.main compare \
    --run-a abc123 \
    --run-b def456 \
    --export
```

## 配置文件说明

### 1. 测试用例 (test_cases.jsonl)

每行一个 JSON 对象：

```json
{
  "id": "tc_001",
  "prompt": "用户提示词内容",
  "system_prompt": "系统提示词（可选）",
  "expected_output": "期望输出（可选）",
  "sensitive_tags": ["confidential", "restricted"],
  "metadata": {
    "force_timeout": false,
    "force_rate_limit": false,
    "force_failure": false
  },
  "priority": 1
}
```

#### 特殊测试用例

测试用例的 `metadata` 字段可以强制触发特定行为：

| 字段 | 说明 |
|------|------|
| `force_timeout: true` | 强制模拟超时 |
| `force_rate_limit: true` | 强制模拟限流 |
| `force_failure: true` | 强制模拟调用失败 |

### 2. 模型配置 (models.yaml)

```yaml
models:
  openai.gpt-4o:
    provider: openai
    model_name: gpt-4o
    tier: primary           # 层级：primary/secondary/fallback
    enabled: true
    
    # 价格配置（每1000 tokens）
    input_price_per_1k: 0.0050
    output_price_per_1k: 0.0150
    
    # 限流配置
    rpm_limit: 500           # 每分钟请求数限制
    tpm_limit: 200000        # 每分钟 tokens 限制
    
    # 预算配置
    daily_budget: 50.0       # 日预算
    monthly_budget: 1000.0   # 月预算
    
    # 超时与重试
    timeout_ms: 60000
    max_retries: 3
    
    # 熔断器配置
    circuit_breaker_threshold: 5        # 失败阈值
    circuit_breaker_timeout_ms: 60000    # 熔断超时
    
    # 降级模型列表
    degradation_models:
      - openai.gpt-3.5-turbo
      - anthropic.claude-3-haiku
```

#### 模型层级说明

| 层级 | 说明 |
|------|------|
| `primary` | 主模型，优先选择 |
| `secondary` | 次级模型，主模型不可用时备选 |
| `fallback` | 兜底模型，最后防线 |

### 3. 路由策略 (policy_v1.yaml / policy_v2.yaml)

```yaml
name: "conservative_route"    # 策略名称
version: "1.0"                 # 策略版本

# 主模型选择策略
primary_selection_strategy: "round_robin"  # 可选: round_robin, least_load, priority

# 重试配置
retry_enabled: true
retry_on_errors:
  - "timeout"
  - "rate_limited"
  - "failed"
max_retries_override: 2

# 熔断器配置
circuit_breaker_enabled: true

# 预算追踪
budget_tracking_enabled: true
budget_alert_threshold: 0.8    # 预算告警阈值（80%）

# 敏感标签拦截
sensitive_tag_blocking_enabled: true
blocked_sensitive_tags:
  - "confidential"
  - "restricted"
  - "pii"
  - "health"
  - "financial"

# 降级配置
degradation_enabled: true
auto_degrade_on_failure: true
```

#### 策略版本对比示例

| 特性 | policy_v1 (保守) | policy_v2 (激进) |
|------|------------------|------------------|
| 选择策略 | round_robin | least_load |
| 重试次数 | 2 | 3 |
| 重试错误类型 | timeout, rate_limited, failed | timeout, rate_limited |
| 敏感拦截 | 启用 | 禁用 |
| 预算阈值 | 80% | 90% |

## 验证流程

### 流程 1：单策略压测验证

```bash
# 1. 使用确定性模式运行（便于复现结果）
python -m prompt_router.cli.main run \
    --test-cases examples/test_cases.jsonl \
    --models-config examples/models.yaml \
    --routing-policy examples/policy_v1.yaml \
    --deterministic \
    --seed 42 \
    --save \
    --export

# 2. 检查输出报告
# - reports/report_{run_id}.md - Markdown 报告
# - reports/results_{run_id}.csv - 结果 CSV
# - reports/attempts_{run_id}.csv - 尝试详情 CSV
# - reports/summary_{run_id}.json - 摘要 JSON
```

### 流程 2：两策略对比验证

```bash
# 1. 运行策略 v1（保守策略）
python -m prompt_router.cli.main run \
    --test-cases examples/test_cases.jsonl \
    --models-config examples/models.yaml \
    --routing-policy examples/policy_v1.yaml \
    --deterministic \
    --seed 42 \
    --save

# 记录输出的 Run ID，例如: runid_v1

# 2. 运行策略 v2（激进策略），使用相同种子保证可比性
python -m prompt_router.cli.main run \
    --test-cases examples/test_cases.jsonl \
    --models-config examples/models.yaml \
    --routing-policy examples/policy_v2.yaml \
    --deterministic \
    --seed 42 \
    --save

# 记录输出的 Run ID，例如: runid_v2

# 3. 比较两次运行
python -m prompt_router.cli.main compare \
    --run-a runid_v1 \
    --run-b runid_v2 \
    --export
```

### 流程 3：边界场景验证

#### 敏感标签拦截验证

```bash
# 检查测试用例 tc_009 带有敏感标签
# policy_v1 启用了敏感拦截，policy_v2 禁用

# 预期结果：
# - policy_v1: tc_009 会被拦截 (sensitive_blocked)
# - policy_v2: tc_009 会正常路由
```

#### 重试机制验证

```bash
# 测试用例 tc_010、tc_013、tc_015 分别强制触发：
# - tc_010: force_timeout (超时)
# - tc_013: force_rate_limit (限流)
# - tc_015: force_failure (失败)

# policy_v1 会在这三类错误时重试
# policy_v2 只在 timeout 和 rate_limited 时重试

# 预期结果：
# - policy_v1: 三者都会触发重试
# - policy_v2: 只有 tc_010 和 tc_013 会触发重试
```

#### 降级机制验证

```bash
# 多次运行相同用例，观察降级行为
# 当主模型连续失败达到阈值时，会触发降级到次级/兜底模型

# 预期结果：
# - 主模型失败后，会尝试 degradation_models 列表中的模型
# - 最终降级到 fallback 层级的模型
```

## 输出报告说明

### Markdown 报告结构

```markdown
# 运行报告: {run_id}

## 概览
| 指标 | 值 |
|------|-----|
| 总用例数 | N |
| 成功率 | XX% |
| 总成本 | $X.XX |
| 平均延迟 | XXXms |
| ... | ... |

## 模型分布
| 模型 | 次数 | 百分比 |
|------|------|--------|
| ... | ... | ... |

## 状态分布
| 状态 | 次数 | 百分比 |
|------|------|--------|
| ... | ... | ... |

## 命中原因分析
### 成功原因
### 重试情况
### 失败原因
```

### CSV 字段说明

**results_{run_id}.csv** 包含每用例的最终结果：
- `test_case_id`: 测试用例 ID
- `final_model`: 最终路由到的模型
- `final_status`: 最终状态
- `success`: 是否成功
- `total_cost`: 总成本
- `hit_reason`: 命中原因

**attempts_{run_id}.csv** 包含每一次尝试的详情：
- `test_case_id`: 测试用例 ID
- `attempt_number`: 尝试序号
- `model_name`: 尝试的模型
- `status`: 该次尝试的状态
- `error_message`: 错误信息（如有）

## 核心机制详解

### 1. 熔断器 (Circuit Breaker)

三种状态：
- **Closed**: 正常状态，请求正常通过
- **Open**: 熔断状态，请求直接拒绝
- **Half-Open**: 半开状态，尝试恢复

状态转换：
```
失败累计达到阈值
    Closed ──────────────────→ Open
       ↑                           │
       │    超时后允许部分请求      │
       │    ┌─────────────────────┘
       │    ↓
       └─ Half-Open
            成功3次恢复，失败1次回到Open
```

### 2. 重试机制 (Retry)

重试触发条件：
1. 错误类型在 `retry_on_errors` 列表中
2. 当前尝试次数未超过 `max_retries_override`

重试流程：
```
请求失败
    │
    ├─ 检查是否应该重试
    │       ├─ 是 → 同一模型重试（最多N次）
    │       └─ 否 → 尝试降级模型
    │
    └─ 所有模型都失败 → 最终失败
```

### 3. 降级机制 (Degradation)

降级优先级：
1. 首先尝试当前模型的 `degradation_models` 列表
2. 然后尝试 `secondary` 层级的其他模型
3. 最后尝试 `fallback` 层级的模型

### 4. 预算追踪 (Budget Tracking)

预算类型：
- **日预算**: 每日重置
- **月预算**: 每月重置

预算检查点：
- 路由前检查：是否还有预算
- 调用后扣减：实际消费金额

### 5. 敏感标签拦截 (Sensitive Tag Blocking)

拦截流程：
1. 检查测试用例的 `sensitive_tags`
2. 与策略的 `blocked_sensitive_tags` 比对
3. 存在交集则直接拦截，不进行路由

## 扩展开发

### 添加新的模型选择策略

在 `prompt_router/core/strategy_engine.py` 中：

1. 继承 `SelectionStrategy` 基类
2. 实现 `select` 方法
3. 在 `StrategyEngine` 中注册

```python
class MyCustomStrategy(SelectionStrategy):
    def select(self, models: List[ModelConfig], context: Dict[str, Any]) -> Optional[ModelConfig]:
        # 自定义选择逻辑
        pass

# 在 StrategyEngine 中注册
self._selection_strategies["my_strategy"] = MyCustomStrategy()
```

### 添加新的导出格式

在 `prompt_router/export/exporters.py` 中：

1. 继承 `BaseExporter` 基类
2. 实现 `export_*` 方法

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 PR！
