# 社区食堂配餐管理系统

专为社区食堂设计的老人配餐管理系统，支持饮食禁忌检查、慢病配餐规则、批量操作、配送管理和回访跟踪。

## 功能特性

### 核心业务流程
- ✅ **老人信息管理** - 记录过敏史、慢病标签、饮食禁忌
- ✅ **餐食管理** - 餐食成分、过敏源标记、适配慢病类型
- ✅ **配餐冲突检查** - 配餐前自动检查规则，拦截不合规配餐
- ✅ **改餐功能** - 支持变更配餐，保留完整改餐历史
- ✅ **配送管理** - 配送状态跟踪、配送员管理
- ✅ **回访管理** - 满意度调查、餐食质量反馈

### 规则引擎
- 🚫 **过敏优先拦截** - 严格禁止过敏源配餐
- 🚫 **糖尿病禁忌** - 非低糖/糖尿病友好餐食自动拦截
- ⚠️ **高血压警告** - 非低盐餐食提醒
- ⚠️ **痛风警告** - 非低嘌呤餐食提醒
- ⚠️ **饮食禁忌检查** - 检查餐食成分是否符合老人禁忌

### 批量操作
- 🔄 **批量配餐** - 支持一次性为多位老人配餐
- ✅ **成功/失败追踪** - 精确记录每条操作结果
- 🔒 **事务安全** - 单条失败不影响其他成功记录
- ⏱️ **失败重试** - 支持针对失败项单独重试

### 审计与追踪
- 📝 **操作人记录** - 所有操作记录操作人姓名和角色
- ⏰ **时间戳** - 完整记录操作时间
- 📋 **审计日志** - 所有操作可追溯查询

### 报告与导出
- 📊 **汇总统计** - 配餐数量、冲突数量、配送状态、满意度统计
- 🔍 **多维度筛选** - 按负责人、时间、状态、异常类型筛选
- 📥 **Excel导出** - 导出完整报告，含配餐、配送、回访、审计日志

## 技术栈

- **后端框架**: Express.js + TypeScript
- **ORM**: TypeORM
- **数据库**: SQLite (支持平滑迁移到 PostgreSQL/MySQL)
- **报表导出**: ExcelJS

## 快速开始

### 安装依赖

```bash
npm install
```

### 初始化测试数据

```bash
npm run seed
```

该命令会：
- 创建 5 位测试老人（含各种慢病和过敏情况）
- 创建 5 份测试餐食（覆盖不同禁忌类型）
- 自动运行配餐规则测试，展示拦截/通过情况
- 创建配餐、改餐、配送、回访等完整流程测试数据

### 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动

### 启动生产服务器

```bash
npm run build
npm start
```

## API 文档

### 请求头要求

所有 API 请求必须包含以下头信息：
- `x-operator`: 操作人姓名
- `x-operator-role`: 操作人角色 (admin/staff/manager)

### 老人管理

- `GET /api/elders` - 获取老人列表
  - 查询参数: `name` (模糊搜索), `isActive`
- `POST /api/elders` - 创建老人
- `GET /api/elders/:id` - 获取老人详情

### 餐食管理

- `GET /api/meals` - 获取餐食列表
  - 查询参数: `date`, `type` (breakfast/lunch/dinner)
- `POST /api/meals` - 创建餐食
- `GET /api/meals/:id` - 获取餐食详情

### 配餐管理

- `GET /api/assignments/check-conflict` - 检查配餐冲突
  - 查询参数: `elderId`, `mealId`
- `POST /api/assignments` - 创建配餐
- `GET /api/assignments` - 获取配餐列表
  - 查询参数: `elderId`, `mealId`, `status`, `hasConflicts`, `assignedBy`, `startDate`, `endDate`
- `GET /api/assignments/:id` - 获取配餐详情
- `GET /api/assignments/:id/changes` - 获取配餐变更历史

### 改餐管理

- `POST /api/meal-changes` - 变更配餐
  - 请求体: `assignmentId`, `newMealId`, `reason`, `reasonDetails`

### 配送管理

- `POST /api/deliveries` - 创建/更新配送记录
- `GET /api/deliveries` - 获取配送列表
  - 查询参数: `status`, `deliveryPerson`, `startDate`, `endDate`
- `GET /api/deliveries/:id` - 获取配送详情

### 回访管理

- `POST /api/follow-ups` - 创建回访记录
- `GET /api/follow-ups` - 获取回访列表
  - 查询参数: `assignmentId`, `satisfaction`, `conductedBy`, `startDate`, `endDate`
- `GET /api/follow-ups/:id` - 获取回访详情

### 批量操作

- `POST /api/batch/assign-meals` - 批量配餐
  - 请求体: `items: [{ elderId, mealId, notes }]`
- `GET /api/batch/operations` - 获取批量操作记录
- `GET /api/batch/operations/:id` - 获取批量操作详情

### 报告与导出

- `POST /api/report/summary` - 获取报告汇总
- `POST /api/report/export` - 导出 Excel 报告
  - 请求体: `startDate`, `endDate`, `assignedBy`, `hasConflicts` 等筛选条件

### 审计日志

- `GET /api/audit-logs` - 获取审计日志
  - 查询参数: `entity`, `action`, `operator`, `startDate`, `endDate`, `success`, `entityId`

## 数据模型

### Elder (老人)
- 基本信息: 姓名、电话、地址、房号
- 健康信息: 过敏源列表、慢病列表、饮食禁忌列表
- 审计字段: 创建人、创建角色、创建时间、更新时间

### Meal (餐食)
- 基本信息: 名称、日期、类型（早/午/晚）
- 成分信息: 配料列表、过敏源列表
- 标签: 糖尿病友好、低盐、低糖、低嘌呤
- 审计字段: 创建人、创建角色

### MealAssignment (配餐)
- 关联: 老人ID、餐食ID
- 状态: pending/confirmed/delivered/cancelled/changed
- 规则检查结果: 是否有冲突、规则检查详情
- 审计字段: 分配人、分配角色、分配时间

### MealChange (改餐记录)
- 关联: 原配餐ID、原餐食ID、新餐食ID
- 改餐原因: dietary_request/health_issue/taste_preference/admin_change/other
- 规则检查: 新配餐的规则检查结果
- 审计字段: 改餐人、改餐角色、改餐时间

### Delivery (配送)
- 关联: 配餐ID
- 状态: pending/in_transit/delivered/failed/returned
- 配送信息: 配送员、配送路线、预计/实际配送时间、签收人
- 审计字段: 创建人、创建角色

### FollowUp (回访)
- 关联: 配餐ID
- 满意度: very_dissatisfied/dissatisfied/neutral/satisfied/very_satisfied
- 评价项: 餐食质量、温度、配送时间
- 反馈: 投诉列表、建议列表、备注
- 审计字段: 回访人、回访角色、回访时间

### AuditLog (审计日志)
- 操作信息: 操作类型、实体类型、实体ID
- 数据变更: 变更前数据、变更后数据
- 审计字段: 操作人、操作角色、操作时间、是否成功、错误信息

### BatchOperation (批量操作)
- 操作信息: 操作类型、状态
- 统计: 总条目数、成功数、失败数
- 详情: 成功条目列表、失败条目列表（含错误信息）
- 审计字段: 操作人、操作角色、开始时间、完成时间

## 使用示例

### 检查配餐冲突

```bash
curl -H "x-operator: 张三" \
     -H "x-operator-role: staff" \
     "http://localhost:3000/api/assignments/check-conflict?elderId=xxx&mealId=yyy"
```

### 批量配餐

```bash
curl -X POST "http://localhost:3000/api/batch/assign-meals" \
     -H "Content-Type: application/json" \
     -H "x-operator: 李四" \
     -H "x-operator-role: manager" \
     -d '{
       "items": [
         { "elderId": "id1", "mealId": "meal1", "notes": "备注1" },
         { "elderId": "id2", "mealId": "meal2", "notes": "备注2" }
       ]
     }'
```

### 导出 Excel 报告

```bash
curl -X POST "http://localhost:3000/api/report/export" \
     -H "Content-Type: application/json" \
     -H "x-operator: 系统管理员" \
     -H "x-operator-role: admin" \
     -d '{
       "startDate": "2024-01-01",
       "endDate": "2024-12-31"
     }' \
     --output report.xlsx
```

## 项目结构

```
src/
├── entities/              # 数据模型
│   ├── Elder.ts          # 老人
│   ├── Meal.ts           # 餐食
│   ├── MealAssignment.ts # 配餐
│   ├── MealChange.ts     # 改餐记录
│   ├── Delivery.ts       # 配送
│   ├── FollowUp.ts       # 回访
│   ├── AuditLog.ts       # 审计日志
│   └── BatchOperation.ts # 批量操作
├── services/              # 业务服务
│   ├── rule-engine.ts    # 规则引擎
│   ├── audit-service.ts  # 审计服务
│   ├── batch-service.ts  # 批量操作服务
│   ├── canteen-service.ts # 核心业务服务
│   └── report-service.ts # 报告服务
├── middleware/            # 中间件
│   └── audit.ts          # 审计中间件
├── routes/               # 路由
│   └── api.ts            # API 路由
├── database/             # 数据库配置
│   └── data-source.ts    # 数据源配置
├── scripts/              # 脚本
│   ├── seed-data.ts      # 测试数据初始化
│   └── test-api.sh       # API 测试脚本
└── server.ts             # 服务器入口
```

## 健康检查

```bash
curl http://localhost:3000/health
```

## 开发说明

### 添加新的配餐规则

在 `src/services/rule-engine.ts` 中的 `RuleEngine` 类添加新的检查方法，然后在 `checkMealAssignment` 中调用。

### 扩展实体

在 `src/entities/` 目录下添加新的实体文件，然后在 `src/database/data-source.ts` 中注册。

### 批量操作处理器

参考 `src/services/batch-service.ts` 中的 `BatchProcessor` 接口实现自定义批量处理器。

## 许可证

MIT
