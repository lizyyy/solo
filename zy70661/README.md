# 售楼处渠道来访合并排查CLI工具

## 功能概述

解决售楼处渠道表和来访表口径不同，同一个客户被多个渠道重复认领的问题。核心功能包括：

- **电话归一化**：自动处理带横杠、带国家码(+86/86)、带空格等不同格式的手机号
- **渠道优先级**：按预设渠道优先级自动选择最终归属渠道
- **重复认领标记**：识别并高亮标记被多个渠道认领的客户
- **顾问汇总统计**：按置业顾问维度统计客户数、渠道分布等
- **报告导出**：生成多Sheet的Excel报告，包含完整决策追踪
- **来源追踪**：坏行保留原始文件位置和行号，便于追溯

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 基本用法

```bash
python channel_visit_cli.py --visit 来访表.xlsx --channel 渠道表.xlsx --output 合并报告.xlsx
```

### 完整参数

```bash
python channel_visit_cli.py \
    --visit 来访表.xlsx \
    --channel 渠道表.xlsx \
    --output 合并报告.xlsx \
    --phone-col "客户电话" \
    --consultant-col "置业顾问" \
    --channel-col "渠道名称" \
    --status-col "认领状态" \
    --visit-sheet "Sheet1" \
    --channel-sheet "Sheet1" \
    --verbose
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--visit` | 来访登记表路径（支持Excel/CSV） | 必填 |
| `--channel` | 渠道认领表路径（支持Excel/CSV） | 必填 |
| `--output` | 输出报告路径 | 合并报告.xlsx |
| `--phone-col` | 客户电话列名 | 客户电话 |
| `--consultant-col` | 置业顾问列名 | 置业顾问 |
| `--channel-col` | 渠道名称列名 | 渠道名称 |
| `--status-col` | 认领状态列名 | 认领状态 |
| `--visit-sheet` | 来访表工作表名 | 第一个工作表 |
| `--channel-sheet` | 渠道表工作表名 | 第一个工作表 |
| `--verbose` | 显示详细执行信息 | |

## 渠道优先级配置

默认渠道优先级（从高到低）：

1. 老业主推荐
2. 全民经纪人
3. 渠道分销-贝壳
4. 渠道分销-链家
5. 渠道分销-其他
6. 自然来访
7. 电话邀约
8. 线上广告
9. 线下活动
10. 企业团购
11. 外拓拓客
12. 其他渠道

如需修改优先级，请编辑 `modules/merger.py` 中的 `DEFAULT_CHANNEL_PRIORITY` 列表。

## 输出报告说明

生成的Excel报告包含7个工作表：

### 1. 总览
- 总客户数
- 重复认领客户数
- 涉及顾问数
- 涉及渠道数
- 导出时间

### 2. 合并详情
所有客户合并后的完整信息，包含：
- 归一化电话
- 最终渠道/顾问/状态
- 是否重复认领
- 所有渠道/顾问列表
- 原始来源行号

重复认领客户行以**黄色高亮**显示。

### 3. 重复认领明细
仅包含重复认领的客户，便于重点排查。

### 4. 顾问汇总
按置业顾问维度统计：
- 客户数
- 重复认领客户数
- 渠道分布
- 状态分布
- 负责的客户电话列表

### 5. 渠道汇总
按渠道维度统计：
- 客户数
- 涉及顾问数
- 重复认领数

### 6. 异常记录
记录数据解析过程中发现的坏行，包含：
- 来源文件/类型/行号
- 错误原因
- 原始数据（截断前500字符）

坏行以**红色高亮**显示。

### 7. 决策追踪
记录每个客户的合并决策详情，便于审计和追溯。

## 项目结构

```
.
├── channel_visit_cli.py    # CLI入口文件
├── modules/
│   ├── __init__.py
│   ├── parser.py           # 数据解析模块
│   ├── cleaner.py          # 数据清洗和电话归一化
│   ├── merger.py           # 渠道合并和优先级判断
│   ├── consultant.py       # 顾问汇总统计
│   ├── tracker.py          # 来源追踪和决策记录
│   └── exporter.py         # Excel报告导出
├── requirements.txt
├── create_test_data.py     # 测试数据生成脚本
└── README.md
```

## 测试

生成测试数据并运行测试：

```bash
python create_test_data.py
python channel_visit_cli.py --visit test_visit.xlsx --channel test_channel.xlsx --output test_report.xlsx --verbose
```

## 模块职责分离

| 模块 | 职责 |
|------|------|
| parser | Excel/CSV读取，行校验，坏行收集 |
| cleaner | 电话归一化，数据标准化 |
| merger | 按电话分组，渠道优先级判断，重复认领检测 |
| tracker | 来源记录，决策记录，顾问分配记录 |
| consultant | 多维度汇总统计（顾问/渠道/状态） |
| exporter | Excel多Sheet生成，格式化，颜色标记 |

## 设计特点

1. **结果稳定性**：所有排序使用确定性规则，重复运行结果一致
2. **来源可追溯**：每条记录保留原始文件行号，便于排查问题
3. **坏行保留**：异常数据不丢弃，单独收集并高亮显示
4. **决策可审计**：所有合并决策单独记录，便于审计和调整规则
5. **模块化设计**：各模块职责单一，便于扩展和维护
