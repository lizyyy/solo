# 校车点名改站系统

一个完整的全栈 Web 应用，用于管理校车学生上下车点名、临时改站、请假申请和异常监控。

## 功能特性

### 核心功能
- **异常看板**：实时显示当日点名异常情况，包括缺勤、改站、未确认记录
- **学生管理**：学生信息增删改查，支持搜索和筛选
- **线路站点**：校车线路和站点管理
- **请假管理**：学生请假申请、审批流程
- **报表导出**：按日期、线路、操作人筛选导出历史记录

### 业务规则
- **请假拦截**：已批准请假的学生当日无法进行点名
- **改站限制**：家长已确认的记录不能再改站；新站点必须属于同一条线路
- **家长确认**：支持家长二次确认改站/点名结果
- **重复提交**：同一学生同一方向当日只能有一条点名记录
- **变更日志**：所有修改操作都记录变更历史，保留修改前后值

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
- dayjs (日期处理)
- uuid (唯一ID)

### 前端
- React 18
- TypeScript
- Ant Design (UI组件库)
- React Router (路由)
- Axios (HTTP客户端)

## 本地启动

### 前置要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

### 初始化数据库和样例数据

```bash
npm run seed
```

这将创建 `bus-attendance.db` SQLite 数据库文件，并插入样例数据：
- 2 条校车线路
- 4 个站点
- 5 名学生
- 2 条请假申请（1条待审批，1条已批准）
- 5 条点名记录（包含正常、改站、缺勤状态）

### 启动开发服务器

```bash
# 启动前后端（同时启动）
npm run dev

# 或者分别启动
# 后端 (端口 4000)
npm run dev:server

# 前端 (端口 3000)
cd client && npm run dev
```

访问 http://localhost:3000 即可使用系统。

## API 接口演示

### 健康检查
```bash
GET /api/health
```

### 学生管理
```bash
# 获取学生列表
GET /api/students?search=张&status=active

# 获取单个学生
GET /api/students/:id

# 创建学生
POST /api/students
{
  "name": "张三",
  "studentNo": "S2024001",
  "grade": "一年级",
  "class": "1班",
  "parentName": "张父",
  "parentPhone": "13900139001",
  "operator": "管理员"
}

# 更新学生
PUT /api/students/:id
```

### 线路站点
```bash
# 获取线路列表
GET /api/routes

# 获取线路站点
GET /api/routes/:routeId/stops

# 创建站点
POST /api/routes/stops
```

### 请假管理
```bash
# 获取请假列表
GET /api/leaves?status=pending&startDate=2024-01-01

# 申请请假
POST /api/leaves
{
  "studentId": "...",
  "leaveDate": "2024-05-20",
  "leaveType": "病假",
  "reason": "感冒",
  "operator": "家长"
}

# 批准请假
POST /api/leaves/:id/approve
{
  "approvedBy": "管理员"
}

# 拒绝请假
POST /api/leaves/:id/reject
{
  "approvedBy": "管理员",
  "reason": "理由不充分"
}
```

### 点名管理
```bash
# 获取点名记录
GET /api/attendance?attendanceDate=2024-05-20&status=changed

# 获取异常记录
GET /api/attendance/abnormal?date=2024-05-20

# 创建点名记录
POST /api/attendance
{
  "studentId": "...",
  "routeId": "...",
  "stopId": "...",
  "attendanceDate": "2024-05-20",
  "direction": "morning",
  "status": "normal",
  "operator": "司机"
}

# 改站
POST /api/attendance/:id/change-stop
{
  "newStopId": "...",
  "changedBy": "操作员",
  "changeReason": "家长临时要求"
}

# 家长确认
POST /api/attendance/:id/confirm

# 获取变更日志
GET /api/attendance/:id/logs
```

### 报表导出
```bash
GET /api/attendance/export?startDate=2024-05-01&endDate=2024-05-20&routeId=...&changedBy=操作员
```

## 失败路径示例

### 1. 已请假学生无法点名
```bash
POST /api/attendance
{
  "studentId": "已请假的学生ID",
  "attendanceDate": "请假日期",
  ...
}

# 返回: 400 Bad Request
{ "error": "该学生当日已请假，无需点名" }
```

### 2. 重复点名
```bash
# 对同一学生同一日期同一方向提交两次点名
# 第二次返回: 400 Bad Request
{ "error": "该学生当日该方向已有点名记录" }
```

### 3. 已确认记录无法改站
```bash
POST /api/attendance/:已确认记录ID/change-stop
{
  "newStopId": "...",
  "changedBy": "操作员",
  "changeReason": "..."
}

# 返回: 400 Bad Request
{ "error": "家长已确认，不能改站" }
```

### 4. 跨线路改站
```bash
POST /api/attendance/:id/change-stop
{
  "newStopId": "其他线路的站点ID",
  ...
}

# 返回: 400 Bad Request
{ "error": "新站点必须属于同一条线路" }
```

### 5. 重复请假申请
```bash
# 对同一学生同一日期提交两次请假
# 第二次返回: 400 Bad Request
{ "error": "该学生当日已有有效请假申请" }
```

### 6. 已批准请假无法修改
```bash
PUT /api/leaves/:已批准ID
{ ... }

# 返回: 400 Bad Request
{ "error": "已批准的请假申请不能修改" }
```

## 数据库结构

### 主要表
- `students` - 学生表
- `routes` - 线路表
- `stops` - 站点表
- `leave_applications` - 请假申请表
- `attendance_records` - 点名记录表
- `change_logs` - 变更日志表（所有修改操作都在此记录）

## 项目结构

```
.
├── server/                 # 后端代码
│   ├── index.ts           # 入口文件
│   ├── db.ts              # 数据库初始化
│   ├── routes/            # API路由
│   │   ├── students.ts
│   │   ├── routes.ts
│   │   ├── leaves.ts
│   │   └── attendance.ts
│   ├── services/          # 业务逻辑
│   │   ├── changeLogService.ts
│   │   ├── studentService.ts
│   │   ├── routeService.ts
│   │   ├── leaveService.ts
│   │   └── attendanceService.ts
│   └── seed.ts            # 样例数据脚本
├── client/                 # 前端代码
│   ├── src/
│   │   ├── App.tsx        # 主应用
│   │   ├── main.tsx       # 入口
│   │   └── pages/         # 页面组件
│   │       ├── Dashboard.tsx    # 异常看板
│   │       ├── Students.tsx     # 学生管理
│   │       ├── Routes.tsx       # 线路站点
│   │       ├── Leaves.tsx       # 请假管理
│   │       └── Reports.tsx      # 报表导出
│   ├── package.json
│   └── vite.config.ts
├── package.json
├── tsconfig.json
└── README.md
```
