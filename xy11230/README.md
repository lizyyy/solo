# 换电运营值班系统

## 功能概述

本系统将换电运营值班员手里的老流程后端化，解决柜门打不开、扫码失败、空仓误报等故障混在客服单里人工分类慢的问题。

### 核心功能
- **接单**：接收工单，自动应用规则引擎
- **归因**：对工单进行故障分类
- **派修**：将工单派发给维修人员
- **复核**：维修完成后进行质量复核
- **导出**：按条件导出工单数据

### 规则引擎
1. **重复故障合并**：24小时内同一柜号同一故障类型自动合并
2. **离线柜排除**：离线状态的柜子不派修
3. **维修前后状态一致**：复核时检查维修前后状态，防止虚假修复

### 批量操作
所有核心操作都支持批量处理，失败时会明确列出成功和失败的记录，重试时不会破坏已成功的记录。

## 项目结构

```
battery-swap-operation/
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库配置
│   ├── models.py        # 数据模型
│   ├── schemas.py       # Pydantic 模式
│   ├── rules.py         # 规则引擎
│   ├── services.py      # 业务服务层
│   └── main.py          # API 入口
├── .env                 # 环境变量
├── requirements.txt     # Python 依赖
└── README.md
```

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 访问 API 文档

启动后访问: http://localhost:8000/docs

## API 接口

### 工单管理
- `POST /tickets/` - 创建工单
- `GET /tickets/` - 查看工单列表
- `GET /tickets/{id}` - 查看工单详情
- `POST /tickets/{id}/receive` - 接单
- `POST /tickets/batch/receive` - 批量接单
- `POST /tickets/{id}/attribute` - 归因
- `POST /tickets/batch/attribute` - 批量归因

### 派修管理
- `POST /dispatches/` - 创建派修单
- `PATCH /dispatches/{id}` - 更新派修单状态
- `POST /dispatches/batch` - 批量派修

### 复核管理
- `POST /tickets/{id}/review` - 复核工单
- `POST /tickets/batch/review` - 批量复核

### 导入导出
- `POST /import/excel` - 导入Excel工单
- `POST /export/excel` - 导出Excel工单

## 数据模型

### 故障类型 (FaultType)
- `door_fail` - 柜门打不开
- `scan_fail` - 扫码失败
- `empty_bin_false` - 空仓误报
- `other` - 其他

### 工单状态 (TicketStatus)
- `pending` - 待处理
- `received` - 已接单
- `attributed` - 已归因
- `dispatched` - 已派修
- `repaired` - 已维修
- `reviewed` - 已复核
- `closed` - 已关闭
- `rejected` - 已拒绝

### 复核结果 (ReviewResult)
- `passed` - 通过
- `failed` - 不通过
- `need_repair` - 需重新维修

## 使用示例

### 创建工单

```bash
curl -X POST http://localhost:8000/tickets/ \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{
    "ticket_no": "T20240101001",
    "cabinet_code": "CAB001",
    "fault_type": "door_fail",
    "fault_description": "3号仓门打不开",
    "bin_number": "3"
  }'
```

### 接单

```bash
curl -X POST http://localhost:8000/tickets/1/receive \
  -H "X-Operator: admin"
```

### 批量接单

```bash
curl -X POST http://localhost:8000/tickets/batch/receive \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '[1, 2, 3]'
```

### 归因

```bash
curl -X POST "http://localhost:8000/tickets/1/attribute?fault_type=door_fail&reason=硬件故障" \
  -H "X-Operator: admin"
```

### 派修

```bash
curl -X POST http://localhost:8000/dispatches/ \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{
    "ticket_id": 1,
    "technician_id": "TECH001",
    "technician_name": "张师傅"
  }'
```

### 复核

```bash
curl -X POST "http://localhost:8000/tickets/1/review?result=passed&comment=维修合格" \
  -H "X-Operator: admin"
```

## 幂等性设计

系统支持重复提交，结果保持稳定：
- 重复创建相同工单编号的工单，会直接返回已存在的工单
- 重复接单会返回当前状态，提示无需重复操作
- 批量操作采用逐行处理模式，单行失败不影响其他行
