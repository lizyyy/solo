# 沙箱资源清理保全拦截后端 API

## 核心功能
- **资源清点**：清理前统计沙箱资源明细
- **保全拦截**：设置保全标签的沙箱自动阻止清理
- **状态机流转**：严格的清理流程状态转换校验
- **撤销留痕**：所有操作记录审计日志，包含原始输入和处理结论
- **摘要导出**：完整导出清理记录及审计历史

## 状态流转图
```
pending → inventory_done → preservation_checked → ready_for_cleanup → cleanup_in_progress → cleanup_done
   ↓              ↓                ↓                    ↓                   ↓
cancelled    cancelled       cancelled          cancelled/revoked      cancelled
```

## 保全标签
- `none`：无保全，可正常清理
- `under_investigation`：调查中，禁止清理
- `evidence`：证据保全，禁止清理
- `pending_review`：待审核，禁止清理

## 快速启动

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
服务启动在 `http://localhost:8000`，API 文档：`http://localhost:8000/docs`

## 造数脚本

### 创建多个沙箱清理任务
```bash
# 沙箱 1：正常无保全
curl -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "sandbox_id": "SANDBOX-2024-001",
    "resources": [
      {"resource_type": "file", "resource_id": "malware-sample-01.exe", "size": 2097152},
      {"resource_type": "file", "resource_id": "analysis-report.pdf", "size": 512000},
      {"resource_type": "vm", "resource_id": "sandbox-vm-01", "size": 10737418240}
    ],
    "handler": "security-engineer-01",
    "notes": "常规清理任务"
  }'

# 沙箱 2：调查中（保全拦截）
curl -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "sandbox_id": "SANDBOX-2024-002",
    "resources": [
      {"resource_type": "file", "resource_id": "suspicious-sample.bin", "size": 4096},
      {"resource_type": "memory", "resource_id": "mem-dump.raw", "size": 4294967296}
    ],
    "preservation_tag": "under_investigation",
    "handler": "incident-response",
    "notes": "APT攻击样本调查中，暂不清理"
  }'

# 沙箱 3：证据保全
curl -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "sandbox_id": "SANDBOX-2024-003",
    "resources": [
      {"resource_type": "disk", "resource_id": "evidence-disk-01", "size": 536870912000}
    ],
    "preservation_tag": "evidence",
    "handler": "forensics-team",
    "notes": "司法证据，永久保全"
  }'
```

## cURL 主流程示例

### 正常清理流程
```bash
# 1. 创建清理任务
CREATE_RESP=$(curl -s -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "sandbox_id": "SANDBOX-FLOW-001",
    "resources": [{"resource_type": "file", "resource_id": "test.exe", "size": 1024}],
    "handler": "test-user"
  }')
CLEANUP_ID=$(echo $CREATE_RESP | python -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "创建任务 ID: $CLEANUP_ID"

# 2. 资源清点完成
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "inventory_done", "operator": "auto-scanner", "reason": "资源清点完成，共1个文件"}'

# 3. 保全检查通过
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "preservation_checked", "operator": "security-review", "reason": "无保全标记，可清理"}'

# 4. 准备清理
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "ready_for_cleanup", "operator": "cleanup-manager", "reason": "审批通过，准备清理"}'

# 5. 更新清理计划
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/plan \
  -H "Content-Type: application/json" \
  -d '{
    "cleanup_plan": {
      "steps": ["备份至归档存储", "删除原始文件", "更新资产台账"],
      "estimated_time": "5min",
      "backup_location": "s3://sandbox-archive/"
    },
    "operator": "ops-team",
    "reason": "制定详细清理计划"
  }'

# 6. 开始清理
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "cleanup_in_progress", "operator": "cleanup-agent", "reason": "启动清理脚本"}'

# 7. 完成清理并填写摘要
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/summary \
  -H "Content-Type: application/json" \
  -d '{
    "cleanup_summary": {
      "cleaned_count": 1,
      "freed_size": 1024,
      "status": "success",
      "backup_completed": true,
      "log_id": "CLEAN-2024-00123"
    },
    "operator": "cleanup-agent"
  }'

# 8. 查看审计日志
curl http://localhost:8000/api/cleanup/$CLEANUP_ID/audit
```

### 保全拦截流程
```bash
# 创建带保全标记的任务
CREATE_RESP=$(curl -s -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "sandbox_id": "SANDBOX-BLOCK-001",
    "resources": [{"resource_type": "file", "resource_id": "blocked.exe", "size": 1024}],
    "preservation_tag": "under_investigation",
    "handler": "investigator"
  }')
CLEANUP_ID=$(echo $CREATE_RESP | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 推进状态（预期被拦截）
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "inventory_done", "operator": "scanner"}'

curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "preservation_checked", "operator": "reviewer"}'

# 尝试进入准备清理状态 - 应该返回 403 禁止
curl -v -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "ready_for_cleanup", "operator": "manager"}'
```

### 撤销清理流程
```bash
# 创建任务并推进到 ready_for_cleanup
CREATE_RESP=$(curl -s -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "sandbox_id": "SANDBOX-REVOKE-001",
    "resources": [{"resource_type": "vm", "resource_id": "to-revoke.vm", "size": 1073741824}],
    "handler": "admin"
  }')
CLEANUP_ID=$(echo $CREATE_RESP | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "inventory_done", "operator": "scanner"}'
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "preservation_checked", "operator": "reviewer"}'
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "ready_for_cleanup", "operator": "manager"}'

# 紧急发现重要证据，撤销清理
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "CTI团队确认该沙箱包含0day漏洞利用样本，需立即保全",
    "operator": "cti-team-lead",
    "original_input": {"cti_ticket": "CTI-2024-0892", "severity": "critical"},
    "conclusion": "已撤销，转入深度分析流程，标记为关键证据"
  }'

# 查看审计日志确认留痕
curl http://localhost:8000/api/cleanup/$CLEANUP_ID/audit
```

## 冲突路径示例

### 1. 重复创建冲突
```bash
# 第一次创建成功
curl -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{"sandbox_id": "SANDBOX-CONFLICT-001", "resources": [{"resource_type": "file", "resource_id": "1.exe"}], "handler": "user1"}'

# 同一沙箱重复创建 - 返回 409
curl -v -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{"sandbox_id": "SANDBOX-CONFLICT-001", "resources": [{"resource_type": "file", "resource_id": "2.exe"}], "handler": "user2"}'
```

### 2. 无效状态转换
```bash
CREATE_RESP=$(curl -s -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{"sandbox_id": "SANDBOX-INVALID-001", "resources": [{"resource_type": "file", "resource_id": "test.exe"}], "handler": "user"}')
CLEANUP_ID=$(echo $CREATE_RESP | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 跳过中间状态直接完成 - 返回 400
curl -v -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "cleanup_done", "operator": "user"}'
```

### 3. 已终止任务不可修改
```bash
CREATE_RESP=$(curl -s -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{"sandbox_id": "SANDBOX-TERMINATED-001", "resources": [{"resource_type": "file", "resource_id": "test.exe"}], "handler": "user"}')
CLEANUP_ID=$(echo $CREATE_RESP | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 先取消
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason": "测试取消", "operator": "user"}'

# 尝试修改已取消任务的保全标签 - 返回 400
curl -v -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/preservation \
  -H "Content-Type: application/json" \
  -d '{"preservation_tag": "evidence", "operator": "user"}'
```

### 4. 清理进行中无法设置保全
```bash
CREATE_RESP=$(curl -s -X POST http://localhost:8000/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{"sandbox_id": "SANDBOX-CLEANING-001", "resources": [{"resource_type": "file", "resource_id": "test.exe"}], "handler": "user"}')
CLEANUP_ID=$(echo $CREATE_RESP | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "inventory_done", "operator": "user"}'
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "preservation_checked", "operator": "user"}'
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "ready_for_cleanup", "operator": "user"}'
curl -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"new_status": "cleanup_in_progress", "operator": "user"}'

# 尝试在清理进行中设置保全 - 返回 400
curl -v -X PATCH http://localhost:8000/api/cleanup/$CLEANUP_ID/preservation \
  -H "Content-Type: application/json" \
  -d '{"preservation_tag": "evidence", "operator": "emergency-team"}'
```

## 常用查询接口

### 列出所有清理任务
```bash
curl http://localhost:8000/api/cleanup
```

### 按状态筛选
```bash
curl "http://localhost:8000/api/cleanup?status=pending"
curl "http://localhost:8000/api/cleanup?status=revoked"
```

### 按保全标签筛选
```bash
curl "http://localhost:8000/api/cleanup?preservation_tag=under_investigation"
```

### 按沙箱 ID 模糊搜索
```bash
curl "http://localhost:8000/api/cleanup?sandbox_id=2024"
```

### 查看统计概览
```bash
curl http://localhost:8000/api/stats
```

### 导出所有数据（含审计日志）
```bash
curl http://localhost:8000/api/export/cleanup
```

### 按条件导出
```bash
curl "http://localhost:8000/api/export/cleanup?status=revoked&preservation_tag=evidence"
```

## 运行 pytest 测试

### 安装测试依赖
```bash
pip install pytest httpx
```

### 运行所有测试
```bash
pytest test_main.py -v
```

### 运行特定测试类
```bash
pytest test_main.py::TestCreateCleanup -v
pytest test_main.py::TestPreservationInterception -v
pytest test_main.py::TestStatusFlow -v
```

### 生成测试覆盖率报告
```bash
pytest test_main.py --cov=main --cov-report=html
```

## 数据库结构

### sandbox_cleanup 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| sandbox_id | String(64) | 沙箱编号，唯一索引 |
| status | String(32) | 清理状态 |
| preservation_tag | String(32) | 保全标签 |
| resource_inventory | JSON | 资源清单 |
| cleanup_plan | JSON | 清理计划 |
| cleanup_summary | JSON | 清理摘要 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |
| planned_cleanup_at | DateTime | 计划清理时间 |
| handler | String(128) | 处理人 |
| notes | Text | 备注 |
| revoke_reason | Text | 撤销原因 |
| revoked_by | String(128) | 撤销人 |
| revoked_at | DateTime | 撤销时间 |

### audit_log 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| cleanup_id | Integer | 关联清理任务ID |
| action | String(64) | 操作类型 |
| old_status | String(32) | 旧状态 |
| new_status | String(32) | 新状态 |
| operator | String(128) | 操作人 |
| reason | Text | 操作原因 |
| original_input | JSON | 原始输入（异常路径留痕） |
| conclusion | Text | 处理结论 |
| created_at | DateTime | 操作时间 |

## API 接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/cleanup | 创建清理任务 |
| GET | /api/cleanup | 查询清理任务列表 |
| GET | /api/cleanup/{id} | 查询单个清理任务 |
| PATCH | /api/cleanup/{id}/status | 推进状态 |
| PATCH | /api/cleanup/{id}/preservation | 修改保全标签 |
| PATCH | /api/cleanup/{id}/revoke | 撤销清理 |
| PATCH | /api/cleanup/{id}/cancel | 取消清理 |
| PATCH | /api/cleanup/{id}/plan | 更新清理计划 |
| PATCH | /api/cleanup/{id}/summary | 更新清理摘要并完成 |
| GET | /api/cleanup/{id}/audit | 查询审计日志 |
| GET | /api/export/cleanup | 导出数据 |
| GET | /api/stats | 统计概览 |
