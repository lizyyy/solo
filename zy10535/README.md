# 客户回访排期 API 服务

## 项目概述

为客户成功团队提供统一的回访排期管理服务，解决表格管理方式存在的撞期、漏访、延期记录不统一等问题。

## 技术栈

- **运行时**: Node.js
- **框架**: Express.js
- **语言**: TypeScript
- **ORM**: TypeORM
- **数据库**: SQLite
- **测试**: Jest
- **导出**: Excel (xlsx) / CSV

## 核心数据模型

### 1. Customer (客户)
- accountNumber: 客户账号（唯一）
- name: 客户名称
- contactPerson: 联系人
- phone: 电话
- email: 邮箱
- description: 描述

### 2. PersonInCharge (负责人)
- employeeId: 员工号（唯一）
- name: 姓名
- department: 部门
- phone: 电话
- email: 邮箱

### 3. VisitSchedule (回访排期)
- scheduleNumber: 排期编号（唯一）
- customerId: 客户ID
- personInChargeId: 负责人ID
- visitType: 回访类型（新客户/常规回访/投诉处理/合同续签/升级销售/培训/其他）
- visitChannel: 回访渠道（电话/视频/上门/在线会议）
- scheduledStartTime: 预约开始时间
- scheduledEndTime: 预约结束时间
- durationMinutes: 时长（分钟）
- status: 状态（草稿/已排期/已确认/进行中/已完成/已延期/漏访/已取消）
- subject: 主题
- description: 描述
- isConfirmedByPerson: 负责人确认标记
- actualStartTime: 实际开始时间
- actualEndTime: 实际结束时间
- originalInput: 原始输入记录
- lastProcessingBasis: 最后处理依据

### 4. DelayRecord (延期记录)
- visitScheduleId: 排期ID
- reason: 延期原因（客户没空/负责人没空/紧急情况/重新排期/其他）
- reasonDescription: 原因描述
- originalScheduledTime: 原预约时间
- newScheduledTime: 新预约时间
- delayMinutes: 延期时长（分钟）
- requestedBy: 申请人
- approvedBy: 审批人
- isApproved: 是否已审批

### 5. VisitReport (回访报告)
- reportNumber: 报告编号（唯一）
- visitScheduleId: 排期ID
- visitSummary: 回访总结
- customerFeedback: 客户反馈
- issuesIdentified: 发现问题
- actionItems: 行动项
- followUpRequired: 需要跟进内容
- nextFollowUpDate: 下次跟进日期
- satisfactionScore: 满意度评分
- status: 报告状态（草稿/已提交/已审核/已归档）

## 关键业务规则

### 1. 时间冲突检查
- 同一负责人同一时间段只能有一个排期
- 时间重叠检测：开始时间 < 结束时间 且 结束时间 > 开始时间

### 2. 状态流转规则
```
草稿(DRAFT) → 已排期(SCHEDULED) → 已确认(CONFIRMED) → 进行中(IN_PROGRESS) → 已完成(COMPLETED)
                                 ↓
                              已延期(DELAYED) → 已排期(SCHEDULED)
                                 ↓
                              漏访(MISSED)
                                 ↓
                              已取消(CANCELLED)
```

### 3. 防重复机制
- 已确认的排期不可重复确认
- 同一状态不可重复推进
- 非法状态转换会被拦截

### 4. 异常路径记录
- 所有操作保存原始输入数据
- 每次状态变更记录处理依据
- 延期操作独立保存完整记录

## API 接口

### 主数据管理
```
POST   /api/master/customers     - 创建客户
GET    /api/master/customers     - 获取客户列表
GET    /api/master/customers/:id - 获取客户详情
PUT    /api/master/customers/:id - 更新客户信息
DELETE /api/master/customers/:id - 停用客户

POST   /api/master/persons       - 创建负责人
GET    /api/master/persons       - 获取负责人列表
GET    /api/master/persons/:id   - 获取负责人详情
PUT    /api/master/persons/:id   - 更新负责人信息
DELETE /api/master/persons/:id   - 停用负责人
```

### 排期管理
```
POST   /api/schedules            - 创建回访排期
GET    /api/schedules            - 获取排期列表（支持筛选）
GET    /api/schedules/:id        - 获取排期详情
POST   /api/schedules/:id/confirm - 负责人确认排期
POST   /api/schedules/:id/status  - 推进排期状态
PUT    /api/schedules/:id         - 人工修正排期信息
POST   /api/schedules/:id/cancel  - 取消排期
GET    /api/schedules/missed      - 获取漏访列表
POST   /api/schedules/:id/missed  - 标记为漏访
```

### 延期管理
```
POST   /api/schedules/:id/delay   - 创建延期记录
```

### 报告管理
```
POST   /api/schedules/:id/report  - 创建回访报告
GET    /api/schedules/:id/report  - 获取回访报告
```

### 数据导出
```
POST   /api/schedules/export      - 导出排期数据（Excel/CSV）
```

## 项目结构

```
├── src/
│   ├── entities/              # 数据模型定义
│   │   ├── Customer.ts
│   │   ├── PersonInCharge.ts
│   │   ├── VisitSchedule.ts
│   │   ├── DelayRecord.ts
│   │   └── VisitReport.ts
│   ├── services/              # 业务逻辑层
│   │   ├── MasterDataService.ts
│   │   ├── VisitScheduleService.ts
│   │   └── ExportService.ts
│   ├── routes/                # API 路由层
│   │   ├── master.ts
│   │   └── schedules.ts
│   ├── database/              # 数据库配置
│   │   └── data-source.ts
│   ├── __tests__/             # 测试文件
│   │   └── visit-scheduler.test.ts
│   └── index.ts               # 应用入口
├── database/                  # SQLite 数据库文件目录
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 运行测试
```bash
npm test
```

### 启动开发服务器
```bash
npm run dev
```

### 编译并启动生产服务器
```bash
npm run build
npm start
```

### 健康检查
```bash
curl http://localhost:3000/health
```

## 测试覆盖

项目包含完整的集成测试，覆盖以下场景：

1. **正常流程测试** - 创建、查询、导出（Excel/CSV）
2. **状态推进测试** - 按顺序推进、防重复确认、防重复推进、非法转换拦截
3. **时间冲突测试** - 同一负责人冲突检测、不同负责人不冲突
4. **异常处理测试** - 延期记录、人工修正、漏访标记、取消排期
5. **报告功能测试** - 已完成排期创建报告、未完成排期拦截
6. **审计记录测试** - 原始输入保存、处理依据记录

## 验收要点

✅ **创建排期** - 支持关联客户和负责人，自动生成编号  
✅ **查询功能** - 按客户、负责人、状态、时间范围筛选  
✅ **导出功能** - 支持 Excel 和 CSV 两种格式导出  
✅ **状态推进** - 按业务规则流转，防重复操作  
✅ **重复提交防护** - 同一动作重复提交被正确拦截  
✅ **时间冲突检测** - 同一负责人同一时间只能有一个排期  
✅ **负责人确认** - 独立的确认标记和时间记录  
✅ **延期记录** - 完整保存延期原因、原时间、新时间  
✅ **漏访提醒** - 自动识别过期未完成排期  
✅ **人工修正** - 特殊情况可人工修改排期信息  
✅ **异常路径记录** - 原始输入和处理依据全程留存  

## 作者

Trae AI 代码生成
