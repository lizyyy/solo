# 证书自动续签编排 API 使用指南

## 系统概述

本系统专注于解决服务证书续签后，负载均衡、网关和客户端信任链不同步的问题。

### 核心流程
1. **证书清单** → 管理所有证书，监控到期状态
2. **续签任务** → 创建并执行证书续签任务
3. **部署回执** → 确认每个目标节点的部署状态
4. **健康探测** → 验证部署后服务是否正常
5. **失败回滚** → 问题发生时自动恢复到旧证书
6. **到期报表** → 可检查的统计和状态输出

## 启动服务

```bash
go run cmd/api/main.go
```

服务将在 `http://localhost:8080` 启动

## API 端点

### 1. 证书管理

#### 列出所有证书
```bash
GET /api/certificates
```

#### 创建证书
```bash
POST /api/certificates
Content-Type: application/json

{
  "common_name": "api.example.com",
  "sans": ["www.example.com", "mail.example.com"],
  "valid_days": 365,
  "auto_renew": true,
  "tags": {
    "environment": "production",
    "team": "infrastructure"
  }
}
```

### 2. 任务管理

#### 列出所有任务
```bash
GET /api/tasks
```

#### 创建续签任务
```bash
POST /api/tasks
Content-Type: application/json

{
  "certificate_id": "cert-xxxxxx",
  "targets": [
    {
      "id": "lb-01",
      "type": "load_balancer",
      "name": "Primary Load Balancer",
      "endpoint": "https://lb01.example.com:8443",
      "health_check_endpoint": "https://lb01.example.com:8443/health"
    },
    {
      "id": "gateway-01",
      "type": "gateway",
      "name": "API Gateway",
      "endpoint": "https://gateway01.example.com:443",
      "health_check_endpoint": "https://gateway01.example.com:443/health"
    }
  ]
}
```

#### 获取任务详情
```bash
GET /api/tasks/{task_id}
```

#### 重试任务
```bash
POST /api/tasks/{task_id}/retry
```

#### 取消任务
```bash
POST /api/tasks/{task_id}/cancel
```

#### 解决冲突
```bash
POST /api/tasks/{task_id}/resolve-conflict
Content-Type: application/json

{
  "conflict_id": "conflict-xxxxxx",
  "resolution": "Manual validation passed, health check endpoint is now available"
}
```

### 3. 报表管理

#### 生成到期报表
```bash
POST /api/reports
```

#### 获取报表详情
```bash
GET /api/reports/{report_id}
```

---

## 🎯 处理成功标准

### 什么算处理成功？

任务必须同时满足以下所有条件：

1. **任务状态 = completed**
   - `task.status == "completed"`

2. **所有部署回执已验证**
   - `task.all_receipts_verified() == true`
   - 每个目标的回执状态都必须是 `verified`
   - 回执数量必须与目标数量一致

3. **所有健康探测通过**
   - `task.all_health_checks_passed() == true`
   - 每个回执的健康检查 `success == true`

4. **无未解决的冲突**
   - `task.has_unresolved_conflicts() == false`
   - 所有冲突都必须标记为 `resolved: true`

5. **在超时时间内完成**
   - `task.is_within_timeout() == true`
   - 当前时间在任务超时时间之前

### 代码实现
这些判断逻辑在 `internal/models/validation.go` 中，可通过单元测试验证：

```go
func (task *RenewalTask) MeetsSuccessCriteria() bool {
	if !task.IsCompleted() {
		return false
	}
	if !task.AllReceiptsVerified() {
		return false
	}
	if !task.AllHealthChecksPassed() {
		return false
	}
	if task.HasUnresolvedConflicts() {
		return false
	}
	return true
}
```

---

## ❌ 处理失败场景

### 1. 部署回执失败
**症状**：某个目标的回执状态为 `failed`

**下一步检查**：
1. 查看任务详情：`GET /api/tasks/{task_id}`
2. 检查具体哪个回执失败：`task.receipts[].status == "failed"`
3. 查看回执错误信息：`receipt.error`

**系统行为**：
- 如果还有重试次数（`retry_count < max_retries`）：任务状态变为 `pending_retry`
- 如果已达最大重试次数：任务状态变为 `failed`，触发回滚

### 2. 健康探测失败
**症状**：回执的 `health_check.success == false`

**下一步检查**：
1. 检查健康检查端点：`target.health_check_endpoint`
2. 查看健康检查错误：`health_check.error`
3. 验证目标服务是否正常运行

**系统行为**：同部署回执失败

### 3. 任务超时
**症状**：任务状态为 `timeout`

**下一步检查**：
1. 查看超时时间：`task.timeout_at`
2. 检查目标系统是否响应缓慢
3. 考虑增加任务超时时间配置

**系统行为**：直接触发回滚，需要人工复核

### 4. 冲突检测
**症状**：任务状态为 `conflict`

**常见冲突类型**：
- `missing_health_check`：目标没有配置健康检查端点
- `active_task_conflict`：同一证书已有活跃任务
- `certificate_expired`：证书已过期

**下一步检查**：
1. 查看冲突列表：`task.conflicts[]`
2. 解决冲突后调用：`POST /api/tasks/{id}/resolve-conflict`

---

## 🔄 回滚机制

### 什么时候触发回滚？

回滚在以下情况自动触发（当 `rollback.enabled = true` 时）：

1. **任务超时** - 超过 `task_scheduler.task_timeout`
2. **部署/健康检查失败且无重试次数** - 已达 `max_retries`
3. **冲突无法解决** - 所有冲突解决后仍失败

### 回滚流程

1. 创建回滚任务（`is_rollback: true`）
2. 将旧证书重新部署到所有目标
3. 执行健康检查验证
4. 原任务状态变为 `rolled_back`
5. **必须人工复核**

### 检查回滚状态

```bash
GET /api/tasks/{original_task_id}

# 查看回滚任务详情
GET /api/tasks/{rollback_task_id}
```

---

## ⚠️ 人工复核场景

### 什么情况必须人工介入？

以下情况任务状态都会标记为需要人工复核：

| 场景 | 任务状态 | 复核原因 |
|------|----------|----------|
| 回滚执行完成 | `rolled_back` | 已恢复到旧证书，需要调查原因 |
| 任务超时 | `timeout` | 不确定部署状态，需要验证 |
| 失败且无重试次数 | `failed` | 自动恢复机制已用尽 |
| 存在未解决冲突 | `conflict` | 需要人工判断如何处理 |
| 健康探测部分失败 | `failed` | 部分目标可能在使用新证书，部分在旧证书 |

### 人工复核清单

当看到 `RequiresManualReview() == true` 时，请按以下步骤检查：

1. **检查证书状态**
   ```bash
   GET /api/certificates/{cert_id}
   # 确认证书当前状态是 renewing / rolled_back / requires_approval
   ```

2. **检查所有目标的部署情况**
   - 负载均衡：验证监听器配置
   - 网关：检查证书绑定
   - 客户端：确认信任链更新

3. **执行手动健康检查**
   ```bash
   curl -v https://target-endpoint/health
   # 确认证书指纹是否正确
   ```

4. **决策**
   - 如果确认新证书可用：手动标记任务完成
   - 如果需要恢复：确认回滚已正确执行
   - 如果需要重试：调用重试 API

---

## 📊 到期报表

### 生成报表

```bash
POST /api/reports
```

### 报表字段说明

| 字段 | 含义 |
|------|------|
| `expiring_certs` | 30天内到期的证书列表 |
| `expired_certs` | 已过期的证书列表 |
| `active_certs` | 当前活跃的证书列表 |
| `statistics.total_certs` | 证书总数 |
| `statistics.expiring_certs` | 即将到期数量 |
| `statistics.expired_certs` | 已过期数量 |
| `statistics.failed_renewals` | 续签失败数量 |
| `statistics.pending_approval` | 等待人工处理数量 |
| `statistics.success_rate` | 续签成功率 |

### 报表使用建议

1. **定期生成**：建议每天生成一次
2. **关注 `expiring_certs`**：这些证书需要在30天内处理
3. **关注 `pending_approval`**：这些是需要人工处理的任务
4. **低成功率预警**：如果 `success_rate` < 90%，需要检查系统健康状况

---

## 🔧 故障排查指南

### 问题：任务一直卡在 `processing`

**检查步骤**：
1. 确认目标系统是否可达
2. 检查网络连接和防火墙
3. 查看任务超时时间是否合理
4. 考虑增加健康检查超时配置

### 问题：健康探测总是失败

**检查步骤**：
1. 验证健康检查端点配置正确
2. 手动访问端点确认返回正常
3. 检查证书链是否完整
4. 确认目标服务已重新启动或重载配置

### 问题：回滚后服务仍不可用

**紧急步骤**：
1. 立即检查所有目标的证书状态
2. 手动部署旧证书到受影响的目标
3. 验证健康检查恢复正常
4. 调查回滚失败的原因

### 问题：同一证书多个任务冲突

**解决方法**：
1. 查看所有相关任务：`GET /api/tasks?certificate_id=xxx`
2. 取消不需要的任务：`POST /api/tasks/{id}/cancel`
3. 重新创建任务

---

## 🧪 核心判断逻辑测试

所有关键判断逻辑都有对应的单元测试，可随时验证：

```bash
go test ./internal/models -v -run TestTaskSuccessCriteria
go test ./internal/models -v -run TestRequiresManualReview
go test ./internal/models -v -run TestDetermineFinalStatus
go test ./internal/models -v
```

测试覆盖的场景：
- 成功标准判断
- 人工复核判断
- 最终状态确定
- 回执验证逻辑
- 重试次数判断
- 冲突检测

---

## 📋 快速参考

### 任务状态流转

```
pending → processing → completed (成功)
              ↓
         pending_retry → retrying → ... (最多 max_retries 次)
              ↓
            failed → rolling_back → rolled_back (需要人工复核)
              ↓
           timeout (需要人工复核)
              ↓
          conflict (需要人工解决)
```

### 证书状态流转

```
active → expiring → renewing → renewed (成功)
                              ↓
                         rolled_back (回滚后)
                              ↓
                         requires_approval (需要人工处理)
```

### 回执状态

| 状态 | 含义 |
|------|------|
| `pending` | 等待部署 |
| `deployed` | 已部署，等待验证 |
| `verified` | 部署成功，健康检查通过 |
| `failed` | 部署或健康检查失败 |
| `rolled_back` | 已回滚 |

---

## 🔒 安全注意事项

1. **证书私钥**：当前版本的 PEM 数据存储在内存中，生产环境应使用密钥管理服务
2. **访问控制**：API 应添加认证和授权机制
3. **审计日志**：建议记录所有任务操作
4. **备份**：定期导出证书清单和任务历史

---

## 🚀 下一步

1. 启动服务并测试基本流程
2. 查看单元测试验证核心逻辑
3. 根据实际环境调整配置参数
4. 集成实际的证书提供商（Let's Encrypt、内部 CA 等）
5. 实现真实的部署器（替换当前的模拟实现）
