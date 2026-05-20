# MCN 样品管理后端服务

## 功能特点

- 支持 CSV 寄送单批量导入
- 支持 JSON 达人档案导入
- 支持回收照片上传
- 可追踪的操作日志
- 新增批次、标记处理、退回修改
- 超期未还自动检测和标记
- 破损扣款记录
- 同样品重复寄送检测
- 多维度历史查询（品牌、批次、达人、押金扣款）
- 明细导出（CSV格式）

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
npm start
```

## API 接口文档

### 1. 导入寄送单 CSV

```
POST /api/import/csv
Content-Type: multipart/form-data

file: CSV文件
handler: 处理人（可选）
```

示例文件：`examples/sample_import.csv`

### 2. 导入达人档案 JSON

```
POST /api/import/influencers
Content-Type: multipart/form-data

file: JSON文件
```

示例文件：`examples/influencers.json`

### 3. 创建新批次

```
POST /api/batches
Content-Type: application/json

{
  "brand": "品牌名称",
  "sendDate": "2024-01-15",
  "expectedReturnDate": "2024-02-15",
  "handler": "管理员",
  "remark": "备注"
}
```

### 4. 获取所有批次

```
GET /api/batches
```

### 5. 处理样品记录

```
POST /api/records/:recordId/process
Content-Type: application/json

{
  "status": "returned",  // returned(已归还), damaged(破损), deducted(已扣款)
  "handler": "处理人",
  "remark": "处理备注",
  "actualReturnDate": "2024-02-10",  // 可选
  "deductionAmount": 100,             // 扣款时必填
  "deductionReason": "样品破损"       // 扣款时必填
}
```

### 6. 退回修改

```
POST /api/records/:recordId/return
Content-Type: application/json

{
  "handler": "处理人",
  "reason": "退回原因"
}
```

### 7. 查询记录（支持多维度筛选）

```
GET /api/records?brand=雅诗兰黛&batchId=xxx&influencerId=xxx&status=overdue&hasDeduction=true
```

### 8. 导出明细

```
GET /api/export?brand=雅诗兰黛
```

参数同查询接口，导出CSV文件。

### 9. 查看操作日志

```
GET /api/records/:recordId/logs
```

### 10. 上传回收照片

```
POST /api/records/:recordId/photos
Content-Type: multipart/form-data

photos: 照片文件（最多10张）
handler: 处理人
```

## 数据模型

### 状态说明

- `pending`: 待处理
- `sent`: 已寄送
- `received`: 已签收
- `overdue`: 超期未还（系统自动标记）
- `damaged`: 样品破损
- `returned`: 已归还
- `deducted`: 已扣款

## 目录结构

```
├── src/
│   ├── index.ts      # 入口文件
│   ├── database.ts   # 数据库操作
│   ├── services.ts   # 业务逻辑
│   ├── routes.ts     # 路由定义
│   ├── types.ts      # 类型定义
│   └── utils.ts      # 工具函数
├── examples/         # 示例文件
├── data/            # 数据库文件
├── uploads/         # 上传文件
└── package.json
```
