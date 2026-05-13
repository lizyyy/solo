# 策略命中解释 API - 补充说明

## 1. 主要边界（Core Boundaries）

### 1.1 策略版本边界
- **发布前边界**：只有 `draft -> published` 的版本能用于实时决策。
- **冻结边界**：`published -> frozen` 后不允许再次发布或回滚到该版本；不允许对 frozen 版本做规则修改。
- **回滚边界**：只能回滚到 `published` 且非 `frozen` 的版本；回滚只影响新决策，不影响历史决策。
- **历史决策边界**：决策记录在落库（本实现内存存储）时快照了 `strategy_version` 和完整 `context/rule_results`，后续策略回滚或新版本发布不会改变历史查询输出。

### 1.2 决策请求边界
- **策略 ID 必须存在**，否则 404。
- **策略必须有已发布版本**（PublishedVersion > 0），否则 400。
- **同一 request_id 全局唯一**，第二次提交直接返回首次结果（幂等）。
- **上下文字段缺失**：规则条件引用的字段在 context 中不存在时，决策失败并返回具体缺失字段名，不产生 decision_id（幂等检查前已失败）。

### 1.3 规则与条件边界
- **规则命中即短路**：规则按顺序执行，第一个 `matched=true` 的规则立即作为最终结果，后续规则不再计算。
- **条件短路**：条件可标记 `short_circuit=true`：
  - 若 `rule.match_all=true`，且某条件失败，则该规则停止继续评估，后续条件不执行，直接标记规则不匹配。
  - 若 `rule.match_all=false`（任一条件满足即命中），且某条件通过，则该规则停止继续评估，标记规则命中。

### 1.4 解释输出边界
- **简版（客服用）**：固定前缀 + 规则名 + 策略版本，不暴露内部条件 ID 或数值细节。
- **详版（研发用）**：包含策略类型、版本、规则 ID/名称、条件路径、每个条件的输入值/期望值/操作符/结果、短路原因。

---

## 2. 失败路径（One Failure Path）

### 2.1 场景：风控策略 + 字段缺失
路径：
1. 业务系统调用 `/decide`，`strategy_id=risk-strategy`，`request_id=req-missing-001`。
2. 幂等检查：`req-missing-001` 不存在，进入决策引擎。
3. 取策略 `risk-strategy`，已发布版本 v1，状态 published（非 frozen）。
4. 按顺序执行第一条规则 `risk-ip（黑名单IP拦截）`。
5. 条件 `c-ip` 字段 `ip_address` 在 context 中不存在。
6. `evaluateCondition` 返回 `error: missing required field: ip_address`。
7. 向上冒泡到 `/decide` handler。
8. 不生成 decision_id，不保存记录，返回 `400 {"error": "missing required field: ip_address"}`。
9. 业务系统必须补充上下文后重试（幂等仍可用 request_id）。

### 2.2 边界校验点（复查用）
- 响应码应为 **400**（不是 200）。
- **不生成** decision_id。
- **不保存** 到决策存储（用该 request_id 再次查询应返回 404）。
- 错误消息应包含缺失字段名，便于定位。

---

## 3. 重复执行路径（One Re-execution Path）

### 3.1 场景：优惠策略 + 首次通过 + 重复请求
路径：
1. 首次请求：`/decide`，`strategy_id=discount-strategy`，`request_id=req-replay-001`，`context={user_level: "VIP"}`。
2. 幂等检查：`req-replay-001` 无记录。
3. 取策略 `discount-strategy` 已发布版本 v1。
4. 命中第一条规则 `disc-vip（VIP用户优惠通过）`。
5. 生成简版：`通过: VIP用户优惠通过 (策略版本v1)`，详版包含条件路径 `c-vip`。
6. 生成 `decision_id=dec-xxxx` 并落库，同时建立 `request_id -> decision_id` 映射。
7. 返回 `200 { ... is_replay: false }`。

8. 业务因超时/重试发起**第二次相同请求**（request_id 相同，context 也相同）。
9. 幂等检查命中：通过 `request_id` 查到 `dec-xxxx`。
10. **不重新执行**策略引擎，不重新命中规则。
11. 直接返回首次保存的结果，同时标记 `is_replay: true`。
12. 即使此时策略已回滚到 v2 或 v1 被冻结，返回的 `simple_explanation`、`detailed_explanation`、`strategy_version` 仍然是首次决策时的 v1 内容（历史快照保持不变）。

### 3.2 边界校验点（复查用）
- 第二次返回的 `decision_id` 与第一次**必须相同**。
- 第二次返回的 `simple_explanation` / `detailed_explanation` 与第一次**完全一致**。
- 第二次响应 `is_replay=true`。
- 若在两次请求之间将策略发布了 v2 或回滚，第二次仍显示 v1 版本的解释（查询接口也是如此）。

---

## 4. 快速复查清单（下一轮可用）

### 4.1 策略版本管理
- [ ] 新建策略版本为 `draft`，未发布不能用于决策（策略 PublishedVersion=0 时 `/decide` 返回 400）。
- [ ] 发布 draft -> published 成功；发布 frozen 返回 400。
- [ ] 冻结仅对 published 生效；冻结后再 publish/freeze 均返回 400。
- [ ] 回滚仅接受 published 且非 frozen 版本；回滚后 `PublishedVersion` 更新但历史决策不变。

### 4.2 决策幂等与字段缺失
- [ ] 同一 request_id 二次请求返回 `is_replay=true` 且 decision_id 不变。
- [ ] 缺失字段时不生成 decision_id，不入库，返回 400 且可重试。
- [ ] 先缺失字段失败后再补全字段重试，能正常生成新 decision。

### 4.3 解释输出一致性（回滚/冻结场景）
- [ ] 在 v1 做出决策记录，然后发布 v2 并回滚到 v1（或 v1 被冻结），查询历史仍显示 v1 解释。
- [ ] 简版不暴露条件路径细节；详版包含条件路径和每个条件的输入/输出。

## 5. 预置策略说明
启动后默认包含两个策略：
- `risk-strategy`（风控拦截）
  - v1 已发布，规则：黑名单IP、高危账户。
- `discount-strategy`（优惠资格）
  - v1 已发布，规则：VIP、积分达标、默认拒绝。
