# 售后知识推荐 API

面向售后工程师的故障处理知识推荐系统，提供基于机型、错误码、历史工单的智能推荐服务。

---

## 1. 本地启动

### 1.1 环境准备

```bash
# 进入项目目录
cd /Users/mac/pro/solo/workspaces/xy10597

# 创建虚拟环境（推荐）
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 1.2 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/api/health

---

## 2. 内置样例数据

服务启动时自动初始化以下数据（仅在空库时执行一次）：

### 2.1 机型数据（4个机型）
| 机型代码 | 机型名称 | 产品线 |
|---------|---------|--------|
| PRD-A100 | Product-A 100系列 | Product-A |
| PRD-A200 | Product-A 200系列 | Product-A |
| PRD-B100 | Product-B 100系列 | Product-B |
| PRD-B200 | Product-B 200系列 | Product-B |

### 2.2 备件数据（5个备件）
| 备件代码 | 备件名称 | 兼容机型 | 库存 | 安全库存 | 状态 |
|---------|---------|---------|-----|---------|------|
| PART-MB-001 | 主控板 | PRD-A100, A200 | 15 | 5 | 充足 |
| PART-MB-002 | 主控板(B型) | PRD-B100, B200 | 3 | 5 | **缺货** |
| PART-PS-001 | 电源模块 | 全机型 | 0 | 3 | **缺货** |
| PART-SENSOR-001 | 温度传感器 | 全机型 | 50 | 10 | 充足 |
| PART-FAN-001 | 散热风扇 | A100, B100 | 8 | 2 | 充足 |

### 2.3 知识条目（7条）
覆盖4个错误码，设计了：
- **准确匹配**: KL-ERR-001-01 (A系列ERR-001，成功率90%)
- **机型差异化**: KL-ERR-001-01 vs KL-ERR-001-02 (A/B系列不同方案)
- **过期知识**: KL-ERR-003-01 (ERR-003旧方案，已过期)
- **新版知识**: KL-ERR-003-02 (ERR-003新方案，无历史数据)

### 2.4 历史工单（5条已完成工单）
作为相似历史的匹配基础，可验证推荐的历史依据。

---

## 3. 主要演示路径

### 3.1 路径一：准确推荐完整流程

**场景**: 售后工程师处理 A100 机型出现 ERR-001 错误

```bash
# Step 1: 创建工单
curl -X POST http://localhost:8000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "DEMO-2026-001",
    "model_code": "PRD-A100",
    "error_code": "ERR-001",
    "description": "设备无法连接网络，通信中断，重启后问题复现",
    "engineer_id": "ENG-NEW-001"
  }'

# 预期: 返回 status=CREATED，历史记录新增"创建工单"
```

```bash
# Step 2: 生成推荐
curl -X POST http://localhost:8000/api/orders/DEMO-2026-001/advance \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate",
    "operator": "ENG-NEW-001"
  }'
```

**预期结果验证**（在返回的 `knowledge_recommendations` 中查看）：
1. **推荐依据**：
   - 第1名 `KL-ERR-001-01` 得分约 **150分**
   - 包含：机型匹配+30分，成功率90%+18分
   - `model_match=true`, `is_expired=false`
   - 推荐备件 `PART-MB-001`

2. **机型差异化**：
   - 第2名 `KL-ERR-001-02` (B系列) 得分约 **115分**
   - 包含：机型不匹配-25分（但B系列方案本身有数据）

3. **相似历史**：
   - 返回 HIST-2026-001、HIST-2026-002 等A系列历史
   - similarity 约 80+

4. **备件可用性**：
   - `PART-MB-001` 显示 `available=true`, 库存15

```bash
# Step 3: 执行推荐（工程师开始处理）
curl -X POST http://localhost:8000/api/orders/DEMO-2026-001/advance \
  -H "Content-Type: application/json" \
  -d '{
    "action": "execute",
    "operator": "ENG-NEW-001",
    "reason": "按推荐步骤检查通信线缆"
  }'
# 预期: status 变为 IN_PROGRESS
```

```bash
# Step 4: 提交反馈（成功解决）
curl -X POST http://localhost:8000/api/orders/DEMO-2026-001/advance \
  -H "Content-Type: application/json" \
  -d '{
    "action": "feedback",
    "operator": "ENG-NEW-001",
    "feedback_data": {
      "knowledge_code": "KL-ERR-001-01",
      "effectiveness": 90,
      "comment": "重启主控板后恢复正常"
    }
  }'
# 预期: KL-ERR-001-01 的 success_count 和 total_usage 各+1
```

```bash
# Step 5: 完成工单
curl -X POST http://localhost:8000/api/orders/DEMO-2026-001/advance \
  -H "Content-Type: application/json" \
  -d '{
    "action": "complete",
    "operator": "ENG-NEW-001",
    "reason": "故障已解决"
  }'
```

```bash
# Step 6: 查看完整报告
curl http://localhost:8000/api/reports/order/DEMO-2026-001
# 预期: 显示完整时间线、推荐记录、反馈链
```

---

### 3.2 路径二：机型不匹配降权

**场景**: 同样 ERR-001，但机型换成 B200

```bash
# 创建工单
curl -X POST http://localhost:8000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "DEMO-2026-002",
    "model_code": "PRD-B200",
    "error_code": "ERR-001",
    "description": "无线连接失败，指示灯红色闪烁"
  }'

# 生成推荐
curl -X POST http://localhost:8000/api/orders/DEMO-2026-002/advance \
  -H "Content-Type: application/json" \
  -d '{"action":"generate"}'
```

**预期结果**：
- 第1名变为 `KL-ERR-001-02` (B系列方案，成功率80%)
- A系列方案 `KL-ERR-001-01` 因机型不匹配被降权，排名下降
- 推荐备件 `PART-MB-002` 显示 `available=false`（库存3 < 安全库存5）

---

### 3.3 路径三：过期知识提示

**场景**: 处理 ERR-003 错误

```bash
curl -X POST http://localhost:8000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "DEMO-2026-003",
    "model_code": "PRD-A100",
    "error_code": "ERR-003",
    "description": "电源指示灯异常，无法开机"
  }'

curl -X POST http://localhost:8000/api/orders/DEMO-2026-003/advance \
  -H "Content-Type: application/json" \
  -d '{"action":"generate"}'
```

**预期结果**：
- 第1名 `KL-ERR-003-02` (新版，无历史数据，约130分)
- 第2名 `KL-ERR-003-01` **标注 `is_expired=true`**
  - 原成功率50%但因过期-50分，约80分
  - `score_details` 包含"知识过期 -50分"
- 推荐备件 `PART-PS-001` 显示 `available=false`（库存0）

---

### 3.4 路径四：反馈影响排序变化

**场景**: 持续给某知识低分反馈，观察成功率变化

```bash
# 给 KL-ERR-001-01 一个低分
curl -X POST http://localhost:8000/api/orders/DEMO-2026-004/advance \
  -H "Content-Type: application/json" \
  -d '{
    "action": "feedback",
    "feedback_data": {
      "knowledge_code": "KL-ERR-001-01",
      "effectiveness": 20,
      "comment": "该方案无效，实际是网络问题"
    }
  }'

# 查看知识改进报告，观察成功率下降
curl http://localhost:8000/api/reports/knowledge-improvement
```

**预期结果**：
- KL-ERR-001-01 的 `success_rate` 从90%下降
- 后续同错误码推荐时，该知识的排名会下降

---

### 3.5 路径五：人工修正追踪

**场景**: 工程师不认可推荐，手动选择其他知识

```bash
curl -X POST http://localhost:8000/api/orders/DEMO-2026-005/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "ENG-SENIOR-001",
    "reason": "实际经验表明这是网络环境问题",
    "priority_knowledge_code": "KL-ERR-001-03",
    "comment": "推荐优先检查防火墙设置"
  }'
```

**预期结果**：
- 返回 `diff` 对象，清晰展示：
  - before: 原来排名第1的知识代码和标题
  - after: 人工修正后的知识代码和原因
- `is_manual_correction=true`
- 历史记录标记为"人工修正"

---

## 4. 失败路径演示

### 4.1 场景：状态机非法转移

```bash
# 1. 创建工单
curl -X POST http://localhost:8000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"order_no":"FAIL-001","model_code":"PRD-A100","error_code":"ERR-001","description":"test"}'

# 2. 错误操作：跳过"生成推荐"直接"提交反馈"
curl -X POST http://localhost:8000/api/orders/FAIL-001/advance \
  -H "Content-Type: application/json" \
  -d '{
    "action": "feedback",
    "operator": "ENG-TEST",
    "feedback_data": {"knowledge_code": "KL-ERR-001-01", "effectiveness": 80}
  }'
```

**预期结果**：
1. HTTP 400 错误
2. 工单状态变为 `EXCEPTION`
3. 查看工单详情：
   ```bash
   curl http://localhost:8000/api/orders/FAIL-001
   ```
4. `history_timeline` 中出现：
   - `action="异常处理"`
   - `reason="当前状态 CREATED 不能执行反馈"`
   - `data_after.error` 包含失败原因

---

## 5. 幂等性验证

```bash
# 生成推荐后重复调用
curl -X POST http://localhost:8000/api/orders/DEMO-2026-001/advance \
  -H "Content-Type: application/json" \
  -d '{"action":"generate"}'

# 预期: 返回 is_idempotent=true，不创建新推荐
```

---

## 6. 核心规则说明

| 规则 | 实现位置 | 验证方式 |
|-----|---------|---------|
| 机型匹配加分 | engine.py:calculate_knowledge_score | 路径一/二 |
| 机型不匹配降权 | engine.py:calculate_knowledge_score | 路径二 |
| 同产品线加分 | engine.py:calculate_knowledge_score | 路径二 |
| 知识过期降权 | engine.py:calculate_knowledge_score | 路径三 |
| 成功率排序 | engine.py | 路径四 |
| 备件缺货提示 | engine.py:check_part_availability | 路径二/三 |
| 重复推荐幂等 | state_machine.py | 幂等验证 |
| 状态机校验 | state_machine.py:VALID_TRANSITIONS | 失败路径 |
| 人工修正留痕 | state_machine.py:submit_feedback | 路径五 |
| 前后差异记录 | 所有_history操作 | 查看报告 |
| 操作者记录 | 所有_history操作 | 查看报告 |

---

## 7. 报告输出说明

### 知识改进报告 (`/api/reports/knowledge-improvement`)

输出内容（不看源码也能判断闭环）：
```json
{
  "summary": {
    "total_knowledge": 7,
    "expired_knowledge": 1,
    "total_orders": 6,
    "completed_orders": 5,
    "manual_corrections": 1
  },
  "knowledge_performance": [
    {
      "knowledge_code": "KL-ERR-001-01",
      "success_rate": 90.0,
      "avg_effectiveness": 87.5
    }
  ],
  "manual_correction_details": [
    {
      "operator": "ENG-SENIOR-001",
      "diff_before": {...},
      "diff_after": {...}
    }
  ]
}
```

**闭环判断依据**：
1. ✅ 成功率随反馈动态变化 → 反馈有效
2. ✅ 过期知识可统计 → 知识生命周期管理
3. ✅ 人工修正有记录 → 人在回路闭环

---

## 8. API 速查

| 接口 | 方法 | 说明 |
|-----|-----|------|
| `/api/orders` | POST | 创建工单 |
| `/api/orders` | GET | 工单列表查询 |
| `/api/orders/{no}` | GET | 工单详情 |
| `/api/orders/{no}/advance` | POST | 推进状态 (generate/execute/feedback/complete) |
| `/api/orders/{no}/exception` | POST | 记录异常 |
| `/api/orders/{no}/manual-correction` | POST | 人工修正 |
| `/api/reports/knowledge-improvement` | GET | 知识改进报告 |
| `/api/reports/order/{no}` | GET | 工单完整报告 |
| `/api/health` | GET | 健康检查 |
