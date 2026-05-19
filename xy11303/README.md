# 民宿运营管理系统

一个专门为民宿行业设计的运营管理后端系统，解决保洁派单、验收、返工、扣款和结算等核心业务问题。

## 核心特性

✅ **业务流程全覆盖**
- 订单管理
- 保洁派单（支持幂等操作）
- 任务验收（照片校验）
- 返工管理
- 客诉处理
- 扣款管理
- 月度结算

✅ **智能校验规则**
- **缺图拦截**: 照片数量不足时无法通过验收，每张缺图扣款20元，最多100元
- **超时扣分**: 任务超时每小时扣款10元，最多50元
- **返工影响**: 每次返工扣款30元，返工超时额外扣款

✅ **数据安全**
- 敏感字段脱敏（手机号、姓名、金额）
- 基于角色的权限控制（RBAC）
- 操作审计日志

✅ **幂等操作**
- 重复派单不产生新任务
- 重复扣款不产生新记录
- 重复返工返回已有记录

✅ **多接口支持**
- RESTful API
- 命令行工具（CLI）
- CSV报告导出

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript
- **数据库**: SQLite（嵌入式，零配置）
- **框架**: Express.js
- **测试**: Jest

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译项目

```bash
npm run build
```

### 3. 初始化系统

```bash
# 初始化数据库和默认用户
npm run cli -- init
```

默认账号：
- 管理员: `admin` / `admin123`
- 运营经理: `manager` / `manager123`
- 保洁员张阿姨: `cleaner1` / `cleaner123`
- 保洁员李阿姨: `cleaner2` / `cleaner456`
- 财务: `finance` / `finance123`

### 4. 启动API服务

```bash
npm start
```

服务将在 `http://localhost:3000/api/v1` 启动

### 5. 生成测试数据（可选）

```bash
npm run cli -- seed
```

## CLI命令使用

### 派单
```bash
npm run cli -- task:assign --order <订单ID> --cleaner <保洁员ID> [--date <日期>] [--deadline <截止时间>]
```

### 校验任务
```bash
npm run cli -- task:validate --id <任务ID>
```

### 验收任务
```bash
npm run cli -- task:approve --id <任务ID>
```

### 创建返工
```bash
npm run cli -- rework:create --task <任务ID> [--reason <原因>]
```

### 创建扣款
```bash
npm run cli -- deduction:create --task <任务ID> --type <类型> --amount <金额> [--reason <原因>]
```

类型：`missing_photos`（缺图）、`overtime`（超时）、`complaint`（客诉）、`rework`（返工）、`damage`（损坏）、`other`（其他）

### 生成结算单
```bash
npm run cli -- settlement:create --cleaner <保洁员ID> --start <开始日期> --end <结束日期>
```

### 确认结算
```bash
npm run cli -- settlement:confirm --id <结算单ID>
```

### 导出结算CSV
```bash
npm run cli -- settlement:export --id <结算单ID> [--output <文件路径>]
```

## API接口

### 请求头

```
X-User-ID: 用户ID
X-User-Role: admin | manager | operator | cleaner | finance
```

### 订单管理

```
GET    /api/v1/orders              # 订单列表
GET    /api/v1/orders/:id          # 订单详情
POST   /api/v1/orders              # 创建订单
```

### 任务管理

```
GET    /api/v1/tasks               # 任务列表
GET    /api/v1/tasks/:id           # 任务详情
GET    /api/v1/tasks/:id/validate  # 任务校验
POST   /api/v1/tasks/assign        # 派单
POST   /api/v1/tasks/:id/start     # 开始任务
POST   /api/v1/tasks/:id/submit    # 提交任务
POST   /api/v1/tasks/:id/approve   # 验收通过
POST   /api/v1/tasks/:id/reject    # 驳回任务
POST   /api/v1/tasks/:id/complete  # 完成任务
```

### 照片管理

```
GET    /api/v1/tasks/:id/photos    # 照片列表
POST   /api/v1/tasks/:id/photos    # 上传照片
```

### 返工管理

```
GET    /api/v1/tasks/:id/reworks   # 返工列表
POST   /api/v1/reworks              # 创建返工
POST   /api/v1/reworks/:id/start    # 开始返工
POST   /api/v1/reworks/:id/submit   # 提交返工
POST   /api/v1/reworks/:id/approve  # 验收返工
POST   /api/v1/reworks/:id/complete # 完成返工
```

### 扣款管理

```
GET    /api/v1/tasks/:id/deductions # 扣款列表
POST   /api/v1/deductions           # 创建扣款
POST   /api/v1/deductions/:id/confirm # 确认扣款
POST   /api/v1/deductions/:id/appeal  # 申诉扣款
```

### 结算管理

```
GET    /api/v1/settlements          # 结算单列表
GET    /api/v1/settlements/:id      # 结算单详情
GET    /api/v1/settlements/:id/items # 结算明细
POST   /api/v1/settlements          # 生成结算单
POST   /api/v1/settlements/:id/confirm # 确认结算
POST   /api/v1/settlements/:id/pay     # 标记已支付
```

### 客诉管理

```
GET    /api/v1/complaints           # 客诉列表
POST   /api/v1/complaints           # 创建客诉
```

### 报告导出

```
GET    /api/v1/reports/settlement/:id        # 结算报告
GET    /api/v1/reports/settlement/:id/export # 导出结算CSV
```

### 系统管理

```
GET    /api/v1/rules                # 业务规则说明
GET    /api/v1/audit-logs           # 审计日志
GET    /api/v1/health               # 健康检查
```

## 业务规则

### 缺图拦截

- **触发条件**: 任务验收时照片数量少于要求数量（默认5张）
- **处理逻辑**: 不允许通过验收，必须补拍
- **扣款规则**: 每张缺图扣款20元，最多扣款100元

### 超时扣分

- **触发条件**: 任务提交时间晚于截止时间
- **扣款规则**: 每超时1小时扣款10元，最多扣款50元
- **注意事项**: 超时不阻塞验收，但会影响最终结算

### 返工影响

- **触发条件**: 任务被要求返工
- **扣款规则**: 每次返工扣款30元，返工超时每小时额外扣款5元（最多25元）
- **结算影响**: 返工次数计入保洁员绩效统计

## 权限矩阵

| 功能 | 管理员 | 运营经理 | 操作员 | 保洁员 | 财务 |
|------|--------|----------|--------|--------|------|
| 创建订单 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 派单 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 验收任务 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 创建返工 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 创建扣款 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 确认扣款 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 生成结算 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 确认结算 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 标记支付 | ✅ | ❌ | ❌ | ❌ | ✅ |
| 查看金额 | ✅ | ✅ | ✅ | 脱敏 | ✅ |
| 审计日志 | ✅ | ✅ | ❌ | ❌ | ✅ |

## 运行测试

```bash
npm test
```

测试覆盖：
- ✅ 幂等性测试（派单、返工、扣款）
- ✅ 业务规则测试（缺图、超时、返工）
- ✅ 数据脱敏测试
- ✅ 完整结算流程测试

## 项目结构

```
src/
├── api/                    # API层
│   └── server.ts          # Express服务器
├── models/                 # 数据模型
│   ├── database.ts        # 数据库初始化
│   ├── OrderModel.ts      # 订单模型
│   ├── CleaningTaskModel.ts # 任务模型
│   ├── PhotoModel.ts      # 照片模型
│   ├── ReworkModel.ts     # 返工模型
│   ├── DeductionModel.ts  # 扣款模型
│   ├── SettlementModel.ts # 结算模型
│   ├── ComplaintModel.ts  # 客诉模型
│   └── UserModel.ts       # 用户模型
├── services/              # 业务服务
│   ├── TaskService.ts     # 任务服务
│   ├── ReworkService.ts   # 返工服务
│   ├── DeductionService.ts # 扣款服务
│   └── SettlementService.ts # 结算服务
├── rules/                 # 业务规则
│   ├── PhotoValidationRule.ts # 缺图校验
│   ├── OvertimeValidationRule.ts # 超时校验
│   ├── ReworkValidationRule.ts # 返工校验
│   └── ValidationEngine.ts # 规则引擎
├── utils/                 # 工具
│   ├── DataMaskingService.ts # 数据脱敏
│   └── PermissionService.ts # 权限控制
├── reports/               # 报告
│   └── ReportGenerator.ts # 报告生成
├── types/                 # 类型定义
│   └── index.ts
├── cli.ts                 # CLI工具
└── index.ts               # 服务入口
```

## 数据库路径

默认数据库文件位于 `data/homestay.db`

可以通过环境变量 `DB_PATH` 修改：
```bash
DB_PATH=/custom/path/my.db npm start
```

## 生产部署

1. 修改默认密码
2. 使用Nginx反向代理
3. 配置HTTPS
4. 定期备份数据库文件
5. 配置日志轮转

## License

MIT
