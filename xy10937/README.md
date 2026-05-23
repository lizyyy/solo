# 婚礼物料归还 API

婚庆公司物料归还管理系统，提供完整的 REST 接口，支持活动订单、物料清单、出库记录、归还检查、丢损赔付、结案报告等功能。

## 技术栈

- **FastAPI**: 高性能 Web 框架
- **SQLAlchemy**: ORM 数据库操作
- **SQLite**: 本地持久化数据库
- **Pydantic**: 数据验证

## 核心功能

### 数据模型
1. **活动订单**: 客户信息、活动日期、订单状态
2. **物料清单**: 花架、灯串、桌牌等物料信息
3. **出库记录**: 物料出库管理
4. **归还检查**: 归还记录、数量核对
5. **丢损赔付**: 丢失损坏处理、赔付金额
6. **结案报告**: 活动总结报告

### 状态机

**订单状态**:
- `pending` - 待处理
- `in_progress` - 进行中
- `materials_out` - 物料已出库
- `returning` - 归还中
- `compensating` - 赔付中
- `completed` - 已完成
- `cancelled` - 已取消

**归还状态**:
- `not_returned` - 未归还
- `partial` - 部分归还
- `pending_review` - 待复核
- `reviewed` - 已审核
- `completed` - 已完成
- `rejected` - 已驳回

**赔付状态**:
- `not_required` - 无需赔付
- `pending` - 待赔付
- `in_progress` - 赔付进行中
- `paid` - 已赔付
- `waived` - 已豁免
- `disputed` - 有争议
- `resolved` - 已解决

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行测试脚本

```bash
python test_api.py
```

## API 接口列表

### 订单管理
- `POST /api/orders` - 创建活动订单
- `GET /api/orders` - 查询订单列表
- `GET /api/orders/{order_id}` - 查询单个订单
- `PUT /api/orders/{order_id}/status` - 更新订单状态

### 出库管理
- `POST /api/outbounds` - 创建出库记录
- `GET /api/outbounds/{outbound_id}` - 查询出库记录

### 归还管理
- `POST /api/returns` - 创建归还记录
- `GET /api/returns/{return_id}` - 查询归还记录
- `PUT /api/returns/{return_id}/review` - 审核归还记录

### 赔付管理
- `POST /api/compensations` - 创建赔付记录
- `GET /api/compensations/{compensation_id}` - 查询赔付记录
- `PUT /api/compensations/{compensation_id}/status` - 更新赔付状态

### 异常处理
- `GET /api/exceptions` - 查询异常记录
- `PUT /api/exceptions/{exception_id}/handle` - 人工处理异常

### 报告管理
- `POST /api/reports` - 生成报告
- `GET /api/reports/{report_id}` - 查询报告
- `GET /api/orders/{order_id}/report` - 导出订单结案报告

### 健康检查
- `GET /api/health` - 服务健康检查

## 核心规则

1. **重复归还拦截**: 同一订单只能有一个进行中的归还记录
2. **状态流转验证**: 严格的状态机控制，非法状态转移被拦截
3. **异常记录**: 所有异常路径都会保存原始输入和处理结果
4. **赔付联动**: 所有赔付完成后订单自动标记为完成
5. **本地持久化**: SQLite 数据库文件 `wedding_materials.db` 保存所有历史数据

## 项目结构

```
.
├── main.py              # FastAPI 主程序
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 数据验证
├── crud.py              # 数据库操作逻辑
├── database.py          # 数据库连接配置
├── test_api.py          # API 测试脚本
├── requirements.txt     # 依赖列表
└── wedding_materials.db # SQLite 数据库文件（自动生成）
```

## 响应格式

所有 API 返回统一格式：

```json
{
  "success": true,
  "code": "CREATED",
  "message": "订单创建成功",
  "data": { ... }
}
```

状态码说明：
- `CREATED` - 创建成功
- `SUCCESS` - 操作成功
- `REJECTED` - 业务拒绝
- `NOT_FOUND` - 资源不存在
- `REVIEWED` - 审核完成
- `HANDLED` - 异常已处理
- `EXPORTED` - 导出成功

## 数据持久化

所有数据保存在 `wedding_materials.db` SQLite 数据库文件中，重启服务后数据不会丢失。