# 税务申报附件校验服务 - 快速入门

## 一、项目简介

这是一个面向税务申报场景的附件校验服务，主要解决：
- 多系统来源的附件统一管理
- 申报期/企业主体校验
- 缺件自动拦截
- 补传任务追踪
- 人工修正后的历史一致性

## 二、环境准备

### 2.1 必需软件
- Node.js 16+
- MongoDB 4.4+

### 2.2 安装依赖

```bash
# 进入项目目录
cd /Users/lzy/pro/solo/workspaces/zy70183

# 安装依赖
npm install
```

### 2.3 配置环境变量

```bash
# 复制配置模板
cp .env.example .env

# 编辑 .env 文件（根据实际情况修改）
vim .env
```

默认配置：
```
PORT=3000
MONGO_URI=mongodb://localhost:27017/tax_attachment_service
LOG_LEVEL=info
```

## 三、启动步骤

### 3.1 启动 MongoDB

```bash
# 如果使用 Homebrew 安装的 MongoDB
brew services start mongodb-community

# 或者直接启动
mongod
```

### 3.2 初始化测试数据（可选但推荐）

```bash
npm run seed
```

成功后会看到：
```
开始初始化测试数据...
✓ 企业数据创建完成 2
✓ 申报期数据创建完成 3
✓ 校验规则创建完成 2

测试数据初始化完成！

测试数据概要：
企业代码：ENT001, ENT002
企业名称：测试企业有限公司, 科技发展有限公司
申报期代码： 202605, 202604, 2026Q2
```

### 3.3 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

看到以下日志表示启动成功：
```
info: MongoDB 数据库连接成功
info: 服务器启动成功，端口：3000
```

## 四、功能验证

### 4.1 健康检查

```bash
curl http://localhost:3000/api/health
```

预期输出：
```json
{
  "success": true,
  "message": "税务申报附件校验服务运行正常",
  "timestamp": "2026-05-10T...",
  "version": "1.0.0"
}
```

### 4.2 验证主数据

```bash
# 查看企业列表
curl http://localhost:3000/api/master/enterprises

# 查看申报期
curl http://localhost:3000/api/master/periods

# 查看校验规则
curl http://localhost:3000/api/master/rules
```

### 4.3 上传附件并验证

创建一个测试 PDF 文件：
```bash
echo "测试内容" > test.pdf
```

上传附件（注意替换 `企业代码` 和 `申报期代码` 为实际值）：
```bash
curl -X POST http://localhost:3000/api/attachments/upload \
  -H "x-operator: test-user" \
  -F "file=@test.pdf" \
  -F "enterpriseCode=ENT001" \
  -F "periodCode=202605" \
  -F "attachmentType=INVOICE_SUMMARY" \
  -F "sourceSystem=SYSTEM_A"
```

预期输出：
```json
{
  "success": true,
  "message": "附件上传成功",
  "data": {
    "attachmentId": "xxxx-xxxx-xxxx",
    "enterpriseCode": "ENT001",
    "periodCode": "202605",
    "validationStatus": "PENDING",
    "version": 1,
    "isLatest": true
  }
}
```

### 4.4 校验附件

```bash
# 先获取附件ID
curl http://localhost:3000/api/attachments?enterpriseCode=ENT001&periodCode=202605

# 校验附件（替换 {attachmentId}）
curl -X POST http://localhost:3000/api/attachments/{attachmentId}/validate \
  -H "x-operator: validator"
```

### 4.5 查看申报状态

```bash
# 查看申报状态（会自动校验）
curl http://localhost:3000/api/declarations/ENT001/202605
```

如果只上传了 `INVOICE_SUMMARY` 而没有 `FINANCIAL_STATEMENT`，状态应该是 `MISSING_ATTACHMENTS`。

### 4.6 创建补传任务

```bash
curl -X POST http://localhost:3000/api/tasks/create-from-declaration \
  -H "Content-Type: application/json" \
  -H "x-operator: admin" \
  -d '{
    "enterpriseCode": "ENT001",
    "periodCode": "202605"
  }'
```

### 4.7 人工修正状态

```bash
# 人工修正附件状态
curl -X POST http://localhost:3000/api/attachments/{attachmentId}/manual-correct \
  -H "Content-Type: application/json" \
  -H "x-operator: admin" \
  -d '{
    "reason": "纸质文件已审核通过，系统识别问题",
    "targetStatus": "MANUAL_CORRECTED"
  }'

# 人工修正申报状态
curl -X POST http://localhost:3000/api/declarations/ENT001/202605/manual-correct \
  -H "Content-Type: application/json" \
  -H "x-operator: super-admin" \
  -d '{
    "reason": "特殊审批，允许先申报后补材料",
    "targetStatus": "READY_TO_DECLARE",
    "remark": "已与税务局沟通确认"
  }'
```

### 4.8 查看审计日志

```bash
# 查看所有审计日志
curl http://localhost:3000/api/audit-logs

# 按企业和申报期查看
curl "http://localhost:3000/api/audit-logs/ENT001/202605"

# 筛选人工修正记录
curl "http://localhost:3000/api/audit-logs?logType=MANUAL_CORRECTION"
```

### 4.9 生成申报报告

```bash
curl http://localhost:3000/api/declarations/ENT001/202605/report
```

报告包含：
- 企业和申报期基本信息
- 当前状态（是否可申报）
- 附件汇总（已上传/缺失/无效数量）
- 附件详情列表
- 缺失附件清单
- 无效附件及原因
- 人工修正历史
- 最近审计日志摘要

## 五、关键功能验证点

### 5.1 缺件拦截
验证方式：
1. 故意不上传某个必填附件
2. 查看申报状态，应该是 `MISSING_ATTACHMENTS`
3. 无法调用 `/submit` 接口

验证命令：
```bash
# 尝试提交申报（应该失败）
curl -X POST http://localhost:3000/api/declarations/ENT001/202605/submit \
  -H "x-operator: user"
```

### 5.2 多系统来源追踪
验证方式：
1. 用不同的 `sourceSystem` 上传同一企业的附件
2. 查询附件列表，确认 `sourceSystem` 字段正确
3. 审计日志中能看到来源系统

### 5.3 版本历史
验证方式：
1. 同一附件类型上传两次
2. 第二次上传后，第一次的 `isLatest` 应该是 `false`
3. 查看历史：
```bash
curl http://localhost:3000/api/attachments/{attachmentId}/history
```

### 5.4 人工修正一致性
验证方式：
1. 人工修正附件状态
2. 检查审计日志有 `MANUAL_CORRECTION` 记录
3. 检查 `correctionReasons` 数组有记录
4. 统计时，人工修正的附件算作有效

### 5.5 状态流转
正常流程：
```
DRAFT → MISSING_ATTACHMENTS → (补传) → READY_TO_DECLARE → DECLARED
            ↓
            (无效附件) → INVALID → (修正) → READY_TO_DECLARE
```

查看所有申报状态：
```bash
curl http://localhost:3000/api/declarations/statistics/summary
```

## 六、数据查询示例

### 6.1 查询所有任务
```bash
# 所有任务
curl http://localhost:3000/api/tasks

# 待处理任务
curl "http://localhost:3000/api/tasks?status=PENDING"

# 逾期任务
curl "http://localhost:3000/api/tasks?overdue=true"

# 任务统计
curl http://localhost:3000/api/tasks/statistics/summary
```

### 6.2 查询附件
```bash
# 按状态查询
curl "http://localhost:3000/api/attachments?validationStatus=INVALID"

# 按来源系统查询
curl "http://localhost:3000/api/attachments?sourceSystem=SYSTEM_A"

# 只看最新版本
curl "http://localhost:3000/api/attachments?isLatest=true"
```

## 七、日志位置

- 控制台：开发模式直接在终端查看
- 文件日志：
  - `logs/error.log` - 错误日志
  - `logs/combined.log` - 综合日志

## 八、常见问题

### Q1: 启动时提示 MongoDB 连接失败？
A: 确认 MongoDB 已启动，检查 `.env` 中的 `MONGO_URI` 配置。

### Q2: 上传文件失败？
A: 检查文件类型，只支持：pdf, jpg, jpeg, png, xls, xlsx, doc, docx

### Q3: 为什么申报状态总是 MISSING_ATTACHMENTS？
A: 检查校验规则中的必填附件类型，确认已上传所有 `isRequired=true` 的附件。

### Q4: 人工修正后统计不对？
A: 检查审计日志，确认 `MANUAL_CORRECTION` 类型的日志已记录。系统会自动重新计算状态。

## 九、下一步

服务启动后，你可以：
1. 通过 API 管理企业、申报期、校验规则
2. 接入实际业务系统上传附件
3. 根据业务需求扩展校验规则
4. 开发前端界面展示数据

项目结构清晰，可扩展性强：
- `src/models/` - 添加新的数据模型
- `src/services/` - 扩展业务逻辑
- `src/routes/` - 添加新的 API 接口
- `src/controllers/` - 处理 HTTP 请求
