# 笼位健康事件仲裁器

## 项目简介

**笼位健康事件仲裁器** 是专为高校实验动物房设计的本地后端 API 服务，用于统一管理实验动物的笼位状态、健康事件和合规校验。

### 核心解决的问题

值班员每天需要处理四类数据导入，最怕出现以下问题：

1. **重复转笼**：同一只动物被多次转笼，导致轨迹混乱
2. **温湿度超限未闭环**：传感器告警没人处理
3. **处置单缺签**：兽医处置单未签署就执行
4. **观察期超时**：用药后观察窗口漏掉

## 技术架构

- **框架**: Node.js + Express.js
- **数据库**: SQLite (本地持久化)
- **数据处理**: csv-parser, json2csv
- **日期处理**: date-fns
- **测试框架**: Jest + Supertest

## 项目结构

```
xy4331/
├── src/
│   ├── config/
│   │   ├── database.js          # 数据库配置
│   │   └── initDB.js            # 表初始化
│   ├── models/
│   │   ├── Animal.js            # 动物数据模型
│   │   ├── Cage.js              # 笼位数据模型
│   │   ├── SensorAlert.js       # 传感器告警模型
│   │   ├── TransferRecord.js    # 转笼记录模型
│   │   ├── VeterinaryOrder.js   # 兽医处置单模型
│   │   ├── CareInspection.js    # 巡检记录模型
│   │   └── ValidationViolation.js # 违规记录模型
│   ├── parsers/
│   │   ├── JsonParser.js        # JSON数据解析器
│   │   └── CsvParser.js         # CSV数据解析器
│   ├── rules/
│   │   └── RuleEngine.js        # 规则引擎
│   ├── exporters/
│   │   ├── MarkdownExporter.js  # Markdown报告导出
│   │   ├── CsvExporter.js       # CSV数据导出
│   │   └── JsonAuditExporter.js # JSON审计包导出
│   ├── routes/
│   │   ├── importRoutes.js      # 数据导入接口
│   │   ├── queryRoutes.js       # 数据查询接口
│   │   ├── reviewRoutes.js      # 复核状态管理接口
│   │   └── exportRoutes.js      # 数据导出接口
│   └── server.js                 # 主服务入口
├── examples/
│   ├── animals.json              # 示例动物数据
│   ├── cages.json                # 示例笼位数据
│   ├── sensor_alerts.json        # 示例传感器告警
│   ├── transfer_records.csv      # 示例转笼记录
│   ├── veterinary_orders.json    # 示例兽医处置单
│   └── care_inspections.json     # 示例巡检记录
├── tests/
│   ├── test.config.js            # 测试配置
│   └── api.test.js               # API测试用例
├── data/                         # 数据库目录
├── uploads/                      # 上传文件目录
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

或者开发模式（自动重启）：

```bash
npm run dev
```

服务启动后访问：http://localhost:3000

### 3. 运行测试

```bash
npm test
```

## 核心功能

### 一、数据导入 (四类数据)

#### 1. 笼位数据导入
```bash
curl -X POST http://localhost:3000/api/import/cages \
  -H "Content-Type: application/json" \
  -d @examples/cages.json
```

#### 2. 动物数据导入
```bash
curl -X POST http://localhost:3000/api/import/animals \
  -H "Content-Type: application/json" \
  -d @examples/animals.json
```

#### 3. 传感器告警导入
```bash
curl -X POST http://localhost:3000/api/import/sensor-alerts \
  -H "Content-Type: application/json" \
  -d @examples/sensor_alerts.json
```

#### 4. 转笼记录导入 (CSV)
```bash
curl -X POST http://localhost:3000/api/import/transfer-records \
  -F "file=@examples/transfer_records.csv"
```

#### 5. 兽医处置单导入
```bash
curl -X POST http://localhost:3000/api/import/veterinary-orders \
  -H "Content-Type: application/json" \
  -d @examples/veterinary_orders.json
```

#### 6. 饲养员巡检记录导入
```bash
curl -X POST http://localhost:3000/api/import/care-inspections \
  -H "Content-Type: application/json" \
  -d @examples/care_inspections.json
```

### 二、规则校验 (六大核心规则)

#### 运行所有校验规则
```bash
curl -X POST http://localhost:3000/api/query/rules/run-all
```

#### 校验规则说明

| 规则名称 | 检测内容 | 示例触发场景 |
|---------|---------|-------------|
| 笼位占用冲突 | 同一只动物同时占用多个笼位 | 转笼记录中 from_cage 与实际占用不符 |
| 未闭环告警 | 状态为 open/acknowledged 的传感器告警 | 温湿度超限后未处理 |
| 处置单缺签 | veterinarian_signature 为空的处置单 | VO-2024-002 未签署 |
| 观察期超时 | 观察期已过但状态仍为 observing | VO-2024-003 观察14天 |
| 重复转笼 | 同一天同一只动物有多个转笼记录 | TRANS-006 和 TRANS-007 |
| 笼位容量过载 | 实际占用超过 max_capacity | 笼位容量已满时继续迁入 |

### 三、数据查询

#### 仪表板汇总
```bash
curl http://localhost:3000/api/query/dashboard
```

#### 查询待处理违规
```bash
curl http://localhost:3000/api/query/violations/open
```

#### 查询未闭环告警
```bash
curl http://localhost:3000/api/query/alerts/open
```

#### 查询待签署处置单
```bash
curl http://localhost:3000/api/query/veterinary-orders/unsigned
```

#### 查询观察中处置单
```bash
curl http://localhost:3000/api/query/veterinary-orders/observing
```

#### 查询动物详情
```bash
curl http://localhost:3000/api/query/animals/M-2024-001
```

### 四、复核与状态管理

#### 复核违规记录
```bash
curl -X POST http://localhost:3000/api/review/violations/{violationId}/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "值班员A",
    "decision": "accept",
    "comments": "确认违规，已通知相关人员",
    "action_items": "立即处理"
  }'
```

#### 确认告警
```bash
curl -X POST http://localhost:3000/api/review/alerts/{alertId}/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"acknowledgedBy": "值班员A"}'
```

#### 解决告警
```bash
curl -X POST http://localhost:3000/api/review/alerts/{alertId}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolutionNotes": "已调整空调温度至24℃",
    "resolvedBy": "值班员A"
  }'
```

#### 签署处置单
```bash
curl -X POST http://localhost:3000/api/review/veterinary-orders/{orderId}/sign \
  -H "Content-Type: application/json" \
  -d '{
    "veterinarianSignature": "李兽医",
    "signatureDate": "2024-12-18"
  }'
```

#### 开始观察期
```bash
curl -X POST http://localhost:3000/api/review/veterinary-orders/{orderId}/start-observation \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2024-12-18"}'
```

#### 完成观察期
```bash
curl -X POST http://localhost:3000/api/review/veterinary-orders/{orderId}/complete-observation \
  -H "Content-Type: application/json" \
  -d '{"notes": "观察期结束，动物恢复正常"}'
```

#### 执行转笼
```bash
curl -X POST http://localhost:3000/api/review/transfers/{transferId}/execute \
  -H "Content-Type: application/json" \
  -d '{"verifiedBy": "值班员A"}'
```

### 五、数据导出

#### 导出 Markdown 复盘报告
```bash
curl -o review_report.md http://localhost:3000/api/export/markdown/review
```

#### 导出 CSV 风险清单
```bash
curl -o risk_list.csv http://localhost:3000/api/export/csv/risk-list
```

#### 导出告警 CSV
```bash
curl -o alerts.csv http://localhost:3000/api/export/csv/alerts
```

#### 导出转笼记录 CSV
```bash
curl -o transfers.csv http://localhost:3000/api/export/csv/transfers
```

#### 导出处置单 CSV
```bash
curl -o veterinary_orders.csv http://localhost:3000/api/export/csv/veterinary-orders
```

#### 导出 JSON 审计包
```bash
curl -o audit_package.json http://localhost:3000/api/export/json/audit-package
```

#### 导出单动物审计记录
```bash
curl -o animal_M-2024-001_audit.json http://localhost:3000/api/export/json/animal-audit/M-2024-001
```

## 验证流程

### 快速验证脚本

创建验证脚本 `validate.sh`：

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 步骤 1: 检查服务状态 ==="
curl -s "$BASE_URL/health" | python3 -m json.tool

echo ""
echo "=== 步骤 2: 导入基础数据 ==="
echo "导入笼位数据..."
curl -s -X POST "$BASE_URL/api/import/cages" \
  -H "Content-Type: application/json" \
  -d @examples/cages.json | python3 -m json.tool

echo ""
echo "导入动物数据..."
curl -s -X POST "$BASE_URL/api/import/animals" \
  -H "Content-Type: application/json" \
  -d @examples/animals.json | python3 -m json.tool

echo ""
echo "=== 步骤 3: 导入业务数据 ==="
echo "导入传感器告警..."
curl -s -X POST "$BASE_URL/api/import/sensor-alerts" \
  -H "Content-Type: application/json" \
  -d @examples/sensor_alerts.json | python3 -m json.tool

echo ""
echo "导入兽医处置单..."
curl -s -X POST "$BASE_URL/api/import/veterinary-orders" \
  -H "Content-Type: application/json" \
  -d @examples/veterinary_orders.json | python3 -m json.tool

echo ""
echo "导入巡检记录..."
curl -s -X POST "$BASE_URL/api/import/care-inspections" \
  -H "Content-Type: application/json" \
  -d @examples/care_inspections.json | python3 -m json.tool

echo ""
echo "导入转笼记录..."
curl -s -X POST "$BASE_URL/api/import/transfer-records" \
  -F "file=@examples/transfer_records.csv" | python3 -m json.tool

echo ""
echo "=== 步骤 4: 运行规则校验 ==="
curl -s -X POST "$BASE_URL/api/query/rules/run-all" | python3 -m json.tool

echo ""
echo "=== 步骤 5: 查询仪表板 ==="
curl -s "$BASE_URL/api/query/dashboard" | python3 -m json.tool

echo ""
echo "=== 步骤 6: 导出复盘报告 ==="
curl -s -o output/review_report.md "$BASE_URL/api/export/markdown/review"
echo "复盘报告已保存到 output/review_report.md"

curl -s -o output/risk_list.csv "$BASE_URL/api/export/csv/risk-list"
echo "风险清单已保存到 output/risk_list.csv"

curl -s -o output/audit_package.json "$BASE_URL/api/export/json/audit-package"
echo "审计包已保存到 output/audit_package.json"

echo ""
echo "=== 验证完成 ==="
```

### 手动验证步骤

1. **启动服务**
   ```bash
   npm start
   ```

2. **访问 API 文档**
   打开浏览器访问 http://localhost:3000/

3. **导入笼位数据**
   ```bash
   curl -X POST http://localhost:3000/api/import/cages \
     -H "Content-Type: application/json" \
     -d '{"cages":[{"cage_id":"TEST-001","rack_id":"RA-01","position":"A1","max_capacity":5}]}'
   ```

4. **导入动物数据**
   ```bash
   curl -X POST http://localhost:3000/api/import/animals \
     -H "Content-Type: application/json" \
     -d '{"animals":[{"animal_id":"TEST-M-001","species":"小鼠","strain":"C57BL/6","gender":"雄性"}]}'
   ```

5. **导入传感器告警（测试未闭环检测）**
   ```bash
   curl -X POST http://localhost:3000/api/import/sensor-alerts \
     -H "Content-Type: application/json" \
     -d '{"alerts":[{"alert_id":"ALERT-TEST-001","cage_id":"TEST-001","sensor_type":"温度","threshold_value":26,"measured_value":29,"alert_time":"2024-12-18T08:00:00","status":"open"}]}'
   ```

6. **运行规则校验**
   ```bash
   curl -X POST http://localhost:3000/api/query/rules/run-all
   ```

7. **查看检测到的违规**
   ```bash
   curl http://localhost:3000/api/query/violations/open
   ```

## API 完整列表

### 导入接口 (`/api/import`)

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/sensor-alerts` | 导入传感器告警 JSON |
| POST | `/transfer-records` | 导入转笼记录 CSV |
| POST | `/veterinary-orders` | 导入兽医处置单 |
| POST | `/care-inspections` | 导入饲养员巡检记录 |
| POST | `/animals` | 导入动物数据 |
| POST | `/cages` | 导入笼位数据 |

### 查询接口 (`/api/query`)

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/animals` | 查询动物列表 |
| GET | `/animals/:animalId` | 查询动物详情 |
| GET | `/cages` | 查询笼位列表 |
| GET | `/alerts` | 查询告警列表 |
| GET | `/alerts/open` | 查询未闭环告警 |
| GET | `/transfers/pending` | 查询待处理转笼 |
| GET | `/veterinary-orders/unsigned` | 查询待签署处置单 |
| GET | `/veterinary-orders/observing` | 查询观察中处置单 |
| GET | `/violations/open` | 查询待处理违规 |
| GET | `/dashboard` | 查询仪表板汇总 |
| POST | `/rules/run-all` | 运行所有校验规则 |

### 复核接口 (`/api/review`)

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/violations/:violationId/review` | 复核违规记录 |
| POST | `/violations/batch-review` | 批量复核违规 |
| POST | `/alerts/:alertId/acknowledge` | 确认告警 |
| POST | `/alerts/:alertId/resolve` | 解决告警 |
| POST | `/transfers/:transferId/execute` | 执行转笼 |
| POST | `/veterinary-orders/:orderId/sign` | 签署处置单 |
| POST | `/veterinary-orders/:orderId/start-observation` | 开始观察期 |
| POST | `/veterinary-orders/:orderId/complete-observation` | 完成观察期 |
| POST | `/animals/:animalId/merge-timeline` | 合并动物时间线 |
| POST | `/resolve-transfer-duplicate` | 解决重复转笼冲突 |

### 导出接口 (`/api/export`)

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/markdown/review` | 下载 Markdown 复盘报告 |
| GET | `/csv/risk-list` | 下载风险清单 CSV |
| GET | `/csv/alerts` | 下载告警 CSV |
| GET | `/csv/transfers` | 下载转笼记录 CSV |
| GET | `/csv/veterinary-orders` | 下载处置单 CSV |
| GET | `/csv/animals` | 下载动物 CSV |
| GET | `/csv/cages` | 下载笼位状态 CSV |
| GET | `/json/audit-package` | 下载 JSON 审计包 |
| GET | `/json/animal-audit/:animalId` | 下载单动物审计记录 |

## 数据库表结构

### 核心表

1. **animals** - 动物信息
2. **cages** - 笼位信息
3. **cage_occupancy** - 笼位占用记录
4. **sensor_alerts** - 传感器告警
5. **transfer_records** - 转笼记录
6. **veterinary_orders** - 兽医处置单
7. **care_inspections** - 巡检记录
8. **animal_timelines** - 动物时间线
9. **validation_violations** - 违规记录
10. **review_decisions** - 复核决策
11. **import_sessions** - 导入会话
12. **audit_logs** - 审计日志

## 注意事项

1. **本地部署**: 这是本地服务，数据存储在本地 SQLite 数据库
2. **数据备份**: 定期备份 `data/database.db` 文件
3. **示例数据**: `examples/` 目录包含测试用的示例数据，包含有意设计的"问题"数据用于测试规则引擎
4. **日志**: 服务启动后会自动记录操作日志

## License

MIT
