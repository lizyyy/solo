# 曲线拟合图表解释器（Curve Fit Interpreter）

> 给数学老师老叶和接手人的操作说明。目标：月底这批“曲线拟合图表解释”不再靠学生草稿手工核，**同一题不再被两个版本答案互相覆盖**。
> 算不出的记录不会消失，会说明卡在 **公式 / 单位 / 阈值** 哪一关；单位缺失时宁可挂起让项目经理确认，也不给假稳定结论。

纯 Python 3 标准库实现，**零外部依赖**。macOS 自带 `python3` 直接能跑，不用 `pip install` 任何东西。

---

## 一、先跑哪条命令（按顺序）

```bash
cd /Users/maca/pro/solo/workspaces/zy73168

# 1) 跑一遍整批材料，生成“接口返回”
python3 run.py run --batch samples/batch_2026_06

# 2) 想看某一道题的完整明细 + 中间计算（项目经理对照两组参数用这个）
python3 run.py rerun --question Q-2026-001

# 3) 跑测试，确认没改坏
python3 -m unittest tests.test_interpreter -v
```

**老叶第一条命令只跑第 1 条即可**。跑完看下面的“接口返回在哪看”。

---

## 二、再看哪份接口返回（按顺序）

跑完第 1 条命令后，产物全部落在 `output/`：

| 看什么 | 文件 | 说明 |
| --- | --- | --- |
| **先看这个**：整批结论汇总 | `output/reports/batch_2026_06_report.txt` | 人读版：每题状态、谁影响了结论、卡在哪一关 |
| 结构化接口返回（程序读） | `output/reports/batch_2026_06_report.json` | 同上内容的 JSON，方便接手人二次处理 |
| 每题拟合图 | `output/charts/Q-2026-001.svg` 等 | 浏览器直接打开看散点+拟合曲线 |
| 项目经理对照的两组参数 | `output/reports/batch_2026_06_report.json` 里每题的 `parameter_sets` | 冲突题同时给“正式记录”与“学生草稿旧版”两套参数 + 中间计算 |

**推荐的看法**：先开 `..._report.txt` 扫一遍状态 → 发现要复核的题 → 开对应 `...svg` 看图 → 项目经理对照时看 JSON 里的 `parameter_sets` 和 `intermediate_calculations`。

---

## 三、三个来源怎么分清（谁影响了结论）

本批材料像现场收到的，分三类放在 `samples/batch_2026_06/` 下，解释器按权威度分开解析：

| 目录 | 来源类型 | 权威度 | 规则 |
| --- | --- | --- | --- |
| `normal_record/records.jsonl` | 正式记录 | 最高 | 同题冲突时作基准版本 |
| `student_draft_old/drafts.jsonl` | 学生草稿旧版 | 低 | 仅当同题无正式记录才作计算依据；有冲突时**保留备查但不覆盖正式结论** |
| `verbal_notes/notes.jsonl` | 口头备注 | 仅说明用 | 只能影响结论的说明与挂起理由，**不能单独确认单位或参数** |

每条结论都带 `influenced_by` 字段，写清是哪类来源真正决定了结论，哪些只是备查/口头。

---

## 四、状态说明（算不出的记录不会消失）

每道题一定有一个状态，不会静默丢弃：

| 状态 | 含义 | 处理 |
| --- | --- | --- |
| `OK` | 拟合成功，单位齐全，R² 过阈值 | 给稳定结论 |
| `STUCK_FORMULA` | 卡在公式 | 模型字段为空或数据对不上任何已知模型，列出可重试的模型 |
| `STUCK_UNIT` | 卡在单位 | 单位存在但有歧义（同题不同来源单位打架且无正式记录裁定） |
| `STUCK_THRESHOLD` | 卡在阈值 | R² 低于阈值，附实际 R² 与阈值，建议复核数据或换模型 |
| `PENDING_PM` | 挂起，等项目经理确认 | **单位缺失**时专用：绝不给假稳定结论，列出待确认项与口头线索 |

> 特别强调：**单位缺失 → `PENDING_PM`**。口头备注说“单位是 kΩ”也不算数，必须项目经理书面确认后才转 `OK`。

---

## 五、项目经理怎么拿两组参数对照

对**有版本冲突**的题（如 `Q-2026-001`：正式记录写 cm，学生草稿旧版写 mm），`rerun` 与 JSON 报告里同时给出：

- **参数集 A**：正式记录拟合结果
- **参数集 B**：学生草稿旧版拟合结果
- **中间计算**：法方程矩阵、求解步骤、SS_res/SS_tot、R²
- **单位换算**：cm↔mm 的换算系数与换算后参数，过程全部留痕

这样项目经理不用重算，直接对照两组参数与中间过程。

---

## 六、目录结构

```
zy73168/
├── README.md                 # 本文件
├── run.py                    # 命令入口
├── interpreter/              # 解释器核心
│   ├── models.py             # 数据模型与状态枚举
│   ├── sources.py            # 解析三类来源
│   ├── conflict.py           # 版本冲突检测（学生草稿 vs 正式记录）
│   ├── fitting.py            # 纯 Python 最小二乘拟合（线性/二次/指数）
│   ├── units.py              # 单位检测、换算、缺失挂起
│   ├── status.py             # 状态裁定（公式/单位/阈值/PM）
│   └── report.py             # 生成接口返回：txt + json + svg
├── samples/
│   └── batch_2026_06/        # 一包像现场收到的材料
│       ├── manifest.json
│       ├── normal_record/records.jsonl
│       ├── student_draft_old/drafts.jsonl
│       └── verbal_notes/notes.jsonl
├── output/                   # 接口返回落这里（首次运行自动建）
│   ├── reports/
│   └── charts/
└── tests/
    └── test_interpreter.py
```

---

## 七、怎么重跑 / 换一批材料

- 重跑同一批：再执行一次第 1 条命令，`output/` 会被覆盖为最新。
- 换一批材料：照 `samples/batch_2026_06/` 的目录结构放一个新包，然后 `python3 run.py run --batch <你的包路径>`。
- 只重跑一题：`python3 run.py rerun --question <题号> --batch samples/batch_2026_06`。

---

## 八、故障排查

- 报 `FileNotFoundError`：`--batch` 路径写错，要指向含 `manifest.json` 的包目录。
- 图打不开：`.svg` 用浏览器（Safari/Chrome）打开即可，无需装软件。
- 想确认程序有没有被改坏：跑 `python3 -m unittest tests.test_interpreter -v`，全绿即可。
