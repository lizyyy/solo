# 仓库叉车充电排队 API

面向仓库夜班叉车集中回充场景的充电排队管理系统。

## 项目概述

### 业务场景
仓库夜班结束时，所有叉车同时返回需要充电，但充电位数量有限，次日任务优先级不同，需要智能分配充电资源。

### 核心边界
1. **充电位数量**：有限的充电位需要排队
2. **电量预测**：根据电池容量、充电功率预测充电时间
3. **任务优先级**：高优先级任务的叉车优先充电

## 快速开始

### 环境要求
- Python 3.8+
- pip 或 pip3

### 安装依赖
```bash
cd warehouse-forklift-charging
pip3 install -r requirements.txt
```

### 初始化演示数据
```bash
python3 init_data.py
```

### 启动服务
```bash
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 访问文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 运行场景测试
```bash
pip3 install requests
python3 scenarios.py
```

## 功能模块

### 1. 叉车档案管理
- 创建、查询、更新、停用叉车档案
- 自动关联电池状态

### 2. 充电位管理
- 创建、查询、更新充电位
- 充电位锁定/释放机制

### 3. 充电排队系统
- 提交充电请求
- 智能排队（基于电量和任务优先级）
- 电量预测
- 充电完成处理

### 4. 任务管理
- 创建次日任务
- 任务与叉车绑定
- 任务优先级影响充电排队

### 5. 人工修正
- 修正异常数据（电池电量、状态等）
- 修正历史记录可追溯

## 可复现场景

### 场景1: 正常处理流程
验证叉车档案生效 → 充电位锁定 → 提交充电请求 → 完成充电

### 场景2: 缺字段错误
验证缺少必需字段时系统返回明确错误

### 场景3: 重复提交
验证幂等键机制防止重复提交

### 场景4: 非法状态流转
验证不允许的状态转换被正确拦截

### 场景5: 人工修正流程
验证人工修正 → 修正后重跑

### 场景6: 电量预测验证
验证电量预测与原始数据一致性

### 场景7: 排队优先级验证
验证低电量+高优先级任务的叉车优先

## 验收说明

详细验收标准请参考 [验收指南.md](./验收指南.md)

### 通过的输出
- `success: true`
- `code: "OK" | "CREATED" | "UPDATED" | "COMPLETED" | "CORRECTED"`

### 需要人工处理的输出
- `success: false`
- `code: "VALIDATION_ERROR" | "DUPLICATE_REQUEST" | "INVALID_TRANSITION" | "INSUFFICIENT_BATTERY"` 等

## 项目结构
```
warehouse-forklift-charging/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 应用入口
│   ├── database.py          # 数据库配置
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py        # SQLAlchemy 数据模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── schemas.py       # Pydantic 数据验证
│   ├── services/
│   │   ├── __init__.py
│   │   ├── battery_service.py    # 电量预测服务
│   │   ├── charging_service.py   # 充电排队服务
│   │   └── correction_service.py # 人工修正服务
│   └── routers/
│       ├── __init__.py
│       ├── forklift_router.py    # 叉车档案路由
│       ├── station_router.py     # 充电位路由
│       ├── charging_router.py    # 充电排队路由
│       ├── task_router.py        # 任务管理路由
│       └── correction_router.py  # 人工修正路由
├── requirements.txt
├── init_data.py            # 演示数据初始化
├── scenarios.py            # 场景测试脚本
├── 验收指南.md             # 详细验收文档
└── README.md
```

## API 端点

### 叉车档案
- `POST /api/forklifts` - 创建叉车
- `GET /api/forklifts/{code}` - 查询叉车
- `GET /api/forklifts` - 叉车列表
- `PATCH /api/forklifts/{code}` - 更新叉车
- `DELETE /api/forklifts/{code}` - 停用叉车

### 充电位
- `POST /api/stations` - 创建充电位
- `GET /api/stations/{code}` - 查询充电位
- `GET /api/stations` - 充电位列表
- `PATCH /api/stations/{code}` - 更新充电位

### 充电排队
- `POST /api/charging/request` - 提交充电请求
- `POST /api/charging/predict` - 电量预测
- `GET /api/charging/queue` - 队列状态
- `POST /api/charging/complete/{id}` - 完成充电
- `GET /api/charging/requests` - 请求列表

### 任务管理
- `POST /api/tasks` - 创建任务
- `GET /api/tasks/{code}` - 查询任务
- `GET /api/tasks` - 任务列表
- `PATCH /api/tasks/{code}/start` - 开始任务
- `PATCH /api/tasks/{code}/complete` - 完成任务

### 人工修正
- `POST /api/correction/apply` - 应用修正
- `GET /api/correction/history` - 修正历史
