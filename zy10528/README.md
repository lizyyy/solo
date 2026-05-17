# 数据权限申诉API服务

完整的数据权限申诉管理系统，支持申诉创建、状态流转、临时恢复、异常追溯、人工修正和报表导出等核心功能。

## 核心特性

- ✅ **完整申诉生命周期**: 创建 -> 处理 -> 临时恢复 -> 结论
- ✅ **状态流转留痕**: 所有状态变更完整记录，可追溯
- ✅ **临时恢复机制**: 支持设置有效期，到期自动失效
- ✅ **异常处理追溯**: 失败操作保留原始输入、处理依据和结论
- ✅ **人工修正功能**: 支持数据修正，操作留痕
- ✅ **数据持久化**: SQLite文件存储，重启数据不丢失
- ✅ **报表导出**: 支持CSV格式导出
- ✅ **统计看板**: 实时统计数据

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行自检程序（验证功能完整性）

```bash
npm run self-check
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 4. 运行API调用样例（新开终端）

```bash
npm test
```

## API接口文档

### 基础信息

- 服务地址: `http://localhost:3000`
- Content-Type: `application/json`

### 接口列表

#### 1. 健康检查
```
GET /api/health
```

#### 2. 创建申诉
```
POST /api/appeals
Body:
{
  "employee_id": "员工编号",
  "employee_name": "员工姓名",
  "data_scope": "数据范围",
  "revoke_reason": "收回原因",
  "appeal_material": "申诉材料",
  "operator_id": "操作人ID",
  "operator_name": "操作人姓名"
}
```

#### 3. 查询申诉详情
```
GET /api/appeals/:id
GET /api/appeals/no/:appeal_no
```

#### 4. 查询申诉列表
```
GET /api/appeals/query?employee_id=&current_status=&start_time=&end_time=
```

#### 5. 更新申诉状态
```
PUT /api/appeals/:id/status
Body:
{
  "to_status": "目标状态",
  "handler_id": "处理人ID",
  "handler_name": "处理人姓名",
  "operator_id": "操作人ID",
  "operator_name": "操作人姓名",
  "remark": "备注",
  "basis": "处理依据"
}
```

#### 6. 临时恢复权限
```
POST /api/appeals/:id/temp-restore
Body:
{
  "start_time": "2024-01-01 00:00:00",
  "end_time": "2024-01-04 00:00:00",
  "operator_id": "操作人ID",
  "operator_name": "操作人姓名",
  "remark": "备注"
}
```

#### 7. 处理申诉结论
```
POST /api/appeals/:id/conclusion
Body:
{
  "conclusion": "APPROVED | REJECTED | CLOSED",
  "conclusion_text": "结论说明",
  "handler_id": "处理人ID",
  "handler_name": "处理人姓名"
}
```

#### 8. 人工修正申诉数据
```
POST /api/appeals/:id/manual-correct
Body:
{
  "employee_name": "可修正字段",
  "data_scope": "可修正字段",
  "revoke_reason": "可修正字段",
  "appeal_material": "可修正字段",
  "current_status": "可修正字段",
  "operator_id": "操作人ID",
  "operator_name": "操作人姓名",
  "remark": "修正说明"
}
```

#### 9. 查询申诉状态历史
```
GET /api/appeals/:id/history
```

#### 10. 查询临时恢复记录
```
GET /api/appeals/:id/temp-restore
```

#### 11. 查询异常记录
```
GET /api/appeals/exceptions?appeal_id=
```

#### 12. 解决异常记录
```
PUT /api/appeals/exceptions/:id/resolve
Body:
{
  "final_conclusion": "最终结论",
  "handler_id": "处理人ID"
}
```

#### 13. 检查临时恢复到期
```
POST /api/appeals/check-expired
```

#### 14. 导出申诉数据
```
GET /api/appeals/export
```

#### 15. 统计数据
```
GET /api/appeals/stats
```

## 数据模型

### 申诉状态说明

| 状态 | 说明 |
|------|------|
| PENDING | 待处理 |
| PROCESSING | 处理中 |
| TEMP_RESTORED | 临时恢复 |
| APPROVED | 申诉通过 |
| REJECTED | 申诉驳回 |
| CLOSED | 已关闭 |

### 数据库表结构

1. **appeals** - 申诉主表
   - id, appeal_no, employee_id, employee_name, data_scope, revoke_reason, appeal_material
   - current_status, temp_restore_id, conclusion, handler_id, handler_name
   - created_at, updated_at

2. **status_history** - 状态历史表
   - id, appeal_id, appeal_no, from_status, to_status, action_type
   - operator_id, operator_name, remark, basis, created_at

3. **temp_restore** - 临时恢复表
   - id, appeal_id, appeal_no, employee_id, data_scope
   - start_time, end_time, is_expired, operator_id, operator_name, remark, created_at

4. **exception_logs** - 异常记录表
   - id, appeal_id, appeal_no, operation_type, original_input, error_message
   - processing_basis, final_conclusion, handler_id, is_resolved, created_at, resolved_at

## 项目结构

```
.
├── src/
│   ├── app.js                    # 主应用入口
│   ├── database/
│   │   ├── index.js             # 数据库连接和基础操作
│   │   └── schema.js            # 数据库Schema定义
│   ├── services/
│   │   └── appealService.js     # 业务逻辑层
│   ├── controllers/
│   │   └── appealController.js  # 控制器层
│   └── routes/
│       └── appealRoutes.js      # 路由定义
├── test/
│   ├── sample.js                # API调用样例
│   └── self-check.js            # 自检程序
├── data/
│   └── appeal.db                # SQLite数据库文件(自动生成)
├── package.json
└── README.md
```

## 关键流程说明

### 申诉完整流程

1. **创建申诉**: 员工提交申诉，状态为 PENDING
2. **分配处理**: 管理员分配处理人，状态更新为 PROCESSING
3. **临时恢复**: 如需紧急处理，可创建临时恢复权限，状态变为 TEMP_RESTORED
4. **处理结论**: 处理人审核后给出结论（通过/驳回/关闭）
5. **自动失效**: 临时恢复到期后自动将状态变回 PROCESSING

### 异常追溯机制

所有操作失败时会自动记录到 exception_logs 表，包含：
- 原始请求数据（original_input）
- 错误信息（error_message）
- 处理依据（processing_basis）
- 最终结论（final_conclusion）

可通过申诉ID关联查询，实现完整追溯。

## 使用说明

### 运行自检程序

自检程序会验证所有核心功能是否正常：

```bash
npm run self-check
```

### 启动开发模式

```bash
npm run dev
```

### 运行API调用样例

```bash
# 先启动服务
npm start

# 新开终端运行样例
npm test
```

## 技术栈

- Node.js + Express
- SQLite3 (文件型数据库)
- Moment.js (日期处理)
- json2csv (数据导出)

## 注意事项

1. 数据库文件默认保存在 `data/appeal.db`
2. 临时恢复权限需要定期调用检查接口触发自动失效
3. 所有操作都会记录历史，支持完整审计追溯
4. 异常记录需要人工标记为已解决

## 许可证

ISC
