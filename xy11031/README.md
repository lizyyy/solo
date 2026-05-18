# 家电安装队安装师傅抢单API - 导入接口系统

## 项目概述

本系统专门解决家电安装队安装师傅抢单过程中的**后续追责和复盘**问题，提供完整的数据导入、问题识别、人工审核和状态流转机制。

---

## 核心功能

### 1. 数据导入接口
- **JSON格式导入**: 支持批量导入订单数据
- **CSV格式导入**: 支持CSV文件上传导入
- **坏行处理**: 失败数据保留原始字段、失败原因和处理建议

### 2. 智能问题识别
- **重复订单检测**: 识别订单号重复的记录
- **时段重叠检测**: 检测师傅同一时段被锁定多个订单
- **字段完整性校验**: 必填字段、格式校验
- **审计一致性校验**: 金额计算、状态逻辑等一致性检查

### 3. 人工审核机制
- **待审核队列**: 有问题但可人工干预的订单进入待审核
- **审核操作**: 支持通过、拒绝、调整后继续
- **审核备注**: 所有审核操作保留完整记录（操作人、时间、备注）

### 4. 状态流转控制
- **完整状态机**: pending → locked → dispatched → accepted → in_progress → completed/cancelled
- **越级变更拦截**: 防止非法状态跳转，确保流程合规

---

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务
```bash
npm start
```
服务将在 `http://localhost:3001` 启动

### 3. 运行完整测试（推荐）
```bash
# 先启动服务（新终端窗口）
npm start

# 在原窗口运行自动化测试
npm test
```

---

## API接口说明

### 基础信息
- **Base URL**: `http://localhost:3001/api`
- **Content-Type**: `application/json`

### 1. 健康检查
```bash
GET /api/health
```

### 2. JSON格式导入订单
```bash
POST /api/import/json
Content-Type: application/json

{
  "orders": [
    {
      "orderNo": "DD202405200001",
      "customerName": "张三",
      "customerPhone": "13800138001",
      "customerAddress": "北京市朝阳区建国路88号SOHO现代城A座1501室",
      "applianceType": "air_conditioner",
      "applianceBrand": "格力",
      "applianceModel": "KFR-35GW/(35592)FNhAa-B1",
      "installationType": "new_install",
      "scheduledDate": "2024-05-21",
      "timeSlotStart": "09:00",
      "timeSlotEnd": "11:00",
      "technicianId": "TECH001",
      "technicianName": "李师傅",
      "technicianPhone": "13900139001",
      "technicianTeam": "城东空调一组",
      "status": "pending",
      "installationFee": 150,
      "materialFee": 80,
      "totalFee": 230,
      "notes": "客户要求穿工作服，带鞋套",
      "auditStatus": "pending"
    }
  ],
  "options": {
    "skipDuplicateCheck": false,
    "skipTimeSlotCheck": false,
    "skipAuditCheck": false
  }
}
```

### 3. CSV格式导入订单
```bash
POST /api/import/csv
Content-Type: multipart/form-data

file: @sample_orders.csv
```

### 4. 查看导入批次
```bash
GET /api/import/batches
GET /api/import/batches/{batchId}
```

### 5. 待审核订单列表
```bash
GET /api/import/review/pending
```

### 6. 人工审核处理
```bash
POST /api/import/review/{orderId}
Content-Type: application/json

{
  "action": "approve",        // approve: 通过, reject: 拒绝, adjust_and_continue: 调整继续
  "remark": "经核实，时段重叠为特殊情况，客户紧急需求",
  "operator": "张经理"
}
```

### 7. 订单管理
```bash
GET /api/import/orders                    # 所有订单
GET /api/import/orders?status=pending     # 按状态筛选
GET /api/import/orders/{orderId}          # 订单详情
PUT /api/import/orders/{orderId}/status   # 更新状态
```

---

## 核心字段说明

| 字段 | 说明 | 有效值 |
|------|------|--------|
| applianceType | 家电类型 | air_conditioner(空调), washing_machine(洗衣机), refrigerator(冰箱), tv(电视), water_heater(热水器), kitchen_hood(油烟机), gas_stove(燃气灶), dishwasher(洗碗机) |
| installationType | 安装类型 | new_install(新装), reinstall(重装), repair(维修) |
| status | 订单状态 | pending(待处理), locked(已锁定), dispatched(已派单), accepted(已接单), in_progress(安装中), completed(已完成), cancelled(已取消), needs_review(待审核) |
| issue.type | 问题类型 | duplicate_order(重复订单), time_slot_overlap(时段重叠), missing_required_field(缺字段), audit_inconsistency(审计不一致), invalid_phone(手机号无效), invalid_address(地址无效) |

---

## 坏行处理示例

导入失败时，返回的失败数据包含完整原始信息：

```json
{
  "rowNumber": 4,
  "originalData": {
    "orderNo": "DD202405200008",
    "customerName": "缺字段测试",
    "customerPhone": "",
    "customerAddress": "北京",
    "...": "..."
  },
  "reason": "数据验证失败: 客户电话不能为空; 客户地址至少需要10个字符...",
  "suggestion": "customerPhone: 请填写11位有效手机号码，如：13800138000; customerAddress: 请填写详细地址，包含省市区街道门牌号..."
}
```

---

## 人工审核流程示例

### 场景1：时段重叠
```
问题: 李师傅在2024-05-21 10:00-12:00时段已有重叠订单
建议: 1) 调整时段 2) 经人工确认后标记为"特殊情况允许重叠"继续推进

人工操作:
- action: approve
- remark: 经电话核实，该订单为VIP客户紧急需求，安排李师傅加班完成，已确认
- operator: 张经理

结果: 订单状态从 needs_review → pending，可以继续后续流程
```

### 场景2：重复订单
```
问题: 订单号DD202405200001已存在
建议: 1) 检查是否重复导入 2) 确认是更新操作还是新单导入 3) 经人工确认后标记继续

人工操作:
- action: adjust_and_continue
- remark: 实为同一订单更新，原订单取消，以此单为准
```

---

## 边界测试说明

### 1. 重复提交测试
- 导入订单号已存在的数据
- 系统自动识别并标记为待审核
- 保留原始数据和重复订单ID供人工判断

### 2. 状态越级测试
- 尝试从pending直接跳转到completed
- 系统拦截并给出明确提示：
  ```
  错误: 状态从 pending 不能直接变更为 completed
  建议: 允许的状态变更为: locked, cancelled
  ```

### 3. 缺字段测试
- 缺失customerPhone、customerAddress等必填字段
- 字段格式错误（如手机号不是11位）
- 系统直接标记为导入失败，保留原始数据

---

## 运行测试脚本

### 方式1：交互式curl测试
```bash
chmod +x curl_examples.sh
./curl_examples.sh
```

### 方式2：自动化测试（推荐）
```bash
npm test
```

测试项目包括：
- ✓ 健康检查
- ✓ 导入正常订单
- ✓ 边界数据导入验证（重复、时段重叠、缺字段）
- ✓ 待审核订单列表获取
- ✓ 人工审核处理
- ✓ 状态越级变更拦截
- ✓ 正常状态流转

---

## 数据持久化

所有数据保存在 `data/` 目录下：
- `orders.json`: 所有订单数据
- `batches.json`: 导入批次记录
- `sample_orders.json`: 正常订单示例
- `boundary_test_orders.json`: 边界测试数据
- `sample_orders.csv`: CSV格式示例

---

## 追责和复盘能力

1. **完整操作日志**: 所有人工审核操作均有记录（操作人、时间、备注）
2. **问题追溯**: 每个订单的issues字段记录了所有发现的问题及解决过程
3. **批次管理**: 按导入批次管理，便于追溯数据来源和处理过程
4. **状态审计**: 所有状态变更均有时间戳和操作轨迹

---

## 项目结构

```
.
├── server.js                 # 主服务入口
├── package.json
├── README.md
├── curl_examples.sh          # curl示例脚本
├── models/
│   └── dispatch.js           # 数据模型
├── services/
│   ├── validator.js          # 数据验证服务
│   ├── storage.js            # 数据存储服务
│   └── importService.js      # 导入核心服务
├── routes/
│   └── import.js             # API路由
├── data/
│   ├── sample_orders.json    # 正常订单示例
│   ├── boundary_test_orders.json  # 边界测试数据
│   └── sample_orders.csv     # CSV示例
└── tests/
    └── run-tests.js          # 自动化测试
```

---

## 常见问题

**Q: 导入后发现数据有误怎么办？**
A: 有问题的订单会自动进入待审核队列，可通过人工审核处理，所有操作均有日志记录。

**Q: 师傅同一时段真的可以接多个订单吗？**
A: 系统默认会检测时段重叠并标记待审核，但支持人工审核后通过，满足特殊场景需求。

**Q: 如何追溯某个订单的所有问题和处理过程？**
A: 通过订单详情接口可查看完整的issues列表（问题类型、原因、建议、解决状态、解决时间）和manualRemarks（所有人工备注）。

---

## 许可证

ISC
