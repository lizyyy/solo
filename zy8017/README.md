# 剧院演出换座与退票规则校验工具

一个本地可运行的剧院运营工具，用于校验换座与退票申请是否符合规则，识别潜在问题并生成可执行的处理建议。

## 功能特性

- **连座被拆检测**: 识别原座位为连座但新座位被拆分的情况
- **无障碍座误换检测**: 检测无障碍座位与普通座位之间的换座
- **临开演禁退检测**: 根据开演时间自动判断是否超过退票/换座截止时间
- **跨票档补差计算**: 自动计算跨票档换座的价格差异（升级补收/降级退还）
- **重复订单号检测**: 识别重复的订单号记录
- **异常处理**: 处理座位图缺区块、数据格式错误等异常情况
- **报告导出**: 支持 Markdown 和 CSV 两种报告格式

## 项目结构

```
zy8017/
├── theatre_validator.py    # 主入口文件
├── requirements.txt        # 依赖配置
├── parsers/                # 数据解析模块
│   ├── __init__.py
│   ├── csv_parser.py       # CSV 订单解析器
│   ├── json_parser.py      # JSON 座位图解析器
│   └── yaml_parser.py      # YAML 规则解析器
├── storage/                # 状态存储模块
│   ├── __init__.py
│   ├── store.py            # 数据存储和模型定义
│   └── validator.py        # 数据验证器
├── engine/                 # 规则引擎模块
│   ├── __init__.py
│   └── rules_engine.py     # 核心规则校验逻辑
├── cli/                    # 命令行入口模块
│   ├── __init__.py
│   ├── command.py          # 命令行展示
│   └── reporter.py         # 报告生成器
└── samples/                # 样例数据
    ├── orders.csv          # 样例订单数据
    ├── seating.json        # 样例座位图
    └── rules.yaml          # 样例规则配置
```

## 安装

### 环境要求

- Python 3.7+

### 安装依赖

```bash
pip install -r requirements.txt
```

## 本地启动命令

### 查看帮助

```bash
python theatre_validator.py --help
```

### 运行验证

```bash
# 基本验证（使用自定义数据）
python theatre_validator.py validate \
    --orders your_orders.csv \
    --seating your_seating.json \
    --rules your_rules.yaml

# 详细模式（显示订单详情）
python theatre_validator.py validate \
    --orders samples/orders.csv \
    --seating samples/seating.json \
    --rules samples/rules.yaml \
    --verbose

# 导出 Markdown 报告
python theatre_validator.py validate \
    --orders samples/orders.csv \
    --seating samples/seating.json \
    --rules samples/rules.yaml \
    --output report.md

# 导出 CSV 报告
python theatre_validator.py validate \
    --orders samples/orders.csv \
    --seating samples/seating.json \
    --rules samples/rules.yaml \
    --csv report.csv
```

### 演示模式

使用内置样例数据运行演示：

```bash
# 快速演示
python theatre_validator.py demo

# 演示并指定输出文件
python theatre_validator.py demo --output my_report.md --csv my_report.csv
```

## 演示流程

以下是一条完整的演示流程：

```bash
# 1. 进入项目目录
cd /path/to/zy8017

# 2. 安装依赖
pip install -r requirements.txt

# 3. 运行演示（使用样例数据）
python theatre_validator.py demo

# 4. 查看生成的报告
# 演示会自动生成 demo_report.md 和 demo_report.csv

# 5. 查看报告内容
cat demo_report.md

# 6. 使用自定义数据运行
python theatre_validator.py validate \
    --orders samples/orders.csv \
    --seating samples/seating.json \
    --rules samples/rules.yaml \
    --verbose \
    --output my_report.md \
    --csv my_report.csv
```

## 数据格式说明

### 订单 CSV 格式

必需字段：
- `order_id`: 订单号
- `operation_type`: 操作类型（refund/退票 或 exchange/换座）
- `show_time`: 演出时间（格式：YYYY-MM-DD HH:MM:SS）
- `original_seats`: 原座位（格式：区域-排-号，多个座位用逗号分隔）
- `new_seats`: 新座位（换座操作必填，退票留空）
- `ticket_price`: 票价
- `request_time`: 申请时间（格式：YYYY-MM-DD HH:MM:SS）

可选字段：
- `customer_name`: 客户姓名
- `ticket_category`: 票档
- `notes`: 备注

### 座位图 JSON 格式

```json
{
  "metadata": {
    "theatre_name": "剧院名称",
    "show_name": "演出名称",
    "accessible_sections": ["无障碍区"]
  },
  "sections": {
    "A区": {
      "name": "VIP 区",
      "rows": {
        "1": {
          "name": "第1排",
          "seats": {
            "1": {"number": "1", "is_available": true, "is_accessible": false, "category": "VIP", "price": 280.0},
            "2": {"number": "2", "is_available": true, "is_accessible": false, "category": "VIP", "price": 280.0}
          }
        }
      }
    }
  }
}
```

### 规则 YAML 格式

```yaml
# 票档配置
ticket_categories:
  VIP:
    name: VIP 票
    price: 280.0
    refund_allowed: true
    exchange_allowed: true
    refund_fee_rate: 0.0
    sections:
      - A区

# 退票规则
refund_rules:
  enabled: true
  deadline_minutes: 60  # 开演前60分钟内禁止退票
  tiered_fees:
    - threshold_hours: 168  # 7天以上
      fee_rate: 0.0
    - threshold_hours: 72   # 3-7天
      fee_rate: 0.05

# 换座规则
exchange_rules:
  enabled: true
  deadline_minutes: 30
  allow_cross_section: true
  allow_cross_category: true
  price_difference_policy: customer_pays
```

## 检测的问题类型

| 问题类型 | 严重程度 | 说明 |
|---------|---------|------|
| 临开演禁退 | 严重 | 距离开演时间不足，禁止退票/换座 |
| 票档禁退 | 严重 | 该票档不允许退票 |
| 连座被拆 | 警告 | 原座位为连座，但新座位不是连座 |
| 无障碍座误换 | 警告 | 无障碍座位与普通座位之间的换座 |
| 重复订单号 | 警告 | 存在重复的订单号记录 |
| 跨票档换座 | 提示 | 换座涉及不同票档 |
| 跨区域换座 | 提示 | 换座涉及不同区域 |
| 价格差异 | 提示 | 存在价格差异（需补收或退还） |

## 处理建议类型

| 建议类型 | 说明 |
|---------|------|
| 批准 (approve) | 未发现违规问题，建议直接批准 |
| 拒绝 (reject) | 存在严重违规问题，建议拒绝申请 |
| 人工审核 (review) | 存在需要人工确认的情况，建议审核后决定 |

## 异常处理

### 重复订单号

系统会自动检测重复的订单号，并标记为需要人工审核。在报告中会显示重复记录的数量。

### 座位图缺区块

当订单中引用的区域在座位图中不存在时，系统会发出警告，标记该座位信息不完整，建议人工核对。

### 数据格式错误

解析 CSV/JSON/YAML 文件时，如果格式错误或缺少必要字段，系统会给出明确的错误提示。

## 样例数据说明

样例数据包含 14 笔订单，覆盖以下场景：

1. **ORD001**: 正常退票申请（提前7.5小时）
2. **ORD002**: 正常换座申请
3. **ORD003**: 临开演换座（开演前30分钟）
4. **ORD004**: 连座被拆（原5-5,5-6 → 新5-5,6-6）
5. **ORD005**: 从普通座换至无障碍座
6. **ORD006**: 从无障碍座换至普通座
7. **ORD007**: 跨票档升级（B区→A区，需补收）
8. **ORD008**: 跨票档降级（A区→B区，需退还）
9. **ORD009**: 临开演退票（开演前90分钟，接近截止时间）
10. **ORD010**: 重复订单号（两条记录）
11. **ORD011**: 低价票升级（C区→A区）
12. **ORD012**: 提前多天退票（5天前）
13. **ORD013**: 三连座被拆
14. **ORD014**: 低价票退票

## License

MIT License
