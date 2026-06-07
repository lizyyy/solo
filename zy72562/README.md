# 模型蒸馏质量复核工具

> 整合负样本列表与召回候选表，检测时间窗穿越导致的效果虚高，让模型蒸馏质量可控。

## ✨ 核心特性

- **证据合并**：把负样本（主流程）和召回候选（现场说法）放到同一个结果里
- **时间窗穿越检测**：自动识别可能导致效果虚高的时间窗问题，标记给实验平台负责人复核
- **三步工作流**：导入负样本 → 老唐补录召回候选 → 异常样本页自动更新
- **异常样本详情页**：清晰说明「为什么被留下」「还缺什么材料」「下一步该找谁」
- **三种入口**：命令行(CLI)、REST API、Web小看板
- **报告不冰冷**：不是系统日志，是给人看的复核报告

## 🚀 快速开始（新人5分钟跑通）

### 0. 环境准备

```bash
# 推荐 Python 3.8+
python3 --version
```

### 1. 一键跑通端到端演示

```bash
# 清理旧数据
rm -rf ./demo_data

# 运行完整演示（三步流程 + 生成报告）
python3 ./review --storage ./demo_data demo
```

你会看到：
- **第一步**：导入4条负样本，自动检测出2条时间窗穿越问题
- **第二步**：推荐策略老唐补录3条召回候选
- **第三步**：异常样本页自动更新，时间窗问题保留待实验平台复核
- **第四步**：生成完整的复核报告

### 2. 查看异常列表

```bash
# 查看所有异常（带详情）
python3 ./review --storage ./demo_data list --detail

# 只看有时间窗问题的
python3 ./review --storage ./demo_data list --has-time-window

# 按状态过滤
python3 ./review --storage ./demo_data list --status pending_expert_review
```

### 3. 查看异常详情（最关键的一页）

```bash
# 先从 list 里复制一个 anomaly_id，比如 anomaly_e221c870
python3 ./review --storage ./demo_data detail anomaly_e221c870
```

详情页里你会看到：
- 🔴 **负样本信息**（主流程证据）
- 🟢 **召回候选信息**（现场说法证据）
- 🔗 **证据合并结果**（支持点/冲突点）
- 🕐 **时间窗穿越问题**（严重程度、影响指标、效果虚高估计）
- ❓ **为什么这条被留下**
- 📦 **还缺什么材料**
- 👤 **下一步该找谁**（实验平台负责人 / 推荐策略老唐 / 复核人）

### 4. 生成复核报告

```bash
# 控制台输出
python3 ./review --storage ./demo_data report

# 保存到文件
python3 ./review --storage ./demo_data report -o ./report.txt
```

## 📖 完整三步工作流

### 第一步：导入负样本列表

准备 `negative_samples.json`：

```json
[
  {
    "sample_id": "sample_001",
    "main_process_id": "mp_home_feed",
    "main_process_name": "首页推荐流主流程",
    "timestamp": "2024-06-15T14:30:00",
    "feature_values": {"user_age": 28},
    "ground_truth_label": "negative",
    "model_prediction_score": 0.92,
    "source": "线上A/B实验",
    "time_window_tag": "疑似时间窗穿越导致预测分虚高",
    "notes": "预测分异常高但实际无点击"
  }
]
```

导入：

```bash
python3 ./review --storage ./my_data import data/sample_negative_samples.json -v
```

### 第二步：推荐策略老唐补录召回候选表

准备 `recall_candidates.json`：

```json
[
  {
    "candidate_id": "recall_001",
    "sample_id": "sample_001",
    "scene_description": "用户当日晚些时候点击了同品类商品",
    "timestamp": "2024-06-15T22:30:00",
    "recall_source": "用户行为序列回查",
    "field_evidence": "该行为特征被错误地用于样本预测",
    "confidence_score": 0.85,
    "added_by": "recommend_strategy_tang",
    "notes": "老唐补录的现场说法"
  }
]
```

补录：

```bash
python3 ./review --storage ./my_data add-recall data/sample_recall_candidates.json -v
```

### 第三步：异常样本页自动更新

补录召回候选后，异常样本页会自动：
- 合并两边证据
- 重新检测时间窗问题
- 更新「为什么被留下」「缺什么材料」「下一步找谁」

**重要**：时间窗穿越问题不会被自动归为正常，会一直保留 `pending_expert_review` 状态，留给实验平台负责人复核。

## 🖥️ Web小看板

启动Web服务：

```bash
# 安装依赖（首次运行）
pip3 install -r requirements.txt

# 启动服务
REVIEW_STORAGE=./demo_data python3 src/review_engine/api/main.py
```

打开浏览器访问：`http://localhost:8000`

小看板功能：
- 统计卡片：总异常数、时间窗问题数、待复核数
- 异常列表：支持按状态、时间窗过滤
- 文件上传：一键导入负样本、补录召回候选
- 异常详情页：完整证据链 + 复核操作

## 🔌 API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 获取统计数据 |
| GET | `/api/anomalies` | 异常列表（支持status/has_time_window参数） |
| GET | `/api/anomalies/{id}` | 异常详情 |
| POST | `/api/import/negative` | 导入负样本（multipart/form-data, file字段） |
| POST | `/api/import/recall` | 补录召回候选（multipart/form-data, file字段） |
| POST | `/api/anomalies/{id}/review` | 提交专家复核 |
| GET | `/api/anomalies/{id}/history` | 操作历史 |

示例：

```bash
# 获取统计
curl http://localhost:8000/api/stats

# 导入负样本
curl -X POST -F "file=@data/sample_negative_samples.json" http://localhost:8000/api/import/negative
```

## 🔍 时间窗穿越检测规则

系统会自动检测以下情况：

1. **标记检测**：负样本的 `time_window_tag` 包含「穿越」「虚高」「cross」「inflated」等关键词 → HIGH
2. **预测分异常**：负样本预测分 > 0.8 但真实标签是 negative → CRITICAL
3. **时间不一致**：召回候选与负样本时间差 > 24小时 → MEDIUM

检测出的时间窗问题会：
- 自动标记状态为 `pending_expert_review`
- 自动分配给「实验平台负责人」
- 不会被自动清除，必须人工复核

## 📂 项目结构

```
.
├── review                          # CLI入口脚本
├── requirements.txt
├── pyproject.toml
├── data/
│   ├── sample_negative_samples.json    # 样例负样本
│   └── sample_recall_candidates.json   # 样例召回候选
├── src/
│   └── review_engine/
│       ├── __init__.py
│       ├── models/
│       │   ├── __init__.py
│       │   └── schemas.py              # 数据模型定义
│       ├── engine/
│       │   ├── __init__.py
│       │   └── core.py                 # 核心引擎：检测、合并、流转
│       ├── cli/
│       │   ├── __init__.py
│       │   └── main.py                 # CLI命令行
│       ├── api/
│       │   ├── __init__.py
│       │   └── main.py                 # FastAPI服务
│       └── web/
│           ├── __init__.py
│           └── templates/
│               ├── index.html          # 小看板首页
│               └── detail.html         # 异常详情页
└── tests/
    └── test_e2e.py                     # 端到端测试
```

## 🧪 运行测试

```bash
python3 tests/test_e2e.py
```

测试覆盖：
- 三步完整工作流
- 时间窗问题保留机制（不被自动归为正常）
- 专家复核流程
- 状态流转正确性

## 📋 数据格式说明

### NegativeSample（负样本）

| 字段 | 类型 | 说明 |
|------|------|------|
| sample_id | string | 样本唯一ID |
| main_process_id | string | 主流程ID |
| main_process_name | string | 主流程名称 |
| timestamp | ISO datetime | 样本时间 |
| feature_values | object | 特征值 |
| ground_truth_label | string | 真实标签 |
| model_prediction_score | float | 模型预测分 (0~1) |
| source | string | 来源 |
| time_window_tag | string | 时间窗标记（有穿越问题时填入关键词） |
| notes | string | 备注 |

### RecallCandidate（召回候选）

| 字段 | 类型 | 说明 |
|------|------|------|
| candidate_id | string | 候选唯一ID |
| sample_id | string | 关联的负样本ID |
| scene_description | string | 场景描述（现场说法） |
| timestamp | ISO datetime | 时间 |
| recall_source | string | 召回来源 |
| field_evidence | string | 现场证据详情 |
| confidence_score | float | 置信度 (0~1) |
| added_by | string | 补录人 |
| notes | string | 备注 |

## 🎯 设计理念

1. **证据不丢失**：负样本和召回候选永远放在一起看，不会只剩漂亮画面
2. **问题不掩盖**：时间窗穿越问题不会被自动归为正常，必须留给实验平台负责人
3. **责任清晰**：每条异常都明确「下一步找谁」，不会踢皮球
4. **新人友好**：README + 样例数据 + 一键demo，照做就能跑通

---

**最后检查清单**：
- ✅ 能走完负样本第一次导入
- ✅ 能走完推荐策略老唐补看召回候选表
- ✅ 能走完异常样本页更新
- ✅ 时间窗穿越问题留给实验平台负责人复核，不急着归正常
