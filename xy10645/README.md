# 培训证书资格发放系统

一个完整的培训证书资格发放管理系统，包含后端API和前端管理界面。

## 功能特性

### 后端功能
- **幂等性处理**：支持通过请求头 `x-request-id` 实现幂等操作
- **状态历史记录**：所有数据变更都会记录历史，包括修改前后的值
- **错误处理**：统一的错误响应格式，包含错误码和详细信息

### 业务模块
- **学员管理**：学员的增删改查
- **出勤记录**：学员出勤情况管理
- **考试成绩**：成绩录入，自动校验是否通过
- **补考记录**：补考情况管理
- **证书发放**：证书创建、发放、撤销、复核
- **变更历史**：所有操作的历史记录查询

### 前端功能
- **统计概览**：学员总数、证书发放情况、通过率等关键指标
- **状态按钮**：证书发放、撤销、复核操作按钮
- **导出功能**：支持按责任人和处理时间筛选导出Excel

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- 内存数据库（演示用）
- exceljs（导出Excel）

### 前端
- React 18
- TypeScript
- Ant Design 5
- Vite
- Axios

## 快速开始

### 启动后端服务

```bash
cd backend
npm install
npm run dev
```

后端服务将在 http://localhost:3001 启动

### 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 http://localhost:3000 启动

## 项目结构

```
.
├── backend/
│   ├── src/
│   │   ├── types.ts              # 类型定义
│   │   ├── database.ts           # 数据库操作
│   │   ├── index.ts              # 入口文件
│   │   ├── sampleData.ts         # 示例数据
│   │   ├── middleware/           # 中间件
│   │   │   ├── responseHandler.ts
│   │   │   └── idempotent.ts
│   │   └── routes/               # 路由
│   │       ├── students.ts
│   │       ├── attendance.ts
│   │       ├── examScores.ts
│   │       ├── retakeRecords.ts
│   │       ├── certificates.ts
│   │       ├── history.ts
│   │       ├── statistics.ts
│   │       └── export.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # 入口文件
│   │   ├── App.tsx               # 主应用组件
│   │   ├── index.css             # 样式
│   │   ├── types.ts              # 类型定义
│   │   ├── api.ts                # API请求
│   │   └── components/           # 组件
│   │       ├── StatisticsDashboard.tsx
│   │       ├── StudentsPage.tsx
│   │       ├── AttendancePage.tsx
│   │       ├── ExamScoresPage.tsx
│   │       ├── RetakeRecordsPage.tsx
│   │       ├── CertificatesPage.tsx
│   │       ├── HistoryPage.tsx
│   │       └── ExportPage.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

## API接口

### 学员管理
- `GET /api/students` - 获取学员列表
- `GET /api/students/:id` - 获取单个学员
- `POST /api/students` - 创建学员
- `PUT /api/students/:id` - 更新学员

### 出勤记录
- `GET /api/attendance` - 获取出勤记录列表
- `GET /api/attendance/student/:studentId` - 获取学员出勤记录
- `POST /api/attendance` - 创建出勤记录
- `PUT /api/attendance/:id` - 更新出勤记录

### 考试成绩
- `GET /api/exam-scores` - 获取考试成绩列表
- `GET /api/exam-scores/student/:studentId` - 获取学员考试成绩
- `POST /api/exam-scores` - 创建考试成绩
- `PUT /api/exam-scores/:id` - 更新考试成绩

### 补考记录
- `GET /api/retake-records` - 获取补考记录列表
- `GET /api/retake-records/student/:studentId` - 获取学员补考记录
- `POST /api/retake-records` - 创建补考记录
- `PUT /api/retake-records/:id` - 更新补考记录

### 证书管理
- `GET /api/certificates` - 获取证书列表
- `GET /api/certificates/:id` - 获取单个证书
- `GET /api/certificates/student/:studentId` - 获取学员证书
- `POST /api/certificates` - 创建证书
- `PUT /api/certificates/:id` - 更新证书
- `POST /api/certificates/:id/revoke` - 撤销证书
- `POST /api/certificates/:id/recheck` - 复核证书

### 统计
- `GET /api/statistics` - 获取统计数据

### 变更历史
- `GET /api/history` - 获取变更历史
  - 查询参数：`entityType`（实体类型）、`entityId`（实体ID）

### 导出
- `GET /api/export/certificates` - 导出证书名单
  - 查询参数：`responsiblePerson`、`startDate`、`endDate`、`status`
- `GET /api/export/history` - 导出变更历史
  - 查询参数：`responsiblePerson`、`startDate`、`endDate`

## 示例数据

系统启动时会自动创建以下示例数据：
- 8名学员
- 每个学员5条出勤记录
- 每个学员1条考试成绩
- 考试未通过的学员有补考记录
- 每个学员1条证书记录，覆盖各种状态
- 学员信息修改历史记录

## 验收要点

1. **考试成绩校验**：成绩自动校验是否通过，状态同步更新
2. **撤销原因留痕**：证书撤销时需要填写原因，原因会被记录在历史中
3. **发放名单查询**：可以通过页面和API接口查询证书发放名单
4. **修改历史记录**：所有字段修改都保留前后值记录
5. **导出筛选**：支持按责任人和处理时间筛选导出数据
