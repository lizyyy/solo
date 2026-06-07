# Embedding 版本兼容 — 边界规则

> 林姐和推荐负责人交接用，别当评测说明书看

---

## 一、什么情况算"线上特征缺失却给了默认分"？（怎么判

### 判定条件（代码里硬卡这俩条件同时成立才算）
```
feature_present_online = False  → 线上环境确实没有这个特征
used_default_score = True     → 但还是打了个默认分
```

### 触发后会发生什么？
1. 自动打上标记 `anomaly_type = default_score_missing_feature`
2. 状态自动变成 `pending_lead_review`（待推荐负责人复核）
3. **不会**自动算正常，**不会**在汇总里消失
4. 明细导出、页面、接口返回**都能看到这条记录

---

## 二、碰到这种情况怎么处理？

### 角色分工

| 谁 | 能做什么 | 不能做什么 |
|---|---|---|
| 系统自动检测 | 打标记、改状态到待复核 | 不能自己算正常、不能跳过 |
| 林姐（数据科学家） | 看评测切片、写备注、可以主动标记更多待复核 | 不能直接批，不能消掉待复核状态 |
| 推荐负责人 | 复核通过 / 打回 | 这是唯一能消掉待复核状态的人 |
| 其他人 | 看数据、导出明细 | 不能改状态 |

### 处理流程

```
第一步：YAML导入 → 系统自动检测到 → pending_lead_review
第二步：林姐看评测切片 → 写备注 → 还是 pending_lead_review（不会变）
第三步：推荐负责人复核
    ├─ 通过 → lead_approved → 可以进第三步更新摘要
    └─ 打回 → lead_rejected → 林姐重新看
```

---

## 三、改错了怎么回滚？

### 可以回滚的情况：
- 状态流转错了
- 备注写错了
- 标记错了

### 怎么回滚：
```python
workflow.rollback_record(record_id="xxx", actor="张三", note="状态改错了，退回去")
```

### 回滚规则：
1. 一步一步往回退，不能跳
2. 每次回滚都留审计日志（谁、什么时候、为什么回滚）
3. 回滚后还是能看到之前的所有操作痕迹，不会抹掉

---

## 四、数据一致性约定

### 三个出口必须读同一份结果：
- **明细导出**（CSV/JSON）
- **页面展示**
- **API接口返回**

都走 `UnifiedDataExporter`，都从 `FeatureComparisonRecord.to_dict()` 出。

谁也不许自己算一遍自己的逻辑，谁算谁背锅。

---

## 五、证据留存约定

### 每一条记录必须能回到证据链：
1. **YAML原始行号**：这条记录在参数YAML里的第几行，原始内容是什么
2. **人工改动记录**：谁改了、改前改后、什么时候改的
3. **处理状态流转**：每一次状态变更谁操作的、备注是什么
4. **审计日志**：所有操作都有时间戳

推荐负责人追问的时候，直接拉证据链，别口头说。

---

## 六、状态机一览

| 状态 | 含义 | 下一个可能的状态 |
|---|---|---|
| imported | 刚导入，原始数据 | linji_reviewed / pending_lead_review |
| linji_reviewed | 林姐看完了 | pending_lead_review / lead_approved（不对，得推荐负责人才能批） |
| pending_lead_review | 等推荐负责人看 | lead_approved / lead_rejected / rollback |
| lead_approved | 推荐负责人过了 | summary_updated |
| lead_rejected | 推荐负责人打回 | linji_reviewed（重新看）/ rollback |
| summary_updated | 摘要更完了，归档 | rollback（极少用 |
| rollback | 回滚标记 | 回到上一个状态 |

> 重点：DEFAULT_SCORE_MISSING_FEATURE 的记录，林姐看完也不会自动过，必须等推荐负责人。
