# 工厂质量追溯系统后端服务

## 项目简介

这是一套完整的工厂质量追溯后端服务，用于管理物料批次、工单、返修记录和缺陷追踪。系统支持批量导入数据、处理返修流程、导出明细报表，并提供完整的操作历史追踪。

## 技术栈

- **运行时**: Node.js
- **Web框架**: Express.js
- **ORM**: Sequelize
- **数据库**: SQLite (嵌入式，无需额外安装)
- **文件上传**: Multer
- **CSV解析**: csv-parser
- **CSV导出**: json2csv

## 功能特性

### 1. 物料批次管理
- 新增批次
- 按工位、状态、日期查询批次
- 更新批次状态
- 关联缺陷和返修记录

### 2. 工单管理
- 创建工单
- 查询工单列表
- 关联返修记录和缺陷

### 3. 返修记录管理
- 创建返修记录
- 标记处理状态
  - 开始处理
  - 返修完成
  - 退回修改
  - 放行
  - 闭环
- 要求补材料
- 按工位、责任工位、状态、批次查询
- 导出CSV明细
- 生成最终报告

### 4. 缺陷管理
- 记录缺陷信息
- 按类型、严重程度、工位统计
- 关联批次、工单、返修记录
- 追踪缺陷处理状态

### 5. 操作历史
- 记录所有状态变更
- 记录操作人、时间、原因
- 支持按记录ID查询历史

### 6. 文件导入
- 返修记录CSV批量导入
- 工单JSON批量导入
- 批次JSON批量导入
- 导入模板下载

## 项目结构

```
factory-quality-traceability/
├── src/
│   ├── app.js                 # 应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── models/                # 数据模型
│   │   ├── index.js
│   │   ├── Batch.js
│   │   ├── WorkOrder.js
│   │   ├── RepairRecord.js
│   │   ├── Defect.js
│   │   └── ProcessHistory.js
│   ├── controllers/           # 控制器
│   │   ├── batchController.js
│   │   ├── workOrderController.js
│   │   ├── repairController.js
│   │   ├── defectController.js
│   │   ├── historyController.js
│   │   └── fileUploadController.js
│   ├── services/              # 服务层
│   │   └── historyService.js
│   ├── middleware/            # 中间件
│   │   └── upload.js
│   └── routes/                # 路由
│       └── index.js
├── data/                      # SQLite数据库文件
├── uploads/                   # 上传文件临时目录
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

### 3. 开发模式

```bash
npm run dev
```

## API 接口文档

### 基础路径

所有API接口前缀: `/api`

### 物料批次接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /batches | 创建批次 |
| GET | /batches | 查询批次列表 |
| GET | /batches/:id | 查询批次详情 |
| PUT | /batches/:id/status | 更新批次状态 |
| DELETE | /batches/:id | 删除批次 |

### 工单接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /work-orders | 创建工单 |
| GET | /work-orders | 查询工单列表 |
| GET | /work-orders/:id | 查询工单详情 |
| PUT | /work-orders/:id | 更新工单 |
| DELETE | /work-orders/:id | 删除工单 |

### 返修记录接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /repairs | 创建返修记录 |
| GET | /repairs | 查询返修列表 |
| GET | /repairs/:id | 查询返修详情 |
| PUT | /repairs/:id/processing | 标记开始处理 |
| PUT | /repairs/:id/completed | 标记返修完成 |
| PUT | /repairs/:id/return | 退回修改 |
| PUT | /repairs/:id/release | 放行 |
| PUT | /repairs/:id/close | 闭环 |
| PUT | /repairs/:id/material | 要求补材料 |
| GET | /repairs/:id/report | 获取最终报告 |
| GET | /export/repairs | 导出返修明细CSV |

### 缺陷接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /defects | 创建缺陷记录 |
| GET | /defects | 查询缺陷列表 |
| GET | /defects/statistics | 缺陷统计 |
| GET | /defects/:id | 查询缺陷详情 |
| PUT | /defects/:id | 更新缺陷 |
| DELETE | /defects/:id | 删除缺陷 |

### 历史记录接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /histories | 查询操作历史 |
| POST | /histories | 添加历史记录 |

### 文件上传接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /upload/repair-csv | 批量导入返修CSV |
| POST | /upload/workorder-json | 批量导入工单JSON |
| POST | /upload/batch-json | 批量导入批次JSON |
| GET | /upload/template/:type | 下载导入模板 |

## 使用示例

### 1. 创建物料批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH20240501001",
    "materialCode": "MAT001",
    "materialName": "电子元件A",
    "quantity": 1000,
    "productionDate": "2024-05-01",
    "workstation": "WS01",
    "operator": "张三",
    "status": "pending",
    "remark": "第一批物料"
  }'
```

### 2. 创建返修记录

```bash
curl -X POST http://localhost:3000/api/repairs \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "uuid-of-batch",
    "serialNo": "SN202405010001",
    "workstation": "WS02",
    "responsibleStation": "WS01",
    "operator": "李四",
    "defectDescription": "外观划痕，表面有明显刮伤",
    "rootCause": "运输过程中碰撞",
    "solution": "抛光打磨处理",
    "materialsUsed": "抛光膏",
    "repairTime": 30,
    "handler": "王五",
    "status": "pending"
  }'
```

### 3. 标记处理完成

```bash
curl -X PUT http://localhost:3000/api/repairs/{id}/completed \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王五",
    "solution": "已完成抛光打磨，外观恢复正常",
    "repairTime": 35,
    "rootCause": "运输不当导致碰撞"
  }'
```

### 4. 放行返修记录

```bash
curl -X PUT http://localhost:3000/api/repairs/{id}/release \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "质检主管",
    "releaseReason": "划痕已修复，不影响使用，同意放行"
  }'
```

### 5. 闭环返修记录

```bash
curl -X PUT http://localhost:3000/api/repairs/{id}/close \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "质量经理",
    "remark": "问题已解决，流程闭环"
  }'
```

### 6. 导出返修明细

直接在浏览器访问:
```
http://localhost:3000/api/export/repairs?workstation=WS01&status=completed&startDate=2024-01-01&endDate=2024-12-31
```

### 7. 查看最终报告

```bash
curl http://localhost:3000/api/repairs/{id}/report
```

报告包含:
- 基本信息（编号、工位、状态等）
- 缺陷信息（描述、根本原因）
- 处理信息（解决方案、处理人、处理时间）
- 决策信息（放行原因、退回原因、补材料要求）
- 闭环信息（闭环时间、闭环人）
- 完整操作历史
- 最终结论

## 数据状态说明

### 批次状态 (Batch.status)
- `pending`: 待处理
- `processing`: 处理中
- `completed`: 已完成
- `returned`: 已退回
- `rejected`: 已拒收

### 工单状态 (WorkOrder.status)
- `created`: 已创建
- `in_progress`: 进行中
- `completed`: 已完成
- `closed`: 已关闭

### 返修状态 (RepairRecord.status)
- `pending`: 待处理
- `processing`: 处理中
- `completed`: 已完成
- `returned`: 已退回
- `released`: 已放行
- `rejected`: 已拒收

### 缺陷严重程度 (Defect.severity)
- `minor`: 轻微
- `major`: 严重
- `critical`: 致命

### 缺陷状态 (Defect.status)
- `open`: 待处理
- `analyzing`: 分析中
- `fixing`: 修复中
- `verified`: 已验证
- `closed`: 已关闭

## 查询参数说明

所有列表查询接口支持以下通用参数:

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码，默认1 |
| pageSize | number | 每页条数，默认20 |
| startDate | string | 开始日期 YYYY-MM-DD |
| endDate | string | 结束日期 YYYY-MM-DD |

各接口还有特定筛选参数（如workstation、status等），请参考具体接口。

## 数据持久化

系统使用SQLite嵌入式数据库，数据文件存储在 `data/database.sqlite`。重启服务后所有数据保持不变。

## 导入模板

访问以下地址获取导入模板:
- 返修CSV: `/api/upload/template/repair`
- 工单CSV: `/api/upload/template/workorder`
- 批次CSV: `/api/upload/template/batch`

## 注意事项

1. 所有时间字段使用ISO 8601格式 (YYYY-MM-DDTHH:mm:ss.sssZ)
2. 操作者字段应填写真实姓名，便于追溯
3. 状态变更时应填写原因，便于后续审查
4. 建议定期备份 `data/database.sqlite` 文件

## 版本历史

- v1.0.0: 初始版本，包含完整的批次、工单、返修、缺陷管理功能
