# 招标澄清问答 API 系统

一个用于招标期间统一留痕管理的 API 系统，支持供应商提问、澄清发布、补遗文件管理及完整可追溯性。

## 系统特性

### 核心功能
- **项目标段管理**：多项目、多标段分层管理
- **问题收集**：供应商在线提交问题，支持状态流转
- **澄清版本**：多版本澄清管理，包含问题-答复明细
- **补遗附件**：文件上传、下载，供应商确认签收
- **归档报告**：一键生成完整归档，包含所有可追溯明细
- **审计留痕**：所有关键操作自动记录日志
- **后台任务**：失败重试机制，无需清库重来

### 可追溯性保证
- 每个问题可查看：提问供应商、答复内容、关联的澄清版本
- 每个澄清可查看：包含的所有问题明细、各版本差异
- 每个补遗可查看：供应商确认状态、确认时间
- 归档报告包含：项目概览、各标段统计、完整问题清单、澄清历史、补遗确认情况
- 审计日志记录：操作人、操作时间、变更前后状态

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn

### 安装与启动

1. **安装依赖**
```bash
npm install
```

2. **初始化数据库**
```bash
npx prisma migrate dev --name init
```

3. **启动开发服务器**
```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 访问首页
访问 `http://localhost:3000` 查看完整的接口文档和使用指南。

## 业务流程指南

### 第一步：创建项目和标段

1. **创建项目**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "XX大楼建设项目",
    "code": "PROJ-2024-001",
    "description": "办公楼建设工程招标",
    "deadline": "2024-12-31T23:59:59Z"
  }'
```

2. **查看所有项目**
```bash
curl http://localhost:3000/api/projects
```

3. **为项目创建标段**
```bash
curl -X POST http://localhost:3000/api/projects/{项目ID}/sections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "第一标段-土建工程",
    "code": "S01",
    "description": "主体结构施工"
  }'
```

### 第二步：注册供应商

1. **创建供应商**
```bash
curl -X POST http://localhost:3000/api/questions/suppliers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "中建XX建设有限公司",
    "code": "SUPP-001",
    "contact": "张三",
    "email": "zhang@company.com",
    "phone": "13800138000"
  }'
```

### 第三步：供应商提问

1. **提交问题**
```bash
curl -X POST http://localhost:3000/api/questions \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "{项目ID}",
    "sectionId": "{标段ID}",
    "supplierId": "{供应商ID}",
    "title": "关于招标文件第3.2条的疑问",
    "content": "请问混凝土强度等级是否有具体要求？"
  }'
```

2. **查看项目所有问题**
```bash
curl http://localhost:3000/api/questions?projectId={项目ID}
```

3. **查看问题详情（含关联澄清）**
```bash
curl http://localhost:3000/api/questions/{问题ID}
```

### 第四步：答复问题并发布澄清

1. **答复单个问题**
```bash
curl -X POST http://localhost:3000/api/questions/{问题ID}/answer \
  -H "Content-Type: application/json" \
  -d '{
    "answer": "混凝土强度等级要求为C30，详见补充说明。",
    "answeredBy": "招标办-李四"
  }'
```

2. **创建澄清版本**
```bash
curl -X POST http://localhost:3000/api/clarifications \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "{项目ID}",
    "sectionId": "{标段ID}",
    "title": "第一期澄清公告",
    "content": "针对供应商提问的统一答复..."
  }'
```

3. **将问题添加到澄清（批量发布）**
```bash
curl -X POST http://localhost:3000/api/clarifications/{澄清ID}/items \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "{问题ID}",
    "answer": "混凝土强度等级要求为C30。"
  }'
```

4. **发布澄清（公开给所有供应商）**
```bash
curl -X POST http://localhost:3000/api/clarifications/{澄清ID}/publish \
  -H "Content-Type: application/json" \
  -d '{
    "publishedBy": "招标办-李四"
  }'
```

5. **查看澄清详情（含所有问题明细）**
```bash
curl http://localhost:3000/api/clarifications/{澄清ID}
```

### 第五步：上传补遗文件

1. **上传补遗**
```bash
curl -X POST http://localhost:3000/api/addendums \
  -F "projectId={项目ID}" \
  -F "sectionId={标段ID}" \
  -F "title=工程量清单补充说明" \
  -F "description=关于第3章工程量的补充" \
  -F "file=@/path/to/addendum.pdf"
```

2. **供应商确认收到补遗**
```bash
curl -X POST http://localhost:3000/api/addendums/{补遗ID}/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "{供应商ID}",
    "notes": "已收到并确认"
  }'
```

3. **查看补遗确认情况**
```bash
curl http://localhost:3000/api/addendums/{补遗ID}/confirmations
```

### 第六步：生成归档报告

1. **创建归档任务**
```bash
curl -X POST http://localhost:3000/api/archives \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "{项目ID}",
    "title": "招标澄清完整归档",
    "generatedBy": "招标办-李四"
  }'
```

2. **执行后台任务（生成归档）**
```bash
curl -X POST http://localhost:3000/api/admin/jobs/execute-all
```

3. **查看归档状态**
```bash
curl http://localhost:3000/api/archives/{归档ID}
```

4. **导出归档报告（含完整明细）**
```bash
curl http://localhost:3000/api/archives/{归档ID}/export -o archive-report.json
```

## 后台任务管理

### 任务状态说明

| 状态 | 说明 | 下一步操作 |
|------|------|-----------|
| pending | 待执行 | 等待执行或手动触发 |
| running | 执行中 | 等待完成 |
| completed | 已完成 | 查看结果 |
| failed | 失败 | 检查错误，重试执行 |

### 任务失败后的操作

**1. 查看失败任务**
```bash
curl http://localhost:3000/api/admin/jobs/pending
```

**2. 查看任务详情（了解失败原因）**
```bash
curl http://localhost:3000/api/admin/jobs/{任务ID}
```

**3. 重置失败任务（清除错误状态）**
```bash
curl -X POST http://localhost:3000/api/admin/jobs/{任务ID}/retry
```

**4. 手动执行任务**
```bash
curl -X POST http://localhost:3000/api/admin/jobs/{任务ID}/execute
```

**5. 批量执行所有待处理任务**
```bash
curl -X POST http://localhost:3000/api/admin/jobs/execute-all
```

### 归档任务失败的补偿动作

如果归档报告生成失败，不需要清库重来：

1. 查看失败原因：`GET /api/admin/jobs/pending`
2. 修复问题（如数据不完整，先补充缺失数据）
3. 重置任务：`POST /api/admin/jobs/{任务ID}/retry`
4. 或直接在归档记录上重试：`POST /api/archives/{归档ID}/retry`
5. 重新执行任务

## 可追溯性查询

### 1. 查询项目完整审计轨迹
```bash
curl http://localhost:3000/api/admin/audit?projectId={项目ID}
```

### 2. 查询某个实体的操作历史
```bash
curl http://localhost:3000/api/admin/audit?entityType=Question&entityId={问题ID}
```

### 3. 问题追溯链条
- 问题详情 → 看到供应商、标段、答复、关联的澄清版本
- 澄清详情 → 看到包含的所有问题、每个问题的答复
- 归档报告 → 完整统计 + 所有明细

### 4. 补遗确认追溯
- 补遗详情 → 看到所有供应商的确认状态、确认时间
- 可按供应商查询确认记录

## 统计概览

```bash
curl http://localhost:3000/api/admin/statistics
```

返回项目数、问题总数、已答复数、答复率、澄清数、补遗数、供应商数、任务状态等。

## API 接口汇总

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 项目 | POST | /api/projects | 创建项目 |
| 项目 | GET | /api/projects | 项目列表 |
| 项目 | GET | /api/projects/:id | 项目详情 |
| 标段 | POST | /api/projects/:id/sections | 创建标段 |
| 标段 | GET | /api/projects/:id/sections | 标段列表 |
| 供应商 | POST | /api/questions/suppliers | 创建供应商 |
| 问题 | POST | /api/questions | 提交问题 |
| 问题 | GET | /api/questions | 问题列表 |
| 问题 | GET | /api/questions/:id | 问题详情 |
| 问题 | POST | /api/questions/:id/answer | 答复问题 |
| 澄清 | POST | /api/clarifications | 创建澄清 |
| 澄清 | GET | /api/clarifications | 澄清列表 |
| 澄清 | GET | /api/clarifications/:id | 澄清详情 |
| 澄清 | POST | /api/clarifications/:id/items | 添加问题到澄清 |
| 澄清 | POST | /api/clarifications/:id/publish | 发布澄清 |
| 补遗 | POST | /api/addendums | 上传补遗 |
| 补遗 | GET | /api/addendums | 补遗列表 |
| 补遗 | GET | /api/addendums/:id | 补遗详情 |
| 补遗 | POST | /api/addendums/:id/confirm | 确认补遗 |
| 归档 | POST | /api/archives | 创建归档任务 |
| 归档 | GET | /api/archives/:id | 归档详情 |
| 归档 | GET | /api/archives/:id/export | 导出归档 |
| 归档 | POST | /api/archives/:id/retry | 重试归档 |
| 任务 | GET | /api/admin/jobs/pending | 待处理任务 |
| 任务 | POST | /api/admin/jobs/:id/execute | 执行任务 |
| 任务 | POST | /api/admin/jobs/:id/retry | 重置任务 |
| 任务 | POST | /api/admin/jobs/execute-all | 批量执行 |
| 审计 | GET | /api/admin/audit | 审计日志 |
| 统计 | GET | /api/admin/statistics | 统计概览 |

## 故障排查指南

### 常见问题

**Q: 启动时提示数据库错误？**
A: 请先执行 `npx prisma migrate dev --name init` 初始化数据库。

**Q: 归档任务一直失败？**
A: 步骤：
1. 查看任务详情：`GET /api/admin/jobs/:id` 查看 `errorMessage`
2. 修复数据问题
3. 重置任务：`POST /api/admin/jobs/:id/retry`
4. 重新执行

**Q: 如何确认供应商是否已确认补遗？**
A: 访问 `GET /api/addendums/:id` 查看 `confirmations` 数组，或 `GET /api/addendums/:id/confirmations` 获取确认列表。

**Q: 澄清版本是如何管理的？**
A: 系统自动按版本号递增（v1, v2, v3...），已发布的澄清不可修改，需要创建新版本。

**Q: 如何查看某个问题在哪个澄清版本中发布？**
A: `GET /api/questions/:id` 返回的 `clarificationItems` 数组包含该问题关联的所有澄清版本。

## 项目结构

```
.
├── prisma/
│   └── schema.prisma      # 数据库模型定义
├── src/
│   ├── index.ts           # 应用入口
│   ├── prisma.ts          # 数据库客户端
│   ├── routes/
│   │   ├── projects.ts    # 项目标段API
│   │   ├── questions.ts   # 问题收集API
│   │   ├── clarifications.ts # 澄清管理API
│   │   ├── addendums.ts   # 补遗附件API
│   │   ├── archives.ts    # 归档报告API
│   │   └── admin.ts       # 管理API
│   └── services/
│       ├── auditService.ts  # 审计日志服务
│       └── jobService.ts    # 后台任务服务
├── package.json
├── tsconfig.json
└── README.md
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（自动重启） |
| `npm run build` | 编译 TypeScript |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 类型检查 |
| `npx prisma migrate dev` | 创建并应用数据库迁移 |
| `npx prisma reset` | 重置数据库（清空所有数据） |

> 注意：`prisma reset` 会清空所有数据，请谨慎使用。正常情况下失败任务应通过重试机制解决，不需要重置数据库。
