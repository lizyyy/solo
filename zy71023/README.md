# 危废回收暂存 API

基于 Spring Boot + H2 数据库的危险废弃物暂存管理后端服务。

## 功能特性

- **提交材料**: 危废记录提交，自动校验类别、暂存桶匹配
- **自动判断**: 类别校验、超期检测、转运单重复使用检查
- **人工处理**: 审核通过/退回、分配暂存桶、确认转运
- **退回补充**: 校验不通过时退回补充材料
- **重新计算**: 超期状态自动/手动重算
- **结果核对**: 记录状态追踪，处置报告导出

## 核心业务规则

1. **类别混装校验**: 同一暂存桶只能存放同一类别危废
2. **超期暂存告警**: 超过90天自动标记超期并产生告警
3. **转运单校验**: 转运单必须签收且未被使用
4. **状态机控制**: 严格的状态流转控制
5. **操作留痕**: 所有状态变更都有操作日志

## 技术栈

- Java 17+
- Spring Boot 3.2.0
- Spring Data JPA
- H2 Database (嵌入式)
- Apache POI (Excel导出)
- Lombok

## 快速开始

### 1. 环境要求

- JDK 17 或更高版本
- Maven 3.6+

### 2. 构建运行

```bash
# 编译项目
mvn clean package

# 运行应用
java -jar target/waste-storage-api-1.0.0.jar
```

### 3. 访问地址

- API 服务: http://localhost:8080
- H2 控制台: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/wastedb`
  - 用户名: `admin`
  - 密码: `admin`

## API 接口

### 危废记录管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/waste-records/submit` | 提交危废记录 |
| POST | `/api/waste-records/review` | 审核记录 |
| POST | `/api/waste-records/resubmit` | 重新提交 |
| POST | `/api/waste-records/assign-bucket` | 分配暂存桶 |
| POST | `/api/waste-records/mark-transfer` | 标记待转运 |
| POST | `/api/waste-records/confirm-transfer` | 确认转运签收 |
| POST | `/api/waste-records/confirm-disposal` | 确认处置 |
| POST | `/api/waste-records/return` | 退回补充 |
| POST | `/api/waste-records/recalculate` | 重新计算状态 |
| GET | `/api/waste-records` | 获取所有记录 |
| GET | `/api/waste-records/{recordNo}` | 获取单条记录 |
| GET | `/api/waste-records/status/{status}` | 按状态查询 |
| GET | `/api/waste-records/check/{recordNo}` | 核对结果 |

### 暂存桶管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/buckets` | 创建暂存桶 |
| GET | `/api/buckets` | 获取所有桶 |
| GET | `/api/buckets/active` | 获取活跃桶 |
| GET | `/api/buckets/category/{category}` | 按类别查询 |
| GET | `/api/buckets/{bucketCode}` | 获取单个桶 |

### 转运单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/transfer-forms` | 创建转运单 |
| GET | `/api/transfer-forms` | 获取所有转运单 |
| GET | `/api/transfer-forms/unused` | 获取未使用转运单 |
| POST | `/api/transfer-forms/{formNo}/sign` | 签收转运单 |

### 告警管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/alerts` | 获取所有告警 |
| GET | `/api/alerts/unhandled` | 获取未处理告警 |
| POST | `/api/alerts/{id}/handle` | 处理告警 |
| POST | `/api/alerts/trigger-check` | 触发超期检查 |

### 报告管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reports/disposal/generate` | 生成处置报告 |
| POST | `/api/reports/disposal/{no}/approve` | 审批报告 |
| GET | `/api/reports/export/waste-records` | 导出危废记录Excel |
| GET | `/api/reports/export/disposal/{no}` | 导出处置报告Excel |

## 状态流转

```
PENDING_SUBMIT (待提交)
    ↓
PENDING_REVIEW (待审核) ←──────────┐
    ↓                               │
REVIEW_PASSED (审核通过)            │
    ↓                               │
STORING (暂存中) → OVERDUE (超期)   │
    ↓              ↓                │
PENDING_TRANSFER (待转运)           │
    ↓                               │
TRANSFERRED (已转运)                │
    ↓                               │
DISPOSED (已处置)                   │
                                    │
RETURNED (已退回) ──────────────────┘
    ↓
REJECTED (已拒绝)
```

## 错误码说明

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| 400 | 400 | 缺少必要材料 |
| 409 | 409 | 当前状态不允许此操作 |
| 409 | 409 | 重复请求 |
| 422 | 422 | 需要人工复核 |
| 400 | 400 | 危废类别不匹配 |
| 409 | 409 | 危废已超期暂存 |
| 409 | 409 | 转运单已被使用 |
| 400 | 400 | 暂存桶类别混装 |
| 400 | 400 | 无效的危废类别 |
| 404 | 404 | 记录不存在 |

## 配置说明

在 `application.yml` 中可配置:

```yaml
waste:
  storage:
    max-storage-days: 90        # 最大暂存天数
    allowed-categories:         # 允许的危废类别
      - HW08
      - HW09
      - HW12
      - HW17
      - HW34
      - HW49
```

## 预置数据

应用首次启动会自动创建:
- 4个预置暂存桶 (BKT-HW08-001 ~ BKT-HW49-001)
- 4个预置转运单 (TF-HW08-2024001 ~ TF-HW49-2024004)

## 使用示例

```bash
# 1. 提交危废记录
curl -X POST http://localhost:8080/api/waste-records/submit \
  -H "Content-Type: application/json" \
  -d '{
    "category": "HW08",
    "wasteName": "废矿物油",
    "weight": 50.5,
    "submitter": "张三"
  }'

# 2. 审核通过
curl -X POST http://localhost:8080/api/waste-records/review \
  -H "Content-Type: application/json" \
  -d '{
    "recordNo": "WF20240524ABC123",
    "reviewer": "李四",
    "passed": true
  }'

# 3. 分配暂存桶
curl -X POST "http://localhost:8080/api/waste-records/assign-bucket?recordNo=WF20240524ABC123&bucketCode=BKT-HW08-001&operator=管理员"

# 4. 导出Excel
curl -O http://localhost:8080/api/reports/export/waste-records
```
