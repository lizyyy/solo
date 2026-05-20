# 幼儿园晨检异常追踪 API 服务

一个专为幼儿园设计的晨检异常追踪管理系统API服务。

## 功能特点

### 核心分类处理
- **正常 (normal)**: 晨检通过，无异常情况
- **待补充 (pending)**: 信息不完整，需要补充材料后重新审核
- **已拦截 (blocked)**: 存在异常情况，需要进一步处理或隔离

### 异常类型区分
- **发热隔离 (fever_quarantine)**: 体温超过正常值（≥37.8℃），需要隔离观察
- **用药授权 (medication_auth)**: 需要家长授权用药
- **家长未确认 (parent_unconfirmed)**: 家长未确认晨检相关信息

### 主要功能
1. 批次管理 - 创建和管理晨检批次
2. 晨检记录登记 - 录入学生晨检信息
3. 自动分类 - 根据体温、用药、确认状态自动分类
4. 复核流程 - 触发复核流程
5. 处理轨迹追踪 - 记录每条记录的完整处理历史
6. 修改历史审计 - 追踪谁改过什么、为什么改
7. 班级回访 - 班级老师可以查看和更新回访状态
8. 统计查询 - 每日数据统计
9. CSV导出 - 导出完整晨检记录

## 技术栈

- Node.js + Express
- SQLite3 数据库
- CSV导出支持

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

### 3. 运行测试

```bash
npm test
```

## API 接口文档

### 健康检查
```
GET /api/health
```

### 批次管理

**创建批次**
```
POST /api/batches
Content-Type: application/json

{
  "check_date": "2024-01-15",
  "created_by": "张老师"
}
```

**获取批次列表**
```
GET /api/batches?page=1&pageSize=20
```

**获取批次详情**
```
GET /api/batches/:id
GET /api/batches/no/:batch_no
```

### 晨检记录管理

**创建晨检记录**
```
POST /api/checks
Content-Type: application/json

{
  "batch_id": 1,
  "student_id": "S001",
  "student_name": "小明",
  "class_name": "小班一班",
  "temperature": 36.5,
  "has_medication": false,
  "medication_details": "",
  "parent_confirmed": true,
  "parent_name": "王芳",
  "parent_phone": "13800138000",
  "handler": "李老师"
}
```

**获取记录详情（含处理轨迹）**
```
GET /api/checks/:id
```

**更新记录状态**
```
PUT /api/checks/:id/status
Content-Type: application/json

{
  "new_status": "normal",
  "new_abnormal_type": null,
  "operator": "王主任",
  "reason": "家长已确认，信息完整"
}
```

**触发复核流程**
```
POST /api/checks/:id/review
Content-Type: application/json

{
  "operator": "王主任",
  "review_reason": "用药信息需要重新核实"
}
```

**更新回访状态**
```
PUT /api/checks/:id/followup
Content-Type: application/json

{
  "follow_up_status": "completed",
  "follow_up_remark": "家长已确认学生情况良好",
  "operator": "李老师"
}
```

**按班级查询异常记录**
```
GET /api/checks/class/:class_name
```

**获取类型字典**
```
GET /api/checks/types
```

### 导出与统计

**导出CSV文件**
```
GET /api/export/csv/:check_date
```

**下载CSV文件**
```
GET /api/export/download/:check_date
```

**获取统计数据**
```
GET /api/export/statistics/:check_date
```

## 项目结构

```
kindergarten-morning-check-api/
├── src/
│   ├── config/
│   │   └── database.js          # 数据库配置和初始化
│   ├── models/
│   │   ├── batchModel.js        # 批次数据模型
│   │   └── checkRecordModel.js  # 晨检记录数据模型
│   ├── services/
│   │   ├── batchService.js      # 批次业务逻辑
│   │   ├── checkService.js      # 晨检业务逻辑和分类
│   │   └── exportService.js     # 导出和统计服务
│   ├── controllers/
│   │   ├── batchController.js   # 批次接口控制器
│   │   ├── checkController.js   # 晨检接口控制器
│   │   └── exportController.js  # 导出接口控制器
│   ├── routes/
│   │   ├── batchRoutes.js       # 批次路由
│   │   ├── checkRoutes.js       # 晨检路由
│   │   └── exportRoutes.js      # 导出路由
│   └── server.js                 # 服务器入口
├── data/                         # SQLite数据库文件目录
├── exports/                      # 导出文件目录
├── tests/
│   └── run-tests.js              # 自动化测试脚本
├── package.json
└── README.md
```

## 数据流转说明

1. **保健老师**创建晨检批次
2. **保健老师**录入学生晨检信息（体温、用药情况、家长确认等）
3. 系统**自动分类**处理：
   - 体温≥37.8℃ → 已拦截（发热隔离）
   - 带药但家长未确认 → 待补充
   - 家长未确认 → 待补充
   - 带药且家长确认 → 待补充（用药授权）
   - 其他情况 → 正常
4. **保健老师/主任**可以触发复核流程
5. **处理人**更新状态，系统记录完整处理轨迹
6. **班级老师**查看本班异常记录，更新回访状态
7. 导出时自动包含：晨检体温、用药嘱托、家长确认、处理人、最后处理人等信息

## 审计追踪

所有状态变更都会记录以下信息：
- 操作人 (operator)
- 操作原因 (reason)
- 变更前状态
- 变更后状态
- 操作时间

## License

MIT