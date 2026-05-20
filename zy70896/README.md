# 网点运营交接记录后端服务

用于管理柜员尾箱交接记录的后端服务，支持CSV导入、自动校验、状态流转、历史追溯和导出。

## 功能特性

- **批次管理**：创建交接批次，批量导入CSV记录
- **自动校验**：
  - 金额不平检测
  - 缺双签检测
  - 跨日交接检测
- **状态流转**：待处理、需审核、处理中、已退回、已审批
- **处理追溯**：记录每次操作的处理人、时间、备注
- **多维度查询**：按柜员尾箱、授权主管、差错编号、状态等筛选
- **数据导出**：支持导出CSV明细
- **数据持久化**：基于文件系统存储，重启不丢失数据

## 快速开始

### 安装依赖

```bash
npm install
```

### 初始化样例数据

```bash
npm run init-data
```

样例数据包含：
- 4位柜员信息（含尾箱编号）
- 4条排班记录（含授权主管）
- 3条交接记录：
  - 张三（CASH-001）：正常记录，待处理
  - 李四（CASH-002）：金额差异-500元 + 缺少签名，已退回修改
  - 王五（CASH-003）：跨日交接，主管已确认放行

### 启动服务

```bash
# 开发模式
npm run dev

# 编译后运行
npm run build
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口

### 健康检查
```
GET /api/health
```

### 批次管理

#### 创建批次
```
POST /api/batches
Content-Type: application/json

{
  "name": "2024年1月15日交接批次",
  "description": "日常柜员尾箱交接",
  "branchId": "B001",
  "createdBy": "admin"
}
```

#### 上传CSV交接记录
```
POST /api/batches/:batchId/upload
Content-Type: multipart/form-data

file: sample-transfer.csv
```

#### 获取批次列表
```
GET /api/batches
```

#### 获取单批次详情
```
GET /api/batches/:batchId
```

### 记录管理

#### 查询记录（支持多维度筛选）
```
GET /api/records?cashBoxId=CASH-001&supervisorId=S001&status=needs_review&page=1&pageSize=50
```

支持的查询参数：
- `cashBoxId`：柜员尾箱编号
- `supervisorId`：授权主管ID
- `errorNumber`：差错编号
- `tellerId`：柜员ID
- `status`：记录状态 (pending/needs_review/processed/returned/approved)
- `batchId`：批次ID
- `startDate` / `endDate`：日期范围
- `page` / `pageSize`：分页参数

#### 获取单条记录详情
```
GET /api/records/:recordId
```

#### 标记处理
```
POST /api/records/:recordId/process
Content-Type: application/json

{
  "handledBy": "S001",
  "comment": "金额已核对无误"
}
```

#### 退回修改
```
POST /api/records/:recordId/return
Content-Type: application/json

{
  "handledBy": "S001",
  "comment": "金额不符，请重新核对现金并补充双签"
}
```

#### 审批通过
```
POST /api/records/:recordId/approve
Content-Type: application/json

{
  "handledBy": "S002",
  "comment": "跨日交接已核实，属特殊情况"
}
```

#### 导出记录CSV
```
GET /api/records/export/download?cashBoxId=CASH-001
```

支持与查询接口相同的筛选参数，导出数量与查询结果一致。

### 基础数据

#### 获取柜员列表
```
GET /api/reference/tellers
```

#### 保存柜员信息
```
POST /api/reference/tellers
Content-Type: application/json

[
  {"tellerId": "T001", "name": "张三", "cashBoxId": "CASH-001", "branchId": "B001"}
]
```

#### 获取排班列表
```
GET /api/reference/schedules
```

#### 保存排班信息
```
POST /api/reference/schedules
Content-Type: application/json

[
  {"tellerId": "T001", "date": "2024-01-15", "shift": "morning", "supervisorId": "S001", "supervisorName": "王主管"}
]
```

## 数据存储

所有数据存储在 `./data` 目录下：
- `records.json`：交接记录
- `batches.json`：批次信息
- `tellers.json`：柜员信息
- `schedules.json`：排班信息

## 项目结构

```
.
├── src/
│   ├── index.ts              # 服务入口
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── storage/
│   │   └── FileStorage.ts    # 文件存储层
│   ├── services/
│   │   └── TransferService.ts # 业务逻辑层
│   ├── routes/
│   │   ├── batches.ts        # 批次路由
│   │   ├── records.ts        # 记录路由
│   │   └── reference.ts      # 基础数据路由
│   └── scripts/
│       └── init-sample-data.ts # 样例数据脚本
├── sample-transfer.csv       # 样例CSV文件
├── data/                     # 数据目录（运行时生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 样例场景说明

### 记录1：正常交接
- 柜员：张三（T001）
- 尾箱：CASH-001
- 状态：待处理
- 说明：金额平，有双签，无需人工干预

### 记录2：需要人工修正
- 柜员：李四（T002）
- 尾箱：CASH-002
- 状态：需审核 → 已退回
- 问题：
  1. 金额差异 -500.00 元
  2. 缺少第一签名
- 处理历史：系统检测问题 → 主管退回，备注"金额不符，请重新核对现金"
- 后续操作：柜员核对现金、补充签名后，主管可标记处理或审批

### 记录3：特殊情况放行
- 柜员：王五（T003）
- 尾箱：CASH-003
- 状态：处理完成
- 问题：跨日交接（1月14日交接，1月15日排班）
- 处理历史：系统检测问题 → 主管标记处理，备注"已确认，特殊情况加班交接"
- 说明：主管可依据实际情况对异常记录进行放行说明，用于后续审计追溯
