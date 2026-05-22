# 物业维修派单重试补偿队列服务

## 系统概述

本系统用于解决物业维修过程中返修、换件经常被算成两单的问题，实现：
- 四种数据来源的稳定接入（住户报修截图、维修师傅回执、材料领用表、临时补录单）
- 持久化的重试补偿队列，重启不丢失数据
- 自动合并返修/换件订单，避免重复计费
- 完整的过程追踪，投诉时可查
- 四级权限控制
- 项目经理关注的可重试分类、死信处理、恢复监控

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库和用户

```bash
python init_db.py
```

默认创建以下测试用户：
- `admin` / `admin123` - 主管角色 (manager)
- `reviewer` / `reviewer123` - 复核角色 (reviewer)
- `data_entry` / `data123` - 录入角色 (data_entry)
- `readonly` / `read123` - 只读角色 (read_only)

### 3. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看 Swagger API 文档

## 核心功能说明

### 一、数据来源接入 (4种类型)

| 来源类型 | 说明 | 必填字段 |
|---------|------|---------|
| `resident_screenshot` | 住户报修截图 | resident_id, room_number, repair_type |
| `technician_receipt` | 维修师傅回执 | technician_id, receipt_number |
| `material_form` | 材料领用表 | material_used (非空) |
| `supplementary_form` | 临时补录单 | original_order_id, supplementary_reason |

**去重机制**: 通过 `source_type + source_id + data_hash` 三重校验避免重复提交

### 二、订单合并逻辑 (解决两单问题)

系统会自动将相关数据合并到同一个维修订单，避免重复计费：

1. **原始订单匹配**: 通过 `original_order_id` 直接关联
2. **智能匹配**: `resident_id + room_number + repair_type + 7天时间窗口`
3. **来源ID匹配**: 通过已合并的 source_id 反向查找

**合并触发场景**:
- 维修回执 `completion_status = 'repair_needed'` → 标记为返修，不创新单
- 维修回执 `completion_status = 'part_replacement'` → 标记为换件，追加费用
- 材料领用表 → 自动追加到对应订单的材料费
- 补录单 → 按 original_order_id 关联

### 三、重试补偿队列

**队列特性**:
- **持久化**: 所有状态存储在数据库，重启不丢失
- **指数退避**: 重试间隔 = 60s × 2^(重试次数-1)
- **最大重试**: 默认5次，超过进入死信队列
- **自动监控**: 卡住超过24小时自动转入人工审核

**状态流转**:
```
PENDING → PROCESSING → SUCCESS
                ↓
           RETRYING ←┐
                │     │ (指数退避)
                └─────┘
                ↓ (超过5次)
           DEAD_LETTER → MANUAL_REVIEW → CLOSED
                                      ↓
                                 COMPENSATED
```

### 四、权限体系 (四级)

| 角色 | 可见字段 | 可操作动作 |
|-----|---------|-----------|
| **只读 (read_only)** | 基础信息（任务ID、状态、重试次数、住户姓名、房号） | 仅查看 |
| **录入 (data_entry)** | 可查看维修内容、材料使用、错误信息 | 提交来源数据、重新验证 |
| **复核 (reviewer)** | 全部字段可读 | 手动重试、标记人工审核、修改重试分类 |
| **主管 (manager)** | 全部字段可读写 | 关闭任务、创建补偿、批量重试、死信处理、查看仪表盘 |

### 五、报表与追踪

**数据溯源**: 每个汇总数字都能追到具体记录
- `/api/v1/tasks/{task_id}/trace` - 完整处理流程 + 失败尝试记录
- `/api/v1/reports/failed-records` - 失败列表，含错误原因和原始数据

**坏数据隔离**:
- 验证失败的数据不进入汇总统计
- 在失败列表中可查看具体错误原因
- 修正后可重新验证并触发重试

### 六、项目经理视图

**关注重点指标**:
1. **重试分类统计**: 按错误类型分类（网络、数据、系统、业务冲突等）
2. **死信处理**: 待人工审核数量、按错误分类分布、24小时内解决数
3. **恢复统计**: 自动恢复率、手动恢复率、平均恢复时间
4. **来源稳定性**: 四种数据来源的成功率对比
5. **高频错误**: Top 10 错误类型，便于针对性优化

## API 使用示例

### 1. 登录获取 Token

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### 2. 提交住户报修截图

```bash
curl -X POST "http://localhost:8000/api/v1/source-data/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "source_type": "resident_screenshot",
    "source_id": "SCREEN-001",
    "resident_id": "R001",
    "resident_name": "张三",
    "room_number": "1号楼201室",
    "repair_type": "水电维修",
    "repair_content": "客厅插座坏了",
    "screenshot_urls": ["https://example.com/img1.jpg"]
  }'
```

### 3. 提交维修回执 (触发换件合并)

```bash
curl -X POST "http://localhost:8000/api/v1/source-data/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "source_type": "technician_receipt",
    "source_id": "RECEIPT-001",
    "resident_id": "R001",
    "resident_name": "张三",
    "room_number": "1号楼201室",
    "repair_type": "水电维修",
    "technician_id": "T007",
    "technician_name": "李师傅",
    "work_hours": 1.5,
    "completion_status": "part_replacement",
    "receipt_number": "RC-2024-001"
  }'
```

**注意**: 系统会自动将此回执合并到前面创建的订单中，不会产生新订单

### 4. 查看任务追踪

```bash
curl "http://localhost:8000/api/v1/tasks/TASK-XXXXXXXXXXXX/trace" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. 项目经理仪表盘

```bash
curl "http://localhost:8000/api/v1/manager/dashboard" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 失败场景与修正方式

| 错误场景 | 错误分类 | 自动重试 | 修正方式 |
|---------|---------|---------|---------|
| 缺少必填字段 | data_validation | ❌ | 补充完整数据后调用 `/source-data/{id}/revalidate` |
| 第三方接口超时 | third_party_timeout | ✅ (5次) | 等待自动重试，或手动触发 `/tasks/{id}/retry` |
| 同一住户重复提交 | duplicate_order | ❌ | 系统自动合并，可在 order_merge_history 查看记录 |
| 数据哈希冲突 | business_conflict | ❌ | 检查是否为重复提交，确认为新数据需更新 source_id |
| 系统内部错误 | system_error | ✅ (5次) | 排查代码问题后，手动重试标记为 resolved |

## 报表变化说明

### 补偿入账对报表的影响

| 操作 | 任务状态 | total_compensation 变化 | 备注 |
|-----|---------|------------------------|------|
| 创建补偿 | COMPENSATED | +金额 | 同时关联订单的 total_compensation 也增加 |
| 发放补偿 | 状态变为 disbursed | 不变 | 仅更新补偿记录状态，不影响汇总 |
| 关闭任务 | CLOSED | 不变 | 任务不再出现在待处理列表 |

### 重试成功对报表的影响

- `success_tasks` +1
- `retrying_tasks` -1
- `avg_retry_count` 重新计算
- 对应重试分类的 `success_rate` 上升

## 项目结构

```
├── main.py                 # 应用入口
├── requirements.txt        # 依赖
├── init_db.py              # 数据库初始化脚本
├── app/
│   ├── api/               # API 路由
│   │   ├── auth.py        # 认证
│   │   ├── source_data.py # 来源数据
│   │   ├── tasks.py       # 任务管理
│   │   ├── reports.py     # 报表
│   │   ├── manager.py     # 经理视图
│   │   └── compensation.py # 补偿
│   ├── core/              # 核心模块
│   │   ├── config.py      # 配置
│   │   ├── database.py    # 数据库
│   │   ├── security.py    # 安全/权限
│   │   └── queue.py       # 队列管理
│   ├── models/            # 数据模型
│   ├── schemas/           # Pydantic 模型
│   └── services/          # 业务逻辑
└── examples/              # 示例数据
    └── sample_data.py     # 样例材料
```

## 核心文件链接

- [数据库模型](file:///Users/mac/pro/solo/workspaces/xy11417/app/models/repair_task.py)
- [队列管理器](file:///Users/mac/pro/solo/workspaces/xy11417/app/core/queue.py)
- [订单合并逻辑](file:///Users/mac/pro/solo/workspaces/xy11417/app/services/order_merger.py)
- [权限控制](file:///Users/mac/pro/solo/workspaces/xy11417/app/core/security.py)
- [报表服务](file:///Users/mac/pro/solo/workspaces/xy11417/app/services/report_service.py)
