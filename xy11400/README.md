# 冷链中转异常回执状态机 API

一个用于追踪冷链运输异常批次处理状态的后端服务，解决跨日签收和箱号改名导致的赔付计算错误问题。

## 功能特性

- **状态机驱动**: 创建 → 附件上传 → 复核中 → 已复核 → 冻结 → 归档/撤回
- **多源材料接入**: 司机照片、WMS箱号表、温度记录仪片段、主管批注
- **脏记录智能识别**: 缺字段、跨日签收、箱号改名、金额/数量冲突
- **四级权限控制**: 录入员、复核员、主管、只读查看
- **数据溯源导出**: 冻结前后状态、人工处理理由、完整审计轨迹

## 快速开始

### 1. 环境准备

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # macOS/Linux

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

首次启动会自动：
- 创建 SQLite 数据库 `cold_chain.db`
- 初始化默认用户账号
- 创建上传文件目录 `./uploads`

### 3. 访问接口文档

打开浏览器访问: http://localhost:8000/docs

## 默认账号

| 用户名 | 密码 | 角色 | 权限说明 |
|--------|------|------|---------|
| admin | admin123 | 主管 | 全部权限 + 导出 |
| reviewer | reviewer123 | 复核员 | 状态流转、异常处理 |
| operator | operator123 | 录入员 | 创建批次、上传材料 |
| viewer | viewer123 | 只读 | 仅查看权限 |

## 主流程操作指南

### 步骤 1: 登录获取 Token

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=operator&password=operator123"
```

返回示例:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

后续请求在 Header 中带上: `Authorization: Bearer <token>`

### 步骤 2: 创建批次

```bash
curl -X POST "http://localhost:8000/api/v1/batches/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "batch_no": "CC20240520001",
    "transport_order_no": "TO20240520001",
    "origin": "北京冷库",
    "destination": "上海配送中心",
    "departure_date": "2024-05-20T08:00:00",
    "arrival_date": "2024-05-21T18:30:00",
    "total_boxes": 50,
    "total_amount": 25000.00
  }'
```

**注意**: 如果出发和到达日期跨天，系统会自动创建 `cross_day` 类型的脏记录。

### 步骤 3: 上传材料

上传司机照片:
```bash
curl -X POST "http://localhost:8000/api/v1/batches/1/attachments" \
  -H "Authorization: Bearer <token>" \
  -F "file_type=driver_photo" \
  -F "description=司机现场照片" \
  -F "file=@/path/to/driver_photo.jpg"
```

上传 WMS 箱号表:
```bash
curl -X POST "http://localhost:8000/api/v1/batches/1/attachments" \
  -H "Authorization: Bearer <token>" \
  -F "file_type=wms_box_table" \
  -F "description=WMS导出箱号表" \
  -F "file=@/path/to/wms_table.xlsx"
```

上传温度记录仪数据:
```bash
curl -X POST "http://localhost:8000/api/v1/batches/1/attachments" \
  -H "Authorization: Bearer <token>" \
  -F "file_type=temperature_log" \
  -F "description=温度记录仪导出数据" \
  -F "file=@/path/to/temp_log.csv"
```

**自动流转**: 当三种必需附件都上传完成后，批次状态会自动从 `created` 变为 `attachments_uploaded`。

### 步骤 4: 添加箱号明细

```bash
curl -X POST "http://localhost:8000/api/v1/batches/1/box-items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "box_no": "BOX001-NEW",
    "original_box_no": "BOX001-OLD",
    "product_name": "进口冷冻牛肉",
    "quantity": 100,
    "unit_price": 50.00,
    "amount": 5000.00,
    "temperature_min": -18.5,
    "temperature_max": -12.0,
    "temperature_avg": -15.2,
    "is_abnormal": true,
    "remark": "运输途中温度超标"
  }'
```

**自动检测**: 如果 `box_no` 和 `original_box_no` 不一致，系统会创建 `box_renamed` 脏记录。

### 步骤 5: 复核状态流转

使用复核员账号登录后执行:

```bash
# 进入复核状态
curl -X POST "http://localhost:8000/api/v1/batches/1/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <reviewer_token>" \
  -d '{
    "target_status": "under_review",
    "reason": "材料齐全，开始复核"
  }'

# 完成复核
curl -X POST "http://localhost:8000/api/v1/batches/1/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <reviewer_token>" \
  -d '{
    "target_status": "reviewed",
    "reason": "复核通过，数据核对无误"
  }'
```

### 步骤 6: 主管批注与冻结

使用主管账号:

```bash
# 添加审批批注
curl -X POST "http://localhost:8000/api/v1/batches/1/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "content": "同意按异常处理，赔付金额按80%计算",
    "is_approval": true
  }'

# 冻结结算（发现异常时）
curl -X POST "http://localhost:8000/api/v1/batches/1/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "target_status": "frozen",
    "reason": "跨日签收赔付金额存疑，暂停结算"
  }'
```

### 步骤 7: 解冻/撤回与归档

```bash
# 异常解决后解冻（自动恢复到冻结前状态）
curl -X POST "http://localhost:8000/api/v1/batches/1/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "target_status": "reverted",
    "reason": "已核实跨日为正常情况，恢复流程"
  }'

# 最终归档
curl -X POST "http://localhost:8000/api/v1/batches/1/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "target_status": "archived",
    "reason": "赔付完成，归档留存"
  }'
```

## 制造异常场景

### 场景 1: 缺字段异常

创建批次时故意不填关键字段:
```bash
curl -X POST "http://localhost:8000/api/v1/batches/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"batch_no": "TEST-MISSING-FIELDS"}'
```

查看脏记录:
```bash
curl "http://localhost:8000/api/v1/batches/2/dirty-records" \
  -H "Authorization: Bearer <token>"
```

### 场景 2: 跨日签收异常

创建跨天的批次:
```bash
curl -X POST "http://localhost:8000/api/v1/batches/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "batch_no": "TEST-CROSS-DAY",
    "transport_order_no": "TO-CROSS-001",
    "departure_date": "2024-05-20T08:00:00",
    "arrival_date": "2024-05-23T10:00:00"
  }'
```

系统会自动标记为跨日签收，提示可能影响赔付计算。

### 场景 3: 箱号改名异常

```bash
curl -X POST "http://localhost:8000/api/v1/batches/3/box-items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "box_no": "NEW-BOX-123",
    "original_box_no": "OLD-BOX-456",
    "product_name": "测试产品"
  }'
```

### 场景 4: 处理脏记录

复核员可以标记脏记录为已解决:
```bash
curl -X POST "http://localhost:8000/api/v1/batches/2/dirty-records/1/resolve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <reviewer_token>" \
  -d '{"resolution_note": "已补充运输单号和发站信息，数据完整"}'
```

## 数据导出

### 导出批次汇总（主管专用）

```bash
# Excel 格式
curl -o batch_summary.xlsx \
  "http://localhost:8000/api/v1/exports/summary?format=excel" \
  -H "Authorization: Bearer <admin_token>"

# JSON 格式
curl "http://localhost:8000/api/v1/exports/summary?format=json" \
  -H "Authorization: Bearer <admin_token>"
```

**导出字段包含**:
- 批次基本信息（批次号、运输单号、发站到站等）
- **冻结前状态** - 关键审计字段
- **冻结原因** - 人工填写理由
- **主管审批意见** - 主管批注汇总
- **未解决异常数** - 风险提示
- **状态流转时间** - 完整时间线

### 导出箱号明细

```bash
curl -o box_detail.xlsx \
  "http://localhost:8000/api/v1/exports/box-detail?format=excel" \
  -H "Authorization: Bearer <token>"
```

### 导出脏记录报告

```bash
curl -o dirty_records.xlsx \
  "http://localhost:8000/api/v1/exports/dirty-records?format=excel&include_resolved=true" \
  -H "Authorization: Bearer <admin_token>"
```

### 查看状态变更历史

```bash
curl "http://localhost:8000/api/v1/exports/batches/1/status-changes" \
  -H "Authorization: Bearer <token>"
```

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行状态机测试
pytest tests/test_state_machine.py -v

# 运行幂等性测试
pytest tests/test_idempotency.py -v

# 运行权限测试
pytest tests/test_permissions.py -v

# 运行脏记录测试
pytest tests/test_dirty_records.py -v
```

**测试重点**:
1. **状态机流转**: 验证合法/非法的状态转换
2. **幂等性**: 重复操作不会产生副作用
3. **权限控制**: 不同角色的可见性和操作边界
4. **脏记录识别**: 各类异常场景的自动检测

## 项目结构

```
.
├── main.py                 # 应用入口
├── requirements.txt        # 依赖列表
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置管理
│   ├── database.py        # 数据库连接
│   ├── models.py          # 数据模型
│   ├── schemas.py         # Pydantic 模型
│   ├── auth.py            # 认证与权限
│   ├── crud/
│   │   ├── __init__.py
│   │   ├── batch_crud.py      # 批次与状态机
│   │   ├── user_crud.py       # 用户管理
│   │   ├── attachment_crud.py # 附件管理
│   │   ├── dirty_record_crud.py # 脏记录处理
│   │   ├── note_crud.py       # 批注管理
│   │   └── export_crud.py     # 导出功能
│   └── routers/
│       ├── __init__.py
│       ├── auth.py       # 认证接口
│       ├── batches.py    # 批次管理接口
│       ├── exports.py    # 数据导出接口
│       └── users.py      # 用户管理接口
└── tests/
    ├── __init__.py
    ├── conftest.py           # 测试配置
    ├── test_state_machine.py # 状态机测试
    ├── test_idempotency.py   # 幂等性测试
    ├── test_permissions.py   # 权限测试
    └── test_dirty_records.py # 脏记录测试
```

## 状态流转图

```
created → attachments_uploaded → under_review → reviewed → archived
   ↓            ↓                 ↓             ↓
  frozen       frozen           frozen        frozen
     \           \                 \             /
      \           \                 \           /
       └───────────┴───────── reverted ───────┘
```

## 权限矩阵

| 操作 | 录入员 | 复核员 | 主管 | 只读 |
|------|--------|--------|------|------|
| 创建批次 | ✅ | ✅ | ✅ | ❌ |
| 上传附件 | ✅ | ✅ | ✅ | ❌ |
| 状态流转 | ❌ | ✅ | ✅ | ❌ |
| 处理脏记录 | ❌ | ✅ | ✅ | ❌ |
| 添加主管批注 | ❌ | ❌ | ✅ | ❌ |
| 导出汇总 | ❌ | ❌ | ✅ | ❌ |
| 查看批次 | ✅ | ✅ | ✅ | ✅ |
| 用户管理 | ❌ | ❌ | ✅ | ❌ |

## 常见问题

**Q: 如何重置数据库？**
A: 删除 `cold_chain.db` 文件，重启服务即可重新初始化。

**Q: 上传的文件存在哪里？**
A: 默认在 `./uploads` 目录下，按批次号分子目录存放。

**Q: 如何修改默认密码？**
A: 登录主管账号后调用 `PUT /api/v1/users/{id}` 接口修改。

**Q: 冻结后如何恢复？**
A: 调用状态变更接口，目标状态设为 `reverted`，系统会自动恢复到冻结前的状态。
