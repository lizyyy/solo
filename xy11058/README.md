# 户外研学机构改队管理系统 API

## 项目概述

这是一个完整的户外研学机构改队管理系统API，用于管理学生在不同分队之间的调整申请流程，保留每一步操作历史，并确保保险名单和分队表数据一致性。

## 核心功能

### 1. 改队申请管理
- 创建改队申请（草稿状态）
- 提交改队申请
- 撤回改队申请
- 审核通过/拒绝
- 进入人工处理流程

### 2. 操作历史追踪
- 每次操作都完整记录历史
- 包含操作人、操作时间、操作类型
- 保留变更字段和数据快照
- 可从详情页查看完整历史记录

### 3. 保险名单同步
- 改队通过后自动检测保险状态
- 原分队保险标记为"已变更"
- 目标分队创建新的有效保险记录
- 同步结果记录在申请历史中

### 4. 分队表一致性校验
- 自动检测学生在原分队的状态
- 原分队学生标记为非活跃
- 目标分队添加新的活跃成员
- 保证分队表数据一致性

### 5. 人工处理流程
- 审核中状态可转入人工处理
- 处理人信息记录
- 添加处理备注
- 备注历史完整保留

## 状态流转

系统严格控制状态流转，防止越级操作：

```
草稿 → 待审核 → 审核中 → 人工处理中 → 已通过/已拒绝
           ↓         ↓
         已撤回     已撤回
```

## 数据模型

### 改队申请表 (TeamChangeApplication)
包含完整户外研学生态字段：
- `applicationNo`: 申请单号
- `studyProgramId/studyProgramName`: 研学项目信息
- `studentId/studentName/studentIdCard`: 学生信息
- `parentContact`: 家长联系电话
- `originalTeamId/Name/Leader`: 原分队信息
- `targetTeamId/Name/Leader`: 目标分队信息
- `changeReason/changeReasonType`: 改队原因
- `status`: 当前状态
- `applicantId/applicantName`: 申请人信息
- `currentHandlerId/Name`: 当前处理人
- `insuranceSynced`: 保险是否已同步
- `teamConsistent`: 分队表是否一致

### 操作历史表 (TeamChangeHistory)
记录每次操作的完整信息：
- `operationType`: 操作类型（创建/提交/撤回/审核/人工处理/添加备注等）
- `previousStatus/newStatus`: 状态变更前后
- `operatorId/operatorName`: 操作人
- `operationRemark`: 操作备注
- `changedFields`: 变更字段列表
- `originalDataSnapshot/newDataSnapshot`: 数据快照

### 保险名单表 (InsuranceList)
管理学生保险信息：
- `insurancePolicyNo`: 保单号
- `insuranceType`: 保险类型（意外险/医疗险/综合险）
- `effectiveDate/expiryDate`: 保险有效期
- `status`: 保险状态（有效/已退保/已变更）

### 分队成员表 (TeamMember)
管理分队成员信息：
- `role`: 队内角色（队长/副队长/队员）
- `joinTime`: 入队时间
- `isActive`: 是否在队

## API 接口

### 改队申请操作
- `POST /api/team-change` - 创建改队申请
- `PUT /api/team-change/:id` - 更新改队申请
- `POST /api/team-change/:id/submit` - 提交申请
- `POST /api/team-change/:id/withdraw` - 撤回申请
- `POST /api/team-change/:id/approve` - 审核通过
- `POST /api/team-change/:id/reject` - 审核拒绝
- `POST /api/team-change/:id/manual-process` - 进入人工处理
- `POST /api/team-change/:id/remark` - 添加备注

### 数据同步与校验
- `POST /api/team-change/:id/sync-insurance` - 同步保险名单
- `POST /api/team-change/:id/check-team-consistency` - 校验分队表一致性

### 查询接口
- `GET /api/team-change` - 获取申请列表（支持分页和筛选）
- `GET /api/team-change/:id` - 获取申请详情（含历史记录）
- `GET /api/team-change/:id/history` - 获取操作历史

## 测试覆盖

测试文件 `tests/teamChange.test.js` 包含以下测试场景：

### 1. 基础流程测试
- 创建改队申请草稿成功
- 提交改队申请成功
- 查询改队申请列表成功
- 查询改队申请详情成功

### 2. 历史记录测试
- 每次操作都记录历史
- 历史记录包含完整信息

### 3. 撤回后再次提交测试
- 撤回申请后可以再次提交
- 多次提交都有历史记录

### 4. 保险名单同步测试
- 改队通过后保险名单未同步时能正确检测并同步
- 未通过审核的申请不能同步保险名单
- 原分队保险标记为已变更
- 目标分队创建新保险记录

### 5. 分队表一致性校验测试
- 改队后分队表不一致时能正确检测并修正
- 原分队无该学生时校验失败
- 原分队学生标记为非活跃
- 目标分队添加新成员

### 6. 状态越级流转测试
- 草稿状态不能直接审核通过
- 已撤回状态不能直接审核拒绝
- 所有状态流转都经过校验

### 7. 重复调用测试
- 重复提交保险同步应正确处理
- 幂等性保证

### 8. 坏数据处理测试
- 缺少必要字段时返回错误
- 操作人信息缺失时返回错误
- 查询不存在的申请返回错误

### 9. 人工处理流程测试
- 进入人工处理后可以添加备注
- 多次添加备注都保留历史
- 人工处理后可最终审核通过
- 处理人信息完整记录

## 安装运行

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 启动服务
npm start
```

## 技术栈

- **Node.js + Express**: Web服务框架
- **Sequelize**: ORM数据库框架
- **SQLite**: 数据库（内存/文件模式）
- **Jest + Supertest**: 测试框架

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── models/
│   │   ├── index.js           # 模型关联
│   │   ├── TeamChangeApplication.js  # 改队申请模型
│   │   ├── TeamChangeHistory.js      # 操作历史模型
│   │   ├── InsuranceList.js          # 保险名单模型
│   │   └── TeamMember.js             # 分队成员模型
│   ├── services/
│   │   └── teamChangeService.js      # 业务逻辑服务
│   ├── controllers/
│   │   └── teamChangeController.js   # 控制器
│   └── routes/
│       └── teamChangeRoutes.js       # 路由定义
├── tests/
│   └── teamChange.test.js     # 测试文件
└── package.json
```

## 设计亮点

1. **完整历史追踪**: 每次状态变更、数据修改都记录完整历史，满足跨人交接需求
2. **严格状态校验**: 防止状态越级流转，保证业务流程正确性
3. **数据一致性保证**: 保险名单和分队表的同步校验机制
4. **幂等性处理**: 重复调用接口不会产生脏数据
5. **坏数据防护**: 完善的参数校验和错误处理
6. **真实业务字段**: 所有模型都包含户外研学机构的真实业务字段
