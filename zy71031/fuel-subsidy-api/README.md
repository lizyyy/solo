# 渔船燃油补贴 API

## 项目概述

渔政窗口燃油补贴审核后端服务，用于自动化处理航次校验、油票去重、禁渔期规则检查等审核工作。

## 技术栈

- **Go 1.21+** - 编程语言
- **Gin Web Framework** - HTTP 路由
- **GORM** - ORM 框架
- **SQLite** - 轻量数据库
- **Excelize** - Excel 报表导出

## 核心功能

### 1. 审核流程（状态机）

```
收件(received) → 核验(verified) → 处理(processed) → 复查(review_passed) → 结案(closed)
                                                         ↓
                                                      拒绝(rejected)
```

### 2. 自动校验规则

- **航次禁渔期校验**：自动检测航次是否落在禁渔期（5月1日-8月16日）
- **油票去重**：加油票号全局唯一，已使用的油票不能重复申报
- **船主信息一致性**：申请人姓名/身份证必须与渔船登记信息一致

### 3. 重复提交检测

- 相同渔船+相同年度+已使用的加油票 = 重复提交
- 重复提交时返回：原处理结论、处理人、处理时间、审核日志

### 4. 数据一致性保证

- 统计查询与 Excel 导出使用同一数据源
- 服务重启后历史数据完整保留
- 审核日志不可篡改，完整记录每一步操作

## API 接口

### 基础信息

- 服务地址：`http://localhost:8082`
- 健康检查：`GET /health`

### 申请管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/applications` | 收件：创建补贴申请 |
| GET | `/api/v1/applications` | 查询申请列表 |
| GET | `/api/v1/applications/:id` | 获取申请详情 |
| GET | `/api/v1/applications/:id/logs` | 获取审核日志 |

### 审核流程

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/applications/verify` | 核验：校验材料 |
| POST | `/api/v1/applications/process` | 处理：计算补贴 |
| POST | `/api/v1/applications/review` | 复查：复核结果 |
| POST | `/api/v1/applications/close` | 结案：归档完成 |

### 数据管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/fuel-receipts` | 添加加油票 |
| GET | `/api/v1/fuel-receipts` | 查询加油票 |
| GET | `/api/v1/statistics?year=2025` | 年度统计 |
| GET | `/api/v1/reports/export?year=2025` | 导出 Excel 报告 |

## 快速开始

### 编译运行

```bash
cd fuel-subsidy-api
go build -o fuel-subsidy-api ./cmd/main.go
SERVER_PORT=8082 ./fuel-subsidy-api
```

### 初始化数据

系统启动时自动创建：
- 4个审核人员账号（admin/auditor1/auditor2/reviewer）
- 2艘测试渔船（浙渔00001/浙渔00002）
- 2024-2025年度禁渔期规则

### 测试流程

```bash
# 1. 添加加油票
curl -X POST http://localhost:8082/api/v1/fuel-receipts \
  -H "Content-Type: application/json" \
  -d '{"receipt_number":"RCP001","receipt_date":"2025-03-15T00:00:00Z","gas_station_name":"东海加油站","fuel_type":"柴油","fuel_amount":5000,"unit_price":7.5,"total_amount":37500,"vessel_number":"浙渔00001","driver_name":"张三"}'

# 2. 收件：创建申请
curl -X POST http://localhost:8082/api/v1/applications \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{
    "application_year": 2025,
    "applicant_name": "张三",
    "applicant_id_card": "330101198001010001",
    "vessel_number": "浙渔00001",
    "receipt_numbers": ["RCP001"],
    "voyages": [{"voyage_number": "V001", "departure_date": "2025-03-10T08:00:00Z", "return_date": "2025-03-12T18:00:00Z", "fishing_area": "东海189海区"}]
  }'

# 3. 核验
curl -X POST http://localhost:8082/api/v1/applications/verify \
  -H "Content-Type: application/json" \
  -d '{"application_id": "申请ID", "operator": "auditor1", "passed": true, "reason": "材料齐全"}'

# 4. 处理（计算补贴）
curl -X POST http://localhost:8082/api/v1/applications/process \
  -H "Content-Type: application/json" \
  -d '{"application_id": "申请ID", "operator": "auditor2", "reason": "补贴计算完成"}'

# 5. 复查
curl -X POST http://localhost:8082/api/v1/applications/review \
  -H "Content-Type: application/json" \
  -d '{"application_id": "申请ID", "operator": "reviewer", "passed": true, "reason": "复核通过"}'

# 6. 结案
curl -X POST http://localhost:8082/api/v1/applications/close \
  -H "Content-Type: application/json" \
  -d '{"application_id": "申请ID", "operator": "admin", "reason": "同意结案"}'
```

## 项目结构

```
fuel-subsidy-api/
├── cmd/
│   └── main.go              # 程序入口
├── internal/
│   ├── config/              # 配置
│   ├── dao/                 # 数据库访问层
│   ├── handler/             # API 处理器
│   ├── models/              # 数据模型
│   └── service/             # 业务逻辑层
│       ├── validation_service.go  # 校验逻辑
│       ├── audit_service.go       # 审核状态机
│       └── report_service.go      # 统计导出
├── pkg/utils/               # 工具函数
├── scripts/                 # 测试脚本
├── reports/                 # 导出的报告
└── fuel_subsidy.db          # SQLite 数据库
```

## 数据模型

### 核心实体

- **FishingVessel** - 渔船信息
- **Voyage** - 航次记录
- **FuelReceipt** - 加油票（带使用状态）
- **FishingBanPeriod** - 禁渔期规则
- **SubsidyApplication** - 补贴申请（主流程）
- **AuditLog** - 审核日志（全流程追溯）
- **SubsidyReport** - 补贴报告

## 关键特性

1. **每步可读原因**：所有状态变更都记录原因，审核日志完整可追溯
2. **边界校验**：航次禁渔期、票据去重、信息一致性等边界条件严格校验
3. **幂等性**：重复提交返回原处理结论，避免重复处理
4. **数据一致性**：统计查询和报表导出使用相同计算逻辑，结果完全一致
5. **服务重启不丢数据**：SQLite 持久化存储，历史数据完整保留
