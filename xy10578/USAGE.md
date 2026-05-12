# 销售线索来源归因 CLI 工具使用指南

## 一、项目概述

这是一个用于销售线索来源归因的命令行工具，能够帮助销售团队解决多渠道线索合并去重和成交归因问题。

### 核心功能

- **数据导入**：支持导入广告点击、活动签到、转介绍记录和成交订单
- **客户合并**：自动通过邮箱、电话、外部ID识别同一客户
- **多维度归因**：支持首触达、末触达、加权归因三种模型
- **数据一致性检查**：自动检测来源时间晚于成交等问题
- **人工调整留痕**：所有人工修改都会记录前后差异和操作者
- **黑名单管理**：支持剔除无效线索
- **幂等操作**：重复导入和运行操作不会导致数据重复
- **操作审计**：完整记录所有操作历史

### 支持的线索来源

| 来源类型 | 说明 | 数据来源 |
|---------|------|---------|
| ad (广告) | 搜索引擎、社交媒体等付费广告 | 广告平台导出的点击数据 |
| event (活动) | 展会、发布会、线上研讨会等 | 活动签到系统数据 |
| referral (转介绍) | 客户或合作伙伴推荐 | CRM中的转介绍记录 |
| organic (自然流量) | 官网、口碑等自然渠道 | 无明确来源的线索 |

## 二、本地启动

### 系统要求

- Python 3.8+
- pip (Python包管理器)

### 安装步骤

```bash
# 1. 进入项目目录
cd /path/to/project

# 2. 安装依赖
pip install -r requirements.txt

# 3. 以开发模式安装CLI
pip install -e .

# 4. 验证安装
lead --help
```

### 数据库位置

默认数据库文件位置：`./.lead_attribution/database.sqlite`

可以通过环境变量自定义：
```bash
export LEAD_ATTRIBUTION_DB=/custom/path/database.sqlite
```

## 三、造数方法

### 3.1 使用内置样例数据

项目已提供完整的样例数据，位于 `sample_data/` 目录：

```
sample_data/
├── ad_clicks.json      # 广告点击数据 (4条)
├── events.json         # 活动签到数据 (4条)
├── referrals.json      # 转介绍数据 (3条)
├── deals.json          # 成交订单数据 (7条)
└── failure_case.json   # 失败案例数据 (用于演示)
```

### 3.2 样例数据覆盖场景

#### B2B客户
- **张伟 (科技创新有限公司)**
  - 1月15日：百度搜索广告点击
  - 2月10日：SaaS产品发布会签到
  - 2月25日：孙总转介绍
  - 3月5日：成交 ¥120,000 (多来源场景)

- **李明 (云途科技)**
  - 2月20日：微信广告点击
  - 3月12日：成交 ¥280,000 (单来源广告)

- **赵强 (数字科技集团)**
  - 2月10日：SaaS产品发布会签到
  - 2月28日：成交 ¥58,000 (单来源活动)

- **陈芳 (智能科技股份有限公司)**
  - 1月28日：360搜索广告点击
  - 3月20日：CIO峰会签到
  - 4月5日：成交 ¥500,000 (多来源场景)

- **周梅 (绿色科技)**
  - 3月10日：王经理转介绍
  - 3月25日：成交 ¥35,000 (单来源转介绍)

#### 个人客户
- **王红**
  - 3月5日：抖音广告点击
  - 3月18日：朋友转介绍
  - 3月20日：成交 ¥2,999 (多来源场景)

- **刘霞**
  - 3月15日：线上产品体验日签到
  - 3月18日：成交 ¥299 (单来源活动)

### 3.3 自定义数据格式

#### JSON格式示例 (广告点击)

```json
[
    {
        "email": "user@example.com",
        "phone": "13800138000",
        "name": "客户姓名",
        "customer_type": "b2b",
        "company_name": "公司名称",
        "campaign_id": "camp_001",
        "campaign_name": "营销活动名称",
        "channel": "百度搜索",
        "click_time": "2024-01-15 10:30:00",
        "cost": 58.50,
        "external_id": "ad_ext_001"
    }
]
```

#### 成交订单格式

```json
[
    {
        "email": "user@example.com",
        "phone": "13800138000",
        "name": "客户姓名",
        "customer_type": "individual",
        "deal_name": "订单名称",
        "amount": 2999.00,
        "close_time": "2024-03-05 15:30:00",
        "salesperson": "销售人员",
        "stage": "closed_won",
        "status": "won",
        "external_id": "deal_ext_001"
    }
]
```

### 关键字段说明

| 字段 | 必需 | 说明 |
|-----|------|------|
| email | 否* | 用于客户识别 |
| phone | 否* | 用于客户识别 |
| external_id | 否* | 用于去重（至少需要一个） |
| name | 是 | 客户名称 |
| customer_type | 否 | b2b 或 individual，默认 individual |
| company_name | 否 | B2B客户公司名称 |

## 四、主要演示路径

### 一键演示

```bash
chmod +x demo.sh
./demo.sh
```

### 分步演示

#### 第1步：初始化数据库

```bash
# 首次初始化
lead init

# 强制重新初始化（清空数据）
lead init --force
```

**预期输出**：
```
┌─ 初始化完成 ──────────────────────────────────┐
│ 数据库初始化成功！                             │
│ 数据库路径: /path/to/.lead_attribution/...    │
└───────────────────────────────────────────────┘
```

#### 第2步：查看系统状态

```bash
lead status
```

**预期输出**：显示当前客户数、订单数、归因记录数等统计信息。

#### 第3步：导入数据

```bash
# 导入广告点击
lead import ads sample_data/ad_clicks.json

# 导入活动签到
lead import events sample_data/events.json

# 导入转介绍
lead import referrals sample_data/referrals.json

# 导入成交订单
lead import deals sample_data/deals.json
```

**每次导入的预期输出**：
```
┌─ 导入结果 ──────────────────────────────────┐
│ 指标       │ 值                             │
│ 导入ID     │ import_xxxxxxxx                 │
│ 源类型     │ ad_click                        │
│ 文件路径   │ sample_data/ad_clicks.json      │
│ 状态       │ [green]SUCCESS[/green]          │
│ 总记录数   │ 4                               │
│ 成功       │ 4                               │
│ 失败       │ 0                               │
│ 重复       │ 0                               │
│ 黑名单     │ 0                               │
└─────────────────────────────────────────────┘
```

#### 第4步：检查数据一致性

```bash
lead check
```

**预期输出**：检查是否存在来源时间晚于成交等问题。

#### 第5步：运行归因计算

```bash
python3 -c "
from lead_attribution.database import DatabaseManager
from lead_attribution.attribution_engine import AttributionEngine

db = DatabaseManager()
engine = AttributionEngine(db)
result = engine.run_attribution_for_all_deals()
print(f'处理了 {result[\"total_deals_processed\"]} 个订单')
"
```

#### 第6步：查看归因报告

```bash
# 查看所有归因类型报告
lead report

# 只看首触达归因
lead report --type first

# 只看末触达归因
lead report --type last

# 只看加权归因
lead report --type weighted

# 输出JSON格式
lead report --json
```

**预期输出示例**：
```
┌─ 概览 ───────────────────────────────────────┐
│ 指标         │ 值                           │
│ 总客户数     │ 7                             │
│ 总订单数     │ 7                             │
│ 总收入       │ ¥996,298.00                  │
│ 总归因数     │ 21                            │
│ 人工调整数   │ 0                             │
└─────────────────────────────────────────────┘

┌─ 首触达归因 ─────────────────────────────────┐
│ 来源     │ 金额         │ 占比              │
│ 广告     │ ¥900,000.00  │ 90.3%            │
│ 活动     │ ¥58,299.00   │ 5.9%             │
│ 转介绍   │ ¥38,000.00   │ 3.8%             │
└─────────────────────────────────────────────┘
```

#### 第7步：查看订单详情

```bash
# 先获取订单ID
python3 -c "
import sqlite3
import os
db_path = os.path.join(os.getcwd(), '.lead_attribution', 'database.sqlite')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute('SELECT id, deal_name FROM deals')
for row in cursor.fetchall():
    print(f'{row[0]}: {row[1]}')
conn.close()
"

# 查看特定订单详情
lead detail <订单ID>
```

**预期输出**：
- 订单基本信息
- 客户信息
- 触点历史（按时间排序）
- 三种归因模型的结果
- 销售跟进记录

#### 第8步：人工调整归因

```bash
lead adjust <订单ID> \
    --attr-type last_touch \
    --source referral:60 \
    --source ad:40 \
    --operator "销售经理" \
    --reason "根据实际业务情况，该订单主要来自转介绍"
```

**预期输出**：
```
┌─ 人工归因 ───────────────────────────────────┐
│ 归因调整成功！                               │
│ 调整了 1 条归因记录                          │
│ 操作人: 销售经理                              │
│ 原因: 根据实际业务情况...                     │
└─────────────────────────────────────────────┘
  - referral: 60.0% (¥72,000.00)
  - ad: 40.0% (¥48,000.00)
```

#### 第9步：查看操作历史

```bash
# 查看所有历史
lead history

# 限制条数
lead history --limit 10

# 筛选特定记录类型
lead history --record-type attribution
```

**预期输出**：显示操作时间、操作类型、记录ID、操作人、原因等。

## 五、失败路径演示

### 5.1 重复导入

```bash
# 第一次导入（成功）
lead import ads sample_data/ad_clicks.json

# 第二次导入（显示重复）
lead import ads sample_data/ad_clicks.json
```

**预期输出**：
```
┌─ 导入结果 ──────────────────────────────────┐
│ 总记录数   │ 4                               │
│ 成功       │ 0                               │
│ 失败       │ 0                               │
│ 重复       │ 4                               │  <-- 检测到重复
└─────────────────────────────────────────────┘
```

### 5.2 黑名单剔除

```bash
# 添加黑名单
lead blacklist spam@example.com \
    --type email \
    --reason "垃圾邮箱，多次无效咨询" \
    --operator "admin"

# 导入包含该邮箱的数据
lead import ads sample_data/failure_case.json
```

**预期输出**：
```
┌─ 导入结果 ──────────────────────────────────┐
│ 总记录数   │ 3                               │
│ 成功       │ 1                               │
│ 失败       │ 1                               │  <-- 缺少必要字段
│ 重复       │ 1                               │
│ 黑名单     │ 1                               │  <-- 黑名单剔除
└─────────────────────────────────────────────┘
```

### 5.3 来源时间晚于成交

导入一组测试数据来演示这个问题：

```bash
# 创建测试数据
cat > sample_data/after_deal.json << 'EOF'
[
    {
        "email": "late@example.com",
        "phone": "13999999999",
        "name": "迟到客户",
        "customer_type": "individual",
        "campaign_id": "camp_late",
        "campaign_name": "迟到的广告",
        "channel": "测试",
        "click_time": "2024-04-01 10:00:00"
    }
]
EOF

# 先导入订单（成交时间较早）
cat > sample_data/early_deal.json << 'EOF'
[
    {
        "email": "late@example.com",
        "phone": "13999999999",
        "name": "迟到客户",
        "customer_type": "individual",
        "deal_name": "提前成交的订单",
        "amount": 10000.00,
        "close_time": "2024-03-01 10:00:00",
        "status": "won"
    }
]
EOF

# 导入订单
lead import deals sample_data/early_deal.json

# 导入来源（时间在成交之后）
lead import ads sample_data/after_deal.json

# 检查数据一致性
lead check
```

**预期输出**：
```
发现以下问题:
  - [source_after_deal] Customer 迟到客户 has 1 touch points after deal close
```

## 六、归因模型说明

### 6.1 首触达归因 (First Touch)

- **规则**：100% 归因为最早的有效触点
- **适用场景**：评估品牌建设、获客渠道效果
- **示例**：张伟的订单 ¥120,000 → 100% 归给1月15日的广告

### 6.2 末触达归因 (Last Touch)

- **规则**：100% 归因为成交前最后一个有效触点
- **适用场景**：评估转化漏斗末端渠道效果
- **示例**：张伟的订单 ¥120,000 → 100% 归给2月25日的转介绍

### 6.3 加权归因 (Weighted)

- **规则**：
  - 首触：22.5%
  - 末触：32.5%
  - 中间触点：平均分配剩余的 45%
- **适用场景**：综合评估各渠道贡献
- **示例**（张伟，3个触点）：
  - 广告（首触）：22.5% → ¥27,000
  - 活动（中间）：45% → ¥54,000
  - 转介绍（末触）：32.5% → ¥39,000

## 七、常见问题

### Q1: 如何判断两个记录是同一客户？

A: 按以下优先级自动匹配：
1. external_id（外部系统ID）
2. email（邮箱）
3. phone（电话）

### Q2: 重复导入数据会怎样？

A: 系统通过 external_id 检测重复记录，重复数据会被标记为 `duplicate` 但不会报错，保持幂等性。

### Q3: 人工调整归因后会有记录吗？

A: 是的。所有人工调整都会：
1. 记录 `audit_logs` 表，包含旧值和新值
2. 标记 `is_manual = true`
3. 记录操作人和调整原因

### Q4: 如何处理无效线索？

A: 使用黑名单功能：
```bash
lead blacklist bad@email.com --type email --reason "无效线索"
```

### Q5: 数据库可以重置吗？

A: 可以：
```bash
lead init --force
```

## 八、命令速查表

| 命令 | 说明 |
|-----|------|
| `lead init` | 初始化数据库 |
| `lead init --force` | 强制重置数据库 |
| `lead status` | 查看系统状态 |
| `lead import ads <file>` | 导入广告点击 |
| `lead import events <file>` | 导入活动签到 |
| `lead import referrals <file>` | 导入转介绍 |
| `lead import deals <file>` | 导入成交订单 |
| `lead check` | 检查数据一致性 |
| `lead report` | 查看归因报告 |
| `lead detail <deal_id>` | 查看订单详情 |
| `lead adjust ...` | 人工调整归因 |
| `lead history` | 查看操作历史 |
| `lead blacklist ...` | 添加黑名单 |

## 九、数据结构

### 主要数据表

1. **customers** - 客户主表
2. **ad_clicks** - 广告点击
3. **event_attendances** - 活动签到
4. **referrals** - 转介绍
5. **deals** - 成交订单
6. **attributions** - 归因结果
7. **audit_logs** - 操作审计日志
8. **import_sessions** - 导入会话记录
9. **blacklist** - 黑名单
10. **sales_follow_ups** - 销售跟进记录

## 十、技术栈

- **语言**：Python 3.8+
- **CLI框架**：Click
- **数据库**：SQLite3
- **终端美化**：Rich
- **日期处理**：python-dateutil
