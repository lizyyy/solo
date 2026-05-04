# 接龙报名处理工具

一个用于自动化处理微信群/家委会乱糟糟接龙报名的本地工具。

## 功能特性

- 📝 **智能解析**：从混乱的接龙文本中提取姓名、手机号、人数、时段、忌口等信息
- 🔀 **自动去重**：合并重复报名、同手机号不同昵称、同姓名多条记录
- 💳 **付款匹配**：自动关联付款记录，标记已付款/未付款/多付/少付
- 📋 **规则引擎**：根据容量限制、儿童比例等规则生成分组和候补名单
- 📊 **多格式导出**：CSV、JSON、通知文案、Markdown/HTML报告

## 快速开始

### 安装

```bash
# 克隆项目后
cd zy1107

# 安装依赖
pip install -r requirements.txt

# 以开发模式安装
pip install -e .
```

### 运行示例

```bash
# 使用正常场景样例数据
signup process -i examples/normal -o output/normal -v

# 使用异常场景样例数据（测试去重和付款匹配）
signup process -i examples/anomalies -o output/anomalies -v

# 使用超员场景样例数据（测试容量限制和候补名单）
signup process -i examples/overflow -o output/overflow -v
```

### 运行自检

```bash
# 运行所有自检测试
signup test --all

# 测试特定模块
signup test --parse    # 测试解析功能
signup test --merge    # 测试合并功能
signup test --rules    # 测试规则引擎
signup test --export   # 测试导出功能
```

## 目录结构

```
.
├── input/                    # 默认输入目录
│   └── rules.json            # 默认规则配置
├── examples/                 # 样例数据
│   ├── normal/               # 正常场景
│   │   ├── chat.txt          # 接龙文本
│   │   ├── payments.csv      # 付款记录
│   │   └── rules.json        # 规则配置
│   ├── anomalies/            # 异常场景（去重、改名、多付少付）
│   │   ├── chat.txt
│   │   ├── payments.csv
│   │   ├── rules.json
│   │   └── optional_edits.csv # 人工修改记录
│   └── overflow/             # 超员场景（容量限制、候补）
│       ├── chat.txt
│       ├── payments.csv
│       └── rules.json
├── src/
│   └── signup_handler/
│       ├── __init__.py
│       ├── cli.py             # 命令行接口
│       ├── models.py          # 数据模型
│       ├── parser.py          # 文本解析器
│       ├── filereader.py      # 文件读取
│       ├── merger.py          # 去重合并和付款匹配
│       ├── rule_engine.py     # 规则引擎（容量、分组）
│       └── exporter.py        # 导出模块
├── tests/
│   └── test_signup_handler.py # 单元测试
├── output/                    # 输出目录（运行后生成）
├── requirements.txt
└── pyproject.toml
```

## 输入文件格式

### 1. chat.txt - 接龙文本

直接从微信群复制的接龙内容，支持各种混乱格式：

```
1. 张三 2大1小 周六上午 已转账
2. 李四+朋友，手机号写在后面，不能吃花生
3. 王五 夫妻 周六下午 13800138000
4. 赵六 报名3人 周日上午 已付款200元
```

### 2. payments.csv - 付款记录

CSV格式，列名可以灵活识别：

```csv
付款人,金额,付款时间,交易号,备注
张三,250,2026-05-01 10:30:00,PAY001,2大1小
李四,100,2026-05-01 11:00:00,PAY002,
```

支持的列名变体：
- 付款人姓名：付款人、姓名、名字、payer、name
- 金额：金额、付款金额、转账金额、amount、payment
- 时间：时间、付款时间、转账时间、time、date
- 交易号：交易号、订单号、流水号、transaction_id、id
- 备注：备注、说明、附言、notes、comment

### 3. rules.json - 规则配置

```json
{
  "total_max_capacity": 30,
  "price_per_adult": 100,
  "price_per_child": 50,
  "group_size": 8,
  "prefer_same_time_together": true,
  "allow_time_slot_conflict": false,
  "time_slots": [
    {
      "name": "周六上午",
      "max_capacity": 15,
      "max_child_ratio": 0.5,
      "priority": 2
    },
    {
      "name": "周六下午",
      "max_capacity": 15,
      "max_child_ratio": 0.5,
      "priority": 1
    }
  ]
}
```

字段说明：
- `total_max_capacity`: 总人数上限
- `price_per_adult`: 成人单价（元）
- `price_per_child`: 儿童单价（元）
- `group_size`: 每组人数上限
- `prefer_same_time_together`: 同时段尽量同组
- `time_slots`: 时段配置
  - `name`: 时段名称
  - `max_capacity`: 时段容量上限
  - `max_child_ratio`: 儿童比例上限（0.5 = 50%）
  - `priority`: 优先级（数字大优先分配）

### 4. optional_edits.csv - 人工修改（可选）

用于补录信息、改名、改人数等：

```csv
原姓名,新姓名,新手机号,总人数,儿童数,时段,备注
王大,王五,13700137000,2,0,周六上午,付款人姓名是王大，实际是王五
李四,李四,13900139000,1,0,周六下午,补录手机号
```

## 输出文件说明

运行后会在输出目录生成以下文件：

| 文件名 | 说明 |
|--------|------|
| `cleaned.csv` | 已确认的干净名单（CSV格式，可直接编辑） |
| `waitlist.csv` | 候补名单 |
| `grouping.json` | 详细分组信息（JSON格式） |
| `notification.txt` | 通知文案（可直接复制到群里） |
| `report.md` | Markdown格式报告 |
| `report.html` | 带样式的HTML报告（推荐查看） |

## 核心算法

### 1. 文本解析

支持的格式模式：
- 序号格式：`1. 张三...`、`2、李四...`
- 人数格式：`2大1小`、`3人`、`报名2人`、`夫妻`、`一家`
- 时段格式：`周六上午`、`周六下午`、`周日上午`、`周日下午`
- 手机号：自动识别11位手机号
- 忌口：`不能吃花生`、`忌口辣`、`过敏`、`素食`
- 付款：`已转账`、`已付款`、`已发红包`、`截图`

### 2. 去重合并

合并规则（按优先级）：
1. **相同手机号**：视为同一人，合并多条记录
2. **相同姓名**：疑似同一人，标记为待确认
3. **选择主记录**：优先选择信息完整、有付款、有手机号的记录

### 3. 付款匹配

匹配规则：
1. **精确匹配**：付款人姓名 = 报名人姓名
2. **相似匹配**：姓名相似度 > 80%（如"李四"和"李四(群昵称)"）
3. **标记异常**：
   - 多付：实付 > 应付
   - 少付：实付 < 应付
   - 无对应报名：付款人未报名

### 4. 规则引擎

容量限制：
- 总人数限制
- 时段人数限制
- 儿童比例限制

入选优先级：
1. 已付款 > 多付 > 少付 > 未付款
2. 人数多的家庭优先（尽量不拆分）
3. 早报名优先（行号小）

分组算法：
- 同时段尽量同组
- 考虑儿童比例限制
- 家庭不拆分

## 测试说明

### 运行单元测试

```bash
pytest tests/ -v
```

### 运行自检测试

```bash
signup test --all
```

自测内容：
- 解析功能：测试各种格式的接龙文本
- 合并功能：测试去重、付款匹配
- 规则引擎：测试容量限制、儿童比例、优先级
- 导出功能：测试文件生成

## 样例场景说明

### 1. examples/normal - 正常场景

- 15条报名记录
- 全部有对应付款
- 验证正常流程

### 2. examples/anomalies - 异常场景

- 20条报名记录
- 包含：
  - 张三：同手机号3次报名（2大1小 → 3大1小）
  - 李四：同手机号不同昵称
  - 王五/小王：同手机号不同姓名
  - 赵六：同手机号3次报名（补截图）
  - 孙七：同手机号改人数（3人→2人→4人）
  - 周八：同手机号改时段（周六上午→周六下午）
- 付款异常：
  - 张三多付（应付250，实付500）
  - 李四少付（应付100，实付80）
  - 王大：付款姓名与报名姓名不一致
  - 无此人：找不到对应报名的付款
- 人工修改：
  - 王大 → 王五
  - 李四(群昵称) → 李四

### 3. examples/overflow - 超员场景

- 20条报名记录
- 总容量限制15人
- 验证：
  - 容量限制
  - 儿童比例限制（40%）
  - 付款优先规则
  - 候补名单生成

## 常见问题

### Q: 解析结果不准确怎么办？

A: 可以使用 `optional_edits.csv` 人工修正，或者直接编辑 `cleaned.csv` 后重新处理。

### Q: 付款人姓名和报名人不一致怎么办？

A: 系统会自动标记为"姓名不一致"，可以：
1. 使用 `optional_edits.csv` 添加修改记录
2. 查看报告中的警告信息

### Q: 如何添加新的时段？

A: 在 `rules.json` 的 `time_slots` 数组中添加新的时段配置，时段名称要与接龙文本中的表述一致。

### Q: 如何调整分组大小？

A: 修改 `rules.json` 中的 `group_size` 参数。

## 错误提示说明

| 错误信息 | 含义 | 建议 |
|----------|------|------|
| 手机号位数异常 | 解析到的手机号不是11位 | 检查接龙文本中的手机号格式 |
| 未明确说明人数 | 无法识别报名人数，默认1人 | 可通过 optional_edits.csv 修正 |
| 未指定时段 | 未说明参加时段，默认周六上午 | 检查接龙文本 |
| 时段超员 | 某时段报名人数超过容量 | 会自动生成候补名单 |
| 付款人姓名不一致 | 付款姓名与报名姓名不同 | 检查是否为同一人，或用 optional_edits 修正 |
| 疑似多付 | 付款金额大于应付金额 | 可能是多人合并付款 |
| 疑似少付 | 付款金额小于应付金额 | 联系确认是否付款完整 |
| 付款无对应报名 | 付款人未报名 | 检查付款人姓名是否正确 |

## 开发说明

### 项目结构

```
src/signup_handler/
├── cli.py          # 命令行入口
├── models.py       # 数据模型定义
├── parser.py       # 文本解析器
├── filereader.py   # 文件读取（CSV/JSON）
├── merger.py       # 去重合并 + 付款匹配
├── rule_engine.py  # 规则引擎（容量/分组）
└── exporter.py     # 导出模块
```

### 添加新功能

1. 如需支持新的接龙格式，修改 `parser.py` 中的正则表达式
2. 如需调整合并规则，修改 `merger.py`
3. 如需调整分组算法，修改 `rule_engine.py`

## 许可证

MIT License
