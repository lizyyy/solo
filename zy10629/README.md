# 直播电商后台 - 主播优惠券撤回系统

本地数据库环境，用于开发和测试主播优惠券撤回功能。

## 快速开始

### 前置要求

- Docker
- Docker Compose

### 启动服务

```bash
./bin/start.sh
```

服务启动后：
- **PostgreSQL数据库**: localhost:5432
  - 数据库名: `coupon_withdraw`
  - 用户名: `admin`
  - 密码: `coupon123456`
- **pgAdmin管理界面**: http://localhost:5050
  - 邮箱: `admin@example.com`
  - 密码: `admin123`

### 常用命令

```bash
# 停止服务
./bin/stop.sh

# 查看日志
./bin/logs.sh
./bin/logs.sh -f  # 实时查看

# 重置数据库（删除所有数据重新初始化）
./bin/reset.sh

# 连接数据库命令行
./bin/psql.sh
```

## 数据库设计

### 核心表结构

| 表名 | 说明 |
|------|------|
| `anchors` | 主播信息表 |
| `coupon_batches` | 优惠券批次表 |
| `distribution_scopes` | 发放范围明细表 |
| `coupon_records` | 单张优惠券记录表 |
| `withdraw_reasons` | 撤回原因字典表 |
| `withdraw_operations` | 撤回操作记录表 |
| `operation_logs` | 操作日志表 |

### 状态枚举

#### 批次状态 (coupon_batch_status)
- `pending` - 待发放
- `distributed` - 已发放
- `withdrawing` - 撤回中
- `invalid` - 已失效

#### 单券状态 (coupon_record_status)
- `pending` - 待发放
- `distributed` - 已发放
- `used` - 已使用
- `expired` - 已过期
- `withdrawn` - 已撤回

#### 撤回操作状态 (withdraw_operation_status)
- `initiated` - 已发起
- `processing` - 处理中
- `partial` - 部分成功
- `completed` - 已完成
- `failed` - 失败

### 数据库视图

- `v_coupon_batch_stats` - 批次统计视图（列表页用）
- `v_withdraw_operation_details` - 撤回操作详情视图（历史页用）

## 测试数据说明

启动数据库后，会自动初始化以下测试场景：

### 1. 完整流转测试 (BATCH001)

**批次**: 618直播间专属满减券
- 总量: 100张
- 已发放: 50张
- 已使用: 5张
- 已撤回: 95张
- 当前状态: `withdrawing`（撤回中）

**流转路径**:
```
待发放(pending) → 已发放(distributed) → 撤回中(withdrawing)
```

**边界场景**:
- 用户已领券但主播要求整批撤回
- 5张已使用的券无法撤回，记录在`fail_details`中
- 接口**不静默覆盖**原记录，失败原因明确记录

### 2. 冲突记录测试 (BATCH002)

**批次**: 双11专属折扣券
- 总量: 500张
- 已发放: 200张
- 当前状态: `distributed`

**冲突场景**:
- 第一次撤回操作正在处理中（状态: `processing`）
- 第二次撤回请求到达，直接失败（状态: `failed`）
- 失败原因明确记录: `"该批次正在撤回中，请等待当前操作完成后再试"`

### 3. 导入坏行测试 (BATCH003)

**批次**: 年货节优惠券
- 状态: `pending`（待导入）

**预设坏行类型**（用于导入接口验证）:
1. 优惠券码重复
2. 用户ID格式错误
3. 手机号格式错误
4. 面额超出范围
5. 有效期开始时间大于结束时间
6. 必填字段为空

### 4. 已失效批次参考 (BATCH004)

**批次**: 已过期测试批次
- 状态: `invalid`
- 用于历史数据查询参考

## 验收要点

### 列表页验证

```sql
-- 查询所有批次列表（含统计数据）
SELECT * FROM v_coupon_batch_stats ORDER BY created_at DESC;
```

预期结果:
- 4个批次，状态分别为: withdrawing、distributed、pending、invalid
- 各批次数量统计正确（total/distributed/used/withdrawn）

### 详情页验证

```sql
-- 查询BATCH001的优惠券状态分布
SELECT status, COUNT(*) as count 
FROM coupon_records 
WHERE batch_id = 'b0000000-0000-0000-0000-000000000001' 
GROUP BY status;
```

预期结果:
- `used`: 5张（无法撤回）
- `withdrawn`: 95张（撤回成功）

### 历史页验证

```sql
-- 查询撤回操作历史
SELECT * FROM v_withdraw_operation_details ORDER BY created_at;
```

预期结果:
- BATCH001: 1条撤回记录，状态partial，成功95/失败5
- BATCH002: 2条撤回记录，1条processing、1条failed
- 失败详情可追溯

### 导出验证

```sql
-- 导出BATCH001所有优惠券（含状态、时间）
SELECT coupon_code, user_id, user_nickname, status, distribute_time, withdraw_time 
FROM coupon_records 
WHERE batch_id = 'b0000000-0000-0000-0000-000000000001' 
ORDER BY coupon_code;
```

预期结果:
- 100条记录，状态与详情页一致
- 时间戳完整可追溯

## 目录结构

```
.
├── bin/                    # 脚本目录
│   ├── start.sh           # 启动服务
│   ├── stop.sh            # 停止服务
│   ├── logs.sh            # 查看日志
│   ├── reset.sh           # 重置数据
│   └── psql.sh            # 连接数据库
├── sql/                    # SQL脚本
│   ├── init.sql           # 数据库初始化
│   └── test_data.sql      # 测试数据
├── docker-compose.yml      # Docker配置
└── README.md              # 本文档
```

## 关键业务规则

### 撤回边界处理

1. **已使用的券**: 不允许撤回，记录失败原因
2. **已过期的券**: 不允许撤回，状态自动变为invalid
3. **撤回中的批次**: 不允许重复发起撤回，返回冲突错误
4. **部分成功场景**: 记录每条失败的具体原因，便于运营排查

### 数据一致性保证

- 批次统计字段（distributed_count/used_count/withdrawn_count）与子表记录一致
- 所有状态变更记录操作日志
- 失败详情使用JSONB存储，支持灵活扩展

## 开发建议

1. 撤回接口建议使用异步处理，返回操作ID供轮询
2. 大批次撤回建议分批处理，避免长事务
3. 撤回前需校验：批次状态、操作权限、撤回原因
4. 撤回操作记录完整审计日志，支持问题追溯
