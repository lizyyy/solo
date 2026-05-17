# 社群运营后台群活动资格补录 API

## 项目概述

提供群活动资格补录的完整后端服务，支持创建、修改、审核、撤回、列表、详情和导出接口。

## 技术栈

- Node.js + Express
- SQLite (本地文件数据库)
- csv-parser / json2csv (CSV 处理)

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务默认运行在 http://localhost:3000

### 运行验收测试

```bash
# 先启动服务，再新开终端运行
npm test
```

## API 接口

### 1. 创建资格记录

```
POST /api/qualifications
Content-Type: application/json

{
  "member_id": "M001",
  "activity_id": "A001",
  "reason": "补录原因",
  "operator_id": "OP001",
  "operator_name": "管理员"
}
```

### 2. 修改资格记录

```
PUT /api/qualifications/:id
Content-Type: application/json

{
  "reason": "修改后的原因",
  "operator_id": "OP001",
  "operator_name": "管理员"
}
```

### 3. 审核资格

```
POST /api/qualifications/:id/review
Content-Type: application/json

{
  "approved": true,
  "remark": "审核意见",
  "operator_id": "OP002",
  "operator_name": "审核员"
}
```

### 4. 撤销资格

```
POST /api/qualifications/:id/revoke
Content-Type: application/json

{
  "reason": "撤销原因",
  "operator_id": "OP001",
  "operator_name": "管理员"
}
```

### 5. 查询列表

```
GET /api/qualifications?member_id=M001&activity_id=A001&status=已获得
```

### 6. 查看详情（含审核历史）

```
GET /api/qualifications/:id
```

### 7. 导出 CSV

```
GET /api/qualifications/export/data?status=已获得
```

### 8. 批量导入

```
POST /api/qualifications/import/batch
Content-Type: multipart/form-data

file: [CSV文件]
operator_id: OP001
operator_name: 管理员
```

CSV 格式：
```csv
member_id,activity_id,reason
M001,A001,批量导入测试
M002,A001,第二条记录
```

## 状态说明

- **未获得**: 初始状态或审核驳回
- **补录待审**: 创建后等待审核
- **已获得**: 审核通过
- **已撤销**: 已获得状态被撤销

## 测试数据

系统启动时自动预置测试数据：

### 成员
- M001 张三 (VIP会员群, 在群)
- M002 李四 (VIP会员群, 在群)
- M003 王五 (VIP会员群, 已退群)
- M004 赵六 (普通用户群, 在群)

### 活动
- A001 2024年春节活动
- A002 周年庆活动
