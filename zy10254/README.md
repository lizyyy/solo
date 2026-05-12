# 车辆救援派单 API 系统

## 📋 项目概述

这是一个完整的车辆救援派单 API 系统，专门解决车主在高速口等待救援时客服只能看到一个未处理工单的问题。系统支持：

- ✅ 创建救援请求
- ✅ 智能匹配技师（按技能和评分）
- ✅ 状态流转追踪
- ✅ 重派技师
- ✅ 费用结算
- ✅ 会员权益检查
- ✅ 重复报案自动识别
- ✅ 取消订单费用自动回滚
- ✅ 完整的状态日志

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 3. 运行演示脚本

**重要：运行演示前需要先启动服务！**

打开新的终端窗口，运行以下命令：

| 演示场景 | 命令 | 说明 |
|---------|------|------|
| 完整流程演示 | `npm run demo` | 从创建到结算的完整流程 |
| 重复报案场景 | `npm run demo:repeat` | 同一车辆多次报案、权益过期 |
| 重派技师场景 | `npm run demo:reassign` | 技师无法到达时的重派流程 |
| 取消回滚场景 | `npm run demo:cancel` | 取消订单后权益自动回滚 |

示例：
```bash
# 终端1：启动服务
npm start

# 终端2：运行完整流程演示
npm run demo
```

## 🔧 技术栈

- **运行时**: Node.js 18+
- **Web框架**: Express.js
- **数据库**: SQLite (本地文件存储)
- **数据格式**: JSON

## 📁 项目结构

```
vehicle-rescue-dispatch/
├── src/
│   ├── index.js              # 服务入口
│   ├── database/
│   │   └── db.js             # 数据库初始化和连接
│   ├── services/
│   │   ├── rescueService.js  # 核心救援业务逻辑
│   │   └── orderService.js   # 订单管理和特殊场景
│   └── routes/
│       └── api.js            # API 路由定义
├── demo/
│   ├── flow.js               # 完整流程演示脚本
│   ├── repeat-cases.js       # 重复报案演示脚本
│   ├── reassign.js           # 重派技师演示脚本
│   └── cancel-rollback.js    # 取消回滚演示脚本
├── README.md                 # 本文档
└── package.json              # 项目配置
```

## 📡 API 文档

### 基础信息

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`

---

### 1. 创建救援请求

**POST** `/rescue/create`

创建新的救援工单，自动检查重复报案和会员权益。

**请求体**:
```json
{
  "vehiclePlate": "京A12345",      // 必填：车牌号
  "vehicleModel": "特斯拉 Model 3", // 可选：车型
  "ownerName": "张三",              // 必填：车主姓名
  "ownerPhone": "13800138000",      // 必填：车主电话
  "location": "北京市朝阳区G6高速出口", // 必填：故障位置
  "breakdownType": "tire",          // 必填：故障类型
  "description": "右后胎爆胎",       // 可选：故障描述
  "membershipId": "VIP001"          // 可选：会员ID
}
```

**故障类型 breakdownType**:
- `tire` - 换胎
- `fuel` - 送油
- `battery` - 搭电
- `tow` - 拖车
- `lock` - 开锁

**响应示例**:
```json
{
  "success": true,
  "data": {
    "orderId": "uuid...",
    "isRepeat": false,
    "estimatedCost": 150,
    "status": "CREATED"
  }
}
```

---

### 2. 查询救援工单详情

**GET** `/rescue/:orderId`

查询单个工单的完整信息，包括技师信息、状态流转日志、费用记录。

**响应示例**:
```json
{
  "success": true,
  "data": {
    "orderId": "...",
    "vehiclePlate": "京A88888",
    "status": "SETTLED",
    "technician": {
      "technicianId": "TECH001",
      "name": "王师傅",
      "phone": "13900139001"
    },
    "statusLogs": [...],
    "feeRecords": [...]
  }
}
```

---

### 3. 查询车辆所有工单

**GET** `/rescue/vehicle/:vehiclePlate`

查询某一车辆的历史工单。

---

### 4. 查询所有工单

**GET** `/rescue?status=CREATED`

查询所有工单，可按状态过滤。

---

### 5. 匹配技师

**POST** `/rescue/:orderId/match`

为工单智能匹配符合技能要求的空闲技师，按评分排序。

**响应示例**:
```json
{
  "success": true,
  "data": {
    "orderId": "...",
    "technician": {
      "technicianId": "TECH001",
      "name": "王师傅",
      "phone": "13900139001",
      "rating": 4.5
    },
    "status": "MATCHED"
  }
}
```

---

### 6. 技师确认出发

**POST** `/rescue/:orderId/depart`

**请求体**:
```json
{
  "technicianId": "TECH001"
}
```

---

### 7. 技师到达现场

**POST** `/rescue/:orderId/arrive`

**请求体**:
```json
{
  "technicianId": "TECH001"
}
```

---

### 8. 完成救援并结算

**POST** `/rescue/:orderId/complete`

完成救援，自动扣除会员权益次数并结算费用。

**请求体**:
```json
{
  "technicianId": "TECH001",
  "actualCost": 180,
  "remark": "已更换备胎"
}
```

---

### 9. 取消救援

**POST** `/rescue/:orderId/cancel`

取消订单，自动释放技师并回滚已扣除的会员权益。

**请求体**:
```json
{
  "reason": "车主自行解决",
  "operatorId": "CS001"
}
```

---

### 10. 重派技师

**POST** `/rescue/:orderId/reassign`

释放原技师并重新匹配新技师。可在匹配后或出发后操作。

**请求体**:
```json
{
  "reason": "技师无法按时到达",
  "operatorId": "CS001"
}
```

---

### 11. 查询所有技师

**GET** `/technicians`

---

### 12. 查询会员权益

**GET** `/membership/:membershipId`

---

## 🔄 状态流转图

```
CREATED (已创建)
    ↓
MATCHED (已匹配技师) ←─────────┐
    ↓                          │
DEPARTED (技师已出发)           │ 重派
    ↓                          │
ARRIVED (技师已到达)            │
    ↓                          │
COMPLETED (已完成)              │
    ↓                          │
SETTLED (已结算)                │
                               │
取消可在任意状态进行 → CANCELLED (已取消)
```

## ⚙️ 业务规则说明

### 1. 重复报案处理
- **检测窗口**: 30分钟内
- **判断条件**: 同一车牌 + 工单未完成
- **处理方式**: 标记为重复工单，关联到原始工单，不重复派单
- **目的**: 避免同一故障多次派单造成资源浪费

### 2. 技师派单规则
- 只匹配状态为 `available` 的技师
- 技师技能必须匹配故障类型
- 按评分从高到低排序选择
- 已接单的技师状态自动变为 `busy`，不会被重复派单

### 3. 会员权益检查
创建订单时自动验证：
- 会员是否存在
- 会员是否有效
- 权益是否过期
- 剩余次数是否充足

### 4. 费用回滚机制
取消订单时自动触发：
- 释放技师（状态变回 `available`）
- 回滚已扣除的会员次数
- 记录回滚日志
- 保留完整的费用记录追溯

### 5. 幂等性保证
- 每个操作都有状态前置检查
- 已取消/已完成的工单不能重复操作
- 非当前指派技师不能操作工单

## 📊 预置测试数据

系统启动时自动创建以下测试数据：

### 技师列表
| ID | 姓名 | 电话 | 技能 | 评分 |
|----|------|------|------|------|
| TECH001 | 王师傅 | 13900139001 | 换胎/搭电/开锁 | 4.5 |
| TECH002 | 李师傅 | 13900139002 | 换胎/送油/拖车 | 4.5 |
| TECH003 | 张师傅 | 13900139003 | 搭电/送油/开锁 | 4.5 |
| TECH004 | 赵师傅 | 13900139004 | 拖车/换胎/搭电 | 4.5 |

### 会员列表
| ID | 姓名 | 剩余次数 | 过期时间 | 状态 |
|----|------|----------|----------|------|
| VIP001 | 张三 | 3 | 1年后 | 有效 |
| VIP002 | 李四 | 5 | 1年后 | 有效 |
| VIP003 | 王五 | 0 | 已过期 | 无效 |

## 🎯 演示场景详解

### 场景1：完整救援流程
1. 车主报案创建工单
2. 系统检查会员权益
3. 智能匹配技师
4. 技师确认出发
5. 技师到达现场
6. 完成救援结算
7. 释放技师，扣除会员次数

### 场景2：重复报案
1. 同一车辆30分钟内第一次报案
2. 5分钟内再次报案
3. 系统自动识别为重复报案
4. 关联原始工单，不重复派单

### 场景3：重派技师
1. 匹配第一个技师
2. 技师路上堵车无法按时到达
3. 客服发起重派
4. 系统释放原技师，匹配新技师

### 场景4：取消回滚
1. 创建工单并匹配技师
2. 技师出发后车主取消
3. 系统自动释放技师
4. 自动回滚已扣除的会员权益

## 🔍 健康检查

访问 `http://localhost:3000/health` 检查服务状态。

## 📝 注意事项

1. 数据库文件 `rescue.db` 会在首次启动时自动创建
2. 如需重置数据，删除 `rescue.db` 后重启服务即可
3. 所有时间均为 Unix 时间戳（秒）
4. 演示脚本需要服务启动后才能运行

## 🐛 问题排查

### 端口被占用
修改 `src/index.js` 中的 `PORT` 变量或设置环境变量：
```bash
PORT=3001 npm start
```

### 演示脚本连接失败
确保已在另一个终端启动了服务。

### 数据库锁错误
确保没有多个进程同时访问数据库文件。