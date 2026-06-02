# 推荐系统冷启动解释 - 模型评测工具

> 解决模型评测同事**小孟**翻半天看板、重复评测同一条样本的问题。
> 从样本到报告闭环处理，异常单独提示，不被平均指标掩盖。

---

## 一、快速开始

### 环境要求
- Python 3.8+
- 无第三方依赖（纯标准库实现）

### 目录结构
```
cold_start_eval/
├── main.py                    # 命令行入口
├── src/                       # 核心代码
│   ├── schemas.py             # 数据结构定义
│   ├── data_loader.py         # 数据加载器
│   ├── anomaly_detector.py    # 异常检测器
│   ├── metrics.py             # 指标计算器
│   ├── reporter.py            # 报告生成器
│   └── engine.py              # 评测引擎
├── data/                      # 数据目录（你需要维护这个）
│   ├── samples/               # 原始样本
│   ├── model_outputs/         # 模型输出（按版本分目录）
│   │   ├── v1/
│   │   └── v2/
│   ├── human_review/          # 人工复核结果
│   ├── online_feedback/       # 线上反馈
│   └── reports/               # 生成的报告（自动创建）
└── README.md
```

---

## 二、怎么放样本

### 1. 原始样本 (`data/samples/`)

**文件格式**：JSON，支持单条或数组。

**字段说明**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sample_id` | string | ✅ | 样本唯一ID |
| `source` | string | ✅ | 原始来源（如看板日期、工单ID） |
| `features` | object | ✅ | 样本特征 |
| `created_at` | datetime | ✅ | 样本创建时间 |
| `processed_at` | datetime | ❌ | 处理时间 |
| `raw_data` | object | ❌ | 原始数据，保留溯源用 |

**示例**：
```json
[
    {
        "sample_id": "CS_001",
        "source": "kanban_review_20260515",
        "features": {
            "user_id": "U10001",
            "item_id": "I20001",
            "item_category": "electronics",
            "user_history_count": 15
        },
        "created_at": "2026-05-15T10:30:00",
        "processed_at": "2026-05-15T14:20:00",
        "raw_data": {
            "original_query": "推荐一款适合运动的耳机"
        }
    }
]
```

> **重要**：`source` 和时间字段务必保留，交接时别人不用再问你这条为什么这么判。

### 2. 模型输出 (`data/model_outputs/<版本号>/`)

每个模型版本一个子目录。切版本就是**新建一个目录**。

**字段说明**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sample_id` | string | ✅ | 关联样本ID |
| `model_version` | string | ✅ | 模型版本 |
| `prediction` | object | ✅ | 模型预测结果 |
| `score` | float | ✅ | 预测置信度分数 |
| `predicted_at` | datetime | ✅ | 预测时间 |
| `metadata` | object | ❌ | 额外信息（延迟、模型类型等） |

### 3. 人工复核 (`data/human_review/`)

**字段说明**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sample_id` | string | ✅ | 关联样本ID |
| `reviewer` | string | ✅ | 复核人（如 "xiaomeng"） |
| `review_status` | string | ✅ | `pending`/`approved`/`rejected`/`rework` |
| `corrected_label` | object | ❌ | 修正后的标签（如有） |
| `review_comment` | string | ❌ | 复核意见，务必写清楚原因 |
| `reviewed_at` | datetime | ✅ | 复核时间 |
| `review_round` | int | ✅ | 复核轮次（第几次返工） |

> **重要**：返工样本要保留**每一轮**的记录，系统会自动取最新一轮。

### 4. 线上反馈 (`data/online_feedback/`)

**字段说明**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sample_id` | string | ✅ | 关联样本ID |
| `feedback_type` | string | ✅ | 反馈类型（click/skip/purchase/report） |
| `feedback_value` | any | ✅ | 反馈值（good/bad/数值等） |
| `feedback_source` | string | ✅ | 反馈来源 |
| `collected_at` | datetime | ✅ | 收集时间 |

---

## 三、怎么切模型版本

切版本 = 新建目录 + 放新的预测结果。

### 步骤
1. 在 `data/model_outputs/` 下新建目录，如 `v3`
2. 把新版本的预测结果 JSON 放进去
3. 完成 ✅

### 查看可用版本
```bash
python main.py --list-versions
```

输出示例：
```
可用的模型版本:
  - v1
  - v2
```

---

## 四、怎么看冲突清单

### 1. 查看所有异常
```bash
python main.py --anomalies v1
```

### 2. 只看标签冲突
```bash
python main.py --anomalies v1 --type label_conflict
```

### 3. 只看样本泄漏（最严重）
```bash
python main.py --anomalies v1 --type sample_leakage
```

### 异常类型说明
| 类型 | 严重程度 | 说明 |
|------|----------|------|
| `sample_leakage` | 🔴 critical | 样本泄漏，特征直接出现在预测中 |
| `label_conflict` | 🟠 error | 人工复核与模型预测标签冲突 |
| `duplicate` | 🟠 error | 样本ID或特征重复 |
| `null_value` | 🟠/🟡 | 空值字段（超过阈值为error） |
| `boundary` | 🟡 warning | 预测分数接近阈值边界 |

> **设计原则**：标签冲突和样本泄漏**单独列在异常清单最前面**，不参与平均指标计算，不会被掩盖。

---

## 五、常用命令

### 1. 评测单个版本
```bash
python main.py --evaluate v1
```

输出示例：
```
正在评测模型版本: v1
============================================================

📊 评测完成
  总样本数: 7
  有效样本数: 5
  异常总数: 9

📈 指标汇总:
  approval_rate: 0.7143
  avg_review_round: 1.5714
  explanation_quality_accuracy: 0.8286
  feature_relevance_accuracy: 0.8571
  human_online_consistency: 0.8333
  label_conflict_rate: 0.4286
  overall_score: 0.7914
  pending_rate: 0.0000
  rejection_rate: 0.1429
  review_rate: 1.0000
  rework_rate: 0.2857
  user_understandable_accuracy: 0.9286

⚠️  异常分类统计:
  boundary: 1 条 (最严重: warning)
  duplicate: 2 条 (最严重: warning)
  label_conflict: 3 条 (最严重: error)
  null_value: 1 条 (最严重: error)
  sample_leakage: 1 条 (最严重: critical)

💾 报告已保存到: ./data/reports
  - eval_report_*.json  (完整JSON报告)
  - eval_summary_*.md   (摘要Markdown)
  - anomalies_*.md      (异常清单)
```

### 2. 对比两个版本
```bash
python main.py --compare v1 v2
```

### 3. 查看单个样本详情（翻证据用）
```bash
python main.py --sample v1 CS_001
```

> 小孟不用再翻看板，一条命令看到完整证据链：样本特征、模型输出、人工复核每一轮、线上反馈、所有异常。

### 4. 自定义参数
```bash
# 调整边界阈值
python main.py --evaluate v1 --boundary-threshold 0.90

# 不保存报告，只看控制台输出
python main.py --evaluate v1 --no-save

# 指定数据和输出目录
python main.py --evaluate v1 --data-dir /path/to/data --output-dir /path/to/output
```

---

## 六、报告说明

每次评测会生成 3 个文件到 `data/reports/`：

| 文件 | 用途 |
|------|------|
| `eval_report_<version>_<时间>.json` | 完整机器可读报告，用于自动化 |
| `eval_summary_<version>_<时间>.md` | 人类可读摘要，包含异常高亮 |
| `anomalies_<version>_<时间>.md` | **重点**：异常清单，单独列出，按严重程度排序 |

### 异常清单特点
- 标签冲突和样本泄漏放最前面
- 每条都有：原始来源、创建时间、处理时间、复核人、复核轮次、复核意见
- 别人接手时，不用再问小孟这条为什么这么判

---

## 七、交接给小孟的 Checklist

✅ **不用手工对第二遍**：系统自动去重，重复样本会标红  
✅ **不用翻旧记录**：`--sample` 命令一条查完整证据链  
✅ **异常不被掩盖**：标签冲突、样本泄漏单独列，平均指标不会盖住问题  
✅ **可追溯**：每条记录都保留 `source`、`created_at`、`processed_at`、`reviewed_at`  
✅ **边界和空值**：用户提到的空值、重复、边界都有专门检测  

### 自测用例（已内置在样例数据中）
| 样本 | 测试点 | 预期结果 |
|------|--------|----------|
| CS_001 | 顺利处理，一次通过 | approved，无异常 |
| CS_002 | 返工后通过（两轮） | review_round=2，检测到标签冲突 |
| CS_003 | 空值样本 | 检测到 null_value 异常 |
| CS_004 | 与CS_001特征重复 | 检测到 duplicate 异常 |
| CS_005 | 边界分数 0.97 | 检测到 boundary 异常 |
| CS_006 | 返工后通过（两轮） | review_round=2，检测到标签冲突 |
| CS_007 | 样本泄漏 | 检测到 sample_leakage 异常（最严重） |

---

## 八、样例数据试用

```bash
# 先评测 v1，看空值、重复、边界检测
python main.py --evaluate v1

# 看标签冲突清单
python main.py --anomalies v1 --type label_conflict

# 看样本泄漏
python main.py --anomalies v1 --type sample_leakage

# 看 CS_002 返工记录
python main.py --sample v1 CS_002

# 对比 v1 和 v2
python main.py --compare v1 v2
```

---

## 九、核心模块参考

| 模块 | 位置 | 说明 |
|------|------|------|
| 数据结构 | [schemas.py](file:///Users/lzy/pro/solo/workspaces/zy72184/cold_start_eval/src/schemas.py) | 所有数据类定义 |
| 数据加载 | [data_loader.py](file:///Users/lzy/pro/solo/workspaces/zy72184/cold_start_eval/src/data_loader.py) | 从目录加载所有数据 |
| 异常检测 | [anomaly_detector.py](file:///Users/lzy/pro/solo/workspaces/zy72184/cold_start_eval/src/anomaly_detector.py) | 5种异常检测逻辑 |
| 指标计算 | [metrics.py](file:///Users/lzy/pro/solo/workspaces/zy72184/cold_start_eval/src/metrics.py) | 准确率、一致性等指标 |
| 报告生成 | [reporter.py](file:///Users/lzy/pro/solo/workspaces/zy72184/cold_start_eval/src/reporter.py) | JSON和Markdown报告 |
| 评测引擎 | [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72184/cold_start_eval/src/engine.py) | 整合所有模块 |
| CLI入口 | [main.py](file:///Users/lzy/pro/solo/workspaces/zy72184/cold_start_eval/main.py) | 命令行接口 |

---

*最后更新：2026-06-02*
