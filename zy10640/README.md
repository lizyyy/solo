# 企业订阅服务试用延期审批 API

本地独立运行的试用延期审批服务，使用 SQLite 数据库，无需外部依赖。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
# 单独初始化
npm run init-db

# 初始化 + 导入验收数据（推荐）
npm run setup
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## API 接口

### 基础信息

```
GET /
```

### 租户管理

```
POST /api/extensions/tenants    # 创建租户
GET  /api/extensions/tenants    # 获取租户列表
```

### 延期申请管理

```
POST /api/extensions                    # 创建延期申请
GET  /api/extensions                    # 获取申请列表（支持 status/tenant_id/salesperson_id 筛选）
GET  /api/extensions/:id                # 获取申请详情
GET  /api/extensions/:id/history        # 获取操作历史
```

### 审批操作

```
POST /api/extensions/:id/approve        # 审批通过
POST /api/extensions/:id/reject         # 审批驳回
POST /api/extensions/:id/convert        # 转为付费客户
```

### 导入导出

```
GET  /api/extensions/export/csv         # 导出 CSV
POST /api/extensions/import             # 批量导入
GET  /api/extensions/import/:batch_no   # 查看导入记录
```

## 状态说明

| 状态码 | 状态名称 |
|--------|----------|
| trial_active | 试用中 |
| extension_pending | 延期申请 |
| extension_approved | 已延期 |
| converted | 已转正 |

## 冲突规则

**同一租户多销售重复申请拦截：**

当某个租户已有状态为 `extension_pending` 的申请时，新的申请将被拦截，并返回：

```json
{
  "success": false,
  "error": "该租户已有待审批的延期申请",
  "code": "DUPLICATE_PENDING_REQUEST",
  "next_steps": {
    "requiredMaterials": [
      "1. 与现有申请人沟通确认申请内容",
      "2. 如需修改，请由原申请人撤销当前申请后重新提交",
      "3. 如需多人协作，请补充销售协作说明并附内部审批邮件截图",
      "4. 紧急情况请联系销售总监进行特殊审批"
    ],
    "contactInfo": {
      "existingApplicant": "...",
      "applicantId": "...",
      "existingExtensionNo": "..."
    }
  }
}
```

## 验收数据说明

执行 `npm run seed` 后将导入以下验收数据：

### 1. 完整流转案例 (EXT003, T003)

```
创建申请 (extension_pending)
  → 审批通过 (extension_approved)
    → 转为付费 (converted)
```

可通过以下接口验证：
- `GET /api/extensions/3` - 查看详情（状态：已转正）
- `GET /api/extensions/3/history` - 查看 3 条历史记录

### 2. 冲突拦截案例 (EXT002, T002)

EXT002 当前处于 `extension_pending` 状态，对 T002 提交新申请将触发拦截。

验证：
```bash
curl -X POST http://localhost:3000/api/extensions \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "T002",
    "original_trial_end_date": "2024-03-01",
    "requested_extension_days": 30,
    "new_trial_end_date": "2024-03-31",
    "extension_reason": "测试冲突",
    "salesperson_id": "S999",
    "salesperson_name": "测试销售"
  }'
```

### 3. 导入坏行 (BATCH001)

批次 BATCH001 包含 3 条记录，其中 2 条失败：
- 第 2 行：租户不存在
- 第 3 行：缺少必填字段

验证：
```bash
curl http://localhost:3000/api/extensions/import/BATCH001
```

### 4. 导出功能验证

```bash
curl -O http://localhost:3000/api/extensions/export/csv
```

## 请求示例

### 创建延期申请

```bash
curl -X POST http://localhost:3000/api/extensions \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "T001",
    "original_trial_end_date": "2024-03-01",
    "requested_extension_days": 30,
    "new_trial_end_date": "2024-03-31",
    "extension_reason": "客户需求调研尚未完成",
    "sales_notes": "高价值客户",
    "salesperson_id": "S001",
    "salesperson_name": "销售小王"
  }'
```

### 审批通过

```bash
curl -X POST http://localhost:3000/api/extensions/1/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approver_id": "M001",
    "approver_name": "销售经理",
    "comment": "同意延期"
  }'
```

## 项目结构

```
.
├── src/
│   ├── server.js          # 服务入口
│   ├── config/
│   │   └── database.js    # 数据库配置
│   ├── dao/               # 数据访问层
│   │   ├── extension.dao.js
│   │   └── tenant.dao.js
│   ├── services/          # 业务逻辑层
│   │   └── extension.service.js
│   └── routes/            # 路由层
│       └── extensions.js
├── scripts/
│   ├── init-db.js         # 数据库初始化
│   └── seed-data.js       # 验收数据导入
├── data/                  # SQLite 数据库文件
├── exports/               # CSV 导出目录
├── package.json
└── README.md
```

## 环境要求

- Node.js >= 16.0.0
- npm

## 常见问题

### 启动时提示数据库不存在

请先执行 `npm run setup` 初始化数据库并导入验收数据。

### 如何重置数据？

```bash
rm -rf data/
npm run setup
```
