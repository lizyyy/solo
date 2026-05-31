# 汽车金融GPS解押 - 批次管理与报告工具

本地 CLI 工具，管理 GPS 解押的收款流水、退款申请、审批邮件和手写备注，支持批次导入、重复处理、人工确认和报告导出。

## 快速开始

```bash
cd gps_release

# 1. 初始化数据库
python3 main.py init

# 2. 导入样例数据
python3 main.py import sample_data/batch1.json B2024-03

# 3. 查看记录
python3 main.py list

# 4. 查看详情（需确认的记录会列出原因）
python3 main.py show GPS-GP2024002

# 5. 补材料
python3 main.py supplement sample_data/batch2_supplement.json B2024-03-S1

# 6. 人工确认
python3 main.py confirm GPS-GP2024002 --action confirm --by 老曹

# 7. 批次自动处理（已确认 → 自动完成，字段完整 → 自动完成）
python3 main.py process

# 8. 导出报告
python3 main.py export --format text --output report.txt
python3 main.py export --format csv --output report.csv

# 9. 差异报告
python3 main.py diff B2024-03 B2024-03-S1

# 10. 统计概览
python3 main.py stats

# 重置（删库重来）
python3 main.py reset
```

## 样例数据说明

| 文件 | 内容 |
|------|------|
| `sample_data/batch1.json` | 初始批次：1条顺利记录、1条金额不一致需确认、1条旧口径银企回单截图补录 |
| `sample_data/batch2_supplement.json` | 补材料：补退款审批邮件（修正收款金额）、补旧口径缺失字段 |

**三条样例覆盖的场景：**
- GPS-GP2024001（张伟）：顺利记录，字段完整金额一致 → 自动完成
- GPS-GP2024002（李明）：收款金额与GPS费用不一致，补材料后修正 → 补材料后自动完成
- GPS-GP2024003（王芳）：旧口径银企回单截图补录，缺字段 → 补材料后仍需人工确认 → 确认后完成

## 重复导入处理模式

`--mode` 参数控制重复合同号的处理方式：

| 模式 | 行为 |
|------|------|
| `skip`（默认） | 跳过，不修改已有记录 |
| `update` | 覆盖更新业务字段，保持处理状态不变 |
| `conflict` | 字段有差异时标记为"需人工确认"，无差异则跳过 |

## 补材料导入

`supplement` 命令更新已有记录的字段（覆盖提供的新值），补完后自动检查问题是否解决，全部解决则状态回到"待处理"。

## 状态流转

```
待处理(pending) → 需人工确认(needs_review) → 已确认(confirmed) → 已完成(completed)
                  ↓
                已驳回(rejected)
```

- 字段完整且金额一致 → 自动完成
- 缺字段、金额不一致、旧口径、银企回单截图来源 → 标记需人工确认
- 人工确认后 → process 命令自动完成

## 报告位置

- `report.txt` — 文本报告（`python3 main.py export --format text --output report.txt`）
- `report.csv` — CSV 报告（Excel 可直接打开）
- `diff_report.txt` — 批次差异报告（`python3 main.py diff 批次A 批次B --output diff_report.txt`）

## 数据文件格式

JSON 数组，每条记录字段：

```json
{
  "contract_no": "合同编号（必填，去重依据）",
  "customer_name": "客户姓名（必填）",
  "plate_no": "车牌号",
  "vehicle_model": "车型",
  "gps_fee": 2800.00,
  "payment_ref": "收款流水号",
  "payment_date": "2024-03-01",
  "payment_amount": 2800.00,
  "refund_applied": 0,
  "refund_amount": null,
  "approval_email": "审批邮件摘要",
  "remarks": "备注",
  "receipt_info": "银企回单信息",
  "is_old_format": 0
}
```

## 数据库

默认 `gps_release.db`（SQLite），可用 `--db` 指定路径。所有操作读写同一份数据。
