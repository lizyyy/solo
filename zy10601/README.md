# SaaS账单中心套餐超额冻结申诉系统

## 功能特性

### 核心功能
- ✅ 按日期、状态、负责人、业务对象筛选申诉
- ✅ 租户、套餐额度、超额明细、申诉材料完整数据
- ✅ 状态覆盖：正常/冻结中/申诉中/已恢复
- ✅ 防重复提交机制（5分钟内重复请求自动识别）
- ✅ 导出CSV，口径与列表一致

### 数据模型
- **Tenant (租户)**: 基本信息、状态、负责人、业务对象
- **Package (套餐)**: 额度、已用、生效日期
- **OverchargeRecord (超额记录)**: 类型、金额、发生时间
- **Appeal (申诉)**: 类型、状态、原因、材料、提交次数
- **AppealHistory (历史记录)**: 操作类型、状态变更、是否重复提交

## 快速开始

### 安装依赖
```bash
npm install
```

### 初始化种子数据
```bash
npm run seed
```

### 启动服务
```bash
npm run dev
```

### 运行验收测试
```bash
npm run test
```

## API 接口

### 申诉列表
```
GET /api/appeals
```

查询参数：
- `startDate`: 开始日期 (YYYY-MM-DD)
- `endDate`: 结束日期 (YYYY-MM-DD)
- `status`: 申诉状态
- `responsiblePerson`: 负责人
- `businessObject`: 业务对象
- `tenantName`: 租户名称
- `appealCode`: 申诉编号
- `includeBadRecords`: 是否包含坏行 (true/false)
- `page`: 页码
- `pageSize`: 每页数量

### 申诉详情
```
GET /api/appeals/:id
```

### 申诉历史
```
GET /api/appeals/:id/histories
```

### 提交恢复请求（防重）
```
POST /api/appeals/:id/restore
Body: { "operatorName": "张三", "requestId": "req_123" }
```

### 导出CSV
```
GET /api/appeals/export/csv
```

### 统计概览
```
GET /api/appeals/statistics/summary
```

## 验收场景

### 场景 1: 完整流转
- APPEAL_001 (北京科技有限公司)
- 状态流转：冻结 → 申诉中 → 审核中 → 通过 → 补缴 → 已恢复
- 完整历史记录可追溯

### 场景 2: 冲突记录
- 包含重复点击、异步回调的重复提交
- 历史记录中标记 `isDuplicateSubmission=true`
- 防重复提交机制生效

### 场景 3: 导入坏行
- APPEAL_BAD_001 标记为坏行
- 默认列表不展示，可通过 `includeBadRecords=true` 查询
- 记录坏行原因

## 项目结构

```
├── src/
│   ├── entities/          # 数据模型
│   │   ├── Tenant.ts
│   │   ├── Package.ts
│   │   ├── OverchargeRecord.ts
│   │   ├── Appeal.ts
│   │   └── AppealHistory.ts
│   ├── services/          # 业务逻辑
│   │   └── AppealService.ts
│   ├── routes/            # API 路由
│   │   └── appeal.ts
│   ├── scripts/           # 脚本
│   │   ├── seed.ts        # 种子数据
│   │   └── acceptance-test.ts  # 验收测试
│   ├── data-source.ts     # 数据库配置
│   └── index.ts           # 入口文件
├── package.json
├── tsconfig.json
└── .env
```
