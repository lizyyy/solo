# 类别不平衡重采样系统

带审计追踪和可解释性的类别不平衡重采样工具。解决线上特征缺失给默认分导致的重采样争议问题。

---

## 核心设计原则

1. **单一数据源原则**：导出明细、页面展示、接口返回读取同一份数据存储，杜绝数据不一致
2. **证据留存原则**：特征快照编号的原始行号、人工改动、处理状态全部留痕，可追溯
3. **边界明确原则**：所有判定规则写在代码和文档中，不靠口头约定
4. **可复盘原则**：输出的是可审计记录和可重跑命令，不是功能清单
5. **审慎原则**：线上特征缺失给默认分的记录，阿越审查后不急于归正常，留给推荐负责人复核

---

## 边界规则（Boundary Rules）

### 1. 特征缺失检测

| 规则项 | 说明 |
|--------|------|
| 触发值 | 特征值等于 `-999`（可配置）时判定为缺失 |
| 检测范围 | 除模型分列、标签列外的所有特征列 |
| 记录字段 | `has_missing_features`（布尔）、`missing_features`（列表） |

### 2. 默认分使用检测

**同时满足以下两个条件时，判定为「线上特征缺失却给了默认分」：**

1. ✅ 存在特征缺失（`has_missing_features = true`）
2. ✅ 模型分精确等于阈值 `0.5`（可配置）

**自动采取的动作：**
- 状态标记为 `suspicious_default_score`
- 权重临时减半（应用重采样时）
- 进入待人工复核队列

### 3. 状态流转规则

```
imported (导入)
    │
    ├─→ 检测到特征缺失+默认分 ──→ suspicious_default_score (可疑-待阿越)
    │                                    │
    │                                    └─ 阿越审查 ──→ reviewed_by_ayue (阿越已审)
    │                                                │
    │                                                └─→ needs_recheck (待推荐负责人)
    │                                                         │
    │                                                         └─→ confirmed_normal (确认正常)
    │                                                              /
    │                                                             /
    └─→ 正常记录 ────────────────────────────────────────────────┘
                                                               /
                                                              /
                                       任意状态 ──→ excluded (排除)
```

### 4. 权重规则

| 状态 | 权重处理 |
|------|----------|
| `suspicious_default_score` | 权重 × 0.5（临时，待复核） |
| `needs_recheck` | 保持基础权重，标记高亮 |
| `excluded` | 权重 = 0，不参与训练 |
| 其他正常状态 | 按类别不平衡比例计算 |

### 5. 回滚规则

- ✅ 支持回滚到任意历史审计节点
- ✅ 回滚不删除原记录，原记录标记为排除
- ✅ 回滚生成新记录，关联原记录ID
- ✅ 所有回滚操作必须填写原因

---

## 三步标准工作流

### 第一步：特征快照导入

**操作人**：任意（建议阿越）

**命令**：
```bash
resampler import-snapshot <特征文件.csv> \
    --score-col model_score \
    --label-col label \
    --created-by ayue \
    --session-id <会话ID>
```

**系统自动做的事**：
1. 给每条记录分配 `record_id`
2. 记录原始行号 `original_line_number`
3. 检测特征缺失和默认分使用情况
4. 自动标记可疑记录
5. 写入审计日志

---

### 第二步：阿越补看训练日志曲线

**操作人**：阿越（实验平台负责人）

**先查看可疑记录**：
```bash
resampler show <会话ID> --suspicious-only
```

**逐条查看详情（点进去看证据）**：
```bash
resampler show <会话ID> --record-id <记录ID>
```

**准备决策文件 `ayue_decisions.json`**：
```json
{
  "rec_abc123": {
    "curve_ok": true,
    "keep_suspicious": true,
    "note": "训练日志曲线正常，但特征缺失来源不明，留待推荐负责人确认"
  },
  "rec_def456": {
    "curve_ok": true,
    "confirm_normal": true,
    "note": "特征缺失不影响，训练曲线稳定"
  },
  "rec_ghi789": {
    "curve_ok": false,
    "exclude": true,
    "note": "训练曲线异常，排除"
  }
}
```

**执行审查**：
```bash
resampler review-logs <会话ID> \
    --decisions-file ayue_decisions.json \
    --reviewer ayue
```

**关键原则**：
> ⚠️ 阿越不要急着把特征缺失给默认分的记录归为正常，尽量标为 `keep_suspicious` 留给推荐负责人复核。

---

### 第三步：可解释摘要更新

**自动生成摘要**：
```bash
resampler update-summary <会话ID> --auto-generate
```

**或使用自定义摘要文件**：
```bash
resampler update-summary <会话ID> --explanations-file summaries.json
```

**摘要文件格式**：
```json
{
  "rec_abc123": {
    "summary": "特征缺失(2个)使用默认分 | 阿越已标注，待推荐负责人确认",
    "detail": "完整的可解释详情...",
    "update_note": "阿越审查后更新摘要"
  }
}
```

---

## 推荐负责人复核

**查看待复核记录**：
```bash
resampler show <会话ID>
# 找 status = needs_recheck 的记录
```

**准备决策文件 `leader_decisions.json`**：
```json
{
  "rec_abc123": {
    "confirm_normal": true,
    "note": "复核确认，特征缺失不影响判定"
  },
  "rec_xyz000": {
    "exclude": true,
    "note": "特征缺失严重，排除"
  }
}
```

**执行复核**：
```bash
resampler leader-review <会话ID> \
    --decisions-file leader_decisions.json \
    --operator recommend_leader
```

---

## 查看可解释摘要详情

**查看单条可疑记录（点开看证据）**：
```bash
resampler show <会话ID> --record-id <记录ID>
```

**输出包含**：
- 特征快照编号、原始行号
- 特征缺失列表
- 是否使用默认分
- 阿越当时的审查意见和保留理由
- 完整审计日志链
- 人工改动记录

---

## 应用权重和导出

**应用重采样权重**：
```bash
resampler apply-weights <会话ID> --label-col label
```

**导出结果（和页面、接口同一份数据）**：
```bash
# 全部导出
resampler export <会话ID> --output result.csv

# 只导出可疑记录
resampler export <会话ID> --output suspicious.csv \
    --status suspicious_default_score \
    --status needs_recheck
```

---

## 回滚操作

**先查看审计日志确定回滚节点**：
```bash
resampler show <会话ID> --record-id <记录ID>
# 审计日志每条有序号，选择要回滚到的序号
```

**执行回滚**：
```bash
resampler rollback <会话ID> \
    --record-id <记录ID> \
    --to-audit-index <序号> \
    --reason "权重计算错误，回滚到阿越审查后状态" \
    --operator ayue
```

---

## 复现完整流程

**查看所有会话**：
```bash
resampler list
```

**复现某次处理**：
```bash
# 用相同的输入文件和参数重新跑一遍
resampler import-snapshot ...
resampler review-logs ...
resampler update-summary ...
resampler apply-weights ...
resampler export ...
```

**查看边界规则**：
```bash
resampler boundary-rules
```

---

## 数据存储结构

```
data/
├── sessions/
│   ├── session_abc123.json      # 会话完整数据（单一数据源）
│   └── session_xyz789.json
└── exports/
    └── resample_session_abc123_20240101.csv
```

**核心保证**：
- 页面展示：读 `sessions/*.json`
- 接口返回：读 `sessions/*.json`
- 导出CSV：从 `sessions/*.json` 转换生成

三份输出同源，绝无数据不一致。

---

## 快速演示

生成演示数据和一键运行脚本：
```bash
resampler demo --output-dir ./examples
cd ./examples
bash run_demo.sh
```

---

## 配置

修改默认参数（在代码中初始化 `ImbalanceResampler` 时传入）：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `default_score_threshold` | `0.5` | 默认分阈值 |
| `missing_feature_default_value` | `-999` | 特征缺失标记值 |

---

## 文件结构

```
src/imbalance_resampler/
├── __init__.py          # 导出所有公共接口
├── models.py            # 数据模型定义
├── resampler.py         # 重采样核心逻辑和边界规则
├── data_store.py        # 统一数据访问层
├── workflow.py          # 三步工作流引擎
├── explanation.py       # 可解释摘要生成
└── cli.py               # 命令行入口
```
