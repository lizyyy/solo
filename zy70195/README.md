# 供应商资质冻结 API 服务端原型

本原型专注于**供应商资质过期后的业务处理流程**，包括：冻结下单、触发补证、恢复采购资格。

---

## 核心业务逻辑

### 1. 资质到期检测
- 自动检测已过期资质，更新状态
- 自动检测即将到期资质（按规则配置的告警天数）
- 生成异常记录（不静默吞掉）

### 2. 供应商冻结触发条件
- 资质过期（自动冻结）
- 高风险/严重风险事件（自动冻结）
- 手动冻结

### 3. 下单拦截规则
- 供应商状态为 `frozen` → 拦截
- 存在过期资质 → 拦截
- 存在活跃风险 → 拦截
- 恢复申请审批中 → 拦截

### 4. 恢复解冻条件
- 所有过期资质已补证审批通过
- 所有活跃风险已解决
- 恢复申请审批通过

### 5. 异常与边界处理
- 所有验证错误、业务错误 → 写入 `exception_records` 表
- 数据不完整、供应商不存在等边界情况 → 记录异常
- 重复提交申请、重复审批 → 记录业务警告

---

## 快速开始

### 步骤 1: 安装依赖
```bash
npm install
```

### 步骤 2: 初始化测试数据
```bash
npm run seed
```
这会创建：
- 5 个供应商（1 个已冻结）
- 10 条资质档案（1 条已过期，3 条即将到期）
- 4 个订单

测试场景：
- `sup_001` (北京顺达食品): 食品经营许可证已过期，供应商已被冻结
- `sup_002` (上海优选农产品): 有机产品认证 20 天后到期
- `sup_003` (广州新鲜配送): 食品经营许可证 45 天后到期
- `sup_004` (深圳健康食材): 所有资质正常，可正常下单
- `sup_005` (杭州绿色农业): 绿色食品认证 15 天后到期

### 步骤 3: 启动服务
```bash
npm start
```
服务地址: http://localhost:3000

### 步骤 4: 验证服务
```bash
curl http://localhost:3000/health
```
预期结果: `{"status":"ok","message":"供应商资质冻结 API 服务运行中"}`

### 步骤 5: 测试主流程
```bash
npm run test-flow
```
这会按顺序执行完整业务流程测试

### 步骤 6: 导出业务复核数据
```bash
npm run export
```
所有文件生成在 `exports/` 目录

---

## 主流程调用示例

### 场景 1: 正常供应商下单
```bash
# 检查 sup_004 状态（应该可下单）
curl -X GET http://localhost:3000/api/qualifications/suppliers/sup_004/status

# 创建订单
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"supplier_id": "sup_004", "order_no": "PO-TEST-001", "amount": 100000}'
```
**预期结果**: 订单状态为 `pending`

### 场景 2: 资质过期供应商下单被拦截
```bash
# 检查 sup_001 状态（已冻结，不可下单）
curl -X GET http://localhost:3000/api/qualifications/suppliers/sup_001/status

# 创建订单（会被拦截）
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"supplier_id": "sup_001", "order_no": "PO-TEST-002", "amount": 50000}'
```
**预期结果**: 订单状态为 `blocked`，返回拦截原因

### 场景 3: 触发到期检测
```bash
curl -X POST http://localhost:3000/api/qualifications/detect-expiry
```
**预期结果**: 检测出已过期、即将到期、需补证的资质

### 场景 4: 查看待处理补证申请
```bash
curl -X GET http://localhost:3000/api/supplements/pending
```

### 场景 5: 提交补证材料并审批
```bash
# 先查看补证申请列表，获取申请 ID
curl -X GET http://localhost:3000/api/supplements

# 假设申请 ID 是 supp_xxxx
# 提交补证材料
curl -X POST http://localhost:3000/api/supplements/supp_xxxx/submit \
  -H "Content-Type: application/json" \
  -d '{"new_certificate_no": "SC101110105-2026-NEW", "new_expiry_date": "2027-05-10", "submitted_by": "供应商经理"}'

# 审批通过
curl -X POST http://localhost:3000/api/supplements/supp_xxxx/approve \
  -H "Content-Type: application/json" \
  -d '{"approval_by": "审批员A"}'
```
**预期结果**: 
- 补证状态变为 `approved`
- 资质到期日期更新
- 供应商状态自动恢复（若无其他问题）

### 场景 6: 高风险事件触发冻结
```bash
# 添加高风险
curl -X POST http://localhost:3000/api/risks \
  -H "Content-Type: application/json" \
  -d '{"supplier_id": "sup_003", "risk_type": "质量投诉", "description": "违反安全生产规定", "severity": "high"}'

# 检查供应商状态（应该已冻结）
curl -X GET http://localhost:3000/api/qualifications/suppliers/sup_003
```
**预期结果**: 供应商状态变为 `frozen`

### 场景 7: 提交恢复申请
```bash
# 先检查冻结状态
curl -X GET http://localhost:3000/api/qualifications/suppliers/sup_003/status

# 提交恢复申请
curl -X POST http://localhost:3000/api/recoveries \
  -H "Content-Type: application/json" \
  -d '{"supplier_id": "sup_003", "reason": "已更新所有资质"}'

# 查看待处理恢复申请
curl -X GET http://localhost:3000/api/recoveries/pending
```

### 场景 8: 审批恢复申请
```bash
# 先解决所有风险（如有）
curl -X POST http://localhost:3000/api/risks/risk_xxxx/resolve \
  -H "Content-Type: application/json" \
  -d '{"resolution_notes": "已完成整改，问题已解决"}'

# 批准恢复（需要先补证所有过期资质、解决所有风险）
curl -X POST http://localhost:3000/api/recoveries/rec_xxxx/approve \
  -H "Content-Type: application/json" \
  -d '{"approval_by": "审批员B"}'
```

---

## 触发异常和查看结果

### 查看异常记录
```bash
# 查看所有待处理异常
curl -X GET "http://localhost:3000/api/exceptions?status=pending"

# 查看高严重程度异常
curl -X GET "http://localhost:3000/api/exceptions?severity=high"

# 查看异常摘要
curl -X GET http://localhost:3000/api/exceptions/summary
```

### 常见异常场景

| 异常类型 | 触发方式 | 查看方法 |
|---------|---------|---------|
| 资质过期 | 检测过期资质 | `type=qualification_expiry` |
| 下单拦截 | 冻结供应商下单 | `type=order_blocked` |
| 数据不存在 | 查询不存在的ID | `type=data_not_found` |
| 验证错误 | 缺少必填字段 | `type=validation_error` |
| 业务错误 | 重复提交申请 | `type=business_error` |
| 风险事件 | 添加高风险 | `type=risk_added` |
| 供应商冻结 | 资质过期/高风险 | `type=supplier_frozen` |

### 处理异常记录
```bash
# 标记异常为已处理
curl -X POST http://localhost:3000/api/exceptions/[异常ID]/handle \
  -H "Content-Type: application/json" \
  -d '{"handled_by": "运营人员", "handling_notes": "已联系供应商补证"}'
```

---

## 业务复核导出

### 导出所有数据
```bash
npm run export
```

### 按类型导出（通过 API）
```bash
# 资质复核
curl -X GET http://localhost:3000/api/export/qualifications

# 冻结记录
curl -X GET http://localhost:3000/api/export/freeze-logs

# 订单复核
curl -X GET http://localhost:3000/api/export/orders

# 风险清单
curl -X GET http://localhost:3000/api/export/risks

# 异常记录
curl -X GET http://localhost:3000/api/export/exceptions

# 完整导出
curl -X GET http://localhost:3000/api/export/full
```

### 导出文件说明
所有文件生成在 `exports/` 目录，格式为 CSV（带 UTF-8 BOM，Excel 可直接打开）：

| 文件类型 | 文件名示例 | 内容用途 |
|---------|-----------|---------|
| 资质复核 | `资质复核_20260510_193238.csv` | 所有资质状态、到期提醒、风险等级 |
| 冻结记录 | `冻结记录复核_20260510_193238.csv` | 冻结/解冻历史、原因追踪 |
| 订单复核 | `订单复核_20260510_193238.csv` | 订单状态分布、拦截金额统计 |
| 风险清单 | `风险清单复核_20260510_193238.csv` | 风险严重程度、处理状态 |
| 异常记录 | `异常记录复核_20260510_193238.csv` | 待处理异常、处理痕迹 |
| 汇总 | `复核汇总_20260510_193238.json` | 统计摘要 |

---

## API 接口总览

### 供应商与资质管理
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/qualifications/suppliers` | 创建供应商 |
| GET | `/api/qualifications/suppliers` | 获取所有供应商 |
| GET | `/api/qualifications/suppliers/:id` | 获取供应商详情 |
| GET | `/api/qualifications/suppliers/:id/status` | 检查供应商状态（可否下单） |
| GET | `/api/qualifications/suppliers/:id/logs` | 获取冻结/解冻日志 |
| POST | `/api/qualifications` | 创建资质档案 |
| GET | `/api/qualifications` | 获取所有资质 |
| GET | `/api/qualifications/:id` | 获取资质详情 |
| GET | `/api/qualifications/supplier/:supplierId` | 获取供应商的所有资质 |
| PUT | `/api/qualifications/:id/update-expiry` | 更新资质到期日期 |
| POST | `/api/qualifications/detect-expiry` | 触发到期检测 |
| POST | `/api/qualifications/supplier/:id/freeze` | 手动冻结供应商 |
| POST | `/api/qualifications/supplier/:id/unfreeze` | 手动解冻供应商 |

### 到期规则
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/rules` | 创建到期规则 |
| GET | `/api/rules` | 获取所有规则 |
| GET | `/api/rules/active` | 获取所有启用的规则 |
| GET | `/api/rules/:id` | 获取规则详情 |
| GET | `/api/rules/type/:qualificationType` | 按资质类型获取规则 |
| PUT | `/api/rules/:id` | 更新规则 |
| POST | `/api/rules/:id/toggle` | 启用/停用规则 |

### 订单管理
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/orders` | 创建订单（自动检查资格） |
| GET | `/api/orders` | 获取所有订单 |
| GET | `/api/orders/:id` | 获取订单详情 |
| GET | `/api/orders/supplier/:supplierId` | 获取供应商的订单 |
| POST | `/api/orders/:id/approve` | 批准订单 |
| POST | `/api/orders/:id/reject` | 拒绝订单 |

### 补证申请
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/supplements` | 创建补证申请 |
| GET | `/api/supplements` | 获取所有补证申请 |
| GET | `/api/supplements/pending` | 获取待处理补证申请 |
| GET | `/api/supplements/:id` | 获取申请详情 |
| POST | `/api/supplements/:id/submit` | 提交补证材料 |
| POST | `/api/supplements/:id/approve` | 批准补证申请 |
| POST | `/api/supplements/:id/reject` | 拒绝补证申请 |

### 恢复申请
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/recoveries` | 提交恢复申请 |
| GET | `/api/recoveries` | 获取所有恢复申请 |
| GET | `/api/recoveries/pending` | 获取待处理恢复申请 |
| GET | `/api/recoveries/:id` | 获取申请详情 |
| POST | `/api/recoveries/:id/approve` | 批准恢复申请 |
| POST | `/api/recoveries/:id/reject` | 拒绝恢复申请 |

### 风险清单
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/risks` | 添加风险记录 |
| GET | `/api/risks/active` | 获取活跃风险 |
| GET | `/api/risks/summary` | 获取风险汇总 |
| GET | `/api/risks/:id` | 获取风险详情 |
| GET | `/api/risks/supplier/:supplierId` | 获取供应商的风险 |
| POST | `/api/risks/:id/resolve` | 解决风险 |

### 异常记录
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/api/exceptions` | 查询异常记录 |
| GET | `/api/exceptions/pending` | 获取待处理异常 |
| GET | `/api/exceptions/summary` | 获取异常摘要 |
| GET | `/api/exceptions/:id` | 获取异常详情 |
| POST | `/api/exceptions/:id/handle` | 处理异常 |

### 导出复核
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/api/export/qualifications` | 导出资质复核 |
| GET | `/api/export/freeze-logs` | 导出冻结记录 |
| GET | `/api/export/orders` | 导出订单复核 |
| GET | `/api/export/risks` | 导出风险清单 |
| GET | `/api/export/exceptions` | 导出异常记录 |
| GET | `/api/export/full` | 导出完整复核数据 |

---

## 数据库表结构

| 表名 | 用途 |
|-----|------|
| suppliers | 供应商基本信息 |
| qualifications | 资质档案 |
| expiry_rules | 到期检测规则 |
| orders | 订单（含冻结/拦截状态） |
| supplement_requests | 补证申请 |
| recovery_requests | 恢复申请 |
| risk_list | 风险清单 |
| exception_records | 异常记录（边界数据） |
| freeze_logs | 冻结/解冻操作日志 |

---

## 状态流转图

### 供应商状态
```
active ──→ frozen ──→ active (恢复)
  │           │
  │           └──→ 触发条件: 资质过期 / 高风险 / 手动
  │
  └──→ 恢复条件: 所有资质补证 + 风险解决
```

### 订单状态
```
pending ──→ blocked (创建时拦截)
   │
   ├──→ frozen (供应商被冻结)
   │
   ├──→ approved / rejected / completed
```

### 补证申请状态
```
pending ──→ submitted ──→ approved (更新资质 → 解冻供应商)
   │                            │
   └──→ rejected               └──→ rejected (不解冻)
```

### 异常记录状态
```
pending ──→ handled
```

---

## 注意事项

1. **不静默吞掉边界数据**: 所有验证失败、业务异常都会写入 `exception_records` 表
2. **导出文件服务业务复核**: CSV 包含业务场景关键字段，而非调试日志
3. **自动恢复有条件**: 必须所有过期资质补证 + 所有风险解决 + 恢复申请批准
4. **风险等级影响**: `high` 和 `critical` 风险自动冻结，`medium` 和 `low` 仅记录
5. **补证审批状态**: 需要先 `submit`（提交材料），再 `approve`（审批）

---

## 测试流程总结

运行 `npm run test-flow` 会测试以下场景：

✅ 资质过期自动冻结供应商
✅ 已冻结供应商下单被拦截
✅ 正常供应商可正常下单
✅ 补证申请审批流程
✅ 补证成功后自动恢复采购资格
✅ 高风险自动触发冻结
✅ 边界数据异常记录
