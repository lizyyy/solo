# 汽修连锁对账后端服务

针对汽修连锁场景的对账系统，解决套餐核销、工单执行、库存扣减三方数据不一致的问题。

## 核心功能

1. **数据导入** - 支持套餐CSV、工单JSON、库存CSV批量导入
2. **自动对账** - 自动比对三方数据，识别差异
3. **差异解释** - 针对跨店核销、项目替换、库存异常等场景生成可读说明
4. **人工复核** - 支持放行、退回、需补充材料三种复核结果
5. **重新计算** - 复核改动后自动同步更新所有数字
6. **报告导出** - 支持 Excel 和 PDF 格式报告下载
7. **审计追踪** - 完整记录所有操作，可追溯

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 启动服务
```bash
npm start
# 或开发模式
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 4. 测试对账流程

使用 `sample-data/` 目录下的示例数据测试：

```bash
# 1. 登录获取 token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. 创建对账批次 (使用返回的 token)
curl -X POST http://localhost:3000/api/batches \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年4月对账",
    "storeId": "s001",
    "periodStart": "2024-04-01",
    "periodEnd": "2024-04-30"
  }'

# 3. 导入套餐数据
curl -X POST http://localhost:3000/api/import/packages \
  -H "Authorization: Bearer <token>" \
  -F "file=@sample-data/packages.csv" \
  -F "batchId=<batch_id>" \
  -F "storeId=s001"

# 4. 导入工单数据
curl -X POST http://localhost:3000/api/import/workorders \
  -H "Authorization: Bearer <token>" \
  -F "file=@sample-data/workorders.json" \
  -F "batchId=<batch_id>" \
  -F "storeId=s001"

# 5. 导入库存数据
curl -X POST http://localhost:3000/api/import/inventory \
  -H "Authorization: Bearer <token>" \
  -F "file=@sample-data/inventory.csv" \
  -F "batchId=<batch_id>" \
  -F "storeId=s001"

# 6. 执行对账
curl -X POST http://localhost:3000/api/batches/<batch_id>/run \
  -H "Authorization: Bearer <token>"

# 7. 查看对账结果
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/batches/<batch_id>

# 8. 复核差异记录
curl -X POST http://localhost:3000/api/batches/records/<record_id>/review \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewResult": "approved",
    "reviewComment": "跨店核销属于正常业务，客户已签字确认"
  }'

# 9. 导出 Excel 报告
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/reports/<batch_id>/excel -o report.xlsx

# 10. 完成批次
curl -X POST http://localhost:3000/api/batches/<batch_id>/complete \
  -H "Authorization: Bearer <token>"
```

## 示例数据包含的场景

1. **正常套餐核销** (PKG2024001 + WO20240301001) - 完全匹配
2. **跨店核销** (PKG2024002 在 s001 购买，在 s002 海淀分店使用) - 中等严重程度
3. **项目替换** (PKG2024004 套餐空气滤芯→空调滤芯) - 中等严重程度
4. **价格差异** (WO20240420001 机油单价工单155元 vs 库存149元) - 中等严重程度
5. **库存盘盈/盘亏** - 自动计算理论结存与实际结存差异

## 项目结构

```
├── src/
│   ├── server.js              # 服务入口
│   ├── database/
│   │   ├── init.js            # 数据库初始化脚本
│   │   └── index.js           # 数据库连接封装
│   ├── middleware/
│   │   └── auth.js            # JWT 认证中间件
│   ├── services/
│   │   ├── reconciliationEngine.js  # 对账核心算法
│   │   ├── explanationEngine.js     # 差异解释引擎
│   │   ├── batchService.js          # 批次管理与状态机
│   │   ├── importService.js         # 数据导入服务
│   │   ├── reportService.js         # 报告导出服务
│   │   └── auditService.js          # 审计日志服务
│   └── routes/
│       ├── auth.js            # 认证接口
│       ├── batches.js         # 对账批次接口
│       ├── import.js          # 数据导入接口
│       └── reports.js         # 报告导出接口
├── sample-data/               # 示例测试数据
├── data/                      # SQLite 数据库文件
├── uploads/                   # 上传文件临时目录
├── exports/                   # 导出报告目录
└── package.json
```

## 核心数据表

- `stores` - 门店信息
- `users` - 用户账号
- `packages` - 套餐主表
- `package_items` - 套餐明细
- `work_orders` - 工单主表
- `work_order_items` - 工单明细
- `inventory` - 库存记录
- `reconciliation_batches` - 对账批次
- `reconciliation_records` - 对账记录
- `reconciliation_discrepancies` - 差异明细
- `audit_logs` - 操作审计日志

## 默认账号

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin123 | 系统管理员 | 可管理所有门店 |
| manager_hq | store123 | 店长 | 总部旗舰店 |
| manager_hd | store123 | 店长 | 海淀分店 |

## 技术栈

- Node.js + Express
- SQLite (可无缝迁移到 PostgreSQL/MySQL)
- JWT 认证
- Excel/PDF 导出

## API 文档

详细接口说明请参考 [API_DOCS.md](./API_DOCS.md)
