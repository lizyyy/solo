# 二手车整备重试补偿队列 API

## 项目概述

针对二手车整备业务中外部回执晚到、同一辆车多次返厂后利润和责任人追溯困难的问题，本系统提供完整的重试补偿队列解决方案。

### 核心特性

- **完整证据链**: 保留来源文件、原始行号、原始数据和标准解析值，改判不覆盖原始证据
- **智能重试**: 支持限次重试、指数退避、失败分类（可重试/待人工/永久失败）
- **状态追踪**: 所有状态变化记录时间、操作者和原因
- **人工接管**: 支持人工处理、补偿入账、关闭流程
- **服务恢复**: 重启后自动恢复未完成任务，断点续跑
- **重点统计**: 可重试分类、死信原因、恢复状态，而非简单汇总

## 快速开始

### 环境要求

- Go 1.21+
- SQLite（内置，无需额外安装）

### 启动服务

```bash
# macOS/Linux
chmod +x start.sh
./start.sh

# Windows
start.bat

# 或直接运行
go run main.go
```

服务启动后访问: `http://localhost:8080`

### 运行测试

```bash
chmod +x test_api.sh
./test_api.sh
```

## API 接口

### 基础路径

`http://localhost:8080/api/v1`

---

### 1. 回执管理

#### 1.1 提交回执

**POST** `/receipts`

提交外部回执，自动加入处理队列。

**请求体:**
```json
{
  "car_vin": "LSVNV2182E2100001",
  "car_plate": "京A12345",
  "source": "inspection",
  "source_file": "inspection_202401.xlsx",
  "source_line": 5,
  "raw_data": "{\"item\":\"刹车片磨损\",\"cost\":1500}",
  "standard_data": "{\"category\":\"刹车系统\"}",
  "amount": 1500.00,
  "responsible_person": "张工",
  "operator": "admin"
}
```

**字段说明:**
- `source`: 来源类型 `inspection`(检测单) | `repair_quote`(维修报价) | `photo_list`(照片清单) | `supplier_statement`(供应商对账单)
- `raw_data`: 原始数据（不可修改）
- `standard_data`: 解析后的标准值（可修改，修改留痕）

**响应:**
```json
{
  "id": 1,
  "receipt_no": "INSP-20240120-abc12345",
  "status": "queued"
}
```

#### 1.2 查询回执详情

**GET** `/receipts/{id}`

获取回执详情，包含完整的状态历史和重试记录。

**响应:**
```json
{
  "id": 1,
  "receipt_no": "INSP-20240120-abc12345",
  "current_status": "closed",
  "status_history": [
    {
      "from_status": "",
      "to_status": "submitted",
      "operator": "admin",
      "reason": "回执提交",
      "change_time": "2024-01-20T10:00:00Z"
    }
  ],
  "retry_tasks": []
}
```

#### 1.3 按回执号查询

**GET** `/receipts/no/{receiptNo}`

#### 1.4 回执列表

**GET** `/receipts?status={status}&car_vin={vin}&page=1&page_size=20`

**查询参数:**
- `status`: 筛选状态
- `car_vin`: 按车架号筛选（查看同一辆车的所有记录）
- `page`, `page_size`: 分页

#### 1.5 获取原始证据链

**GET** `/receipts/{id}/evidence`

查看回执的原始数据、来源文件、行号等不可篡改的证据信息。

#### 1.6 修改标准数据

**PUT** `/receipts/{id}/standard-data`

修改解析后的标准数据，原始数据保留，修改留痕。

**请求体:**
```json
{
  "operator": "manager",
  "standard_data": "{\"category\":\"修正后的分类\"}",
  "reason": "分类错误，经核对原始凭证修正"
}
```

---

### 2. 人工处理

#### 2.1 人工处理回执

**POST** `/receipts/{id}/manual`

处理等待人工介入或死信状态的回执。

**请求体:**
```json
{
  "operator": "manager",
  "result": "success",
  "reason": "数据格式已修复",
  "additional_info": "凭证号: P202401001"
}
```

**result 取值:**
- `success`: 处理成功 → 关闭
- `retry`: 重新排队 → 重置重试次数
- `failed`: 无法处理 → 死信

---

### 3. 补偿与关闭

#### 3.1 补偿入账

**POST** `/receipts/{id}/compensate`

记录补偿操作。

**请求体:**
```json
{
  "operator": "finance",
  "amount": 1500.00,
  "reason": "多次返厂补偿",
  "account_no": "ACC-2024-001",
  "voucher_no": "V-202401001"
}
```

#### 3.2 关闭回执

**POST** `/receipts/{id}/close`

**请求体:**
```json
{
  "operator": "manager",
  "reason": "案件处理完毕，无争议"
}
```

---

### 4. 统计分析（收车负责人关注）

#### 4.1 可重试分类统计

**GET** `/stats/retry-categories`

按状态分类统计待处理回执。

**响应:**
```json
{
  "retry_categories": [
    { "category": "retry_wait", "count": 5, "total_amount": 8500 },
    { "category": "manual_wait", "count": 3, "total_amount": 4200 },
    { "category": "dead_letter", "count": 2, "total_amount": 1800 }
  ],
  "note": "按可重试分类统计，包含: retry_wait(待重试)、manual_wait(待人工)、dead_letter(死信)"
}
```

#### 4.2 死信原因统计

**GET** `/stats/dead-letters`

按失败原因统计死信，便于针对性处理。

**响应:**
```json
{
  "dead_letter_reasons": [
    { "reason": "数据格式无法解析", "count": 3, "total_amount": 5000 },
    { "reason": "供应商对账差异", "count": 2, "total_amount": 3500 }
  ]
}
```

---

### 5. 数据导入

#### 5.1 CSV导入

**POST** `/imports/csv`

批量导入CSV文件，保留原始行号。

**请求体:**
```json
{
  "file_path": "/path/to/inspection.csv",
  "source": "inspection",
  "operator": "admin"
}
```

#### 5.2 导入历史

**GET** `/imports`

---

### 6. 队列管理

#### 6.1 手动触发处理

**POST** `/queue/trigger`

立即触发一次队列处理。

#### 6.2 恢复未完成任务

**POST** `/queue/recover`

服务重启后调用，恢复中断的任务。

---

### 7. 健康检查

**GET** `/health`

---

## 状态流转

```
submitted (已提交)
    ↓
queued (已排队)
    ↓
processing (处理中)
    ├─→ 成功 → closed (已关闭)
    │
    └─→ 失败 ┬─→ retry_wait (待重试) ──┐
            ├─→ manual_wait (待人工)  │
            └─→ dead_letter (死信)    │
                  ↑                    │
                  └── 人工重试 ────────┘

manual_wait / dead_letter
    ├─→ 人工处理成功 → compensated (已补偿) → closed
    ├─→ 人工重试 → queued
    └─→ 人工判定 → closed
```

## 失败分类

| 类型 | 说明 | 处理方式 |
|------|------|----------|
| `retryable` | 临时性错误（网络超时、服务忙） | 自动重试，指数退避 |
| `manual_required` | 需要人工介入（数据格式、对账差异） | 转入人工处理队列 |
| `permanent` | 永久失败（无效数据、业务规则不通过） | 转入死信队列 |

## 验收测试场景

### 场景一：正常链路

1. 提交回执 → 状态 `submitted` → `queued`
2. 队列自动处理 → `processing` → 成功 → `closed`
3. 查看状态历史，验证每步都有操作者和原因

### 场景二：重复提交与坏数据

1. 同一VIN多次提交不同来源回执 → 可通过 `?car_vin=` 聚合查看
2. 提交缺少必填字段的坏数据 → 返回400错误
3. 提交格式错误数据 → 转入 `manual_wait` 待人工处理

### 场景三：服务重启与恢复

1. 处理过程中断服务
2. 重启服务，调用 `/queue/recover`
3. 验证未完成任务恢复到可处理状态
4. 触发处理，验证断点续跑

### 场景四：人工处理与补偿

1. 回执进入 `manual_wait` 或 `dead_letter`
2. 人工处理：成功/重试/失败
3. 补偿入账，记录金额和凭证
4. 关闭案件，查看完整审计轨迹

## 项目结构

```
.
├── main.go              # 程序入口
├── config/              # 配置
├── database/            # 数据库连接
├── models/              # 数据模型
├── services/            # 业务逻辑
│   ├── receipt_service.go   # 回执服务
│   ├── queue_service.go     # 队列调度
│   └── import_service.go    # 导入服务
├── handlers/            # API处理器
├── routes/              # 路由
├── test_data/           # 测试数据
├── start.sh / start.bat # 启动脚本
└── test_api.sh          # API测试脚本
```
