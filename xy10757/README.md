# 会员积分账本API

## 项目简介

这是一个完整的会员积分账本系统，包含后端API服务和前端管理页面，用于SRE查看和管理积分从批次发放到余额快照的完整处理链路。

### 核心功能

- **积分批次管理**：新增、查询积分批次
- **积分操作**：冻结余额、消费抵扣、过期回收、退款返还
- **余额快照**：定期生成余额快照，支持比对
- **比对复核**：自动比对计算余额与快照余额
- **人工修正**：支持修正交易记录，自动重新计算后续余额
- **数据导出**：支持Excel导出交易记录、快照等
- **处理链展示**：可视化展示积分的完整处理链路

### 技术栈

- **后端**：FastAPI + SQLAlchemy + SQLite
- **前端**：Vue 3 + Element Plus + Vue Router
- **数据导出**：pandas + openpyxl

## 快速启动

### 1. 启动后端服务

```bash
cd backend
chmod +x run.sh
./run.sh
```

或手动执行：

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python init_data.py  # 初始化示例数据
python main.py       # 启动服务
```

后端服务将在 `http://localhost:8000` 启动

API文档地址：`http://localhost:8000/docs`

### 2. 启动前端服务

```bash
cd frontend
chmod +x run.sh
./run.sh
```

或手动执行：

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:5173` 启动

## 初始化数据说明

首次启动时，系统会自动创建以下示例数据：

1. **积分批次**：BATCH202401010001，会员MEMBER001，10000积分
2. **冻结记录**：冻结2000积分，原因"风控冻结"
3. **交易记录**：
   - 消费抵扣1500积分（已复核）
   - 过期回收500积分（待复核）
   - 消费抵扣1000积分（待复核）
   - 退款返还300积分（待复核）
4. **余额快照**：可用余额6800积分

## 常用接口说明

### 积分批次接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches/ | 新增积分批次 |
| GET | /api/batches/ | 查询批次列表 |
| GET | /api/batches/{batch_id} | 查询单个批次 |
| GET | /api/batches/{batch_id}/chain | 查询批次处理链 |

### 积分操作接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/points/freeze | 冻结积分 |
| POST | /api/points/consume | 消费抵扣 |
| POST | /api/points/expire | 过期回收 |
| POST | /api/points/refund | 退款返还 |
| GET | /api/points/transactions | 查询交易列表 |
| GET | /api/points/balance/{member_id} | 查询会员余额 |

### 余额快照接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/balance/snapshot | 创建余额快照 |
| GET | /api/balance/snapshots | 查询快照列表 |

### 比对复核接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/review/compare/{member_id}/{snapshot_id} | 比对余额 |
| POST | /api/review/review/{tx_id} | 复核交易 |
| POST | /api/review/correct | 人工修正交易 |
| GET | /api/review/records | 查询复核记录 |

### 导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/export/transactions/{member_id} | 导出交易记录 |
| GET | /api/export/snapshots/{member_id} | 导出快照记录 |
| GET | /api/export/full/{member_id} | 导出完整台账 |

## 规则拦截说明

### 人工修正规则

系统对人工修正操作设置了以下安全规则：

1. **已复核的交易不能修正**：交易一旦完成复核，禁止修改
2. **修正幅度限制**：单次修正的积分差值不能超过1000

### 被规则拦截的操作示例

**场景1：修正已复核的交易**
- 原始交易ID：1（已复核状态）
- 操作：尝试修正该交易的积分
- 结果：返回错误消息"已复核的交易不能修正"

**场景2：修正幅度过大**
- 原始交易积分：1500
- 尝试修改为：3000（差值1500 > 1000）
- 结果：返回错误消息"修正幅度过大，超过规则限制"

### 规则设计目的

1. **防止数据篡改**：已复核的交易代表已审核确认，不应随意修改
2. **控制风险**：限制单次修正的幅度，防止出现大额错误
3. **留痕审计**：所有修正操作都会记录到复核记录表中

## 处理链重计算机制

当对某笔交易进行人工修正后，系统会自动：

1. 查找该会员在这笔交易时间之后的所有交易
2. 重新计算每笔交易的before_balance和after_balance
3. 更新所有后续交易的余额数据
4. 记录复核留痕

确保余额数据的一致性和连贯性。

## 边界情况处理

### 过期回收

- 支持部分过期（不需要整批过期）
- 自动更新批次状态
- 记录操作人和操作时间

### 退款返还

- 必须关联原始消费交易ID
- 自动计算返还后的余额
- 支持部分退款

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── app/
│   │   ├── api/            # API路由
│   │   ├── models/         # 数据模型
│   │   ├── schemas/        # Pydantic模式
│   │   ├── services/       # 业务逻辑
│   │   └── core/           # 核心配置
│   ├── main.py             # 入口文件
│   ├── init_data.py        # 初始化数据脚本
│   ├── requirements.txt    # 依赖清单
│   └── run.sh              # 启动脚本
└── frontend/               # 前端页面
    ├── src/
    │   ├── views/          # 页面组件
    │   └── router/         # 路由配置
    ├── package.json
    └── run.sh              # 启动脚本
```

## 前端页面说明

1. **首页**：系统概览，快捷操作入口
2. **积分批次**：批次列表和新增批次
3. **交易记录**：交易列表和操作（消费、过期、退款、冻结）
4. **余额快照**：快照列表和创建快照、比对功能
5. **比对复核**：待复核交易列表、人工修正、复核记录
6. **处理链**：可视化展示积分从批次到快照的完整链路

## 注意事项

1. 首次启动会自动创建SQLite数据库和示例数据
2. 所有修改操作都会记录留痕
3. 导出的Excel文件包含完整的台账信息
4. 冻结的积分不会参与可用余额计算
5. 过期回收和退款返还操作需要特别注意边界校验
