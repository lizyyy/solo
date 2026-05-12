# 多环境 API 密钥轮换服务

一个完整的 API 密钥轮换管理系统，支持多环境（测试、预发、生产）的密钥轮换流程。

## 功能特性

### 核心功能
- **服务登记**: 注册需要管理密钥轮换的服务
- **密钥版本管理**: 创建和管理密钥版本
- **轮换计划**: 创建、启动、执行密钥轮换计划
- **双写窗口**: 支持新旧密钥同时使用的过渡期
- **使用方确认**: 各使用方确认已切换到新密钥
- **主密钥切换**: 自动切换到新密钥
- **回滚机制**: 问题时快速回滚
- **计划关闭**: 完成后关闭轮换计划

### 业务规则
1. ✅ **生产环境必须审批**: 未经审批无法启动生产环境轮换
2. ✅ **双写窗口过期未确认不能切换**: 默认 2 小时双写窗口，所有使用方必须确认
3. ✅ **已关闭计划不能回滚**: 最终状态不可逆
4. ✅ **同一服务同时只能有一个进行中的轮换**: 避免冲突
5. ✅ **重复确认幂等**: 同一使用方多次确认返回相同结果

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务器
```bash
npm start
```

服务器将在 `http://localhost:3000` 运行。

### 3. 初始化演示数据
```bash
curl -s -X POST http://localhost:3000/api/seed-test-data | python3 -m json.tool
```

这会创建三个演示场景：
- **测试服务**: 正常轮换流程，已准备好切换
- **支付服务**: 预发环境回滚场景
- **内部报表服务**: 生产环境等待确认场景

## API 接口

### 服务管理

#### 登记服务
```bash
curl -X POST http://localhost:3000/api/services \
  -H "Content-Type: application/json" \
  -d '{"id": "my-service", "name": "我的服务", "description": "服务描述"}'
```

#### 查看所有服务
```bash
curl http://localhost:3000/api/services
```

### 密钥版本管理

#### 创建密钥版本
```bash
curl -X POST http://localhost:3000/api/services/{serviceId}/key-versions \
  -H "Content-Type: application/json" \
  -d '{"environment": "test", "secret": "my-secret-key"}'
```

#### 查看当前活跃密钥
```bash
# 查看所有环境
curl http://localhost:3000/api/services/{serviceId}/current-key

# 查看特定环境
curl "http://localhost:3000/api/services/{serviceId}/current-key?environment=production"
```

### 轮换计划

#### 创建轮换计划
```bash
curl -X POST http://localhost:3000/api/rotation-plans \
  -H "Content-Type: application/json" \
  -d '{"service_id": "my-service", "target_key_version_id": "key-version-id"}'
```

#### 审批生产计划
```bash
curl -X POST http://localhost:3000/api/rotation-plans/{planId}/approve \
  -H "Content-Type: application/json" \
  -d '{"approver": "security-leader@company.com", "notes": "已审阅变更计划"}'
```

#### 启动轮换
```bash
curl -X POST http://localhost:3000/api/rotation-plans/{planId}/start
```

#### 进入双写窗口
```bash
curl -X POST http://localhost:3000/api/rotation-plans/{planId}/dual-write
```

#### 使用方确认
```bash
curl -X POST http://localhost:3000/api/rotation-plans/{planId}/consumers/{consumerId}/confirm
```

#### 切换主密钥
```bash
curl -X POST http://localhost:3000/api/rotation-plans/{planId}/switch
```

#### 回滚
```bash
curl -X POST http://localhost:3000/api/rotation-plans/{planId}/rollback \
  -H "Content-Type: application/json" \
  -d '{"reason": "发现兼容性问题"}'
```

#### 关闭计划
```bash
curl -X POST http://localhost:3000/api/rotation-plans/{planId}/close
```

#### 查询计划详情
```bash
curl http://localhost:3000/api/rotation-plans/{planId}
```

## 演示场景

### 场景 1: 正常轮换流程（测试环境）
```bash
# 1. 初始化演示数据
curl -X POST http://localhost:3000/api/seed-test-data

# 2. 查看测试服务的轮换计划（状态应为 dual_write）
curl http://localhost:3000/api/rotation-plans/{test-plan-id}

# 3. 切换到新密钥（双写窗口已过，所有使用方已确认）
curl -X POST http://localhost:3000/api/rotation-plans/{test-plan-id}/switch

# 4. 验证密钥已切换
curl "http://localhost:3000/api/services/test-service/current-key?environment=test"
```

### 场景 2: 预发环境回滚
```bash
# 查看回滚状态
curl http://localhost:3000/api/rotation-plans/{staging-plan-id}

# 响应中会显示:
# - overall_status: "rolled_back"
# - rollback_reason: "预发环境发现兼容性问题..."
# - audit_timeline 包含 rolled_back 事件
```

### 场景 3: 生产环境缺确认阻断
```bash
# 尝试切换（会失败）
curl -X POST http://localhost:3000/api/rotation-plans/{prod-plan-id}/switch

# 响应显示未确认的使用方列表

# 确认剩余使用方
curl -X POST http://localhost:3000/api/rotation-plans/{prod-plan-id}/consumers/consumer-prod-1/confirm
curl -X POST http://localhost:3000/api/rotation-plans/{prod-plan-id}/consumers/consumer-prod-2/confirm

# 再次切换（会成功）
curl -X POST http://localhost:3000/api/rotation-plans/{prod-plan-id}/switch
```

## 查询接口输出说明

### 轮换计划详情
```json
{
  "id": "plan-id",
  "service": {
    "id": "service-id",
    "name": "服务名称"
  },
  "target_key": {
    "id": "key-id",
    "environment": "production",
    "version": "6"
  },
  "current_active_key": {
    "id": "current-key-id",
    "version": "5"
  },
  "overall_status": "waiting_confirmation",
  "has_mixed_environment_status": false,
  "environment_progress": [
    {
      "environment": "production",
      "status": "waiting_confirmation",
      "dual_write_started_at": "2026-05-12 09:00:00",
      "switch_at": null,
      "rollback_reason": null,
      "total_consumers": 3,
      "confirmed_consumers": 1,
      "unconfirmed_consumers": [
        {"id": "consumer-id", "name": "使用方名称"}
      ]
    }
  ],
  "unconfirmed_consumers": [],
  "approval": {
    "approver": "security-leader@company.com",
    "approved_at": "2026-05-12 07:30:00",
    "notes": "已审阅变更计划"
  },
  "audit_timeline": [
    {
      "action": "plan_created",
      "actor": "system",
      "environment": "production",
      "details": null,
      "created_at": "2026-05-12 07:00:00"
    }
  ],
  "timestamps": {
    "created_at": "2026-05-12 07:00:00",
    "started_at": "2026-05-12 08:00:00",
    "closed_at": null
  }
}
```

### 状态说明
- `created`: 计划已创建，等待启动
- `in_progress`: 轮换进行中
- `dual_write`: 双写阶段，新旧密钥同时可用
- `waiting_confirmation`: 等待所有使用方确认
- `switched`: 已切换到新密钥
- `rolled_back`: 已回滚
- `closed`: 计划已关闭

## 种子数据

启动时自动创建以下数据：

### 服务
| 服务 ID | 名称 | 描述 |
|---------|------|------|
| test-service | 测试服务 | 用于测试密钥轮换的服务 |
| payment-service | 支付服务 | 处理支付交易的核心服务 |
| internal-report | 内部报表服务 | 生成内部报表的服务 |

### 使用方
- **测试环境 (test-service)**: 测试客户端A、测试客户端B、测试客户端C
- **预发环境 (payment-service)**: 支付网关预发、支付SDK预发
- **生产环境 (internal-report)**: 报表生成器生产、数据仓库生产、ETL管道生产

### 初始密钥
每个服务都有一个初始活跃密钥版本。

## 测试脚本

### Bash 脚本
```bash
chmod +x test-rotation.sh
./test-rotation.sh
```

### Python 脚本
```bash
pip install requests
python3 test_rotation.py
```

## 数据持久化

数据库文件：`key_rotation.db`

使用 sql.js（纯 JavaScript SQLite 实现），无需原生编译，跨平台兼容。

## 配置

### 环境变量
- `PORT`: 服务器端口（默认 3000）
- `DB_PATH`: 数据库文件路径（默认 ./key_rotation.db）

### 双写窗口配置
在 `server.js` 中修改：
```javascript
const DUAL_WRITE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 小时
```

## 安全说明

- 密钥仅存储 SHA-256 哈希值，不存储明文
- 生产环境强制审批流程
- 所有操作都有审计日志
- 敏感操作需要明确的触发（切换、回滚、关闭）

## 故障排查

### 无法启动服务器
确保已安装依赖：`npm install`

### 数据库错误
删除数据库文件重新初始化：
```bash
rm key_rotation.db
npm start
```

### 切换被拒绝
检查：
1. 双写窗口是否已过（默认 2 小时）
2. 所有使用方是否已确认
3. 生产环境是否已审批

## License

MIT
