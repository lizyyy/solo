# Webhook供应商切换双投验证排查CLI

用于验证Webhook从旧地址向新地址迁移过程中的双投情况，确保双投成功率达到要求后再进行切换。

## 功能特性

- **多格式日志解析**: 支持 JSON、CSV、JSONL 格式日志
- **双投窗口匹配**: 可配置时间窗口，匹配新旧地址的相同事件
- **状态机管理**: 完整的切换流程状态追踪
- **失败回退机制**: 成功率不达标时自动建议不切换
- **来源追踪**: 保留每条记录的原始文件和行号，坏行单独记录
- **结果稳定化**: 排序稳定，重复运行结果一致
- **多格式报告输出**: 控制台摘要、JSON、CSV、Excel

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 生成示例数据

```bash
# 生成示例配置文件
python cli.py generate-config my_config.json

# 生成示例日志文件
python cli.py generate-sample-log my_log.jsonl
```

### 2. 单事件类型验证

```bash
python cli.py verify \
  --old-endpoint https://example.com/old/webhook \
  --new-endpoint https://example.com/new/webhook \
  --vendor supplier_a \
  --event-type order_created \
  --log-files my_log.jsonl \
  --window-seconds 300 \
  --min-success-rate 0.95 \
  --required-consecutive 100 \
  --format all
```

### 3. 使用配置文件（支持多供应商/多事件类型）

```bash
python cli.py verify-with-config \
  --config my_config.json \
  --log-files my_log.jsonl \
  --format all
```

## 核心规则说明

### 双投验证通过条件
事件必须同时满足以下所有条件才算验证通过（VERIFIED）：

1. **双投窗口
   - 配置: `window_seconds`
   - 说明: 同一 event_id 在新旧地址的到达时间差在此窗口内

2. **状态码校验
   - 配置: `success_status_codes` (默认: [200, 201, 202, 204])
   - 说明: 新地址返回的 HTTP 状态码必须在成功列表中
   - 配置: `check_old_endpoint` (默认: True)
   - 说明: 是否同时校验旧地址的状态码

3. **Payload 一致性校验
   - 配置: `require_payload_match` (默认: True)
   - 说明: 新旧地址的 payload_hash 必须一致

### 成功率要求
- 配置: `min_success_rate`
- 说明: VERIFIED 事件数 / 总事件数 需达到此比例

### 连续成功要求
- 配置: `required_consecutive`
- 说明: 要求达到的连续 VERIFIED 事件数

### 事件状态说明
| 状态 | 说明 |
|------|------|
| VERIFIED | 验证通过（全部校验都通过 |
| DUAL_DELIVERED | 双投到达但未通过校验（状态码或 payload 失败 |
| MISSING_NEW | 只有旧地址收到事件 |
| MISSING_OLD | 只有新地址收到事件 |
| FAILED | 其他失败情况 |

### 状态流转

```
INIT → DUAL_DELIVERY → VERIFYING → READY_TO_SWITCH → SWITCHED
                          ↓
                      ROLLBACK（失败回退）
```

## 报告说明

生成的报告位于 `reports/` 目录：

| 文件 | 说明 |
|------|------|
| `verification_report.json` | 完整 JSON 报告，含所有细节 |
| `verification_conclusions.csv` | 各事件类型结论汇总 |
| `verification_dual_delivery_results.csv` | 双投事件明细 |
| `verification_bad_lines.csv` | 解析失败的坏行记录 |
| `verification_report.xlsx` | Excel 汇总报告 |

## 项目结构

```
.
├── cli.py                    # CLI 入口
├── requirements.txt          # 依赖配置
├── webhook_verifier/
│   ├── __init__.py
│   ├── models.py             # 数据模型定义
│   ├── parser.py             # 日志解析模块
│   ├── rules.py              # 核心规则引擎
│   ├── tracker.py            # 来源追踪和结果稳定
│   └── reporter.py           # 报告生成
└── README.md
```

## 坏行处理

- 解析失败的行不会丢弃，会被记录在 `bad_lines` 中
- 每条坏行保留: 源文件路径、行号、原始内容、错误信息
- 坏行不会参与后续计算，但在报告中明确列出
