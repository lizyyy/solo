# 夜市摊位轮换 API 文档

## 基础信息
- **基础 URL**: `http://localhost:8080/api/v1`
- **数据格式**: JSON
- **数据库**: SQLite (night_market.db)

---

## 一、摊位管理 (Stalls)

### 1.1 创建摊位
**POST** `/stalls`

请求体:
```json
{
  "code": "A01",
  "name": "A区1号摊位",
  "power_capacity": 5000,
  "has_exhaust": true,
  "zone": "A区-餐饮"
}
```

### 1.2 获取所有摊位
**GET** `/stalls`

---

## 二、摊主管理 (Vendors)

### 2.1 创建摊主
**POST** `/vendors`

请求体:
```json
{
  "name": "老张烧烤",
  "phone": "13800138000",
  "category": "烧烤",
  "power_usage": 7000,
  "requires_exhaust": true
}
```

### 2.2 获取所有摊主
**GET** `/vendors`

---

## 三、轮换周期管理 (Rotation Cycles)

### 3.1 创建轮换周期
**POST** `/cycles`

请求体:
```json
{
  "name": "2026年第3周轮换",
  "start_date": "2026-05-18",
  "end_date": "2026-05-24",
  "created_by": "管理员"
}
```

### 3.2 获取所有周期
**GET** `/cycles`

### 3.3 创建摊位分配
**POST** `/cycles/{cycleId}/assignments`

请求体:
```json
{
  "cycle_id": "xxx",
  "vendor_id": "vendor-001",
  "stall_id": "stall-006",
  "operator": "管理员"
}
```

### 3.4 获取周期分配列表
**GET** `/cycles/{cycleId}/assignments`

### 3.5 删除分配
**DELETE** `/cycles/assignments/{id}`

请求体:
```json
{
  "operator": "管理员"
}
```

### 3.6 校验周期
**POST** `/cycles/{cycleId}/validate`

请求体:
```json
{
  "operator": "管理员"
}
```

**校验规则**:
- 用电容量匹配: `vendor.power_usage <= stall.power_capacity
- 油烟设备匹配: 需要油烟的摊主必须分配到有油烟的摊位
- 唯一性检查: 每个摊主和摊位不能重复分配

### 3.7 定稿周期
**POST** `/cycles/{cycleId}/finalize`

请求体:
```json
{
  "operator": "管理员"
}
```

### 3.8 重新打开周期
**POST** `/cycles/{cycleId}/reopen`

请求体:
```json
{
  "operator": "管理员"
}
```

### 3.9 获取智能分配建议
**GET** `/cycles/{cycleId}/suggest`

### 3.10 生成轮换报告
**GET** `/cycles/{cycleId}/report`

### 3.11 导出CSV报告
**GET** `/cycles/{cycleId}/export`

---

## 四、校验服务 (Validation)

### 4.1 校验单个分配
**POST** `/validation/assignment`

请求体:
```json
{
  "vendor_id": "vendor-001",
  "stall_id": "stall-006"
}
```

响应:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": []
  }
}
```

---

## 五、投诉管理 (Complaints)

### 5.1 创建投诉
**POST** `/complaints`

请求体:
```json
{
  "vendor_id": "vendor-001",
  "type": "油烟超标",
  "description": "多次被邻居投诉油烟过大",
  "severity": "moderate",
  "reported_by": "巡查员A"
}
```

**严重程度与扣分值**:
- `trivial`: 2分
- `minor`: 5分
- `moderate`: 10分
- `severe`: 20分
- `critical`: 30分

### 5.2 获取待处理投诉
**GET** `/complaints/pending`

### 5.3 处理投诉（扣分）
**POST** `/complaints/{id}/resolve`

请求体:
```json
{
  "operator": "管理员",
  "apply_deduction": true
}
```

### 5.4 驳回投诉（不扣分）
**POST** `/complaints/{id}/reject`

请求体:
```json
{
  "operator": "管理员"
}
```

---

## 六、换位申请 (Swap Requests)

### 状态机流程:
```
pending → approved → completed
   ↓         ↓
rejected  cancelled
```

### 6.1 创建换位申请
**POST** `/cycles/{cycleId}/swaps`

请求体:
```json
{
  "cycle_id": "xxx",
  "requesting_vendor_id": "vendor-002",
  "target_vendor_id": "vendor-004",
  "reason": "希望换到更好的位置"
}
```

### 6.2 获取周期换位列表
**GET** `/cycles/{cycleId}/swaps`

### 6.3 批准换位
**POST** `/swaps/{id}/approve`

请求体:
```json
{
  "operator": "管理员"
}
```

### 6.4 拒绝换位
**POST** `/swaps/{id}/reject`

请求体:
```json
{
  "operator": "管理员"
}
```

### 6.5 完成换位（更新分配）
**POST** `/swaps/{id}/complete`

请求体:
```json
{
  "operator": "管理员"
}
```

### 6.6 取消换位
**POST** `/swaps/{id}/cancel`

请求体:
```json
{
  "operator": "管理员"
}
```

---

## 七、审计日志 (Audit Logs)

### 7.1 获取审计日志
**GET** `/audit/logs?entity_type=xxx&entity_id=xxx`

参数:
- `entity_type`: 实体类型 (stall, vendor, rotation_cycle, stall_assignment, swap_request, complaint)
- `entity_id`: 实体ID (可选)

---

## 核心业务规则

### 1. 容量校验规则
- **用电容量**: 摊主用电需求必须 ≤ 摊位容量
- **油烟匹配**: 需要油烟设备的品类必须分配到有油烟设备的摊位
- **信用分警告**: 摊主信用分 < 60 分时发出警告

### 2. 投诉扣分规则
| 严重程度 | 扣分值 |
|---------|--------|
| trivial | 2分 |
| minor | 5分 |
| moderate | 10分 |
| severe | 20分 |
| critical | 30分 |

### 3. 轮换周期状态
- `draft`: 草稿状态，可自由编辑
- `validated`: 已校验，可定稿或修改
- `finalized`: 已定稿，不可修改（可重新打开）

### 4. 换位状态机
- `pending`: 待审批
- `approved`: 已批准
- `rejected`: 已拒绝（终态）
- `cancelled`: 已取消（终态）
- `completed`: 已完成（终态）

---

## 测试场景脚本

运行测试脚本验证所有场景:

```bash
chmod +x test_scenarios.sh
./test_scenarios.sh
```

**测试场景包含:
1. ✅ 正常流程：创建周期 → 分配摊位 → 校验 → 定稿
2. ✅ 冲突场景：高功率错配、油烟错配
3. ✅ 撤回场景：删除分配、修复、重新校验
4. ✅ 投诉处理：扣分、驳回
5. ✅ 换位流程：申请 → 批准 → 完成
6. ✅ 人工修正：重新打开 → 修正 → 再定稿
7. ✅ 报告导出：JSON报告、CSV导出
8. ✅ 审计追踪：所有操作留痕
