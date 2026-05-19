# 预览环境租约释放审计排查 CLI

用于管理和审计预览环境租约的命令行工具，帮助团队高效管理有限的预览环境资源。

## 核心功能

### 1. 租约过期判断
- 自动检测过期租约并释放环境
- 显示即将到期的租约（2小时内）
- 剩余时间计算

### 2. 续租冲突检测
- 检查环境是否已被占用
- 验证续租人是否为原租用人
- 提供冲突详情（当前占用人、分支信息等）

### 3. 强制释放机制
- 管理员可强制释放任何环境
- 记录释放原因和时间
- 标记租约状态为强制释放

### 4. 重复请求幂等性
- 通过 `request-id` 实现幂等操作
- 重复租用/续租请求不会产生副作用
- 返回幂等标识便于客户端处理

### 5. 环境占用报表
- 机器可读的JSON格式输出
- 人类友好的表格格式输出
- 包含利用率统计、环境状态汇总

## 安装依赖

```bash
pip3 install click python-dateutil tabulate pydantic
```

## 命令列表

### 基本操作
- `lease <env_id> <branch> <assignee> -r <reason>` - 租用环境
- `renew <env_id> <assignee> -r <reason>` - 续租环境
- `release <env_id> [--force]` - 释放环境

### 查询命令
- `status` - 查看所有环境状态
- `available` - 列出所有可用环境
- `history` - 查看租约历史记录
- `who-can-renew` - 列出可续租的环境
- `who-should-release` - 列出应释放的环境（过期或即将过期）

### 管理命令
- `check-expired` - 检查并自动释放过期租约
- `report` - 生成完整的占用报表

### 全局选项
- `-f, --format [json|table]` - 输出格式
- `-q, --quiet` - 静默模式，仅输出JSON

## 使用示例

### 租用环境
```bash
# 基本租用
python3 -c "from env_audit.cli import cli; cli(['lease', 'env-01', 'feature/user-login', 'zhangsan', '-r', '用户登录功能联调'])"

# 使用幂等请求ID
python3 -c "from env_audit.cli import cli; cli(['lease', 'env-02', 'feature/payment', 'lisi', '-r', '支付测试', '--request-id', 'req-001'])"
```

### 续租环境
```bash
python3 -c "from env_audit.cli import cli; cli(['renew', 'env-01', 'zhangsan', '-r', '需要更多时间联调'])"
```

### 释放环境
```bash
# 正常释放
python3 -c "from env_audit.cli import cli; cli(['release', 'env-01'])"

# 强制释放
python3 -c "from env_audit.cli import cli; cli(['release', 'env-01', '--force', '-r', '管理员强制回收'])"
```

### 查看状态和报表
```bash
# 表格格式（默认）
python3 -c "from env_audit.cli import cli; cli(['status'])"

# JSON格式
python3 -c "from env_audit.cli import cli; cli(['-f', 'json', 'report'])"
```

## 测试样例

运行样例数据生成器，查看所有测试场景：

```bash
python3 sample_data.py
```

包含的测试场景：
1. **正常输入场景** - 标准租用、续租、释放流程
2. **边界冲突场景** - 租用人冲突、续租人不符、释放权限验证
3. **重复请求幂等场景** - 相同请求ID重复调用
4. **租约过期判断场景** - 过期自动检测、即将到期提醒
5. **空结果场景** - 无数据时的返回格式
6. **脏数据/异常输入场景** - 不存在的环境、空值等边界情况

## 运行单元测试

```bash
python3 -m pytest test_lease_audit.py -v
```

所有29个测试用例全部通过。

## 数据模型

### Lease（租约）
- `lease_id` - 租约唯一标识
- `env_id` - 环境ID
- `branch_name` - 分支名称
- `assignee` - 占用人
- `start_time` - 开始时间
- `end_time` - 到期时间
- `reason` - 租用理由
- `status` - 状态 (active/expired/released/force_released)

### Environment（环境）
- `env_id` - 环境ID
- `name` - 环境名称
- `status` - 状态 (occupied/available/maintenance)
- `current_lease` - 当前租约
- `lease_history` - 租约历史记录

## 核心规则说明

1. **租约过期判断** - 当当前时间 > 租约到期时间且租约状态为active时判定为过期
2. **续租冲突** - 只有原租用人可以续租，非原租用人尝试续租会返回冲突错误
3. **强制释放** - 管理员可绕过租用人验证，直接释放任何环境
4. **幂等性** - 相同的request-id多次调用只会执行一次操作
5. **维护状态** - 处于维护状态的环境无法被租用

## 输出一致性

所有命令都支持两种输出格式，确保：
- 机器可读的JSON包含完整数据结构
- 人类可读的表格包含关键信息
- 两种输出的数据保持一致性
