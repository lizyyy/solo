# 概率模拟图表解释 — 快速上手

> 本文档只交代三件事：**试跑样例怎么跑、重跑方式怎么写、接口返回从哪看。**
> 负责人下午换班前跑一遍即可，不需要读代码。

---

## 1. 材料放哪

所有样例材料就在 [sample_data/](file:///Users/maca/pro/solo/workspaces/zy73178/sample_data) 目录下，**默认参数会直接读这里**，不用手动传路径。

| 文件 | 作用 |
|---|---|
| [sample_data/scoring_remarks.json](file:///Users/maca/pro/solo/workspaces/zy73178/sample_data/scoring_remarks.json) | 评分备注（含旧说法、正常记录、单位缺失现场原样稿） |
| [sample_data/prob_sim_chart.json](file:///Users/maca/pro/solo/workspaces/zy73178/sample_data/prob_sim_chart.json) | 本次概率模拟数据 |
| [sample_data/prob_sim_baseline.json](file:///Users/maca/pro/solo/workspaces/zy73178/sample_data/prob_sim_baseline.json) | 上次概率模拟数据（用于跳变对比，可选） |

要换真实数据的话，要么覆盖这三个文件，要么用 `--remark-path` / `--sim-path` / `--baseline-path` 指到新位置。

---

## 2. 三条命令

所有命令都在项目根目录执行。脚本入口是 [prob_interpret.py](file:///Users/maca/pro/solo/workspaces/zy73178/prob_interpret.py)。

### 试跑样例（无跳变对比）

```bash
python3 prob_interpret.py
```

默认阈值 0.05，直接读 `sample_data/` 下的文件，结果 JSON 打到 stdout。

### 带跳变对比（推荐日常脚本用）

```bash
python3 prob_interpret.py --baseline-path sample_data/prob_sim_baseline.json
```

会逐题对比上次的概率，跳变原因分三种：
- **threshold** → 纯阈值超过，无特殊归因
- **unit** → 单位缺失/不匹配引起（会追溯评分备注里的原始说法）
- **normal_record** → 跳变由评分备注里的一条【正常记录】引起

### 把结果写进文件

```bash
python3 prob_interpret.py \
    --baseline-path sample_data/prob_sim_baseline.json \
    --output result.json
```

`result.json` 就是接口返回的完整 JSON，后续脚本直接读即可。

---

## 3. 接口返回入口（字段名不要改）

顶层永远四个字段：

```json
{
  "ok": true,
  "code": "OK",
  "message": "解释完成",
  "data": {
    "threshold": 0.05,
    "unit_strict": true,
    "remark_count": 4,
    "sim_count": 4,
    "results": [
      {
        "question_id": "Q-2026-003",
        "probability": 0.68,
        "selected_remark": "……",
        "selected_version": "v1.2",
        "unit": "步",
        "interpretation": "……",
        "jump_diagnosis": {
          "jump_detected": true,
          "cause": "threshold",
          "cause_detail": "……",
          "evidence": ["baseline_prob=…", "current_prob=…", "threshold=…"]
        }
      }
    ]
  }
}
```

重点读 `data.results[]`，每题必带：
- `selected_remark` / `selected_version` —— 选了哪条备注（自动去重了旧版本覆盖新版本）
- `unit_issue` —— 单位问题会把原始备注、原始版本、source_raw 全列出来，不会只说一句"单位缺失"
- `jump_diagnosis` —— 跳变诊断，`cause` 就是上面三种之一，`evidence` 给完整证据链

---

## 4. 失败提示（日常脚本靠这些分支判断）

失败时 `ok=false`，`code` 字段稳定不变，脚本里按 code 分支即可：

| code | 含义 |
|---|---|
| `ERR_MISSING_PARAM` | 缺少必要参数 |
| `ERR_BAD_SAMPLE_DATA` | 样例文件找不到 / 解析失败 / 基线坏了 |
| `ERR_DUPLICATE_VERSION` | 同一题有两个同版本答案冲突，人工去备注里处理 |
| `ERR_BAD_THRESHOLD` | `--threshold` 不在 (0, 1) 范围内 |
| `ERR_UNKNOWN` | 兜底异常，看 `message` |

退出码也同步：成功 0，失败 1，接 crontab 或 CI 都行。

---

## 5. 完整参数速查

```
--remark-path      评分备注 JSON 路径    (默认 sample_data/scoring_remarks.json)
--sim-path         本次模拟 JSON 路径    (默认 sample_data/prob_sim_chart.json)
--baseline-path    上次模拟 JSON 路径    (可选，不传就不做跳变对比)
--threshold        跳变阈值 (0,1)        (默认 0.05)
--unit-strict      单位严格模式          (默认开启；关闭用 --no-unit-strict)
--output           输出 JSON 文件路径     (可选，不传就 stdout)
```

---

就这些。下午换班前自己跑一遍第一条命令，能看到 `ok:true`、`results` 里有 4 题，其中 Q-2026-007 带 `unit_issue`、Q-2026-011 的 `jump_diagnosis.cause` 是 `normal_record`，就说明交付正常。
