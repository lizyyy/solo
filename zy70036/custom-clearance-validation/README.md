# 跨境清关资料校验服务

一个用于跨境清关资料校验的后端服务，解决 HS 编码、发票和箱单版本不一致的问题。

## 功能模块

| 模块 | 功能描述 |
|------|---------|
| **清关批次管理** | 创建、管理清关批次，追踪批次状态 |
| **资料版本管理** | 管理发票、箱单、HS编码的版本，支持版本追踪和一致性校验 |
| **HS编码规则校验** | 验证HS编码格式（长度、校验位、纯数字） |
| **箱单比对校验** | 比对发票与箱单的HS编码、数量、金额一致性 |
| **缺件拦截检测** | 检测文档级和项目级缺件，自动标记拦截状态 |
| **补料任务管理** | 自动生成补料任务，追踪任务完成状态 |
| **清关报告生成** | 整合所有校验结果，生成清关报告 |

## 技术栈

- **框架**: NestJS 11.x (TypeScript)
- **数据库**: PostgreSQL 15 + TypeORM 0.3.x
- **API文档**: Swagger
- **容器化**: Docker + docker-compose

## 快速开始（Docker 方式 - 推荐）

### 前置要求
- Docker
- Docker Compose

### 启动服务

```bash
# 克隆项目后进入目录
cd custom-clearance-validation

# 启动所有服务（PostgreSQL + API）
docker-compose up -d

# 查看日志确认服务启动成功
docker-compose logs -f api
```

服务启动后访问：
- **Swagger API文档**: http://localhost:3000/api/docs
- **健康检查**: http://localhost:3000/api/docs (Swagger 页面即可验证)

### 停止服务

```bash
docker-compose down

# 同时删除数据卷（清除数据库数据）
docker-compose down -v
```

## 本地开发方式

### 前置要求
- Node.js >= 20
- PostgreSQL >= 14 (或使用 Docker 提供的数据库)

### 1. 安装依赖

```bash
cd custom-clearance-validation
npm install
```

### 2. 配置环境变量

复制示例环境变量文件：

```bash
cp .env.example .env
```

`.env` 文件内容说明：

```env
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost       # PostgreSQL 主机
DB_PORT=5432            # PostgreSQL 端口
DB_USERNAME=postgres    # 数据库用户名
DB_PASSWORD=postgres    # 数据库密码
DB_NAME=custom_clearance # 数据库名称
DB_SYNC=true            # 开发模式自动同步表结构，生产环境建议设为 false
```

### 3. 启动 PostgreSQL 数据库

#### 方式 A：使用 Docker 启动数据库

```bash
# 仅启动 PostgreSQL
npm run db:up

# 查看数据库日志
npm run db:logs
```

#### 方式 B：使用本地 PostgreSQL

确保 PostgreSQL 已安装并运行，然后创建数据库：

```sql
CREATE DATABASE custom_clearance;
```

### 4. 启动应用

```bash
# 开发模式（带热重载）
npm run start:dev

# 或生产模式
npm run build
npm run start:prod
```

## API 文档

服务启动后，访问 **Swagger UI** 查看完整的 API 文档：

```
http://localhost:3000/api/docs
```

## 验收调用链

以下是一个完整的清关资料校验流程示例：

### 步骤 1：创建清关批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "BATCH-2026-001",
    "shipmentNumber": "SHP-2026-001",
    "originCountry": "CN",
    "destinationCountry": "US",
    "remarks": "测试批次"
  }'
```

**响应示例**：
```json
{
  "id": "uuid-xxx",
  "batchNumber": "BATCH-2026-001",
  "status": "draft",
  "createdAt": "2026-05-11T..."
}
```

记录返回的 `id` 作为 `{batchId}` 后续使用。

---

### 步骤 2：上传发票（创建发票版本）

```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceNumber": "INV-2026-001",
    "batchId": "{batchId}",
    "invoiceDate": "2026-05-01",
    "shipperName": "ABC Trading Co.",
    "consigneeName": "XYZ Imports Inc.",
    "totalAmount": 15000.00,
    "currency": "USD",
    "totalQuantity": 500,
    "itemCount": 2,
    "items": [
      {
        "lineNumber": 1,
        "hsCode": "85171210",
        "productName": "Mobile Phone",
        "quantity": 300,
        "unit": "PCS",
        "unitPrice": 30.00,
        "totalAmount": 9000.00
      },
      {
        "lineNumber": 2,
        "hsCode": "85171220",
        "productName": "Smart Watch",
        "quantity": 200,
        "unit": "PCS",
        "unitPrice": 30.00,
        "totalAmount": 6000.00
      }
    ]
  }'
```

---

### 步骤 3：上传箱单（创建箱单版本）

```bash
curl -X POST http://localhost:3000/api/packing-lists \
  -H "Content-Type: application/json" \
  -d '{
    "packingListNumber": "PL-2026-001",
    "batchId": "{batchId}",
    "packingDate": "2026-05-02",
    "shipperName": "ABC Trading Co.",
    "consigneeName": "XYZ Imports Inc.",
    "totalPackages": 50,
    "totalGrossWeight": 1250.00,
    "totalNetWeight": 1000.00,
    "totalVolume": 10.50,
    "weightUnit": "KG",
    "volumeUnit": "CBM",
    "items": [
      {
        "lineNumber": 1,
        "hsCode": "85171210",
        "productName": "Mobile Phone",
        "quantity": 300,
        "unit": "PCS",
        "packages": 30,
        "grossWeight": 750.00,
        "netWeight": 600.00,
        "volume": 6.30
      },
      {
        "lineNumber": 2,
        "hsCode": "85171220",
        "productName": "Smart Watch",
        "quantity": 200,
        "unit": "PCS",
        "packages": 20,
        "grossWeight": 500.00,
        "netWeight": 400.00,
        "volume": 4.20
      }
    ]
  }'
```

---

### 步骤 4：上传 HS 编码版本

```bash
curl -X POST http://localhost:3000/api/hs-code-versions \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "{batchId}",
    "source": "invoice",
    "items": [
      {
        "hsCode": "85171210",
        "description": "Telecommunications apparatus",
        "productName": "Mobile Phone",
        "quantity": 300,
        "unit": "PCS",
        "unitPrice": 30.00,
        "totalAmount": 9000.00,
        "currency": "USD"
      },
      {
        "hsCode": "85171220",
        "description": "Wearable computing devices",
        "productName": "Smart Watch",
        "quantity": 200,
        "unit": "PCS",
        "unitPrice": 30.00,
        "totalAmount": 6000.00,
        "currency": "USD"
      }
    ]
  }'
```

---

### 步骤 5：检查资料版本一致性

```bash
curl http://localhost:3000/api/version-management/batch/{batchId}/consistency
```

**响应示例**：
```json
{
  "isConsistent": true,
  "hsCodeVersions": 1,
  "invoiceVersions": 1,
  "packingListVersions": 1,
  "details": [...]
}
```

---

### 步骤 6：校验 HS 编码

```bash
curl -X POST http://localhost:3000/api/hs-code-validation/batch/{batchId}
```

**响应示例**：
```json
{
  "batchId": "...",
  "totalCodes": 2,
  "validCodes": 2,
  "invalidCodes": 0,
  "mismatchedCodes": 0,
  "details": [...]
}
```

---

### 步骤 7：比对箱单与发票

```bash
curl http://localhost:3000/api/packing-list-comparison/batch/{batchId}
```

**响应示例**：
```json
{
  "batchId": "...",
  "isConsistent": true,
  "quantityComparison": {
    "totalQuantityInvoice": 500,
    "totalQuantityPackingList": 500,
    "quantityDifference": 0,
    "quantityMismatches": []
  },
  ...
}
```

---

### 步骤 8：检测缺件

```bash
curl -X POST http://localhost:3000/api/missing-components/batch/{batchId}/detect
```

**响应示例**：
```json
{
  "batchId": "...",
  "isBlocked": false,
  "hasCriticalMissing": false,
  "totalMissingCount": 0,
  "documentLevelMissing": {
    "missingInvoice": false,
    "missingPackingList": false,
    "missingHsCodes": false
  },
  ...
}
```

---

### 步骤 9：自动生成补料任务

```bash
curl -X POST http://localhost:3000/api/compliance-tasks/batch/{batchId}/generate
```

---

### 步骤 10：生成清关报告

```bash
curl -X POST http://localhost:3000/api/clearance-reports/batch/{batchId}/generate
```

**响应示例**：
```json
{
  "id": "report-uuid",
  "batchId": "...",
  "reportNumber": "CR-xxx",
  "version": 1,
  "status": "completed",
  "overallStatus": "passed",
  "versionSummary": {...},
  "hsCodeValidation": {...},
  "packingListComparison": {...},
  "missingComponents": {...},
  "complianceTasks": {...},
  "recommendations": "所有校验通过，资料完整，可以提交清关"
}
```

---

### 查看最终报告

```bash
curl http://localhost:3000/api/clearance-reports/batch/{batchId}/latest
```

## 项目结构

```
custom-clearance-validation/
├── src/
│   ├── config/
│   │   └── configuration.ts    # 配置文件
│   ├── entities/               # 数据实体
│   │   ├── clearance-batch.entity.ts
│   │   ├── clearance-report.entity.ts
│   │   ├── compliance-task.entity.ts
│   │   ├── hs-code-version.entity.ts
│   │   ├── invoice.entity.ts
│   │   └── packing-list.entity.ts
│   ├── modules/                # 功能模块
│   │   ├── clearance-batch/    # 清关批次管理
│   │   ├── clearance-report/   # 清关报告生成
│   │   ├── compliance-task/    # 补料任务管理
│   │   ├── hs-code-validation/ # HS编码规则校验
│   │   ├── missing-component/  # 缺件拦截检测
│   │   ├── packing-list-comparison/ # 箱单比对校验
│   │   └── version-management/ # 资料版本管理
│   ├── app.module.ts           # 主模块
│   ├── data-source.ts          # TypeORM 数据源配置
│   └── main.ts                 # 入口文件
├── docker/
│   └── initdb/                 # 数据库初始化脚本
├── .env.example                # 环境变量示例
├── docker-compose.yml          # Docker Compose 配置
├── Dockerfile                  # Docker 镜像配置
├── package.json
└── README.md
```

## 可用脚本

```bash
# 构建项目
npm run build

# 开发模式
npm run start:dev

# 生产模式
npm run start:prod

# Docker 相关
npm run db:up          # 仅启动 PostgreSQL
npm run db:down        # 停止 PostgreSQL
npm run db:logs        # 查看 PostgreSQL 日志
npm run docker:build   # 构建 API 镜像
npm run docker:up      # 启动所有服务
npm run docker:down    # 停止所有服务
npm run docker:logs    # 查看 API 日志

# TypeORM 迁移
npm run migration:generate  # 生成迁移文件
npm run migration:run       # 执行迁移
npm run migration:revert    # 回滚迁移

# 代码检查
npm run lint
npm run test
```

## 数据实体关系

```
ClearanceBatch (清关批次)
    ├── Invoice (发票) - 多对一
    ├── PackingList (箱单) - 多对一
    ├── HsCodeVersion (HS编码版本) - 多对一
    ├── ComplianceTask (补料任务) - 多对一
    └── ClearanceReport (清关报告) - 一对一
```

## 常见问题

### Q: 服务启动时连接数据库失败？
A: 确保 PostgreSQL 已启动，检查 `.env` 中的数据库配置是否正确。使用 Docker 的话执行 `npm run db:up` 启动数据库。

### Q: 表结构如何创建？
A: 开发模式下 `DB_SYNC=true` 会自动同步表结构。生产环境建议使用迁移：
```bash
npm run migration:generate
npm run migration:run
```

### Q: 如何重置数据库？
A: 使用 Docker 的话：
```bash
docker-compose down -v
docker-compose up -d
```

## License

UNLICENSED
