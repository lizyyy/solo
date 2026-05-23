# 儿童托管接送API

本地后端API服务，提供儿童托管接送管理功能，包括学生管理、接送人授权、请假记录、迟接计费、接送报告等功能。

## 功能特性

### 核心数据模型
- **学生管理**: 学生基本信息、年级班级、家长联系方式
- **接送人管理**: 接送人信息、与学生关系、是否主要接送人
- **授权时段**: 按日期和时段授权特定接送人接送
- **请假记录**: 学生请假申请、审批状态、请假原因
- **迟接事件**: 迟接时长、费用计算、费用状态
- **接送记录**: 接送时间、接送人、验证人员、备注
- **异常日志**: 记录所有异常请求和处理结果
- **人工修正**: 数据修正记录，留下操作痕迹
- **状态历史**: 所有状态变更的完整记录

### 核心规则
- **授权校验**: 只有授权的接送人在授权时段内才能接送
- **时段限制**: 接送时间必须在授权的时间段内
- **迟接计费**: 超过10分钟开始计费，按每30分钟计费
- **请假检查**: 请假学生当天不能创建接送记录
- **重复检查**: 同一学生同一天只能有一条接送记录

## 技术栈
- Node.js + Express
- SQLite3 (本地持久化)
- Moment.js (时间处理)
- json2csv (报表导出)

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 导入样例数据
```bash
npm run seed-data
```

### 4. 启动服务
```bash
npm start
```

服务将在 http://localhost:3000 启动

## API接口文档

### 学生管理
- `GET /api/students` - 获取学生列表
- `GET /api/students/:id` - 获取单个学生详情
- `POST /api/students` - 创建学生
- `PUT /api/students/:id/status` - 变更学生状态

### 接送人管理
- `GET /api/guardians` - 获取接送人列表
- `GET /api/guardians/:id` - 获取单个接送人详情
- `POST /api/guardians` - 创建接送人

### 授权管理
- `GET /api/authorizations` - 获取授权列表
- `POST /api/authorizations` - 创建授权
- `PUT /api/authorizations/:id/status` - 变更授权状态

### 请假管理
- `GET /api/leaves` - 获取请假列表
- `POST /api/leaves` - 创建请假申请
- `PUT /api/leaves/:id/approve` - 审批通过
- `PUT /api/leaves/:id/reject` - 审批拒绝

### 接送管理
- `GET /api/pickups` - 获取接送记录
- `POST /api/pickups` - 创建接送记录
- `GET /api/pickups/late` - 获取迟接记录
- `PUT /api/pickups/late/:id/fee-status` - 更新迟接费用状态

### 报表导出
- `GET /api/reports/daily?date=YYYY-MM-DD` - 日报表
- `GET /api/reports/monthly?year=YYYY&month=MM` - 月报表
- 支持 `?format=csv` 参数导出CSV格式

### 管理接口
- `GET /api/admin/exceptions` - 获取异常日志
- `PUT /api/admin/exceptions/:id/resolve` - 标记异常已解决
- `POST /api/admin/corrections` - 人工修正数据
- `GET /api/admin/corrections` - 获取修正记录
- `GET /api/admin/status-history` - 获取状态变更历史

## 验收测试

运行完整的API测试用例，验证所有核心功能：

```bash
npm test
```

测试用例覆盖：
1. 正常创建：学生、接送人、授权、接送记录
2. 重复提交：重复创建学生、重复接送
3. 异常拦截：无授权、不存在的学生/接送人
4. 状态推进：请假审批流程
5. 人工修正：数据修正功能
6. 导出报告：日报表导出
7. 异常日志：异常请求记录

## 项目结构

```
├── src/
│   ├── server.js              # 服务入口
│   ├── db/
│   │   └── index.js           # 数据库连接
│   ├── routes/
│   │   ├── students.js        # 学生路由
│   │   ├── guardians.js       # 接送人路由
│   │   ├── authorizations.js  # 授权路由
│   │   ├── leaves.js          # 请假路由
│   │   ├── pickups.js         # 接送路由
│   │   ├── reports.js         # 报表路由
│   │   └── admin.js           # 管理路由
│   ├── middleware/
│   │   └── exceptionHandler.js # 异常处理中间件
│   ├── services/
│   │   └── validationService.js # 验证服务
│   ├── scripts/
│   │   ├── initDB.js          # 数据库初始化
│   │   └── seedData.js        # 样例数据
│   └── tests/
│       └── test-api.js        # API测试脚本
├── data/                      # 数据库文件目录
├── package.json
└── README.md
```

## 主要API示例

### 创建接送记录
```bash
curl -X POST http://localhost:3000/api/pickups \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 1,
    "guardian_id": 1,
    "date": "2024-01-15",
    "pickup_time": "16:30",
    "scheduled_time": "16:00",
    "verified_by": "admin",
    "notes": "正常接送"
  }'
```

### 导出日报表
```bash
# JSON格式
curl http://localhost:3000/api/reports/daily?date=2024-01-15

# CSV格式
curl http://localhost:3000/api/reports/daily?date=2024-01-15&format=csv
```

### 人工修正数据
```bash
curl -X POST http://localhost:3000/api/admin/corrections \
  -H "Content-Type: application/json" \
  -d '{
    "record_type": "student",
    "record_id": 1,
    "field_name": "class_name",
    "new_value": "2班",
    "reason": "班级调整",
    "corrected_by": "admin"
  }'
```
