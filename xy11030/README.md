# 社区团购仓团购缺件补发系统

一个基于 Node.js + Express + TypeScript + SQLite 的社区团购缺件补发管理系统。

## 功能特性

- ✅ **补发单管理**：创建、查看、编辑补发单
- ✅ **明细管理**：支持缺件、错发、损坏、过期等多种问题类型
- ✅ **状态流转**：正常 → 处理中 → 补录 → 复核 → 已完成 / 驳回 / 取消
- ✅ **修改历史**：完整记录每次状态变更和操作备注
- ✅ **数据导入**：支持 Excel / CSV 批量导入
- ✅ **统计分析**：补发单统计、按状态分类统计、按问题类型统计
- ✅ **重新提交**：驳回的订单可以补充信息后重新提交

## 项目结构

```
├── src/
│   ├── __tests__/          # 测试文件
│   │   └── reissue.test.ts
│   ├── database/           # 数据库相关
│   │   └── index.ts
│   ├── services/           # 业务逻辑
│   │   ├── reissueService.ts
│   │   └── importService.ts
│   ├── routes/             # API 路由
│   │   └── reissueRoutes.ts
│   ├── scripts/            # 脚本
│   │   └── seed.ts         # 样例数据填充
│   ├── types/              # 类型定义
│   │   └── index.ts
│   └── index.ts            # 应用入口
├── data/                   # SQLite 数据库文件
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 填充样例数据

```bash
npm run seed
```

此命令将创建以下样例数据：
- 1 个正常状态订单
- 1 个处理中状态订单
- 1 个驳回状态订单
- 1 个已补录状态订单
- 1 个已完成状态订单
- 1 个错发缺件混合测试订单

### 3. 运行测试

```bash
npm test
```

测试覆盖：
- 基础功能：创建、列表、详情、历史
- 错发缺发混合单：多问题类型在同一单中
- 统计一致性：验证统计数据与实际数据匹配
- 撤回后再次提交：驳回后重新提交流程
- 状态流转：完整的状态流转测试

### 4. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动

## API 接口文档

### 补发单相关

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/reissues | 创建补发单 |
| GET | /api/reissues | 获取补发单列表 |
| GET | /api/reissues/:id | 获取补发单详情 |
| GET | /api/reissues/:id/items | 获取补发单明细 |
| GET | /api/reissues/:id/history | 获取修改历史 |
| PUT | /api/reissues/:id/status | 更新状态 |
| POST | /api/reissues/:id/resubmit | 重新提交 |
| GET | /api/reissues/statistics | 获取统计数据 |

#### 查询参数
- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 20）
- `status`: 按状态筛选
- `leaderId`: 按团长 ID 筛选

### 导入相关

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/reissues/import/excel | 从 Excel 导入 |
| POST | /api/reissues/import/csv | 从 CSV 导入 |
| GET | /api/reissues/import/template | 下载导入模板 |

### 状态枚举

```
normal        - 正常
processing    - 处理中
supplemented  - 已补录
reviewing     - 复核中
completed     - 已完成
rejected      - 驳回
cancelled     - 取消
draft         - 草稿
```

### 问题类型枚举

```
missing       - 缺件
wrong         - 错发
damaged       - 损坏
expired       - 过期
```

## 使用示例

### 创建补发单

```bash
curl -X POST http://localhost:3000/api/reissues \
  -H "Content-Type: application/json" \
  -d '{
    "groupBuyCode": "GB202405001",
    "groupBuyName": "2024年5月水果团购",
    "leaderId": "LD001",
    "leaderName": "张三",
    "leaderPhone": "13800138001",
    "warehouseCode": "WH001",
    "warehouseName": "北京朝阳仓",
    "originalOrderNo": "ORD20240501001",
    "originalOrderDate": "2024-05-01",
    "remark": "配送问题",
    "createdBy": "admin",
    "items": [
      {
        "productCode": "PRD001",
        "productName": "红富士苹果",
        "skuCode": "SKU001",
        "skuName": "5斤装",
        "issueType": "missing",
        "originalQuantity": 10,
        "issueQuantity": 2,
        "reissueQuantity": 2,
        "unitPrice": 29.9,
        "remark": "少了2袋"
      }
    ]
  }'
```

### 更新状态

```bash
curl -X PUT http://localhost:3000/api/reissues/{id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "processing",
    "operatorId": "op001",
    "operatorName": "操作员",
    "remark": "开始处理补发"
  }'
```

### 查看统计

```bash
curl http://localhost:3000/api/reissues/statistics
```

## 测试用例说明

### 错发缺发混合单测试
- 验证同一单中可以同时包含缺件、错发、损坏等多种问题类型
- 验证金额和数量统计的准确性
- 验证混合单可以完整进行状态流转

### 补发统计一致性测试
- 验证统计的订单总数与实际订单数一致
- 验证按状态筛选的结果与统计数据一致
- 验证统计金额与订单总金额匹配

### 撤回后再次提交测试
- 验证订单可以被驳回
- 验证驳回的订单可以重新提交
- 验证重新提交后可以正常完成流程
- 验证所有操作备注都被完整记录

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm start            # 启动生产服务器
npm test             # 运行测试
npm run seed         # 填充样例数据
```
