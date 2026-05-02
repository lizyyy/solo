# 辅具借还风险管家

社区康复中心辅具借还管理系统 - 本地后端 API 服务

## 项目简介

"辅具借还风险管家" 是一个专为社区康复中心设计的辅具借还管理系统。针对轮椅、助行器、护理床等设备经常跨站点借出、纸质台账难以管理的问题，提供完整的数字化解决方案。

## 功能特性

### 核心功能
- **设备管理**: 设备类型、设备信息、库存管理
- **站点管理**: 多站点支持，跨站点设备调配
- **会员管理**: 会员信息维护，黑名单机制
- **预约管理**: 设备预约，时间冲突检测
- **借出管理**: 库存校验、押金规则、黑名单检查、维修封存校验
- **归还管理**: 逾期费用计算，审计日志记录
- **维修封存**: 设备维修、封存管理

### 校验规则
借出前自动校验：
1. ✅ 库存状态检查
2. ✅ 押金规则匹配
3. ✅ 会员黑名单检查
4. ✅ 预约时间重叠检测
5. ✅ 维修封存状态检查

### 数据导入导出
- **CSV 导入**: 支持站点、设备类型、设备、库存、会员数据批量导入
- **Markdown 周报导出**: 自动生成每周运营报告
- **JSON 审计包导出**: 完整审计记录导出

## 技术栈

- **Python 3.8+**
- **Flask 2.3.3**: Web 框架
- **Flask-SQLAlchemy 3.1.1**: ORM
- **Flask-Migrate 4.0.5**: 数据库迁移
- **SQLite**: 本地数据库

## 安装部署

### 1. 环境准备

```bash
# 检查 Python 版本
python3 --version

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate     # Windows
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 初始化数据库

```bash
# 首次运行会自动创建数据库
python run.py
```

### 4. 导入示例数据（可选）

```bash
python sample_data.py
```

## 运行项目

```bash
# 开发模式运行
python run.py
```

服务启动后访问：`http://localhost:5001/api`

## API 文档

### 基础路径
所有 API 路径前缀：`http://localhost:5001/api`

### 健康检查
```bash
curl http://localhost:5001/api/health
```

### 站点管理

#### 获取所有站点
```bash
curl http://localhost:5001/api/sites
```

#### 创建站点
```bash
curl -X POST http://localhost:5001/api/sites \
  -H "Content-Type: application/json" \
  -d '{
    "name": "阳光社区康复中心",
    "address": "北京市朝阳区阳光路123号",
    "contact_person": "张主任",
    "phone": "010-12345678"
  }'
```

#### 更新站点
```bash
curl -X PUT http://localhost:5001/api/sites/1 \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "010-87654321"
  }'
```

#### 删除站点
```bash
curl -X DELETE http://localhost:5001/api/sites/1
```

### 设备类型管理

#### 获取所有设备类型
```bash
curl http://localhost:5001/api/equipment/types
```

#### 创建设备类型
```bash
curl -X POST http://localhost:5001/api/equipment/types \
  -H "Content-Type: application/json" \
  -d '{
    "name": "轮椅",
    "description": "手动轮椅，适用于行动不便的老年人和残疾人",
    "deposit_amount": 500.0,
    "daily_rental_fee": 10.0,
    "late_fee_per_day": 20.0
  }'
```

### 设备管理

#### 获取所有设备
```bash
curl http://localhost:5001/api/equipment
```

#### 创建设备
```bash
curl -X POST http://localhost:5001/api/equipment \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_type_id": 1,
    "serial_number": "WC0001",
    "name": "轮椅 - 1号",
    "status": "available",
    "purchase_date": "2024-01-15"
  }'
```

### 库存管理

#### 获取所有库存
```bash
curl http://localhost:5001/api/equipment/inventory
```

#### 创建库存记录
```bash
curl -X POST http://localhost:5001/api/equipment/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": 1,
    "equipment_id": 1,
    "quantity": 1,
    "available_quantity": 1,
    "location": "设备区-1"
  }'
```

### 会员管理

#### 获取所有会员
```bash
curl http://localhost:5001/api/members
```

#### 创建会员
```bash
curl -X POST http://localhost:5001/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "member_number": "M20240001",
    "name": "王大爷",
    "id_card": "110101195001151234",
    "phone": "13800138001",
    "address": "北京市朝阳区阳光小区1号楼1单元101室",
    "gender": "男",
    "birth_date": "1950-01-15",
    "is_blacklisted": false
  }'
```

#### 获取黑名单会员
```bash
curl http://localhost:5001/api/members/blacklist
```

### 预约管理

#### 获取所有预约
```bash
curl http://localhost:5001/api/bookings
```

#### 创建预约（自动检测时间冲突）
```bash
curl -X POST http://localhost:5001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "equipment_type_id": 1,
    "site_id": 1,
    "start_date": "2024-05-10",
    "end_date": "2024-05-15",
    "status": "confirmed"
  }'
```

#### 取消预约
```bash
curl -X POST http://localhost:5001/api/bookings/1/cancel
```

### 借出管理（核心功能）

#### 获取所有借出记录
```bash
curl http://localhost:5001/api/rentals
```

#### 创建借出（自动校验所有规则）
```bash
curl -X POST http://localhost:5001/api/rentals \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "equipment_id": 1,
    "site_id": 1,
    "start_date": "2024-05-10",
    "expected_return_date": "2024-05-15",
    "deposit_paid": 500.0
  }'
```

**借出时自动校验：**
1. 会员是否在黑名单
2. 设备是否可用（非借出、非维修）
3. 设备是否在维修封存中
4. 库存是否充足
5. 押金金额是否符合规则

#### 归还设备（计算逾期费用）
```bash
curl -X POST http://localhost:5001/api/rentals/1/return \
  -H "Content-Type: application/json" \
  -d '{
    "actual_return_date": "2024-05-18"
  }'
```

**归还时自动计算：**
1. 逾期天数
2. 逾期费用
3. 总费用
4. 退款金额

#### 获取逾期记录
```bash
curl http://localhost:5001/api/rentals/overdue
```

### 维修封存管理

#### 获取所有维修记录
```bash
curl http://localhost:5001/api/maintenance
```

#### 创建设备维修/封存
```bash
curl -X POST http://localhost:5001/api/maintenance \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": 1,
    "site_id": 1,
    "maintenance_type": "repair",
    "start_date": "2024-05-10",
    "reason": "车轮损坏，需要维修",
    "status": "in_progress"
  }'
```

**维修类型：**
- `maintenance`: 日常维护
- `repair`: 维修
- `storage`: 封存

#### 获取进行中的维修/封存
```bash
curl http://localhost:5001/api/maintenance/active
```

### 审计日志

#### 获取审计日志
```bash
curl http://localhost:5001/api/audit/logs

# 带筛选条件
curl "http://localhost:5001/api/audit/logs?action=create&limit=50"
```

### 数据导入

#### 导入 CSV 数据
```bash
# 导入站点
curl -X POST http://localhost:5001/api/import/csv \
  -F "type=sites" \
  -F "file=@sites.csv"

# 导入设备类型
curl -X POST http://localhost:5001/api/import/csv \
  -F "type=equipment_types" \
  -F "file=@equipment_types.csv"

# 导入设备
curl -X POST http://localhost:5001/api/import/csv \
  -F "type=equipment" \
  -F "file=@equipment.csv"

# 导入库存
curl -X POST http://localhost:5001/api/import/csv \
  -F "type=inventory" \
  -F "file=@inventory.csv"

# 导入会员
curl -X POST http://localhost:5001/api/import/csv \
  -F "type=members" \
  -F "file=@members.csv"
```

### 数据导出

#### 导出 Markdown 周报
```bash
# 默认导出最近7天
curl -OJ http://localhost:5001/api/export/weekly-report

# 指定日期范围
curl -OJ "http://localhost:5001/api/export/weekly-report?start_date=2024-05-01&end_date=2024-05-07"
```

#### 导出 JSON 审计包
```bash
# 默认导出最近30天
curl -OJ http://localhost:5001/api/export/audit-package

# 指定日期范围
curl -OJ "http://localhost:5001/api/export/audit-package?start_date=2024-04-01&end_date=2024-04-30"
```

## 完整业务流程演示

以下是一个完整的业务流程，演示从预约到归还的全过程：

### 1. 准备基础数据
```bash
# 创建站点
curl -X POST http://localhost:5001/api/sites \
  -H "Content-Type: application/json" \
  -d '{"name":"阳光社区","address":"阳光路123号","contact_person":"张主任","phone":"010-12345678"}'

# 创建设备类型（轮椅）
curl -X POST http://localhost:5001/api/equipment/types \
  -H "Content-Type: application/json" \
  -d '{"name":"轮椅","description":"手动轮椅","deposit_amount":500,"daily_rental_fee":10,"late_fee_per_day":20}'

# 创建设备
curl -X POST http://localhost:5001/api/equipment \
  -H "Content-Type: application/json" \
  -d '{"equipment_type_id":1,"serial_number":"WC0001","name":"轮椅-1号","status":"available"}'

# 创建库存
curl -X POST http://localhost:5001/api/equipment/inventory \
  -H "Content-Type: application/json" \
  -d '{"site_id":1,"equipment_id":1,"quantity":1,"available_quantity":1}'

# 创建会员
curl -X POST http://localhost:5001/api/members \
  -H "Content-Type: application/json" \
  -d '{"member_number":"M20240001","name":"王大爷","phone":"13800138001","gender":"男"}'
```

### 2. 预约设备
```bash
# 王大爷预约5月10日-5月15日的轮椅
curl -X POST http://localhost:5001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "equipment_type_id": 1,
    "site_id": 1,
    "start_date": "2024-05-10",
    "end_date": "2024-05-15",
    "status": "confirmed"
  }'
```

### 3. 借出设备
```bash
# 王大爷借出轮椅，交押金500元
curl -X POST http://localhost:5001/api/rentals \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "equipment_id": 1,
    "site_id": 1,
    "booking_id": 1,
    "start_date": "2024-05-10",
    "expected_return_date": "2024-05-15",
    "deposit_paid": 500.0
  }'
```

**系统自动校验：**
- ✅ 王大爷不在黑名单
- ✅ 轮椅状态为 available
- ✅ 轮椅不在维修/封存中
- ✅ 库存可用数量为 1
- ✅ 押金 500 元符合规则（轮椅押金500元）

### 4. 归还设备（逾期3天）
```bash
# 王大爷逾期3天归还（5月18日才还）
curl -X POST http://localhost:5001/api/rentals/1/return \
  -H "Content-Type: application/json" \
  -d '{
    "actual_return_date": "2024-05-18"
  }'
```

**系统自动计算：**
- 租期：5天（5月10日-5月15日）
- 租金：5天 × 10元/天 = 50元
- 逾期：3天（5月16日-5月18日）
- 逾期费：3天 × 20元/天 = 60元
- 总费用：50 + 60 = 110元
- 退款：押金500 - 总费用110 = 390元

### 5. 查看审计日志
```bash
curl http://localhost:5001/api/audit/logs
```

### 6. 导出周报
```bash
curl -OJ http://localhost:5001/api/export/weekly-report
```

### 7. 导出审计包
```bash
curl -OJ http://localhost:5001/api/export/audit-package
```

## 风险控制场景演示

### 场景1：黑名单会员无法借出
```bash
# 创建黑名单会员
curl -X POST http://localhost:5001/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "member_number": "M20240002",
    "name": "张先生",
    "phone": "13700137003",
    "is_blacklisted": true,
    "blacklist_reason": "多次逾期未还设备"
  }'

# 黑名单会员尝试借出（会失败）
curl -X POST http://localhost:5001/api/rentals \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 2,
    "equipment_id": 1,
    "site_id": 1,
    "start_date": "2024-05-20",
    "expected_return_date": "2024-05-25",
    "deposit_paid": 500.0
  }'
```

**预期结果：** 返回 400 错误，提示"会员在黑名单中，无法借出"

### 场景2：设备维修中无法借出
```bash
# 创建设备维修记录
curl -X POST http://localhost:5001/api/maintenance \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": 1,
    "site_id": 1,
    "maintenance_type": "repair",
    "start_date": "2024-05-10",
    "reason": "车轮损坏，需要维修",
    "status": "in_progress"
  }'

# 尝试借出维修中的设备（会失败）
curl -X POST http://localhost:5001/api/rentals \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "equipment_id": 1,
    "site_id": 1,
    "start_date": "2024-05-20",
    "expected_return_date": "2024-05-25",
    "deposit_paid": 500.0
  }'
```

**预期结果：** 返回 400 错误，提示"设备正在维修或封存中"

### 场景3：押金不足无法借出
```bash
# 尝试用不足的押金借出（轮椅押金500元，只交300元）
curl -X POST http://localhost:5001/api/rentals \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "equipment_id": 1,
    "site_id": 1,
    "start_date": "2024-05-20",
    "expected_return_date": "2024-05-25",
    "deposit_paid": 300.0
  }'
```

**预期结果：** 返回 400 错误，提示"押金金额不足"，并显示预期押金和实际押金

## 数据模型

### 主要实体

| 实体 | 说明 |
|------|------|
| Site | 站点（康复中心） |
| EquipmentType | 设备类型（轮椅、助行器、护理床等） |
| Equipment | 具体设备 |
| Inventory | 库存（站点-设备的库存关系） |
| Member | 会员 |
| Booking | 预约 |
| Rental | 借出记录 |
| Maintenance | 维修/封存记录 |
| AuditLog | 审计日志 |

## 目录结构

```
xy4202/
├── __init__.py           # 应用初始化
├── config.py             # 配置文件
├── run.py                # 启动入口
├── requirements.txt      # 依赖列表
├── sample_data.py        # 示例数据
├── test_api.py           # API测试脚本
├── models/
│   ├── __init__.py
│   └── models.py         # 数据模型
└── routes/
    ├── __init__.py
    ├── main.py           # 主路由
    ├── sites.py          # 站点路由
    ├── equipment.py      # 设备路由
    ├── members.py        # 会员路由
    ├── bookings.py       # 预约路由
    ├── rentals.py        # 借还路由
    ├── maintenance.py    # 维修路由
    ├── audit.py          # 审计路由
    └── import_export.py  # 导入导出路由
```

## 测试运行

### 运行测试脚本
```bash
# 确保服务已启动
python run.py

# 另开终端运行测试
python test_api.py
```

### 手动测试
使用 README 中的 curl 命令逐一测试各个 API 端点。

## 故障排除

### 数据库连接问题
- 确保 `app.db` 文件存在且有写入权限
- 检查 `config.py` 中的数据库路径配置

### 导入导出问题
- 确保 `uploads/` 和 `exports/` 目录存在并有写入权限
- CSV 文件编码应为 UTF-8

### 日期格式问题
- 所有日期字段使用 `YYYY-MM-DD` 格式
- 时间字段使用 ISO 8601 格式

## 许可证

本项目仅供内部使用。

## 联系方式

如有问题，请联系系统管理员。
