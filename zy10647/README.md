# 在线考试服务补考资格恢复 API

本地可运行的补考资格恢复服务，支持完整的申请、审核、撤回流程。

## 功能特性

- ✅ 补考资格恢复申请（创建/提交/撤回/审核）
- ✅ 业务规则校验（防重复、已补考校验、缺考校验）
- ✅ 申请列表查询（分页/筛选）
- ✅ 申请详情查询
- ✅ 操作历史记录
- ✅ 批量导入（支持错误记录）
- ✅ CSV导出

## 状态定义

| 状态码 | 状态说明 |
|--------|----------|
| 0 | 草稿 |
| 1 | 已提交待审核 |
| 2 | 审核通过已恢复 |
| 3 | 审核拒绝 |
| 4 | 已撤回 |
| 5 | 已失效 |

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 运行测试
```bash
npm test
```

### 4. 启动服务
```bash
npm start
# 或开发模式
npm run dev
```

服务启动后访问: http://localhost:3000

## API接口

### 健康检查
```
GET /api/health
```

### 创建申请
```
POST /api/recovery/create
{
  "registrationId": 1,
  "absenceReasonId": 1,
  "reasonDetail": "急性肠胃炎住院",
  "applicantRemark": "请批准",
  "operatorId": 1,
  "operatorName": "张三"
}
```

### 提交申请
```
POST /api/recovery/submit/:id
{
  "operatorId": 1,
  "operatorName": "张三"
}
```

### 撤回申请
```
POST /api/recovery/withdraw/:id
{
  "operatorId": 1,
  "operatorName": "张三",
  "reason": "材料不全"
}
```

### 审核申请
```
POST /api/recovery/review/:id
{
  "isApproved": true,
  "reviewerId": 100,
  "reviewerName": "管理员",
  "reviewerRemark": "情况属实"
}
```

### 获取申请列表
```
GET /api/recovery/list?page=1&pageSize=10&status=1&examineeId=1&examId=1
```

### 获取申请详情
```
GET /api/recovery/detail/:id
```

### 获取操作日志
```
GET /api/recovery/logs/:id
```

### 批量导入
```
POST /api/recovery/import
{
  "batchNo": "BATCH001",
  "dataList": [...]
}
```

### 获取导入错误
```
GET /api/recovery/import-errors/:batchNo
```

### 导出CSV
```
GET /api/recovery/export?status=1
```

## 测试场景

测试脚本覆盖以下场景：

1. **完整流程测试**：创建 → 提交 → 审核通过
2. **考生已补考仍再次申请恢复资格**：应返回错误码 1001
3. **重复请求测试**：已有有效申请时重复提交应返回错误码 1002
4. **撤回后再提交测试**：撤回后可以重新创建新申请
5. **未缺考考生申请失败**：应返回错误码 1003
6. **查询功能测试**：列表查询、状态筛选
7. **批量导入测试**：含成功行和失败行，导入错误可查询

## 项目结构

```
.
├── database/
│   ├── init.sql          # 数据库初始化脚本
│   ├── test-data.sql     # 测试数据
│   └── exam.db           # SQLite数据库文件（运行后生成）
├── src/
│   ├── db/
│   │   └── index.js      # 数据库连接
│   ├── constants/
│   │   └── status.js     # 状态常量定义
│   ├── services/
│   │   └── recoveryService.js  # 核心业务逻辑
│   ├── routes/
│   │   └── recovery.js   # API路由
│   └── app.js            # 主应用入口
├── tests/
│   └── run-tests.js      # 测试脚本
├── scripts/
│   └── init-db.js        # 数据库初始化脚本
├── package.json
└── README.md
```

## 核心数据表

1. **examinees** - 考生表
2. **exams** - 考试表
3. **exam_registrations** - 考试报名表（关联考生和考试）
4. **absence_reasons** - 缺考原因字典表
5. **recovery_applications** - 补考资格恢复申请表
6. **proof_materials** - 证明材料表
7. **operation_logs** - 操作历史表
8. **import_errors** - 导入错误记录表
