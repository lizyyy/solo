# 内部服务配额 API - 快速启动指南

## 环境准备

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 初始化数据库和示例数据
```bash
python init_data.py
```

这将创建：
- **4个团队**: 交易平台团队、数据智能团队、支付网关团队、用户中心团队
- **4个服务**: 统一认证服务、订单查询服务、消息推送服务、风控评估服务
- **预设配额**: 每个团队对应服务的月度配额

### 3. 启动 API 服务
```bash
python app.py
```

服务将在 `http://localhost:5000` 启动

### 4. 运行测试场景
```bash
./test_scenarios.sh
```

这将演示所有功能场景

---

## API 端点说明

### 团队管理
- `POST /api/teams` - 创建团队
- `GET /api/teams` - 列出所有团队

### 服务管理
- `POST /api/services` - 创建服务
- `GET /api/services` - 列出所有服务

### 配额管理
- `POST /api/quotas` - 配置月度配额
  ```json
  {
    "team_id": 1,
    "service_id": 1,
    "monthly_quota": 50000,
    "month": "2026-05"
  }
  ```

### 调用量上报
- `POST /api/usage` - 记录调用量（支持幂等）
  ```json
  {
    "team_id": 1,
    "service_id": 1,
    "request_id": "unique_request_001",
    "amount": 100,
    "priority": "normal"  // normal 或 high
  }
  ```

### 临时扩容
- `POST /api/expansions` - 申请扩容
- `POST /api/expansions/<id>/approve` - 审批扩容
- `POST /api/expansions/<id>/reject` - 拒绝扩容

### 配额借用
- `POST /api/borrows` - 申请借用
- `POST /api/borrows/<id>/approve` - 审批借用
- `POST /api/borrows/<id>/reject` - 拒绝借用

### 查询接口
- `GET /api/teams/<team_id>/quotas` - 查看团队配额和冻结调用
- `GET /api/teams/<team_id>/borrows` - 查看借入借出记录

### 月度对账
- `POST /api/reconciliation` - 生成月度对账
- `GET /api/reconciliation` - 查询对账结果

---

## 快速测试命令

```bash
# 查看团队
curl http://localhost:5000/api/teams

# 查看服务
curl http://localhost:5000/api/services

# 查看交易平台团队配额
curl http://localhost:5000/api/teams/1/quotas

# 记录一次正常调用
curl -X POST http://localhost:5000/api/usage \
  -H "Content-Type: application/json" \
  -d '{"team_id":1,"service_id":1,"request_id":"test_001","amount":100}'

# 查看对账
curl -X POST http://localhost:5000/api/reconciliation -H "Content-Type: application/json" -d '{}'
curl http://localhost:5000/api/reconciliation?team_id=1
```
