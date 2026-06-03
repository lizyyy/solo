# 网联通道清分差异

支付平台网联通道清分差异处理工具，支持自检、审计轨迹、CLI 和 API 双模式。

## 快速开始

```bash
# 安装
pip install -e ".[dev]"

# 1. 导入样例数据 + 自检
wlc-diff import sample_data.json

# 2. 补看节假日顺延说明（支付平台产品阿南视角）
wlc-diff holiday WL20260601001 "端午节顺延一天，6月2日到账" --effective-date 2026-06-02 --source "人行公告" --actor anan

# 3. 给负责人看的摘要更新
wlc-diff summary WL20260601001 --note "6月1日批次摘要"

# 4. 查看证据（风控同事追问时用）
wlc-diff evidence t002

# 5. 风控确认 / 驳回
wlc-diff confirm t002 --actor 风控小李
wlc-diff reject t002 "数据有误" --actor 风控小王

# 6. 导出完整报告
wlc-diff export -o report.json
```

## API 模式

```bash
uvicorn wanglian_clearing_diff.api:app --reload
```

主要接口：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/import` | POST | 导入记录 + 自检 |
| `/api/records` | GET | 查询记录 |
| `/api/records/{id}/evidence` | GET | 获取证据摘要 |
| `/api/self-check` | POST | 触发自检 |
| `/api/holiday-note` | POST | 应用节假日顺延说明 |
| `/api/summary` | POST | 摘要更新 |
| `/api/confirm` | POST | 风控确认 |
| `/api/reject` | POST | 风控驳回 |
| `/api/supplement` | POST | 补录 |
| `/api/report` | GET | 完整报告 |
| `/api/reset` | POST | 重置内存数据 |

API 返回统一携带清算批次号和节假日顺延证据摘要，示例：

```json
{
  "clearing_batch_no": "WL20260601001",
  "note": "端午节顺延一天，6月2日到账",
  "effective_date": "2026-06-02",
  "source": "人行公告",
  "evidence_summaries": [...]
}
```

## 自检覆盖

| 规则 | 说明 |
|------|------|
| 重复导入 | 同一批次号+行号出现多次 |
| 金额为0但备注含"已冲正" | 不自动归正常，留待风控复核 |
| 补录后重算 | 补录后金额未变化则告警 |
| 导出一致性 | 导出数据与内存记录逐条比对 |

## 三步工作流

1. **导入** — 首次导入清算批次号数据，自动触发自检
2. **节假日顺延说明** — 支付平台产品阿南补看节假日信息
3. **摘要更新** — 给负责人看的摘要

⚠️ 金额为 0 且备注含"已冲正"的记录在整个流程中始终标记为 `pending_review`，不会自动归入正常，必须由风控同事确认或驳回。

## 审计轨迹

每条记录保留：
- 原始行号（`original_line_no`）
- 人工改动（`manual_edits`，含操作人、原值、新值）
- 当前处理状态（`status`）
- 完整审计日志（`audit_trail`，每步带时间戳）

## 运行测试

```bash
pytest -v
```
