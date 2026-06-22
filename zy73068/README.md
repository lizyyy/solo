# 风机叶片报告复核（blade-review）

> 面向现场调度小宋的命令行工具：导入巡检表 / 补充材料 / 口头说明 → 去重 → 检测口径变更、单点突变、均值掩盖异常、采样断档 → 挂起待确认 → 导出交接结果。
> 同名或近似名称的材料从 v1 改口径到 v2，会记录成同一份材料的前后差异，不会误生成两份新材料。人工备注跨进程持久化保留。

## 1. 安装

需要 Python ≥ 3.8。

```bash
# 开发模式（推荐）
pip install -e .

# 或不安装，直接运行
python3 -m blade_review --help
```

安装成功后会生成命令 `blade-review`。数据库文件默认保存在当前目录的 `./blade_review.db`，也可通过 `BLADE_REVIEW_DB` 或 `--db` 指定。

## 2. 核心能力一览

| 能力 | 说明 |
| --- | --- |
| 去重 | 同一批资料重复导入，正常记录不翻倍，人工备注跨导入/跨进程保留 |
| 口径变更追踪 | 同名 / 近似名称材料内容从 v1 → v2，识别为同一份材料的口径变更，记录旧值 / 新值 / 差异 |
| 单点突变检测 | 基于中位数 + 1.4826·MAD 的稳健 z-score，不被均值掩盖 |
| 均值掩盖异常 | 不同叶片间的均值偏离率 ≥ 50%，即便整体均值正常也会被识别 |
| 采样断档挂起 | 按叶片分组检测采样间隔；超过阈值自动把报告置为 `suspended`，等待现场老师确认 |
| 交接导出 | JSON / 文本两种格式，包含：复核结论、异常点、挂起项、人工备注、改判前后差异、样例位置 |

## 3. 命令速查

```bash
blade-review init                                         # 初始化数据库（首次用）
blade-review import --csv examples/inspection.csv \
  --material supplementary 超声检测报告 examples/supplementary_v1.txt \
  --verbal 现场口头说明 "B002 下午巡检发现轻微异响，待补充检测" \
  --operator 小宋
# 首次导入后会输出报告ID，比如 542199d6ece8

blade-review list                                         # 列出所有报告
blade-review show --report <报告ID>                       # 查看报告细节
blade-review handover --report <报告ID>                   # 打印交接班摘要
blade-review export --report <报告ID> --out handover.json # 导出 JSON
blade-review export --report <报告ID> --out handover.txt --format text
blade-review resolve --report <报告ID> --suspension <挂起ID> \
  --by 现场老师 --note "已确认断档不影响结论"               # 挂起确认
```

### 导入支持的输入

| 参数 | 说明 |
| --- | --- |
| `--blade-id B001` | 指定叶片编号（可重复传多次） |
| `--csv path/to.csv` | 巡检表 CSV，列：`blade_id,timestamp,metric,value,manual_note`（也支持 `指标`/`值`/`备注` 等中文名） |
| `--material TYPE NAME FILE` | 文件类材料：`TYPE` ∈ `inspection_form` / `supplementary` / `verbal_note` |
| `--verbal NAME TEXT` | 临时口头说明（直接给文字） |
| `--operator 小宋` | 操作人，会写入审计日志 |
| `--report-id <ID>` | 合并到已有报告（推荐用于重复导入 / 口径变更导入） |
| `--gap-hours 24` | 采样断档阈值（小时），默认 24 |

## 4. 完整验收样例（README 可直接跑）

项目内置完整样例，可一条命令跑通所有验收点：

```bash
python3 examples/run_sample.py
# 或
python3 -m blade_review demo
```

脚本会输出 `ALL PASSED`，同时在 `examples/_demo/` 下生成：
- `demo.db`：SQLite 数据库（跨进程保存的报告 / 记录 / 材料 / 挂起 / 改判）
- `handover.json`：JSON 交接结果
- `handover.txt`：文本交接结果

### 4.1 手动走一遍（等价脚本）

```bash
# 0) 清理并初始化
rm -f demo.db
python3 -m blade_review --db demo.db init

# 1) 首次导入：巡检表 + 补充材料 v1 + 口头说明
python3 -m blade_review --db demo.db import \
  --title "风机叶片报告复核-演示" \
  --csv examples/inspection.csv \
  --material supplementary 超声检测报告 examples/supplementary_v1.txt \
  --verbal 现场口头说明 "B002 下午巡检发现轻微异响，待补充检测" \
  --operator 小宋
# 记录一下输出的报告ID，示例：REPORT_ID=542199d6ece8
REPORT_ID=542199d6ece8   # 请替换为真实输出

# 2) 重复导入同一批资料 —— 验证：正常记录不翻倍，人工备注保留
python3 -m blade_review --db demo.db import \
  --report-id $REPORT_ID \
  --csv examples/inspection.csv \
  --operator 小宋
# 预期：记录：新增 0, 跳过(重复) 20, 人工备注保留 ...

# 3) 导入同名材料 v2 —— 验证：口径变更，不生成新材料
python3 -m blade_review --db demo.db import \
  --report-id $REPORT_ID \
  --material supplementary 超声检测报告 examples/supplementary_v2.txt \
  --operator 小宋
# 预期：材料：新增 0, 更新(口径/改名) 1

# 4) 查看报告 —— 验证：采样断档已挂起，状态=suspended
python3 -m blade_review --db demo.db show --report $REPORT_ID

# 5) 交接班摘要
python3 -m blade_review --db demo.db handover --report $REPORT_ID

# 6) 导出 JSON 和文本
python3 -m blade_review --db demo.db export --report $REPORT_ID \
  --out handover.json
python3 -m blade_review --db demo.db export --report $REPORT_ID \
  --out handover.txt --format text

# 7) 现场老师确认后解决挂起 —— 状态回到 in_review
# 先从 show 输出里复制挂起ID
SUSP_ID=a8312ee2b1ac
python3 -m blade_review --db demo.db resolve \
  --report $REPORT_ID \
  --suspension $SUSP_ID \
  --by 现场老师 \
  --note "已确认断档不影响结论"
python3 -m blade_review --db demo.db show --report $REPORT_ID
# 预期：状态: in_review
```

## 5. 交接结果文件长什么样？

### JSON 字段

```jsonc
{
  "report_id": "542199d6ece8",
  "title": "风机叶片报告复核-演示",
  "status": "suspended",
  "operator": "小宋",
  "sample_location": { "blade_ids": ["B001","B002"], "record_count": 20, "material_count": 2 },
  "conclusion": "发现 N 项严重异常，需现场确认",
  "is_stable": false,
  "anomalies": [
    {
      "kind": "single_point_spike",
      "blade_id": "B001", "metric_name": "vibration",
      "timestamp": "2026-06-12T08:00:00",
      "value": 5.5,
      "explanation": "单点突变：值 5.5 偏离中位数 1.100 (稳健z=59.36)，被序列均值掩盖",
      "severity": "major"
    },
    {
      "kind": "mean_masked_anomaly",
      "blade_id": "B002", "metric_name": "vibration",
      "value": 3.105,
      "explanation": "局部异常被均值掩盖：B002 均值 3.105 偏离整体均值 1.958 (59%)，最差点位值 4.9；整体均值看似正常",
      "severity": "major"
    },
    {
      "kind": "sampling_gap",
      "blade_id": "B001", "metric_name": "vibration",
      "timestamp": "2026-06-14T08:00:00",
      "value": 1.1,
      "explanation": "采样断档 48.0h (2026-06-12T08:00:00 -> 2026-06-14T08:00:00)，均值无法补全，结论须挂起待现场确认",
      "severity": "major"
    }
  ],
  "suspensions": [
    { "suspension_id": "...", "reason": "sampling_gatch_major", "resolved": false }
  ],
  "manual_notes": [
    { "record_id": "...", "blade_id": "B001", "metric_name": "vibration",
      "timestamp": "2026-06-12T08:00:00", "note": "单点突变，需关注" }
  ],
  "judgment_changes": [
    { "field_name": "content",
      "old_value": "超声检测报告 v1：...",
      "new_value": "超声检测报告 v2：...",
      "changed_at": "...", "changed_by": "小宋", "reason": "stance_changed_same_name" }
  ]
}
```

## 6. 接班指引（30 秒入门）

1. **样例在哪？**
   - 数据：`examples/inspection.csv`、`examples/supplementary_v1.txt`、`examples/supplementary_v2.txt`
   - 一键演示：`python3 examples/run_sample.py`，结果落在 `examples/_demo/`

2. **异常在哪？**
   - `blade-review handover --report <ID>` 里列出全部异常：单点突变 / 均值掩盖 / 采样断档 / 材料口径变更 / 材料改名 / 未解决挂起
   - 更详细可看导出的 JSON（`anomalies` 字段）

3. **结果怎么导出？**
   - JSON：`blade-review export --report <ID> --out report.json`
   - 文本：`blade-review export --report <ID> --out report.txt --format text`
   - 两份导出都包含：复核结论、异常点、挂起项、人工备注、改判前后差异、样例位置

## 7. 项目结构

```
blade_review/
├── __init__.py
├── __main__.py          # python -m blade_review 入口
├── cli.py               # 命令行参数与子命令
├── service.py           # 业务服务层：导入/导出/交接接 SQLite
├── storage.py           # SQLite 持久化（save_report / load_report / list）
├── exporter.py          # JSON / 文本导出
├── handover.py          # 交接班摘要
├── anomaly.py           # 单点突变 / 均值掩盖 / 断档异常检测
├── gap_detector.py      # 采样断档检测与挂起
├── dedup.py             # 去重：报告 / 记录 / 同名材料口径变更
├── importer.py          # 报告导入合并：去重、保留备注、追踪版本
├── version_tracker.py   # 材料版本/改判差异快照
├── audit.py             # 审计日志与改判追踪
└── models.py            # 数据模型

tests/                   # pytest 单元测试
examples/
├── inspection.csv       # 样例巡检表（含单点突变、均值掩盖、采样断档、人工备注）
├── supplementary_v1.txt # 样例补充材料 v1
├── supplementary_v2.txt # 样例补充材料 v2（改口径）
└── run_sample.py        # 一键跑通 README 验收流
```

## 8. 运行测试

```bash
python3 -m pytest tests/ -q
```
