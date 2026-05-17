# 报表快照申诉 API

报表数据申诉处理后端服务，支持快照留存、状态流转、人工修正、解释报告生成等功能。

## 功能特性

- **快照留存**：创建申诉时自动保存报表数据快照
- **状态流转**：pending → processing → under_review → corrected → rejected → closed
- **人工修正**：支持在审核阶段进行人工数据修正
- **修正对比**：自动记录原始值与修正值的差异
- **重复申诉幂等**：同一报表同一日期同一申诉人重复提交返回已有记录
- **解释报告**：自动生成包含申诉信息、快照、修正记录的完整报告
- **数据导出**：导出申诉完整数据
- **异常处理**：异常路径保留原始输入和处理依据

## 技术栈

- Node.js + TypeScript
- Express (Web框架)
- SQLite (数据库)

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 运行测试

```bash
npm test
```

## API 接口

### 健康检查
```
GET /health
```

### 申诉管理

#### 创建申诉
```
POST /api/appeals
Content-Type: application/json

{
  "reportName": "销售日报表",
  "snapshotDate": "2024-05-15",
  "metricValues": {
    "totalSales": 125000,
    "orderCount": 342
  },
  "appellant": "张三",
  "appellantContact": "zhangsan@example.com",
  "appealReason": "数据差异需要核实",
  "rawData": { "source": "CRM系统" }
}
```

#### 查询申诉详情
```
GET /api/appeals/:id
```

#### 查询申诉列表
```
GET /api/appeals?reportName=&snapshotDate=&status=&appellant=&page=&pageSize=
```

#### 更新申诉状态
```
PATCH /api/appeals/:id/status
Content-Type: application/json

{
  "status": "processing",
  "operator": "李四",
  "comment": "处理中",
  "processingBasis": "根据规范第3.2条"
}
```

### 修正与报告

#### 人工修正数据
```
POST /api/appeals/:id/correction
Content-Type: application/json

{
  "correctedValues": { "totalSales": 130000 },
  "correctedBy": "王五",
  "correctionReason": "补充遗漏数据"
}
```

#### 获取修正记录
```
GET /api/appeals/:id/corrections
```

#### 生成解释报告
```
POST /api/appeals/:id/report
Content-Type: application/json

{ "generatedBy": "王五" }
```

#### 获取解释报告
```
GET /api/appeals/:id/report
```

#### 导出申诉数据
```
GET /api/appeals/:id/export
```

#### 获取快照数据
```
GET /api/appeals/:id/snapshot
```

## 状态流转图

```
pending → processing → under_review → corrected → closed
                    ↓
                  rejected → closed
```

## 项目结构

```
.
├── src/
│   ├── types.ts              # 类型定义
│   ├── database.ts           # 数据库初始化和操作
│   ├── services/
│   │   └── appealService.ts  # 业务逻辑层
│   ├── routes/
│   │   └── appealRoutes.ts   # API路由
│   └── server.ts             # 服务入口
├── test/
│   └── appeal.test.ts        # 测试脚本
├── data/                      # 数据库文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 数据库表结构

- `report_snapshots`: 报表快照
- `appeals`: 申诉记录
- `correction_records`: 修正记录
- `explanation_reports`: 解释报告

## 测试覆盖

1. **正常流程**：创建 → 查询 → 状态流转 → 修正 → 生成报告 → 导出
2. **重复申诉幂等**：同一人同一天同一报表重复提交
3. **脏数据处理**：特殊字符指标名、超长文本
4. **异常路径**：无效状态流转、错误时机修正、不存在资源查询
5. **边界条件**：多条件组合查询、分页等
