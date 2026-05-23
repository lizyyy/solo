# 租赁设备押金 API

摄影器材租赁店押金管理后端 API 服务，提供押金冻结、损坏扣款、逾期续租等审计流程。

## ⚡ 极速体验（零依赖，推荐）

**无需 npm install，直接运行！** 使用 Node.js 内置模块，100% 兼容原有功能。

```bash
cd /Users/mac/pro/solo/workspaces/xy10913

# 一键完整自检（自动启动服务 + 运行所有测试）
npm run quick-test
# 或
node test/self-test-standalone.js

# 一键启动服务
npm run quick-start
# 或
node src/standalone.js
```

✅ **零依赖版本特性：**
- 无需安装任何 npm 包
- 本地 JSON 文件持久化（data/standalone-db.json）
- 完整功能：押金冻结/损坏扣款/续租幂等/结算导出
- 完全兼容原版 API 接口

---

## ✅ 快速开始（完整版）

如果需要 SQLite 持久化版本：

```bash
# 自动安装依赖 + 启动服务
npm start

# 自动安装依赖 + 完整自检
npm test
```

## 🧪 自检覆盖范围

所有版本均验证以下押金审计流程：

| 测试场景 | 验证内容 |
|---------|---------|
| **正常流程** | 创建设备→创建租赁→冻结押金→续租→损坏扣款→结算 |
| **幂等性验证** | 相同 request_id 重复请求不产生新流水 |
| **损坏扣款审计** | remaining_deposit 更新 + damage_deduction 流水生成 |
| **异常处理** | 脏数据/无效ID 的错误处理和 exception_logs 留痕 |
| **导出一致性** | CSV 导出内容和条数验证 |

## 🔧 完整命令说明

| 命令 | 说明 | 依赖要求 |
|------|------|---------|
| `npm run quick-test` | ⭐ 零依赖一键自检 | 无需安装 |
| `npm run quick-start` | ⭐ 零依赖启动服务 | 无需安装 |
| `npm test` | 完整版自检（自动装依赖） | 首次需联网 |
| `npm start` | 完整版启动服务（自动装依赖） | 首次需联网 |
| `npm run start-direct` | 直接启动 SQLite 版 | 已安装依赖 |
| `npm run test-direct` | 直接运行 SQLite 版测试 | 已安装依赖 |
| `npm run init-data` | 初始化样例设备数据 | 已安装依赖 |

## 📋 功能特性

- ✅ **押金冻结** - 创建租赁单后自动冻结设备押金
- ✅ **逾期计费** - 按日租金 1.5 倍计算逾期费用
- ✅ **损坏扣款** - 从押金中扣除损坏赔偿金额
- ✅ **续租幂等** - 相同 request_id 重复请求不重复处理
- ✅ **结算导出** - 结算报告 CSV 导出
- ✅ **异常审计** - 所有异常路径保存原始输入和处理结论
- ✅ **人工修正** - 支持手动调整押金余额

## 🚀 API 接口

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/equipment | 添加设备 |
| GET | /api/equipment | 获取设备列表 |
| POST | /api/rentals | 创建租赁单 |
| GET | /api/rentals | 获取租赁单列表 |
| GET | /api/rentals/:id | 获取租赁单详情（含流水、损坏、续租、结算） |
| POST | /api/rentals/:id/freeze-deposit | 押金冻结（幂等） |
| POST | /api/rentals/:id/renew | 续租申请（幂等） |
| POST | /api/rentals/:id/damage | 损坏上报扣款 |
| POST | /api/rentals/:id/settle | 结算完成 |
| POST | /api/rentals/:id/manual-correction | 人工修正押金 |
| GET | /api/settlements | 获取结算列表 |
| GET | /api/settlements/export | 导出结算 CSV |
| GET | /api/exceptions | 获取异常审计日志 |
| GET | /health | 健康检查 |

## 🧪 自检覆盖范围

`npm test` 自动验证以下场景：

1. **正常流程**：创建设备 → 创建租赁 → 冻结押金 → 续租 → 报损 → 结算
2. **幂等性测试**：重复押金冻结、重复续租申请不产生副作用
3. **异常处理**：无效设备 ID、无效租赁单 ID 的错误处理和日志记录
4. **导出一致性**：CSV 导出内容和条数与数据库一致
5. **查询功能**：租赁单详情、列表、设备列表等查询接口

## 📊 数据模型

- **equipment** - 设备库（设备编号、名称、日租金、押金金额）
- **rentals** - 租赁单（租赁单号、客户、起止日期、押金余额、状态）
- **deposit_transactions** - 押金流水（冻结、扣款、退款、人工调整）
- **damages** - 损坏项（类型、描述、扣款金额）
- **renewals** - 续租记录（续租天数、费用、幂等 request_id）
- **settlements** - 结算报告（各项费用明细、退款金额）
- **exception_logs** - 异常审计（原始输入、错误信息、处理结果）

## 🔧 命令速查

```bash
npm run setup     # 安装依赖 + 初始化样例数据
npm start         # 启动 API 服务
npm test          # 运行完整自检（自动启动服务）
npm run verify    # 同 npm test
npm run init-data # 仅初始化样例设备数据
npm run demo      # 初始化数据 + 启动服务
```

## 🌐 访问地址

- 服务地址：http://localhost:3000
- 健康检查：http://localhost:3000/health
- API 根路径：http://localhost:3000/api

## 💡 使用示例

```bash
# 1. 启动服务
npm start

# 2. 新增设备
curl -X POST http://localhost:3000/api/equipment \
  -H "Content-Type: application/json" \
  -d '{"name":"Canon R5","category":"相机","daily_rate":200,"deposit_amount":5000}'

# 3. 创建租赁单
curl -X POST http://localhost:3000/api/rentals \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C001",
    "customer_name": "张三",
    "equipment_id": "[设备ID]",
    "start_date": "2024-01-01 10:00:00",
    "end_date": "2024-01-04 10:00:00",
    "created_by": "admin"
  }'

# 4. 冻结押金
curl -X POST http://localhost:3000/api/rentals/[租赁ID]/freeze-deposit \
  -H "Content-Type: application/json" \
  -d '{"request_id":"FREEZE001","operator":"admin"}'
```
