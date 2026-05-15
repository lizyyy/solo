# 冻结窗口校验后端服务

基于 Node.js + Express + SQLite 构建的实验室样本冻结窗口校验系统。

## 功能特性

- ✅ **真实样本数据**: 使用医院检验科真实场景的样本数据造数
- ✅ **并发覆盖模拟**: 专门设计了并发写入互相覆盖的异常场景
- ✅ **统一查询入口**: 成功和异常路径都可从同一接口查询
- ✅ **失败记录保存**: 所有失败项单独保存，便于问题排查
- ✅ **异常样本留存**: 异常样本单独记录，可回溯原始材料
- ✅ **批量操作预览**: 批量校验前可预览影响范围
- ✅ **摘要报告生成**: 按业务单号组织网关错误、修正建议和结论

## 项目结构

```
.
├── src/
│   ├── index.ts              # 服务入口
│   ├── database.ts           # 数据库初始化和连接
│   ├── types.ts              # 类型定义
│   ├── routes/
│   │   └── validation.ts     # API路由
│   ├── services/
│   │   ├── validationService.ts    # 校验核心逻辑
│   │   ├── queryService.ts         # 查询服务
│   │   ├── batchService.ts         # 批量操作服务
│   │   └── summaryService.ts       # 摘要生成服务
│   └── scripts/
│       └── seed.ts           # 造数脚本
├── data/                     # SQLite数据库文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库并造数

```bash
npm run seed
```

此操作会：
- 初始化 SQLite 数据库表结构
- 插入 10 条真实的检验科样本数据
- 为 `LAB20240515005`（钱七 - 呼吸内科）模拟并发写入覆盖异常
- 执行部分样本的校验操作

### 3. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

## API 接口文档

### 健康检查

```
GET /health
```

### 单样本校验

```
POST /api/validation/validate
Content-Type: application/json

{
  "businessNo": "LAB20240515001",
  "operator": "张三",
  "simulateConcurrency": false
}
```

**参数说明**:
- `businessNo`: 业务单号（必填）
- `operator`: 操作人（必填）
- `simulateConcurrency`: 是否模拟并发覆盖（可选，默认 false）

### 按业务单号查询

```
GET /api/validation/query/:businessNo
```

**示例**:
```
GET /api/validation/query/LAB20240515005
```

此接口会同时返回：
- 原始样本信息
- 校验记录（如有）
- 失败记录（如有，含网关错误摘录、修正建议、结论）
- 异常样本标记

### 查询所有样本

```
GET /api/validation/query?page=1&pageSize=20&startDate=2024-01-01&endDate=2024-12-31
```

### 查询失败记录

```
GET /api/validation/failures?page=1&pageSize=20&failureType=CONCURRENT_WRITE_OVERRIDE
```

### 查询异常样本

```
GET /api/validation/anomalies?page=1&pageSize=20
```

### 批量操作预览

```
POST /api/validation/batch/preview
Content-Type: application/json

{
  "businessNos": ["LAB20240515001", "LAB20240515002", "LAB20240515003"],
  "operator": "管理员"
}
```

### 执行批量操作

```
POST /api/validation/batch/execute/:operationId
Content-Type: application/json

{
  "operator": "管理员"
}
```

### 获取摘要

```
GET /api/validation/summary?businessNos=LAB20240515001,LAB20240515005
```

### 获取摘要报告（Markdown格式）

```
GET /api/validation/summary/report?businessNos=LAB20240515001,LAB20240515005
```

报告内容包含：
- 统计概览
- 按业务单号的详细信息
- 网关错误摘录（JSON格式）
- 修正建议
- 结论

### 获取错误统计

```
GET /api/validation/statistics/errors
```

### 检查当前冻结窗口

```
GET /api/validation/window/check
```

## 冻结窗口配置

系统内置三个冻结窗口：

| 窗口类型 | 时间段 | 说明 |
|---------|--------|------|
| morning | 06:00 - 10:00 | 上午窗口 |
| afternoon | 14:00 - 18:00 | 下午窗口 |
| night | 22:00 - 02:00 | 夜间窗口（跨天） |

不在冻结窗口内的校验操作会被拒绝并记录失败。

## 异常场景说明

### 并发写入覆盖（CONCURRENT_WRITE_OVERRIDE）

- **触发样本**: `LAB20240515005` - 钱七（呼吸内科）
- **异常表现**: 模拟多个用户并发写入同一条记录，后写入的数据覆盖先写入的数据
- **异常留存**: 
  - 在 `failure_records` 表中记录详细错误信息
  - 在 `anomaly_samples` 表中标记为异常样本
  - `gateway_error` 字段保存完整的并发冲突日志
- **修正建议**: 增加乐观锁、使用版本号控制、关键操作串行化

## 测试业务单号

造数脚本会生成以下可测试的业务单号：

| 业务单号 | 患者姓名 | 科室 | 特殊标记 |
|---------|---------|------|---------|
| LAB20240515001 | 张三 | 内科门诊 | - |
| LAB20240515002 | 李四 | 消化内科 | - |
| LAB20240515003 | 王五 | 肾内科 | - |
| LAB20240515004 | 赵六 | 神经内科 | - |
| LAB20240515005 | 钱七 | 呼吸内科 | **并发覆盖异常** |
| LAB20240515006 | 孙八 | 心血管内科 | - |
| LAB20240515007 | 周九 | 消化内科 | - |
| LAB20240515008 | 吴十 | ICU | - |
| LAB20240515009 | 郑十一 | 内分泌科 | - |
| LAB20240515010 | 冯十二 | 感染科 | - |

## 数据库表结构

### lab_samples（实验室样本表）
存储原始样本信息，包含 raw_data 字段保存完整原始数据。

### validation_records（校验记录表）
存储成功的校验操作记录。

### failure_records（失败记录表）
存储所有失败的校验记录，包含：
- `failure_type`: 失败类型
- `error_code`: 错误码
- `error_message`: 错误信息
- `gateway_error`: 网关错误详情（JSON格式）
- `correction_suggestion`: 修正建议
- `conclusion`: 处理结论
- `raw_payload`: 原始请求数据

### anomaly_samples（异常样本表）
存储异常样本的关联记录，支持回溯到原始材料。

### batch_operations（批量操作表）
存储批量操作的预览和执行记录。

## 构建生产版本

```bash
npm run build
npm start
```
