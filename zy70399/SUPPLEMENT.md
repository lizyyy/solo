# 服务级降噪通知 API - 补充说明文档

## 一、核心设计边界

### 1.1 通知聚合维度

**聚合键：serviceId + tenantId + severity + messageKey**

- `serviceId`：服务标识（如 order-service）
- `tenantId`：租户标识（如 tenant-alibaba）
- `severity`：严重级别（info/warning/error/critical）
- `messageKey`：业务消息标识（如 db_connection_timeout）

**边界含义**：
- 不同服务的通知永远不会被合并
- 同一服务不同租户的通知独立处理
- 不同严重级别的通知（如 warning vs error）即使 messageKey 相同也不会合并
- 同一聚合键下的通知形成"通知组"

### 1.2 严重级别定义

```
info < warning < error < critical
```

- **高级别阈值**：error 及以上（error、critical）
- **高级别特性**：不受静默窗口限制，始终立即发送

### 1.3 静默窗口边界

- 默认 30 分钟，可按服务+租户自定义
- 静默窗口从**上一次发送时间**开始计算，而非首次接收时间
- 关闭通知组后，相同聚合键的新通知会创建新组，重新开始计时

### 1.4 通知确认边界

- 确认仅标记 `confirmed=true`，不改变活跃状态
- 确认后无新证据的重复通知仍被压制
- 确认后带新证据（evidence 非空对象）的通知会被发送
- 关闭通知组后，确认状态被隐式终止

### 1.5 租户失败计数边界

- 失败计数绑定到 `serviceId + tenantId`，而非单个通知组
- 计数在通知组关闭时重置
- 不同 messageKey 的通知共享同一失败计数

---

## 二、一个失败路径

### 场景：确认后新通知被错误压制

**预期行为**：操作员确认后，如果有新证据到来，应该重新发送通知

**失败触发条件**：
```
规则配置: notifyOnRecurrence = true

步骤1: 发送通知A（warning, 有messageKey=X）→ 发送成功，创建组G
步骤2: 操作员确认组G
步骤3: 发送通知B（相同messageKey=X，evidence={}）→ 被压制（正确）
步骤4: 发送通知C（相同messageKey=X，evidence={ip: "1.2.3.4"}）→ 应该发送

失败点: 如果步骤4中 evidence 被序列化为空对象 {}
        （例如前端提交时遗漏，或者后端清理时意外清空）
        则通知C会被错误压制
```

**失败路径分析**：

1. **入口**：`src/services/notificationService.js:160`
   ```javascript
   } else if (group.confirmed && rule.notifyOnRecurrence && Object.keys(evidence).length > 0) {
   ```

2. **判断条件**：
   - `group.confirmed = true` ✓
   - `rule.notifyOnRecurrence = true` ✓
   - `Object.keys(evidence).length > 0` ✗（应为 true，但实际为 false）

3. **后果**：
   - 通知不会发送
   - `suppressed = true`
   - 被压制计数递增
   - 操作员看不到新证据

4. **根因**：
   - 上游系统传入 evidence 格式不规范
   - 或者后端在处理前对 evidence 做了错误的清理

**预防措施**：
- API 层验证 evidence 如果提供必须是非空对象
- 考虑将"新证据"的判断扩展到 message 变化或其他字段
- 在降噪报告中特别标记"确认后被压制"的通知

---

## 三、一次重复执行路径

### 场景：同一条通知因网络重试被重复接收

**前提**：
- 通知发送端可能因网络问题重试
- 重试时使用相同的通知载荷
- 没有消息去重机制（如 Kafka offset 追踪）

**重复执行路径**：

```
第一次接收（正常流程）:
┌─────────────────────────────────────────────────────┐
│ 1. 检查是否有活跃组: findActiveGroup(...)           │
│    → 无，创建新组 G1                                 │
│ 2. 判断是否发送: !group.lastSentAt → true           │
│ 3. 发送成功: sent=true, sendType='initial'          │
│ 4. 更新 lastSentAt = now                            │
│ 5. 写入发送历史                                      │
└─────────────────────────────────────────────────────┘

第二次接收（3秒后重试，静默窗口内）:
┌─────────────────────────────────────────────────────┐
│ 1. 检查是否有活跃组: findActiveGroup(...)           │
│    → 找到 G1（status=active）                       │
│ 2. 判断是否发送:                                     │
│    - !group.lastSentAt → false                      │
│    - shouldBypassSilence(severity) → false          │
│    - group.confirmed? → false                       │
│ 3. 判定: 在静默窗口内 → 被压制                       │
│ 4. suppressed=true, 压制计数+1                       │
│ 5. 不写入发送历史                                    │
└─────────────────────────────────────────────────────┘
```

**代码执行路径**（`src/services/notificationService.js`）：

| 步骤 | 函数/行号 | 执行分支 |
|------|----------|---------|
| 1 | `processIncomingNotification:95` | `findActiveGroup` 第1次返回 null，第2次返回 G1 |
| 2 | `processIncomingNotification:98-117` | 第1次创建新组，第2次复用 |
| 3 | `processIncomingNotification:133` | 第1次 `shouldSend = true`，第2次 `shouldSend = false` |
| 4 | `processIncomingNotification:140-169` | 第1次走 `isNewGroup` 分支，第2次走 else 压制分支 |
| 5 | `processIncomingNotification:171-188` | 第1次写入历史，第2次跳过 |

**重复执行的影响**：

1. **副作用累积**：
   - `store.incrementSuppressed(groupId)` 被多次调用
   - 被压制计数虚高
   - 降噪报告中的统计数据不准确

2. **状态一致性**：
   - 通知组状态仍然正确（active）
   - 最后发送时间不会被更新（正确）
   - 失败计数会递增（可能导致过早升级）

**缓解策略**：

- 短期：在降噪报告中标注"可能包含重复接收"
- 中期：引入通知级别的去重（如 5 分钟内相同载荷视为重复）
- 长期：使用消息队列的 exactly-once 语义

---

## 四、复查检查清单

### 4.1 边界复查

- [ ] 确认不同服务的通知不会被错误合并
- [ ] 确认不同租户的通知独立统计失败计数
- [ ] 确认 error/critical 始终绕过静默
- [ ] 确认 info/warning 遵循静默窗口

### 4.2 失败路径复查

- [ ] 检查 `notifyOnRecurrence` 分支的 evidence 判断逻辑
- [ ] 验证 evidence 空对象 `{}` 是否被正确识别为"无新证据"
- [ ] 模拟确认后发送带空 evidence 的通知，确认被压制
- [ ] 模拟确认后发送带实际 evidence 的通知，确认被发送

### 4.3 重复执行复查

- [ ] 模拟短时间内（<静默窗口）重复接收相同通知
- [ ] 确认第 1 次发送，第 2+ 次被压制
- [ ] 检查被压制计数是否与重复次数一致
- [ ] 确认发送历史中只有 1 条记录
- [ ] 确认通知组状态保持一致
