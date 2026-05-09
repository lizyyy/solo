# 门店试吃样品留样 API

食品门店试吃活动样品留样、批次记录、销毁管理和投诉追溯系统。

## 项目概述

本系统用于管理食品门店试吃活动的完整流程，包括：
- **活动档案**：记录试吃活动信息
- **样品批次**：登记产品生产批次信息
- **留样登记**：活动结束后留样，自动计算销毁时间
- **销毁提醒**：到期留样自动提醒
- **投诉关联**：消费者投诉时关联对应留样
- **追溯报告**：完整的调查追溯链路

## 业务流程

```
活动创建(DRAFT) → 确认计划(PLANNED) → 活动进行(IN_PROGRESS) → 活动完成(COMPLETED)
        ↓                ↓                    ↓                      ↓
    批次登记          批次登记             留样登记               销毁管理
                                                      ↓
                                            [7天后自动到期]
                                                      ↓
                                            销毁提醒 → 销毁处理
                                                      ↓
                                            [若有投诉] → 留样留存调查 → 追溯报告 → 投诉解决
```

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 初始化数据目录和样例数据

```bash
npm run init-data
```

### 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

### 健康检查

```bash
curl http://localhost:3000/health
```

## 目录结构

```
.
├── data/                   # SQLite 数据库文件目录（运行时生成）
├── sample-data/            # 样例数据文件
│   ├── sample-activity.json
│   ├── sample-batch.json
│   ├── sample-archive.json
│   ├── sample-complaint.json
│   └── sample-report.json
├── scripts/
│   ├── init-data.js        # 初始化数据目录和样例数据
│   ├── demo-main-flow.js   # 主业务流程演示
│   └── demo-error-cases.js # 异常操作演示
├── src/
│   ├── config/
│   │   └── database.js     # 数据库配置
│   ├── routes/
│   │   ├── activities.js   # 活动管理路由
│   │   ├── batches.js      # 批次和留样路由
│   │   └── complaints.js   # 投诉和报告路由
│   ├── services/
│   │   ├── activityService.js     # 活动业务逻辑
│   │   ├── batchService.js        # 批次留样业务逻辑
│   │   └── complaintService.js    # 投诉报告业务逻辑
│   ├── utils/
│   │   ├── status.js       # 状态管理和计算
│   │   └── idempotency.js  # 幂等性检查和操作日志
│   └── server.js           # 应用入口
├── tests/
│   └── business.test.js    # 业务逻辑测试
├── package.json
└── README.md
```

## 核心数据模型

### 活动档案 (Activity)
| 字段 | 说明 |
|------|------|
| id | 活动ID |
| store_id | 门店ID |
| store_name | 门店名称 |
| activity_name | 活动名称 |
| activity_date | 活动日期 |
| product_name | 产品名称 |
| description | 描述 |
| status | 状态 |

**活动状态流转：**
```
DRAFT(草稿) → PLANNED(已计划) → IN_PROGRESS(进行中) → COMPLETED(已完成)
                        ↓                            ↓
                   CANCELLED(已取消) ←────────────────┘
```

### 样品批次 (Batch)
| 字段 | 说明 |
|------|------|
| id | 批次ID |
| activity_id | 关联活动ID |
| batch_number | 批次号 |
| production_date | 生产日期 |
| expiration_date | 保质期至 |
| quantity | 批次总数量 |

### 留样登记 (SampleArchive)
| 字段 | 说明 |
|------|------|
| id | 留样ID |
| activity_id | 关联活动ID |
| batch_id | 关联批次ID |
| sample_quantity | 留样数量 |
| storage_location | 存储位置 |
| archive_date | 留样日期 |
| destroy_deadline | 销毁截止日期（自动计算，默认7天） |
| destroyed_at | 实际销毁时间 |
| status | 留样状态 |

**留样状态流转：**
```
ARCHIVED(已留样) ──→ IN_INSPECTION(检验中) ──→ DESTROYED(已销毁)
        │                      ↑
        └──→ RETAINED_FOR_INVESTIGATION(留存调查) ──┘
```

**重要：**
- 销毁截止日期 = 留样日期 + 保质期天数（默认7天）
- 留样关联投诉后，状态自动变为 `RETAINED_FOR_INVESTIGATION`

### 投诉记录 (Complaint)
| 字段 | 说明 |
|------|------|
| id | 投诉ID |
| activity_id | 关联活动ID |
| sample_archive_id | 关联留样ID |
| complaint_type | 投诉类型 |
| complaint_date | 投诉日期 |
| complaint_content | 投诉内容 |
| complainant | 投诉人 |
| contact_info | 联系方式 |
| status | 投诉状态 |
| resolution | 解决方案 |
| resolved_at | 解决时间 |

**投诉状态流转：**
```
PENDING(待处理) → UNDER_INVESTIGATION(调查中) → RESOLVED(已解决) → CLOSED(已关闭)
```

### 追溯报告 (TraceReport)
| 字段 | 说明 |
|------|------|
| id | 报告ID |
| complaint_id | 关联投诉ID |
| activity_id | 关联活动ID |
| report_content | 报告内容 |
| report_date | 报告日期 |
| conclusion | 结论 |
| status | 报告状态 |

**报告状态流转：**
```
PENDING(待处理) → IN_PROGRESS(进行中) → COMPLETED(已完成)
```

## API 接口

### 活动管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/activities` | 创建活动 |
| GET | `/api/v1/activities` | 查询活动列表 |
| GET | `/api/v1/activities/:id` | 查询活动详情 |
| GET | `/api/v1/activities/:id/summary` | 查询活动汇总 |
| PUT | `/api/v1/activities/:id` | 修改活动 |
| POST | `/api/v1/activities/:id/advance` | 推进活动状态 |
| POST | `/api/v1/activities/:id/cancel` | 取消活动 |

### 批次和留样管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/activities/:activityId/batches` | 创建批次 |
| GET | `/api/v1/activities/:activityId/batches` | 查询活动批次 |
| GET | `/api/v1/batches/:id` | 查询批次详情 |
| POST | `/api/v1/samples` | 创建留样登记 |
| GET | `/api/v1/samples/reminders` | 查询销毁提醒 |
| GET | `/api/v1/samples/:id` | 查询留样详情 |
| GET | `/api/v1/activities/:activityId/samples` | 查询活动留样 |
| PUT | `/api/v1/samples/:id` | 修改留样 |
| POST | `/api/v1/samples/:id/advance` | 推进留样状态 |
| POST | `/api/v1/samples/:id/destroy` | 销毁留样 |
| POST | `/api/v1/samples/:id/retain` | 留存调查 |
| POST | `/api/v1/samples/:id/withdraw` | 撤回留样 |

### 投诉和追溯报告

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/complaints` | 创建投诉 |
| GET | `/api/v1/complaints` | 查询投诉列表 |
| GET | `/api/v1/complaints/:id` | 查询投诉详情 |
| GET | `/api/v1/complaints/:id/trace` | 查询完整追溯信息 |
| PUT | `/api/v1/complaints/:id` | 修改投诉 |
| POST | `/api/v1/complaints/:id/advance` | 推进投诉状态 |
| POST | `/api/v1/complaints/:complaintId/reports` | 创建追溯报告 |
| GET | `/api/v1/complaints/:complaintId/reports` | 查询投诉报告 |
| GET | `/api/v1/reports/:id` | 查询报告详情 |
| POST | `/api/v1/reports/:id/complete` | 完成报告 |

## 幂等性机制

所有修改接口支持通过 `X-Request-Id` 请求头实现幂等性：

```bash
curl -X POST http://localhost:3000/api/v1/activities \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: unique-request-id-123" \
  -H "X-Operator: admin" \
  -d '{...}'
```

**关键特性：**
- 相同 `X-Request-Id` 的重复请求返回已执行结果，不产生副作用
- 操作日志记录所有状态变更历史
- 不同实体类型的相同 requestId 互不干扰

## 命令演示

### 1. 主业务流程演示

```bash
npm run demo-main
```

演示场景：
- 五一新品尝试吃活动创建和状态推进
- 批次信息登记
- 留样登记（自动计算7天后销毁）
- 日常销毁提醒查询
- 消费者投诉关联留样
- 留样自动变更为留存调查状态
- 追溯报告创建和完成
- 投诉状态推进（调查→解决→关闭）
- 完整追溯链路查询

### 2. 异常操作演示

```bash
npm run demo-errors
```

演示系统保护性校验：
- 状态跳级流转（DRAFT → COMPLETED）
- 状态回退（COMPLETED → IN_PROGRESS）
- 修改已完成的活动
- 留样数量超过批次总量
- 批次与活动不匹配
- 重复销毁留样
- 修改/撤回已销毁的留样
- 撤回留存调查中的留样
- 修改已关闭的投诉
- 重复请求幂等性验证
- 使用不存在的ID

## 运行测试

```bash
npm test
```

测试覆盖场景：
- 状态流转规则验证（正向 + 逆向）
- 留样销毁时间计算和提醒功能
- 投诉关联自动触发留样状态变更
- 追溯报告完整链路
- 幂等性机制验证
- 撤回和修正功能
- 查询汇总功能

## 关键设计要点

### 1. 销毁时间计算
- 留样时自动计算：`销毁截止日期 = 留样日期 + 保质期天数`
- 默认保质期：7天
- 可自定义保质期天数

### 2. 投诉关联自动逻辑
- 创建投诉时关联留样ID
- 系统自动将留样状态变更为 `RETAINED_FOR_INVESTIGATION`
- 阻止该留样被误销毁

### 3. 追溯报告影响
- 报告完成后有明确结论
- 结论作为投诉推进到 "已解决" 的重要依据
- 完整记录调查过程

### 4. 终态数据保护
- COMPLETED/CANCELLED 状态的活动不可修改
- DESTROYED 状态的留样不可修改/撤回
- CLOSED 状态的投诉不可修改

## 样例数据位置

样例数据文件位于 `sample-data/` 目录：

| 文件 | 说明 |
|------|------|
| sample-activity.json | 活动档案样例 |
| sample-batch.json | 批次信息样例 |
| sample-archive.json | 留样登记样例 |
| sample-complaint.json | 投诉记录样例 |
| sample-report.json | 追溯报告样例 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |
| DB_PATH | data/sample-archive.db | 数据库文件路径 |

## 辨识度说明

本项目的核心辨识度来自：

1. **试吃留样**：专门针对食品门店试吃活动场景
2. **销毁时间**：自动计算 + 到期提醒 + 状态控制
3. **投诉追溯**：投诉→留样留存→追溯报告→投诉解决的完整闭环
4. **状态流转**：严格的状态机保护，不允许跳级和回退
5. **幂等性**：基于 requestId 的重复请求保护机制
