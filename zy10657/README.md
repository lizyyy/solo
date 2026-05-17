# 智能外呼平台号码重复呼叫拦截 API

提供号码重复呼叫拦截、审核、撤回、列表、详情和导出功能。

## 功能特性

- ✅ 号码重复自动检测与拦截
- ✅ 状态机流转（待呼叫→已拦截→已呼叫→已归档）
- ✅ 完整历史记录追踪
- ✅ 拦截记录审核流程
- ✅ 呼叫记录撤回功能
- ✅ 批量导入（支持坏行记录）
- ✅ CSV 数据导出
- ✅ 内存数据库（无需外部依赖）
- ✅ 配置缺失友好提示

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 3. 运行验收测试

```bash
# 先启动服务，然后在另一个终端运行
npm test
```

## API 接口

### 基础信息
- `GET /` - 服务信息和接口列表
- `GET /api/status` - 状态说明
- `GET /api/task-batches` - 任务批次列表
- `GET /api/customers` - 客户列表

### 呼叫记录
- `POST /api/call-records` - 创建呼叫记录
- `PUT /api/call-records/:id` - 修改呼叫记录
- `GET /api/call-records` - 获取列表（支持过滤）
- `GET /api/call-records/:id` - 获取详情（含历史和重复记录）

### 操作
- `POST /api/call-records/:id/review` - 审核拦截记录
  ```json
  {
    "operator": "auditor",
    "approved": true,
    "comment": "审核意见"
  }
  ```
- `POST /api/call-records/:id/withdraw` - 撤回归档
- `POST /api/call-records/:id/mark-called` - 标记为已呼叫

### 批量导入
- `POST /api/call-records/bulk-import`
  ```json
  {
    "taskBatchId": 1,
    "records": [
      {"phoneNumber": "13800138001", "customerName": "张三"}
    ],
    "operator": "admin"
  }
  ```

### 导出
- `POST /api/call-records/export` - 导出呼叫记录
- `GET /api/call-records/:id/export-history` - 导出单条历史
- `GET /api/call-records/export/files` - 获取导出文件列表

## 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待呼叫 |
| intercepted | 已拦截（号码重复） |
| called | 已呼叫 |
| archived | 已归档 |
| import_error | 导入错误 |

## 状态流转

```
待呼叫 → 已呼叫 → 已归档
   ↓
已拦截 → (审核通过) 待呼叫
      → (审核驳回) 已归档
```

## 项目结构

```
.
├── src/
│   ├── app.js              # 主应用入口
│   ├── models/             # 数据模型
│   │   ├── Customer.js
│   │   ├── TaskBatch.js
│   │   ├── CallRecord.js
│   │   └── HistoryLog.js
│   ├── database/           # 数据库
│   │   └── memoryDB.js     # 内存数据库
│   ├── services/           # 业务逻辑
│   │   ├── CallRecordService.js
│   │   └── ExportService.js
│   └── routes/             # API路由
│       └── callRecords.js
├── test/
│   └── acceptance.js       # 验收测试
├── exports/                # 导出文件目录
├── .env                    # 配置文件
├── package.json
└── README.md
```

## 配置说明

在 `.env` 文件中配置：

```
PORT=3000                  # 服务端口
EXPORT_DIR=./exports       # 导出文件目录
```

## 验收测试覆盖

1. **完整流转**：待呼叫 → 已呼叫 → 已归档
2. **冲突记录**：号码重复自动拦截 + 审核流程
3. **导入坏行**：格式错误记录并保留历史
4. **数据一致性**：列表/详情/历史/导出互相对应

## License

MIT
