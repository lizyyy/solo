# 实验室试剂管理系统

专为高校实验室设计的后端管理工具，支持审批流程、库存管理和操作审计。

## 核心功能

### ✅ 危险品双人审批
- 剧毒、高毒、爆炸品、易制毒等危险品自动启用双人审批流程
- 普通试剂仅需单人审批
- 审批过程有序进行，支持部分审批

### ✅ 库存防负数校验
- 出库前自动检查库存充足性
- 库存不足时拦截操作并提示
- 先进先出（按有效期）扣减库存

### ✅ 驳回再提交
- 被驳回的申请可以重新提交
- 重置审批状态和审批记录
- 支持修改申请用途

### ✅ 操作审计日志
- 所有操作（创建、审批、出入库等）全部记录
- 记录操作人、角色、时间、结果和详细原因
- 支持完整追溯

### ✅ 幂等性支持
- 重复提交申请结果稳定
- 通过 `X-Idempotency-Key` 请求头实现
- 防止重复扣库、重复派货

### ✅ 本地持久化
- 使用 SQLite 数据库
- 重启服务数据不丢失
- 月底复盘可导出核对

## 项目结构

```
├── main.py              # FastAPI 主程序
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 数据验证
├── crud.py              # 业务逻辑实现
├── database.py          # 数据库连接配置
├── test_flow.py         # 完整流程测试
├── requirements.txt     # 依赖列表
└── reagent_management.db # 运行时数据库（自动生成）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行测试

```bash
python test_flow.py
```

### 3. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口

### 试剂管理
- `POST /reagents/` - 创建试剂
- `GET /reagents/` - 获取试剂列表
- `GET /reagents/{id}` - 获取单个试剂

### 库存管理
- `POST /inventory/` - 入库
- `GET /inventory/summary` - 库存汇总
- `POST /stock-out/` - 出库
- `POST /stock-return/` - 归还
- `POST /inventory-check/` - 盘点

### 申请审批
- `POST /applications/` - 创建申请（支持 `X-Idempotency-Key` 头）
- `GET /applications/` - 获取申请列表
- `GET /applications/{id}` - 获取单个申请
- `POST /approvals/` - 审批
- `POST /applications/{id}/resubmit` - 重新提交

### 审计与导出
- `GET /operation-logs/` - 操作日志
- `GET /export/` - 导出所有数据

## 数据模型

### 角色字段说明
- 所有操作都记录 `operator`（操作人）和 `operator_role`（角色）
- 角色示例：实验室管理员、仓库管理员、研究生、教授等
- 参与审批流程和审计追溯

### 危险等级
- `普通` - 单人审批
- `剧毒`、`高毒`、`爆炸品`、`易制毒` - 自动启用双人审批

### 申请状态
- `pending` - 待审批
- `approved` - 已通过（可出库）
- `rejected` - 已驳回（可重提）
- `completed` - 已出库完成

## 使用示例

### 创建试剂

```bash
curl -X POST "http://localhost:8000/reagents/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "乙醇",
    "cas_no": "64-17-5",
    "danger_level": "普通",
    "unit": "mL",
    "operator": "李老师",
    "operator_role": "实验室管理员"
  }'
```

### 创建申请（支持幂等）

```bash
curl -X POST "http://localhost:8000/applications/" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: my-unique-key-001" \
  -d '{
    "reagent_id": 1,
    "quantity": 100,
    "purpose": "实验使用",
    "applicant": "张学生",
    "applicant_role": "研究生"
  }'
```

### 审批

```bash
curl -X POST "http://localhost:8000/approvals/" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": 1,
    "approver": "李老师",
    "approver_role": "实验室管理员",
    "decision": "approved",
    "comment": "同意使用"
  }'
```

### 出库

```bash
curl -X POST "http://localhost:8000/stock-out/" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": 1,
    "operator": "王管理员",
    "operator_role": "仓库管理员"
  }'
```

### 导出数据（月底复盘）

```bash
curl "http://localhost:8000/export/" -o export_monthly.json
```

## 特点

1. **无登录设计** - 直接传递操作人/角色字段，适合内部小团队
2. **全链路审计** - 每条操作都有记录，可追溯
3. **数据持久化** - SQLite 本地存储，重启不丢数据
4. **错误分支完整** - 各种边界情况都有处理
5. **幂等设计** - 重复操作结果稳定
6. **导出功能** - 月底方便对账
