# 生鲜缺货补偿系统

## 概述

本系统用于处理生鲜商品缺货后的完整流程，包括缺货识别、确认、补偿、回滚和结算。系统提供API接口和命令行工具两种使用方式。

## 核心功能

### 1. 业务流程覆盖

- **缺货识别**: 登记缺货商品及数量
- **缺货确认**: 确认或取消缺货记录
- **补偿处理**: 支持退款、换货、补券、部分退款四种补偿方式
- **补偿回滚**: 支持撤销已处理的补偿
- **结算处理**: 按时间段批量结算补偿记录

### 2. 幂等性保证

- 所有写操作支持幂等性校验
- 可传入 `idempotent_key` 防止重复提交
- 重复请求返回相同结果，不会产生重复数据

### 3. 敏感字段脱敏

- 根据角色权限自动脱敏敏感字段
- 支持手机号、姓名、ID、IP地址等脱敏
- 脱敏规则在后端层应用，不依赖前端

### 4. 业务规则校验

- **部分缺货校验**: 缺货数量不能超过订购数量
- **重复补偿校验**: 同一缺货记录不能重复补偿
- **金额一致性校验**: 退款金额不能大于缺货金额
- **状态流转校验**: 确保状态变更合法
- **角色权限校验**: 按角色限制操作权限

### 5. 审计日志

- 所有操作均记录审计日志
- 包含操作人、角色、时间、结果、原因等
- 敏感字段在日志中自动脱敏

### 6. 数据导出

- 支持导出缺货记录、补偿记录、结算记录
- 支持Excel(xlsx)和CSV格式
- 导出数据与账单数据一致

## 角色权限矩阵

| 角色 | 查询 | 识别 | 确认 | 补偿 | 回滚 | 结算 | 导出 | 导入 |
|------|------|------|------|------|------|------|------|------|
| viewer | ✓ | | | | | | ✓ | |
| customer_service | ✓ | ✓ | | | | | ✓ | |
| operator | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ |
| finance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 项目结构

```
.
├── main.py              # FastAPI应用入口
├── cli.py               # 命令行工具
├── models.py            # 数据库模型
├── schemas.py           # Pydantic数据结构
├── database.py          # 数据库连接配置
├── compensation_service.py  # 核心业务服务
├── export_service.py    # 导出服务
├── rules.py             # 业务规则引擎
├── idempotent.py        # 幂等性管理
├── data_masking.py      # 数据脱敏
├── audit_service.py     # 审计服务
├── init_demo.py         # 演示数据初始化
└── requirements.txt     # 依赖包
```

## 安装和运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化演示数据

```bash
python init_demo.py
```

### 3. 启动API服务

```bash
python main.py
```

服务启动后访问: http://localhost:8000/docs 查看API文档

### 4. 使用命令行工具

```bash
# 查看帮助
python cli.py --help

# 识别缺货
python cli.py identify DEMO000001 P0001 2 --remark "生鲜缺货"

# 确认缺货
python cli.py confirm Sxxxxxxxxx

# 处理补偿（退款）
python cli.py compensate Sxxxxxxxxx --type refund

# 处理补偿（发券）
python cli.py compensate Sxxxxxxxxx --type coupon --coupon-value 50

# 回滚补偿
python cli.py rollback Cxxxxxxxxx "操作错误"

# 结算处理
python cli.py settle --start-date 2024-01-01 --end-date 2024-12-31

# 导出数据
python cli.py export --type shortage --start-date 2024-01-01 --end-date 2024-12-31
```

## API使用说明

### 请求头

所有API需要传入以下请求头:
- `X-Operator-Role`: 角色 (admin/operator/finance/customer_service/viewer)
- `X-Operator-ID`: 操作人ID
- `X-Operator-Name`: 操作人姓名

### 主要接口

- `POST /api/v1/shortages/identify` - 缺货识别
- `POST /api/v1/shortages/confirm` - 缺货确认
- `POST /api/v1/compensations/process` - 补偿处理
- `POST /api/v1/compensations/rollback` - 补偿回滚
- `POST /api/v1/settlements/process` - 结算处理
- `POST /api/v1/export` - 导出数据
- `GET /api/v1/audit-logs` - 查询审计日志

## 补偿类型说明

1. **refund (全额退款)**: 按缺货金额全额退款
2. **partial_refund (部分退款)**: 部分退款+发券
3. **coupon (发券)**: 仅发放优惠券
4. **exchange (换货)**: 更换其他商品

## 数据库表说明

| 表名 | 说明 |
|------|------|
| orders | 订单表 |
| order_items | 订单商品表 |
| shortage_records | 缺货记录表 |
| compensation_records | 补偿记录表 |
| coupons | 优惠券表 |
| settlement_records | 结算记录表 |
| settlement_items | 结算明细表 |
| audit_logs | 审计日志表 |
| idempotent_keys | 幂等性记录表 |
| rule_configs | 规则配置表 |
