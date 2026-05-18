# 共享工位前台工位访客放行 API

基于 Node.js + Express + TypeScript 构建的企业级访客管理系统，提供访客登记、审批、门禁授权、历史追溯等完整功能。

## 核心功能

- **访客全生命周期管理**: 从创建、提交、审批到离场的完整流程
- **修改历史追溯**: 每次操作都留下完整记录，支持审计追溯
- **智能门禁管理**: 支持楼层级门禁授权，变更时可选择保留原权限
- **人工审核留痕**: 备注、修改、重新提交均有完整记录
- **数据导出**: 支持访客信息、历史记录、门禁权限的完整导出

## 技术栈

- **运行时**: Node.js
- **框架**: Express.js
- **语言**: TypeScript
- **测试**: Jest

## 安装与启动

### 环境要求
- Node.js >= 16.0.0

### 安装依赖
```bash
npm install
```

### 开发模式启动
```bash
npm run dev
```

### 生产模式构建与启动
```bash
npm run build
npm start
```

### 运行测试
```bash
npm test
```

## API 接口

### 基础接口
- `GET /health` - 健康检查
- `POST /api/init-sample` - 初始化样例数据

### 访客管理
- `POST /api/visitors` - 创建访客
- `GET /api/visitors` - 获取访客列表
- `GET /api/visitors/:id` - 获取访客详情
- `GET /api/visitors/:id/history` - 获取访客修改历史
- `GET /api/visitors/:id/access-controls` - 获取访客门禁权限
- `POST /api/visitors/:id/submit` - 提交访客申请
- `POST /api/visitors/:id/approve` - 审批通过
- `POST /api/visitors/:id/reject` - 审批拒绝
- `POST /api/visitors/:id/withdraw` - 撤回申请
- `POST /api/visitors/:id/resubmit` - 重新提交
- `PUT /api/visitors/:id/modify` - 修改访客信息
- `POST /api/visitors/:id/change-floor` - 变更访客楼层
- `POST /api/visitors/:id/comment` - 添加备注
- `GET /api/visitors/:id/export` - 导出访客完整数据

## 从创建到导出的验收流程

### 步骤 1: 启动服务并初始化数据

```bash
# 启动服务
npm run dev

# 初始化样例数据（新开一个终端）
curl -X POST http://localhost:3000/api/init-sample
```

### 步骤 2: 创建访客登记

```bash
curl -X POST http://localhost:3000/api/visitors \
  -H "Content-Type: application/json" \
  -d '{
    "visitorName": "张三",
    "visitorPhone": "13800138000",
    "visitorIdCard": "110101199001011234",
    "visitorCompany": "ABC科技有限公司",
    "hostName": "李四",
    "hostDepartment": "技术部",
    "hostPhone": "13900139000",
    "visitDate": "2026-05-20",
    "startTime": "09:00",
    "endTime": "18:00",
    "accessType": "shared_workstation",
    "workstationId": "WS-A-001",
    "floor": 5,
    "building": "A座",
    "visitPurpose": "业务洽谈与技术交流",
    "numberOfVisitors": 1,
    "hasCar": true,
    "plateNumber": "京A12345",
    "healthCodeStatus": "green",
    "temperature": 36.5,
    "createdBy": "前台-小王"
  }'
```

### 步骤 3: 查看访客列表

```bash
curl http://localhost:3000/api/visitors
```

### 步骤 4: 提交访客申请

```bash
# 替换 {visitorId} 为实际的访客ID
curl -X POST http://localhost:3000/api/visitors/{visitorId}/submit \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "前台-小王",
    "operatorRole": "receptionist"
  }'
```

### 步骤 5: 添加人工审核备注

```bash
curl -X POST http://localhost:3000/api/visitors/{visitorId}/comment \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "张经理",
    "operatorRole": "manager",
    "comment": "已核实访客身份，为重要合作方"
  }'
```

### 步骤 6: 审批通过

```bash
curl -X POST http://localhost:3000/api/visitors/{visitorId}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王总监",
    "operatorRole": "director",
    "comment": "同意放行，请安排5楼共享工位"
  }'
```

### 步骤 7: 变更访客楼层（保留原门禁权限）

场景：访客需要同时访问5楼和8楼

```bash
curl -X POST http://localhost:3000/api/visitors/{visitorId}/change-floor \
  -H "Content-Type: application/json" \
  -d '{
    "newFloor": 8,
    "operator": "前台-小王",
    "operatorRole": "receptionist",
    "reason": "访客需到8楼参加会议，保留5楼门禁权限",
    "keepOldAccess": true
  }'
```

### 步骤 8: 查看访客详情

```bash
curl http://localhost:3000/api/visitors/{visitorId}
```

### 步骤 9: 查看修改历史

```bash
curl http://localhost:3000/api/visitors/{visitorId}/history
```

验证历史记录应包含：创建、提交、添加备注、审批通过、楼层变更等所有操作记录。

### 步骤 10: 查看门禁权限

```bash
curl http://localhost:3000/api/visitors/{visitorId}/access-controls
```

验证应包含5楼和8楼两个门禁权限，且均为激活状态。

### 步骤 11: 导出完整数据

```bash
curl http://localhost:3000/api/visitors/{visitorId}/export
```

导出数据包含：
- 访客基本信息
- 完整修改历史（操作人、时间、变更字段、备注）
- 门禁权限记录（授予时间、状态、撤销时间等）

### 步骤 12: 撤回并重新提交（可选验证）

```bash
# 撤回申请
curl -X POST http://localhost:3000/api/visitors/{visitorId}/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "前台-小王",
    "operatorRole": "receptionist",
    "reason": "访客时间调整为明天"
  }'

# 重新提交（可同时更新信息）
curl -X POST http://localhost:3000/api/visitors/{visitorId}/resubmit \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "前台-小王",
    "operatorRole": "receptionist",
    "updates": {
      "visitDate": "2026-05-21",
      "startTime": "14:00",
      "endTime": "17:00"
    }
  }'
```

## 数据模型说明

### Visitor（访客）
包含访客真实业务字段：
- 个人信息：姓名、手机号、身份证号、公司
- 接待信息：接待人姓名、部门、电话
- 访问信息：日期、开始/结束时间、访问目的、人数
- 工位信息：访问类型、工位ID、楼层、楼宇
- 其他信息：是否驾车、车牌号、健康码状态、体温
- 门禁卡：卡号、发卡时间、归还状态、归还时间
- 状态信息：状态、创建时间、更新时间、创建人

### HistoryRecord（历史记录）
完整记录每次操作：
- 操作类型、操作人、操作人角色
- 备注说明
- 变更前后值对比
- 变更字段列表
- 操作时间

### AccessControl（门禁权限）
精细化门禁管理：
- 访客ID、楼层
- 权限状态、授予时间
- 撤销时间、撤销原因

## 测试覆盖

项目包含完整测试用例，覆盖以下场景：
1. 访客改楼层但原门禁仍有效
2. 访客台账一致性（状态与历史记录对应）
3. 撤回后再次提交的组合流程
4. 人工处理后的备注和修改留痕
5. 从创建到导出的完整验收流程

运行测试：
```bash
npm test
```

## 项目结构

```
src/
├── types/           # 类型定义
│   └── index.ts
├── models/          # 数据存储模型
│   └── Store.ts
├── services/        # 业务逻辑层
│   └── VisitorService.ts
├── controllers/     # 控制器层
│   └── visitorController.ts
├── routes/          # 路由层
│   └── visitorRoutes.ts
├── data/            # 样例数据
│   └── sampleData.ts
├── __tests__/       # 测试用例
│   └── VisitorService.test.ts
├── app.ts           # 应用配置
├── index.ts         # 入口文件
└── config/          # 配置文件
```
