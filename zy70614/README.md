# 异常单申诉改派仲裁证据后端API

## 项目简介

这是一个用于处理外卖异常订单申诉、改派和仲裁的后端API系统，基于FastAPI和SQLite构建。

## 核心功能

1. **异常分类管理** - 支持少餐、超时、改派、餐品破损、地址错误、客户拒收等异常类型
2. **订单管理** - 订单导入、状态跟踪
3. **申诉材料管理** - 支持上传图片、截图等证据材料
4. **改派流程** - 骑手改派记录和状态流转
5. **仲裁处理** - 自动仲裁和人工复核机制
6. **重复仲裁拦截** - 防止同一订单重复仲裁
7. **证据验证** - 确保仲裁前有充足的申诉证据
8. **数据导出** - 支持Excel格式导出

## 错误代码说明

| 错误代码 | 说明 |
|---------|------|
| MISSING_FIELD | 缺少必填字段 |
| INVALID_STATUS | 状态不允许此操作 |
| NEED_MANUAL_REVIEW | 需要人工复核 |
| ALREADY_PROCESSED | 已处理过（重复提交） |
| NOT_FOUND | 记录不存在 |
| DUPLICATE_ARBITRATION | 重复仲裁 |
| INSUFFICIENT_EVIDENCE | 证据不足 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档

启动后访问：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. 运行自检脚本

```bash
# 先启动服务，然后在另一个终端运行
python test_api.py
```

## API端点说明

### 骑手管理
- `POST /riders/` - 创建骑手

### 订单管理
- `POST /orders/` - 创建订单
- `POST /orders/filter/` - 筛选订单
- `GET /orders/export/` - 导出订单Excel

### 申诉材料
- `POST /appeals/` - 上传申诉材料

### 改派管理
- `POST /reassignments/` - 创建改派记录

### 仲裁管理
- `POST /arbitrations/` - 创建仲裁记录

### 基础数据
- `GET /exception-types/` - 获取异常类型列表

## 项目结构

```
.
├── main.py              # FastAPI主应用
├── database.py          # 数据库模型和初始化
├── test_api.py          # 自检脚本
├── requirements.txt     # 依赖包
├── README.md           # 说明文档
└── exception_orders.db # SQLite数据库（自动生成）
```

## 数据库模型

1. **Rider** - 骑手表
2. **Order** - 订单表
3. **ExceptionType** - 异常类型表
4. **Reassignment** - 改派记录表
5. **AppealMaterial** - 申诉材料表
6. **ArbitrationResult** - 仲裁结果表

## 使用示例

### 创建异常订单

```bash
curl -X POST "http://localhost:8000/orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORD1001",
    "rider_no": "R001",
    "order_amount": 25.5,
    "exception_code": "MEAL_SHORTAGE",
    "status": "exception"
  }'
```

### 上传申诉材料

```bash
curl -X POST "http://localhost:8000/appeals/" \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORD1001",
    "material_type": "photo",
    "description": "餐品照片",
    "uploaded_by": "admin"
  }'
```

### 创建仲裁

```bash
curl -X POST "http://localhost:8000/arbitrations/" \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORD1001",
    "result": "appeal_upheld",
    "reason": "证据充分",
    "handled_by": "admin"
  }'
```
