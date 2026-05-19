# 高校实验室试剂管理系统

## 项目概述

这是一个面向高校实验室的试剂管理后端系统，专注于试剂申领、审批、出库、归还、盘点等核心业务流程，确保试剂管理的可追溯性和安全性。

## 核心功能

### 1. 申领管理
- 学生/老师创建试剂申领单
- 支持危化品等级自动识别
- 申领数量限制校验
- 申领单提交、审批、驳回流程

### 2. 审批管理
- 多级审批流程
- 按危险等级分配审批权限
- 审批记录完整留存
- 支持单项审批

### 3. 库存管理
- 入库、出库、归还记录
- 库存状态实时更新
- 库存预警阈值设置
- 批次管理与有效期跟踪

### 4. 盘点管理
- 创建盘点单
- 盘点过程记录
- 账实差异分析
- 盘点结果留存

### 5. 数据导入
- 支持 JSON 格式导入试剂信息
- 支持 JSON 格式导入库存
- 支持 CSV 格式导入申领单
- **坏数据记录**: 保留原始位置、失败原因、修改建议

### 6. 审计日志
- 所有操作完整记录
- 操作人、时间、内容全跟踪
- 敏感字段脱敏处理
- 支持历史查询

## 技术特性

### 本地持久化
- 使用 SQLite 数据库
- 数据文件位于 `data/lab-reagent.db`
- 重启服务数据不丢失

### 错误分支处理
- 输入参数校验
- 业务逻辑前置检查
- 异常情况友好提示
- 数据库事务保证

### 敏感字段脱敏
- 手机号、邮箱自动脱敏
- API 返回层脱敏
- 日志输出脱敏
- 审计日志脱敏

### 角色权限
- **admin**: 系统管理员，最高权限
- **teacher**: 教师，审批权限
- **student**: 学生，申领权限
- **lab_manager**: 实验室管理员，出库权限

## 项目结构

```
xy11233/
├── src/
│   ├── app.js                    # 主入口文件
│   ├── config/
│   │   ├── database.js           # 数据库配置
│   │   └── logger.js             # 日志配置
│   ├── models/                   # 数据模型
│   │   ├── index.js
│   │   ├── User.js               # 用户
│   │   ├── Reagent.js            # 试剂
│   │   ├── Inventory.js          # 库存
│   │   ├── Requisition.js        # 申领单
│   │   ├── RequisitionItem.js    # 申领单项
│   │   ├── ApprovalRecord.js     # 审批记录
│   │   ├── OutboundRecord.js     # 出库记录
│   │   ├── ReturnRecord.js       # 归还记录
│   │   ├── InventoryCheck.js     # 盘点单
│   │   ├── InventoryCheckItem.js # 盘点项
│   │   ├── ImportRecord.js       # 导入记录
│   │   ├── ImportError.js        # 导入错误记录
│   │   └── AuditLog.js           # 审计日志
│   ├── routes/                   # API路由
│   │   ├── requisitions.js
│   │   ├── outbound.js
│   │   ├── returns.js
│   │   ├── inventoryCheck.js
│   │   ├── import.js
│   │   └── audit.js
│   ├── middleware/               # 中间件
│   │   └── audit.js
│   └── services/                 # 业务服务
│       ├── requisitionService.js
│       ├── outboundService.js
│       ├── returnService.js
│       ├── inventoryCheckService.js
│       └── importService.js
├── sample_data/                  # 示例数据文件
│   ├── reagents_sample.json
│   ├── inventory_sample.json
│   └── requisitions_sample.csv
├── tests/                        # 测试脚本
│   └── test_flow.js
├── data/                         # 数据库文件(运行时生成)
├── logs/                         # 日志文件(运行时生成)
├── uploads/                      # 上传文件(运行时生成)
├── package.json
└── README.md
```

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/requisitions | 创建申领单 |
| POST | /api/requisitions/:id/submit | 提交申领单 |
| POST | /api/requisitions/:id/approve | 审批申领单 |
| POST | /api/requisitions/:id/reject | 驳回申领单 |
| GET | /api/requisitions/:id | 查询申领单详情 |
| GET | /api/requisitions | 查询申领单列表 |
| POST | /api/outbound | 试剂出库 |
| GET | /api/outbound | 查询出库记录 |
| GET | /api/outbound/available/:reagentId | 查询可用库存 |
| POST | /api/returns | 试剂归还 |
| GET | /api/returns | 查询归还记录 |
| GET | /api/returns/returnable/:requisitionId | 查询可归还项 |
| POST | /api/inventory-check | 创建盘点单 |
| POST | /api/inventory-check/:id/start | 开始盘点 |
| POST | /api/inventory-check/item | 更新盘点项 |
| POST | /api/inventory-check/:id/complete | 完成盘点 |
| GET | /api/inventory-check/:id | 查询盘点单详情 |
| GET | /api/inventory-check | 查询盘点单列表 |
| POST | /api/import/reagents | 导入试剂数据 |
| POST | /api/import/inventory | 导入库存数据 |
| POST | /api/import/requisitions | 导入申领单数据 |
| GET | /api/import/errors/:importId | 查询导入错误 |
| GET | /api/import | 查询导入记录 |
| GET | /api/audit | 查询审计日志 |
| GET | /api/audit/:id | 查询审计日志详情 |

## 快速开始

### 安装依赖

```bash
cd /Users/mac/pro/solo/workspaces/xy11233
npm install
```

### 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

### 运行测试

```bash
# 先启动服务，然后在另一个终端运行:
npm test
```

测试脚本将完整演练:
1. 创建申领单
2. 提交申领单
3. 审批申领单
4. 试剂出库
5. 试剂归还
6. 库存盘点
7. 审计日志查询

## 数据模型

### 危险等级 (Hazard Levels)

- **level_1**: 高危化学品，需严格审批
- **level_2**: 中等危险
- **level_3**: 一般危险
- **level_4**: 普通试剂，无需特殊审批

### 申领单状态

- **draft**: 草稿
- **pending**: 待审批
- **approved**: 已审批
- **rejected**: 已驳回
- **partial_issued**: 部分出库
- **fully_issued**: 全部出库
- **partial_returned**: 部分归还
- **fully_returned**: 全部归还
- **cancelled**: 已取消

### 库存状态

- **normal**: 正常
- **low_stock**: 库存不足
- **out_of_stock**: 已售罄
- **expired**: 已过期
- **damaged**: 已损坏

## 数据导入说明

### 导入试剂数据 (JSON)

```json
[{
  "reagent_code": "R001",
  "name": "浓硫酸",
  "hazard_level": "level_1",
  "unit": "瓶",
  "is_hazardous": true,
  "approval_required": true
}]
```

### 导入库存数据 (JSON)

```json
[{
  "reagent_code": "R001",
  "batch_no": "B2024001",
  "quantity": 10,
  "location": "A-01-01"
}]
```

### 导入申领单数据 (CSV)

```csv
requisition_no,applicant_name,department,purpose,reagent_code,quantity,unit
,李同学,化学系,实验课程,R004,2,瓶
```

### 导入错误处理

- 错误记录存储在 `import_errors` 表
- 包含: 行号、字段名、错误原因、修改建议
- 保留原始数据便于修复

## 安全特性

1. **敏感字段脱敏**: 手机号、邮箱在返回和日志中自动脱敏
2. **操作审计**: 所有修改操作完整记录
3. **危化品管控**: 高危试剂需要特殊审批
4. **数量限制**: 单次申领数量上限控制

## 故障排查

### 数据库文件位置
```
data/lab-reagent.db
```

### 日志文件位置
```
logs/combined.log  # 常规日志
logs/error.log     # 错误日志
```

### 常见问题

1. **端口被占用**: 修改 `src/app.js` 中的 PORT 变量
2. **数据库锁死**: 删除 `data/lab-reagent.db` 后重启服务
3. **导入失败**: 查看 `import_errors` 表获取详细错误信息

## 注意事项

1. 本系统为后端 API 服务，无前端界面
2. 所有接口返回格式为 JSON
3. 操作人信息通过请求参数传递，暂未集成登录系统
4. 重启服务后，所有历史数据保留可查

## License

MIT
