# 充电桩运维站故障派修 API

## 项目概述

本项目实现了充电桩运维站故障派修管理系统，解决了故障派修信息分散在表格、截图和口头确认中的问题，提供了完整的业务流程管控和异常处理机制。

## 核心功能

### 1. 业务规则管控
- **重复接单拦截**：同一告警被多个班组接单时自动拦截，给出明确的拦截原因和处理建议
- **故障闭环一致性校验**：闭环前校验所有必要信息是否完整，包括到达时间、维修时间、维修内容、验证结果等
- **状态流转校验**：确保派修单状态按正确流程流转

### 2. 完整业务流程
```
创建派修单 → 已派单 → 接单 → 已接单 → 开始处理 → 处理中 → 完成维修 → 待复核 → 验证 → 闭环 → 已闭环
                                                          ↓
                                                        驳回
```

### 3. 详细错误信息
- 错误码（error_code）：唯一标识错误类型
- 错误消息（message）：简要描述
- 详细信息（detail）：
  - intercept_reason：具体拦截原因
  - suggestions：处理建议列表
  - issues：具体问题列表（闭环校验时）
  - existing_orders：已存在的相关订单（重复接单时）

## 数据模型

包含充电桩故障派修的真实字段：

### 基础信息
- 告警编号（alarm_id）
- 充电桩编号/名称（charger_id, charger_name）
- 运维站编号/名称（station_id, station_name）
- 故障类型（fault_type）：通信故障、功率模块故障、枪锁故障、屏幕故障等
- 告警级别（alarm_level）：严重、重要、一般、提示
- 故障描述（fault_description）
- 厂商/型号（manufacturer, model）
- 安装位置（location）

### 派修信息
- 派修单号（order_id）
- 派单人/时间（dispatch_user, dispatch_time）
- 指派班组（assigned_team）：电气班组、机械班组、通信班组、综合班组
- 班组长/联系电话（team_leader, team_phone）
- 接单人/时间（accept_user, accept_time）

### 维修过程
- 到达时间（arrival_time）
- 维修开始/结束时间（repair_start_time, repair_end_time）
- 维修内容（repair_content）
- 更换配件（replaced_parts）

### 闭环验证
- 验证结果/验证人/时间（verification_result, verification_user, verification_time）
- 闭环人/时间（close_user, close_time）
- 驳回原因（reject_reason）

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
或
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API文档：http://localhost:8000/docs
- 接口地址：http://localhost:8000/api/v1/repair-orders

### 3. 运行测试
```bash
pytest
```
一条命令运行所有测试，失败时会显示具体是哪条规则未通过。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/repair-orders | 创建派修单 |
| POST | /api/v1/repair-orders/{id}/accept | 接单 |
| POST | /api/v1/repair-orders/{id}/start-process | 开始处理 |
| POST | /api/v1/repair-orders/{id}/complete-repair | 完成维修 |
| POST | /api/v1/repair-orders/{id}/verify | 验证维修 |
| POST | /api/v1/repair-orders/{id}/reject | 驳回派修单 |
| POST | /api/v1/repair-orders/{id}/close | 闭环派修单 |
| GET | /api/v1/repair-orders | 查询派修单列表 |
| GET | /api/v1/repair-orders/{id} | 查询派修单详情 |

## 异常样例

### 重复接单拦截
```json
{
  "error_code": "DUPLICATE_ACCEPT",
  "message": "该告警已有其他班组接单",
  "detail": {
    "intercept_reason": "告警 ALM-XXX 已被 ['电气班组'] 接单，禁止重复接单",
    "suggestions": [
      "联系已接单班组确认是否需要协助",
      "退回本班组派修单",
      "转人工调度进行资源协调"
    ],
    "existing_orders": [...]
  }
}
```

### 闭环一致性校验失败
```json
{
  "error_code": "INCONSISTENT_CLOSURE",
  "message": "故障闭环信息不完整",
  "detail": {
    "intercept_reason": "派修单 RO-XXX 闭环前校验失败，存在 2 项问题",
    "issues": [
      "缺少故障验证结果",
      "缺少验证人信息"
    ],
    "suggestions": [
      "补充缺失的维修记录",
      "完善故障验证结果",
      "检查时间逻辑是否正确",
      "转人工审核进行强制闭环"
    ]
  }
}
```

## 项目结构
```
.
├── main.py                 # 应用入口
├── requirements.txt        # 依赖清单
├── pytest.ini             # pytest配置
├── README.md              # 项目说明
└── app/
    ├── __init__.py
    ├── models/
    │   ├── __init__.py
    │   └── database.py    # 数据模型和种子数据
    ├── schemas/
    │   ├── __init__.py
    │   └── repair_order.py # Pydantic模式
    ├── services/
    │   ├── __init__.py
    │   └── repair_service.py # 业务逻辑
    ├── api/
    │   ├── __init__.py
    │   └── repair_orders.py # API路由
    └── tests/
        ├── __init__.py
        └── test_repair_orders.py # 测试用例
```
