# CSV 转 NDJSON 转换报告

**生成时间**: 2026/5/17 03:15:21
**输入文件**: `/Users/lzy/pro/solo/workspaces/zy10456/test-sample.csv`
**输出文件**: `/Users/lzy/pro/solo/workspaces/zy10456/output/test-sample.ndjson`
**坏行文件**: `/Users/lzy/pro/solo/workspaces/zy10456/output/test-sample-bad-rows.csv`

## 📊 转换摘要

| 指标 | 数值 |
|------|------|
| 探测编码 | UTF-8 |
| 总行数 | 5 |
| 成功行数 | 4 |
| 坏行数 | 0 |
| 重复行数 | 1 |
| 成功率 | 80.00% |
| 耗时 | 20ms |
| 状态 | ✅ 成功 |

## 📋 列名映射

| 原始列名 | 归一化列名 |
|----------|------------|
| `订单号` | `order_id` |
| `用户姓名` | `user_name` |
| `下单时间` | `created_at` |
| `支付金额` | `amount` |
| `备注` | `remark` |

## ⚠️ 重复行详情

共检测到 **1** 行重复数据。

### 重复行样本（前10条）

| 行号 | 样本数据 |
|------|----------|
| 4 | `{"order_id":"1001","user_name":"张三","created_at":"2024-01-01","amount":"99.00","remark":"重复订单"}...` |

## 📁 文件位置

- NDJSON 输出:
  `/Users/lzy/pro/solo/workspaces/zy10456/output/test-sample.ndjson`
- 坏行记录 (CSV):
  `/Users/lzy/pro/solo/workspaces/zy10456/output/test-sample-bad-rows.csv`
- 机器可读结果 (JSON):
  `/Users/lzy/pro/solo/workspaces/zy10456/output/reports/test-sample-result.json`

---
*此报告由 csv2ndjson CLI 工具自动生成*