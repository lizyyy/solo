# Secret 引用血缘 API

管理 Secret 引用关系、访问记录、替换计划和血缘报告的后端服务，解决删除旧 Secret 前无法确认引用关系的痛点。

## 核心功能

- ✅ **引用登记** - 记录 Secret 被哪些服务引用
- ✅ **访问留痕** - 自动记录每次访问的时间和来源
- ✅ **状态推进** - Secret 生命周期管理（ACTIVE → DEPRECATED → PENDING_DELETION）
- ✅ **删除保护** - 有活跃引用时禁止删除，防止误删
- ✅ **替换审批** - Secret 替换计划的创建、审批和执行
- ✅ **人工修正** - 记录数据修正历史
- ✅ **血缘报告** - 完整的引用关系报告，支持 JSON 和 CSV 导出

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npx prisma migrate dev --name init
```

### 3. 导入示例数据

```bash
npm run seed
```

### 4. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:17735` 启动

## 数据模型

### Secret

- `name`: Secret 名称（唯一）
- `status`: 状态（ACTIVE / DEPRECATED / PENDING_DELETION）
- `description`: 描述
- `last_access`: 最后访问时间

### Reference

- `service_name`: 服务名称
- `environment`: 环境（dev / test / staging / prod）
- `file_path`: 文件路径
- `line_number`: 行号
- `is_active`: 是否活跃

### ReplacementPlan

- `new_secret_name`: 新 Secret 名称
- `planned_date`: 计划执行日期
- `status`: 状态（PENDING_APPROVAL / APPROVED / REJECTED / EXECUTED）
- `approver`: 审批人
- `approval_comment`: 审批意见

## API 接口

### 基础接口

#### 健康检查

```bash
curl http://localhost:17735/health
```

#### 创建 Secret

```bash
curl -X POST http://localhost:17735/api/secrets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DB_PASSWORD",
    "description": "生产数据库密码"
  }'
```

#### 查询 Secret 列表

```bash
curl "http://localhost:17735/api/secrets?status=ACTIVE&page=1&page_size=20"
```

#### 查询单个 Secret 详情

```bash
curl http://localhost:17735/api/secrets/DB_PASSWORD
```

#### 更新 Secret 状态

```bash
curl -X PUT http://localhost:17735/api/secrets/DB_PASSWORD/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DEPRECATED"
  }'
```

### 引用管理

#### 登记引用

```bash
curl -X POST http://localhost:17735/api/secrets/DB_PASSWORD/references \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "order-service",
    "environment": "prod",
    "file_path": "config/prod.yaml",
    "line_number": 45
  }'
```

#### 查询引用列表

```bash
curl http://localhost:17735/api/secrets/DB_PASSWORD/references
```

#### 记录访问

```bash
curl -X POST http://localhost:17735/api/secrets/DB_PASSWORD/access \
  -H "Content-Type: application/json" \
  -d '{
    "accessed_by": "system",
    "access_source": "order-service-01"
  }'
```

### 替换计划

#### 创建替换计划

```bash
curl -X POST http://localhost:17735/api/secrets/DB_PASSWORD/replacements \
  -H "Content-Type: application/json" \
  -d '{
    "new_secret_name": "NEW_DB_PASSWORD",
    "planned_date": "2024-12-31T23:59:59Z",
    "created_by": "admin"
  }'
```

#### 审批通过

```bash
curl -X PUT http://localhost:17735/api/secrets/replacements/{id}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "security-team",
    "approval_comment": "审批通过"
  }'
```

### 血缘报告

#### 获取完整血缘报告

```bash
curl http://localhost:17735/api/secrets/DB_PASSWORD/report
```

#### 导出 CSV 报告

```bash
curl -O http://localhost:17735/api/secrets/DB_PASSWORD/report/export
```

### 删除保护（被拦截的示例）

**重要：有活跃引用的 Secret 会被禁止删除**

```bash
curl -X DELETE http://localhost:17735/api/secrets/DB_PASSWORD
```

返回错误示例：

```json
{
  "success": false,
  "error": {
    "code": "SECRET_HAS_ACTIVE_REFERENCES",
    "message": "该Secret存在活跃引用",
    "details": {
      "raw_input": { "name": "DB_PASSWORD", "force": false },
      "processing_basis": "删除保护规则：有活跃引用时禁止删除",
      "conclusion": "删除被拦截",
      "references": [
        {
          "service": "order-service",
          "env": "prod",
          "last_access": "2024-12-01T10:00:00Z"
        }
      ]
    }
  }
}
```

#### 强制删除（谨慎使用）

```bash
curl -X DELETE "http://localhost:17735/api/secrets/DB_PASSWORD?force=true"
```

### 异常记录

#### 查询所有操作失败记录

```bash
curl http://localhost:17735/api/errors
```

## 业务规则

### 1. 删除保护规则

- 有活跃引用的 Secret 禁止删除
- 必须先清理所有引用，才能执行删除
- 强制删除需要管理员权限（force 参数）

### 2. 状态机规则

状态流转不可逆：

```
ACTIVE → DEPRECATED → PENDING_DELETION
```

- ACTIVE: 正常使用状态
- DEPRECATED: 已标记废弃，准备替换
- PENDING_DELETION: 引用已清理，可以安全删除

### 3. 替换审批规则

- 替换计划创建后状态为 PENDING_APPROVAL
- 必须经过审批才能执行
- 只有 APPROVED 状态的计划可以执行

## 错误响应格式

所有错误采用统一格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {
      "raw_input": "原始输入参数",
      "processing_basis": "处理依据",
      "conclusion": "最终结论"
    }
  }
}
```

## 项目结构

```
.
├── prisma/
│   ├── schema.prisma     # 数据模型定义
│   └── dev.db            # SQLite 数据库文件
├── src/
│   ├── controllers/      # 控制器层
│   ├── middleware/       # 中间件
│   ├── routes/           # 路由定义
│   ├── services/         # 业务逻辑层
│   ├── utils/            # 工具函数
│   ├── index.ts          # 服务入口
│   └── seed.ts           # 示例数据脚本
├── package.json
└── README.md
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 编译 TypeScript |
| `npm run start` | 启动生产服务器 |
| `npm run seed` | 导入示例数据 |
| `npx prisma studio` | 打开数据库管理界面 |
