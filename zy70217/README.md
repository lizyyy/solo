# 🏥 诊所疫苗预约冷链 API

一个完整的诊所疫苗预约系统，实现疫苗预约与冷链库存绑定的业务闭环。

## ✨ 核心特性

### 业务闭环
- **疫苗批号绑定**：每次预约绑定具体的疫苗批次
- **预约锁定机制**：创建预约时锁定剂次，防止超卖
- **取消/改约释放**：取消或改约时释放剂次
- **冷链状态监控**：实时监控冷链箱状态
- **异常冻结机制**：冷链异常时自动冻结所有相关剂次
- **人工修正释放**：人工修正后解冻释放剂次
- **剂次报表追踪**：完整追踪剂次流转

### 异常场景
- ✅ 缺字段验证
- ✅ 非法流转（状态机验证）
- ✅ 重复提交
- ✅ 人工修正
- ✅ 冷链异常

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 运行测试
```bash
npm test
```

## 📋 样例数据

系统启动时自动加载以下样例数据：

### 疫苗 (Vaccines)
| ID | 名称 | 生产厂家 | 剂次要求 |
|----|------|----------|----------|
| v1 | HPV九价疫苗 | 默沙东 | 3剂 |
| v2 | 新冠疫苗 | 国药 | 2剂 |
| v3 | 流感疫苗 | 赛诺菲 | 1剂 |

### 冷链箱 (Cold Boxes)
| ID | 名称 | 温度范围 | 当前温度 | 位置 |
|----|------|----------|----------|------|
| box1 | 主冷库-01 | 2-8°C | 5°C | 一号冷库 |
| box2 | 备用冷库-02 | 2-8°C | 6°C | 二号冷库 |

### 库存 (Inventory)
| ID | 疫苗 | 批号 | 冷链箱 | 总剂次 | 过期日期 |
|----|------|------|--------|--------|----------|
| inv1 | v1 | HPV-2024-001 | box1 | 50 | 2025-12-31 |
| inv2 | v1 | HPV-2024-002 | box2 | 30 | 2025-10-31 |
| inv3 | v2 | COVID-2024-001 | box1 | 100 | 2025-06-30 |

## 🔌 API 接口

### 预约管理

#### 创建预约
```bash
POST /api/appointments

# 请求体
{
  "patientName": "张三",
  "patientId": "P001",
  "vaccineId": "v1",
  "appointmentDate": "2025-01-15",
  "inventoryId": "inv1"  // 可选，不指定则自动选择
}

# 响应示例
{
  "success": true,
  "data": {
    "appointment": { ... },
    "inventory": {
      "availableDoses": 49,
      "lockedDoses": 1,
      "batchNo": "HPV-2024-001"
    },
    "message": "预约成功，已锁定1剂次"
  }
}
```

#### 取消预约
```bash
POST /api/appointments/:id/cancel

# 请求体
{
  "reason": "患者临时有事"
}
```

#### 改约
```bash
POST /api/appointments/:id/reschedule

# 请求体
{
  "newDate": "2025-02-01",
  "newInventoryId": "inv2"  // 可选，用于更换批次
}
```

#### 完成预约
```bash
POST /api/appointments/:id/complete
```

### 冷链管理

#### 查看冷链状态
```bash
GET /api/cold-chain/status
```

#### 上报冷链异常
```bash
POST /api/cold-chain/boxes/:id/exception

# 请求体
{
  "exceptionType": "temperature_high",
  "temperature": 15,
  "details": {
    "cause": "设备故障",
    "duration": 30
  }
}
```

#### 处理冷链异常
```bash
POST /api/cold-chain/boxes/:id/resolve

# 方案1: 释放（问题修复后）
{
  "resolution": "release"
}

# 方案2: 人工修正
{
  "manualCorrection": true
}

# 方案3: 销毁
{
  "resolution": "dispose"
}
```

### 报表查询

#### 剂次报表
```bash
GET /api/reports/doses
```

#### 批次报表
```bash
GET /api/reports/batch/:batchNo
```

#### 系统概览
```bash
GET /api/reports/overview
```

## 🧪 主流程演示

### 场景：HPV疫苗预约完整闭环

```bash
# 1. 创建3个预约
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"patientName":"张三","patientId":"P001","vaccineId":"v1","appointmentDate":"2025-01-15"}'

curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"patientName":"李四","patientId":"P002","vaccineId":"v1","appointmentDate":"2025-01-16","inventoryId":"inv1"}'

curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"patientName":"王五","patientId":"P003","vaccineId":"v1","appointmentDate":"2025-01-17"}'

# 2. 取消预约2
curl -X POST http://localhost:3000/api/appointments/<预约2_ID>/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason":"患者临时有事"}'

# 3. 预约1改约到另一个批次
curl -X POST http://localhost:3000/api/appointments/<预约1_ID>/reschedule \
  -H "Content-Type: application/json" \
  -d '{"newDate":"2025-02-01","newInventoryId":"inv1"}'

# 4. 完成预约
curl -X POST http://localhost:3000/api/appointments/<预约1_ID>/complete

# 5. 模拟冷链异常（box1高温）
curl -X POST http://localhost:3000/api/cold-chain/boxes/box1/exception \
  -H "Content-Type: application/json" \
  -d '{"exceptionType":"temperature_high","temperature":15,"details":{"cause":"设备故障","duration":30}}'

# 6. 查看剂次报表
curl http://localhost:3000/api/reports/doses

# 7. 人工修正释放
curl -X POST http://localhost:3000/api/cold-chain/boxes/box1/resolve \
  -H "Content-Type: application/json" \
  -d '{"manualCorrection":true}'
```

## ❌ 异常操作演示

### 1. 缺字段验证
```bash
# 缺少必填字段会被拒绝
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"patientName":"张三"}'

# 响应: {"success":false,"error":"缺少必填字段...","statusCode":400}
```

### 2. 非法流转
```bash
# 创建预约后取消
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"patientName":"张三","patientId":"P001","vaccineId":"v1","appointmentDate":"2025-01-15"}'

curl -X POST http://localhost:3000/api/appointments/<ID>/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason":"测试取消"}'

# 再次取消会失败
curl -X POST http://localhost:3000/api/appointments/<ID>/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason":"再次取消"}'

# 响应: {"success":false,"error":"预约状态为 cancelled，无法取消","statusCode":400}
```

### 3. 重复提交验证
```bash
# 连续预约30次后，第31次会失败
# for 循环创建30个预约...

# 第31次预约
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"patientName":"超额患者","patientId":"OVER01","vaccineId":"v1","appointmentDate":"2025-01-15","inventoryId":"inv2"}'

# 响应: {"success":false,"error":"该批次疫苗可用剂次不足","statusCode":400}
```

### 4. 人工修正场景
```bash
# 1. 创建预约
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"patientName":"待冻结患者","patientId":"F001","vaccineId":"v1","appointmentDate":"2025-01-15","inventoryId":"inv1"}'

# 2. 冷链异常冻结
curl -X POST http://localhost:3000/api/cold-chain/boxes/box1/exception \
  -H "Content-Type: application/json" \
  -d '{"exceptionType":"power_failure","temperature":25}'

# 3. 人工修正释放
curl -X POST http://localhost:3000/api/cold-chain/boxes/box1/resolve \
  -H "Content-Type: application/json" \
  -d '{"manualCorrection":true}'

# 响应包含: "manualCorrection": true
```

## 📊 剂次状态流转

```
           创建预约             取消/改约
available ──────────→ locked ────────────→ available
   ↑                    │
   │                    │ 完成预约
   │                    ↓
   │                  used
   │
   │  冷链异常          人工修正/问题修复
   └──────────→ frozen ──────────────────→ available
                     │
                     │ 销毁
                     ↓
                  disposed
```

## 🏗️ 项目结构

```
.
├── src/
│   ├── index.js              # 入口文件
│   ├── models/
│   │   └── store.js          # 数据模型和存储
│   ├── services/
│   │   ├── appointmentService.js    # 预约业务逻辑
│   │   ├── coldChainService.js      # 冷链业务逻辑
│   │   └── reportService.js         # 报表服务
│   ├── routes/
│   │   ├── appointments.js   # 预约路由
│   │   ├── coldChain.js      # 冷链路由
│   │   └── reports.js        # 报表路由
│   └── utils/
│       └── errors.js         # 错误处理
├── test/
│   ├── main-flow.js          # 主流程测试
│   └── exception-scenarios.js # 异常场景测试
├── package.json
└── README.md
```

## 🔍 关键判断点

### 在测试中验证
- ✓ 疫苗批号绑定：预约时选择具体批次
- ✓ 预约锁定机制：创建预约时 lockedDoses+1, availableDoses-1
- ✓ 取消释放机制：取消预约时 lockedDoses-1, availableDoses+1
- ✓ 改约释放+锁定：改约时释放旧批次，锁定新批次
- ✓ 冷链状态监控：实时更新冷链箱状态
- ✓ 异常冻结机制：冷链异常时所有剂次转入 frozen
- ✓ 人工修正释放：人工修正后 frozenDoses 释放回 available
- ✓ 剂次报表统计：完整追踪各状态剂次数量

### 在接口响应中体现
- 每个 API 响应包含 `success` 字段
- 失败响应包含 `error` 消息和 `statusCode`
- 成功响应包含 `message` 说明操作结果
- 剂次数据在响应中实时更新

## 📝 License

MIT
