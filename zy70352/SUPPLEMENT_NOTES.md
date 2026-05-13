# 上传附件病毒扫描 API - 补充说明

## 一、主要边界条件

### 1.1 引用边界
- **触发条件**: 调用 `/api/attachments/:id/reference`
- **前置检查**: 附件状态必须是 `usable` 或 `manually_released`
- **边界情况**:
  - 扫描未完成（`isolated` / `scanning`）：拒绝引用
  - 扫描失败（`failed` / `quarantined`）：拒绝引用
  - 已关联的工单再次引用：允许重复关联（每次都会记录）
- **错误响应**:
  ```json
  {
    "error": "Attachment cannot be referenced",
    "reason": "Attachment is in quarantine zone awaiting virus scan"
  }
  ```

### 1.2 下载边界
- **触发条件**: 调用 `/api/attachments/:id/download`
- **前置检查**: 附件状态必须是 `usable` 或 `manually_released`
- **边界情况**:
  - 扫描失败的附件：绝对禁止下载
  - 隔离区/扫描中的附件：禁止下载
  - 人工放行的附件：允许下载（但保留风险原因记录）
- **错误响应**:
  ```json
  {
    "error": "Attachment cannot be downloaded",
    "reason": "Attachment failed virus scan: Virus detected: EICAR-Test-File",
    "riskReason": "Virus detected: EICAR-Test-File"
  }
  ```

### 1.3 人工放行边界
- **触发条件**: 调用 `/api/attachments/:id/release`
- **强制参数**:
  - `reason`: 放行理由（非空字符串，前后空格会被 trim）
  - `releasedBy`: 放行操作人员标识
- **边界情况**:
  - 无理由/理由为空：返回 400
  - 无 `releasedBy`：返回 400
  - 已处于 `usable` 状态的附件：不允许放行（不需要）
  - 已人工放行的附件：可再次放行（会更新记录）
- **业务影响**: 人工放行后，附件状态变为 `manually_released`，**风险原因保留**

### 1.4 重复扫描幂等
- **触发条件**: 调用 `/api/attachments/:id/rescan`
- **幂等策略**:
  - 已扫描过的附件（`scanCount > 0`）：首次 rescan 需要 `force=true`
  - 已 `usable` 状态的附件：rescan 需要 `force=true`
  - 扫描中（`scanning`）的附件：拒绝 rescan，返回当前状态
  - 相同参数的重复扫描：每次都会记录新的扫描历史
- **关键逻辑**（src/routes/attachments.js:145-150）:
  ```javascript
  if (attachment.scanCount > 0 && !req.body.force) {
    return res.status(400).json({
      error: 'Attachment has already been scanned. Use ?force=true to rescan.',
      scanCount: attachment.scanCount
    });
  }
  ```

### 1.5 过期隔离清理
- **触发方式**: 定时任务（每小时执行一次，通过 node-cron 调度）
- **清理规则**（src/services/cleanup.js:12-16）:
  - 附件 `expiresAt` < 当前时间
  - 且附件状态为：`isolated` / `scanning` / `quarantined` / `failed`
- **不清理的情况**:
  - `usable` 或 `manually_released` 状态的附件（已被业务引用）
  - 未过期的附件
- **清理动作**: 完全删除（附件记录 + 扫描历史 + 审计日志 + 业务引用）

---

## 二、一个失败路径（完整场景）

### 场景描述
客户上传了一个 EICAR 测试病毒文件，系统检测到病毒后禁止下载和引用

### 路径步骤
1. **创建附件**（POST `/api/attachments/create`）
   - 请求体:
     ```json
     {
       "filename": "eicar-test-file.txt",
       "contentType": "text/plain",
       "size": 68,
       "customerId": "cust_1004",
       "uploadSource": "customer"
     }
     ```
   - 状态变化: `isolated` → 初始隔离

2. **查询状态**（GET `/api/attachments/:id`）
   - 关键字段:
     ```json
     {
       "status": "isolated",
       "canReference": false,
       "canDownload": false,
       "unavailableReason": "Attachment is in quarantine zone awaiting virus scan"
     }
     ```

3. **尝试引用**（POST `/api/attachments/:id/reference`）
   - 结果: **403 拒绝**
   - 响应:
     ```json
     {
       "error": "Attachment cannot be referenced",
       "reason": "Attachment is in quarantine zone awaiting virus scan"
     }
     ```

4. **发起扫描**（POST `/api/attachments/:id/scan`）
   - 状态变化: `isolated` → `scanning` → `failed`
   - 触发失败: 文件名包含 "eicar" → 模拟病毒引擎识别
   - 关键字段更新:
     ```json
     {
       "scanCount": 1,
       "lastScanResult": "infected",
       "riskReason": "Virus detected: EICAR-Test-File",
       "status": "failed"
     }
     ```

5. **再次查询**（GET `/api/attachments/:id`）
   - 工单系统展示用的关键信息:
     ```json
     {
       "status": "failed",
       "canReference": false,
       "canDownload": false,
       "unavailableReason": "Attachment failed virus scan: Virus detected: EICAR-Test-File",
       "riskReason": "Virus detected: EICAR-Test-File",
       "scanRecords": [
         {
           "result": "infected",
           "details": {
             "threatName": "EICAR-Test-File",
             "confidence": 98
           }
         }
       ]
     }
     ```

6. **尝试下载**（GET `/api/attachments/:id/download`）
   - 结果: **403 拒绝**
   - 响应:
     ```json
     {
       "error": "Attachment cannot be downloaded",
       "reason": "Attachment failed virus scan: Virus detected: EICAR-Test-File",
       "riskReason": "Virus detected: EICAR-Test-File"
     }
     ```

7. **最终处理选项**
   - **选项 A**: 客户重新上传正确文件
   - **选项 B**: 安全团队人工放行（需提供理由）
   - **选项 C**: 24 小时后自动清理

---

## 三、一次重复执行路径（幂等验证）

### 场景描述
对同一个附件执行多次扫描，验证幂等行为和扫描历史累积

### 路径步骤
1. **首次创建**
   - 操作: POST `/api/attachments/create`
   - 结果: `isolated`，`scanCount: 0`

2. **首次扫描**
   - 操作: POST `/api/attachments/:id/scan`
   - 状态: `isolated` → `scanning` → `usable`（假设扫描通过）
   - 结果: `scanCount: 1`，scanRecords 增加 1 条

3. **第一次 rescan（无 force）**
   - 操作: POST `/api/attachments/:id/rescan`
   - 结果: **400 拒绝**（因为 `scanCount > 0` 且无 force）
   - 响应:
     ```json
     {
       "error": "Attachment has already been scanned. Use ?force=true to rescan.",
       "scanCount": 1
     }
     ```
   - **幂等保障**: 状态保持 `usable`，不产生新记录

4. **第一次 rescan（带 force）**
   - 操作: POST `/api/attachments/:id/rescan` 带 `{"force": true}`
   - 状态: `usable` → `scanning` → `usable`
   - 结果: `scanCount: 2`，scanRecords 增加第 2 条

5. **第二次 rescan（带 force）**
   - 操作: POST `/api/attachments/:id/rescan` 带 `{"force": true, "forceResult": "infected"}`
   - 状态: `usable` → `scanning` → `failed`
   - 结果: `scanCount: 3`，scanRecords 增加第 3 条，`riskReason` 被设置

6. **第三次 rescan（带 force，强制通过）**
   - 操作: POST `/api/attachments/:id/rescan` 带 `{"force": true, "forceResult": "clean"}`
   - 状态: `failed` → `scanning` → `usable`
   - 结果: `scanCount: 4`，scanRecords 增加第 4 条，`riskReason` 被清空

7. **查询验证**
   - 操作: GET `/api/attachments/:id`
   - 关键验证点:
     - `scanCount`: 4（确认执行了 4 次扫描）
     - `scanRecords.length`: 4（每次扫描都有历史记录）
     - `auditLogs` 包含所有状态变更记录
     - `status`: `usable`（最终状态）

---

## 四、状态流转图（快速参考）

```
isolated ──► scanning ──► usable
   │             │          │
   │             │          │
   │             ▼          ▼
   │           failed  ──► manually_released
   │             │          │
   │             │          │
   └──◄──────────┴────► rescan (with force)
```

**状态说明**:
- `isolated`: 刚上传，在隔离区等待扫描
- `scanning`: 扫描进行中
- `failed`: 扫描失败（含风险原因）
- `usable`: 扫描通过，可下载/引用
- `manually_released`: 人工放行（保留风险原因记录）
- `quarantined`: 预留状态（当前未使用，但数据结构已支持）

---

## 五、关键代码位置索引

| 功能 | 文件 | 行号 |
|------|------|------|
| 引用权限检查 | src/routes/attachments.js | 240-245 |
| 下载权限检查 | src/routes/attachments.js | 279-285 |
| 人工放行参数校验 | src/routes/attachments.js | 193-199 |
| rescan 幂等检查 | src/routes/attachments.js | 145-150 |
| 过期清理逻辑 | src/services/cleanup.js | 3-27 |
| 病毒扫描模拟 | src/services/virusScanner.js | 3-54 |
| 状态变更审计记录 | src/models/attachment.js | 62-79 |
