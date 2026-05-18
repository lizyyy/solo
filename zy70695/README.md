# 亲子候补年龄限制付款锁定排查CLI

一个用于管理亲子活动报名、候补队列、年龄限制、付款锁定的命令行工具。

## 功能特性

- **活动管理**: 创建活动，设置容量、年龄限制、价格
- **家庭管理**: 登记家庭信息，包括家长和儿童信息
- **报名管理**: 活动报名、自动候补、取消报名
- **候补队列**: 满员后自动进入候补，取消报名时自动递补
- **付款管理**: 付款锁定、付款确认、退款处理
- **问题排查**: 年龄违规检查、付款逾期检查
- **报告导出**: 机器可读JSON报告 + 人类可读文本报告
- **一致性验证**: 验证两种格式报告的数据一致性

## 快速开始

```bash
# 安装依赖
pip3 install click pydantic rich python-dateutil

# 加载样例数据
python3 family_cli.py load-samples

# 查看所有命令
python3 family_cli.py --help
```

## 命令示例

### 活动管理
```bash
# 添加活动
python3 family_cli.py activity add --id act001 --name "农场亲子游" --date 2026-06-01 \
    --max-capacity 10 --min-age 3 --max-age 12 --price 199.0 --lock-hours 24

# 列出活动
python3 family_cli.py activity list
```

### 家庭管理
```bash
# 添加家庭
python3 family_cli.py family add --id fam001 --parent "张爸爸" --phone "13800138000" \
    --total 3 --child "小明" 5 --child "小红" 3

# 列出家庭
python3 family_cli.py family list
```

### 报名管理
```bash
# 报名（满员自动进入候补）
python3 family_cli.py register add --id reg001 --activity-id act001 --family-id fam001

# 取消报名（自动递补候补）
python3 family_cli.py register cancel reg001

# 列出报名
python3 family_cli.py register list --activity-id act001
```

### 候补管理
```bash
# 查看候补队列
python3 family_cli.py waitlist show act001

# 手动触发候补递补
python3 family_cli.py waitlist promote act001
```

### 付款管理
```bash
# 确认付款
python3 family_cli.py payment pay --id pay001 --reg-id reg001 --amount 398.0 --txn-id TXN123

# 锁定付款
python3 family_cli.py payment lock reg001
```

### 问题排查
```bash
# 检查年龄违规
python3 family_cli.py troubleshoot age act001

# 检查付款逾期
python3 family_cli.py troubleshoot payment act001
```

### 报告生成
```bash
# 生成双重格式报告
python3 family_cli.py report activity act001

# 仅JSON报告
python3 family_cli.py report activity act001 --format json

# 仅文本报告
python3 family_cli.py report activity act001 --format text

# 验证报告一致性
python3 family_cli.py report verify act001
```

## 核心业务规则

### 年龄校验
- 报名时自动检查儿童年龄是否在活动允许范围内
- 超龄儿童报名被拒绝

### 候补递补
- 活动满员后，新报名自动进入候补队列
- 取消报名时，候补队列按顺序自动递补

### 付款锁定
- 确认报名后，付款有锁定窗口期
- 锁定期间可正常付款，逾期后需重新处理

## 数据文件

所有数据保存在 `data/` 目录下：
- `activities.json` - 活动数据
- `families.json` - 家庭数据
- `registrations.json` - 报名数据
- `payments.json` - 付款数据
- `waitlists.json` - 候补队列

报告保存在 `reports/` 目录下。
