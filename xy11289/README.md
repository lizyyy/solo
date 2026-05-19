# 会展项目设备管理系统

一个用于管理会展项目中桁架、灯具、屏幕等设备借用的后端系统。

## 功能特性

- ✅ 设备扫码借用/归还
- ✅ 重复扫码检测（5分钟内）
- ✅ 跨展位借用管理
- ✅ 损坏等级记录与费用扣减
- ✅ 操作回滚功能
- ✅ 操作日志记录（放行/拦截原因）
- ✅ 多条件筛选查询
- ✅ CSV报告导出
- ✅ 实时统计数据

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入样例数据

```bash
npm run import-sample
```

### 4. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## API 接口文档

### 基础信息

- 基础URL: `http://localhost:3000/api/equipment`

### 接口列表

#### 1. 借用设备

**POST** `/borrow`

**请求参数:**
```json
{
  "barcode": "TRUSS001",
  "toBoothId": "展位ID",
  "operator": "张三",
  "remark": "备注信息（可选）"
}
```

**响应示例:**
```json
{
  "success": true,
  "reason": "跨展位借用成功",
  "recordId": "uuid",
  "equipment": {
    "barcode": "TRUSS001",
    "name": "桁架-2米",
    "type": "truss"
  }
}
```

**异常响应:**
```json
{
  "success": false,
  "reason": "5分钟内重复扫码借用",
  "code": "DUPLICATE_SCAN"
}
```

#### 2. 归还设备

**POST** `/return`

**请求参数:**
```json
{
  "barcode": "TRUSS001",
  "toBoothId": "展位ID",
  "operator": "张三",
  "damageLevel": "轻微",
  "damageFee": 50,
  "remark": "备注（可选）"
}
```

#### 3. 回滚操作

**POST** `/rollback/:recordId`

**请求参数:**
```json
{
  "operator": "管理员"
}
```

#### 4. 查询借用记录

**GET** `/records`

**查询参数（可选）:**
- `operator`: 负责人
- `status`: 状态 (confirmed/rolled_back)
- `operationType`: 操作类型 (borrow/return)
- `startDate`: 开始日期
- `endDate`: 结束日期
- `hasDamage`: 是否有损坏 (true/false)

**示例:**
```
GET /api/equipment/records?operator=张三&hasDamage=true
```

#### 5. 导出CSV报告

**GET** `/records/export`

支持与查询相同的筛选参数，直接下载CSV文件。

#### 6. 获取所有设备

**GET** `/equipments`

#### 7. 获取所有展位

**GET** `/booths`

#### 8. 获取操作日志

**GET** `/logs`

#### 9. 获取统计数据

**GET** `/statistics`

#### 10. 查询单个设备

**GET** `/equipment/:barcode`

## 使用示例

### 正常流程示例

#### 步骤1: 获取展位列表

```bash
curl http://localhost:3000/api/equipment/booths
```

#### 步骤2: 借用设备（从仓库到A01展位）

```bash
curl -X POST http://localhost:3000/api/equipment/borrow \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "TRUSS001",
    "toBoothId": "仓库ID替换为实际ID",
    "operator": "张三"
  }'
```

#### 步骤3: 跨展位借用（从A01到B02）

```bash
curl -X POST http://localhost:3000/api/equipment/borrow \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "TRUSS001",
    "toBoothId": "B02展位ID",
    "operator": "李四"
  }'
```

#### 步骤4: 归还设备（带损坏）

```bash
curl -X POST http://localhost:3000/api/equipment/return \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "TRUSS001",
    "toBoothId": "仓库ID",
    "operator": "王五",
    "damageLevel": "严重",
    "damageFee": 200
  }'
```

#### 步骤5: 查询损坏记录筛选

```bash
curl "http://localhost:3000/api/equipment/records?hasDamage=true"
```

#### 步骤6: 导出报告

```bash
curl -O "http://localhost:3000/api/equipment/records/export?operator=张三"
```

### 异常场景示例

#### 场景1: 重复扫码（5分钟内重复借用）

```bash
# 第一次借用（成功）
curl -X POST http://localhost:3000/api/equipment/borrow \
  -H "Content-Type: application/json" \
  -d '{"barcode": "LIGHT001", "toBoothId": "A01-ID", "operator": "测试员"}'

# 立即第二次借用（失败 - 5分钟内重复）
curl -X POST http://localhost:3000/api/equipment/borrow \
  -H "Content-Type: application/json" \
  -d '{"barcode": "LIGHT001", "toBoothId": "A01-ID", "operator": "测试员"}'
```

#### 场景2: 回滚错误操作

```bash
# 先借用
curl -X POST http://localhost:3000/api/equipment/borrow ...

# 获取recordId后回滚
curl -X POST http://localhost:3000/api/equipment/rollback/{recordId} \
  -H "Content-Type: application/json" \
  -d '{"operator": "管理员"}'
```

## 数据模型

### 展位 (booths)
- id: UUID
- name: 展位名称
- manager: 负责人
- contact: 联系方式
- created_at: 创建时间

### 设备 (equipments)
- id: UUID
- barcode: 条码（唯一）
- name: 设备名称
- type: 设备类型（truss/light/screen）
- status: 状态（available/in_use/damaged）
- current_booth_id: 当前展位

### 借用记录 (borrow_records)
- id: UUID
- equipment_id: 设备ID
- from_booth_id: 来源展位
- to_booth_id: 目标展位
- operator: 操作人
- operation_type: 操作类型（borrow/return）
- status: 状态（confirmed/rolled_back）
- damage_level: 损坏等级
- damage_fee: 损坏费用
- remark: 备注
- created_at: 创建时间

### 操作日志 (operation_logs)
- id: UUID
- record_id: 记录ID
- action: 操作类型
- result: 结果（approved/rejected）
- reason: 原因
- operator: 操作人
- created_at: 创建时间

## 异常代码说明

| 代码 | 说明 |
|------|------|
| EQUIPMENT_NOT_FOUND | 设备不存在 |
| EQUIPMENT_DAMAGED | 设备已损坏 |
| DUPLICATE_SCAN | 5分钟内重复扫码 |
| SAME_BOOTH | 设备已在目标展位 |
| RECORD_NOT_FOUND | 记录不存在 |
| ALREADY_ROLLED_BACK | 记录已回滚 |

## 目录结构

```
.
├── src/
│   ├── app.js                 # 主应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── routes/
│   │   └── equipment.js       # 设备路由
│   ├── services/
│   │   └── EquipmentService.js # 业务逻辑
│   ├── middleware/
│   │   └── errorHandler.js    # 错误处理
│   └── scripts/
│       ├── initDB.js          # 数据库初始化
│       └── importSample.js   # 导入样例数据
├── data/                       # 数据库文件目录
├── package.json
└── README.md
```
