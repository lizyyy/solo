# 投诉工单相似簇助手

客服质检专用的本地 AI/ML 命令行工具，用于自动分析客服工单，聚类相似问题，检测新问题和重复投诉。

## 功能特性

- **数据导入与脱敏**: 自动导入 CSV 工单数据，对手机号、邮箱、订单号等敏感信息进行脱敏处理
- **数据校验**: 检查必填字段缺失、时间格式错误、重复工单号、空文本等问题
- **智能聚类**: 使用 TF-IDF + K-Means/DBSCAN 算法将相似工单聚合成簇
- **异常检测**: 识别新工单中的旧簇问题、疑似新问题、重复用户投诉和结论矛盾
- **人工复核**: 支持人工调整聚类结果、打标签、标记误报
- **报告导出**: 生成 Markdown 周报、簇明细 CSV、疑似新问题 JSON
- **历史查询**: 按日期、产品线、簇标签查询历次导入和训练结果

## 安装方式

### 环境要求

- Python 3.8+
- pip

### 安装步骤

1. 克隆或下载项目代码

```bash
cd ticket-cluster-helper
```

2. 安装依赖

```bash
pip install -r requirements.txt
```

3. 安装项目（可选，用于全局调用）

```bash
pip install -e .
```

## 快速开始

以下是一个完整的工作流程示例，使用项目自带的示例数据。

### 1. 初始化项目

首先，创建一个工作目录并初始化项目：

```bash
# 创建工作目录
mkdir -p ~/ticket-project
cd ~/ticket-project

# 初始化项目
ticket-cluster init
```

或者在当前目录初始化：

```bash
ticket-cluster init
```

初始化后会创建以下目录结构：

```
ticket-project/
├── config.json      # 配置文件
├── data/            # 数据存储目录
│   ├── raw/         # 原始CSV文件
│   └── history/     # 历史记录
├── output/          # 输出目录
└── models/          # 模型和聚类结果
```

### 2. 配置项目（可选）

编辑 `config.json` 配置文件，根据实际情况调整：

```json
{
  "stopwords": ["的", "了", "是", ...],
  "sensitive_fields": ["手机号", "邮箱", "订单号", ...],
  "channels": ["APP", "网页端", "客服热线"],
  "product_lines": ["用户账户", "订单退款", "支付问题", "售后问题"],
  "clustering_params": {
    "algorithm": "kmeans",
    "n_clusters": 20
  },
  "similarity_threshold": 0.8
}
```

### 3. 导入历史工单数据

使用项目提供的示例数据进行导入：

```bash
# 导入第一批历史数据
ticket-cluster import /path/to/ticket_cluster_helper/sample_data/historical_tickets_1.csv

# 导入第二批历史数据
ticket-cluster import /path/to/ticket_cluster_helper/sample_data/historical_tickets_2.csv
```

导入时会自动：
- 复制原始文件到 `data/raw/` 目录
- 对手机号、邮箱、订单号等敏感信息进行脱敏
- 保存处理后的数据到 `data/imported_*.json`

### 4. 校验数据质量

```bash
ticket-cluster check
```

校验内容包括：
- 必填字段缺失检查
- 时间格式验证
- 重复工单号检测
- 空文本检查
- 渠道和产品线校验

坏行会被记录到 `data/quarantine.json`，并说明错误原因。

### 5. 训练聚类模型

```bash
# 使用默认参数（K-Means）
ticket-cluster fit

# 或者指定聚类数量
ticket-cluster fit --clusters 10

# 或者使用 DBSCAN 算法
ticket-cluster fit --algorithm dbscan
```

聚类结果会包含：
- 每个簇的关键词
- 代表工单
- 簇的置信度
- 轮廓系数（评估聚类质量）

### 6. 导入新工单并检测异常

```bash
# 导入新工单
ticket-cluster import /path/to/ticket_cluster_helper/sample_data/new_tickets.csv

# 检测新工单中的异常
ticket-cluster detect
```

检测类型包括：

1. **属于旧簇**: 新工单与历史簇相似
2. **疑似新问题**: 新工单与所有历史簇相似度都很低
3. **重复用户投诉**: 同一用户（手机号/邮箱/用户ID）的重复投诉
4. **处理结论矛盾**: 相似问题但处理结论不同

### 7. 人工复核

```bash
# 查看当前簇列表和复核记录
ticket-cluster review --list

# 将工单移动到指定簇
ticket-cluster review --ticket-id TK101 --action move --to-cluster 2 --reason "更适合这个簇"

# 给工单所在簇打标签
ticket-cluster review --ticket-id TK101 --action tag --tag 重要 --tag 紧急

# 标记为误报
ticket-cluster review --ticket-id TK101 --action false-positive --reason "检测错误"
```

人工反馈会保存并影响后续的检测结果。

### 8. 导出报告

```bash
# 导出所有格式
ticket-cluster export

# 只导出 Markdown 周报
ticket-cluster export --format markdown

# 只导出 CSV
ticket-cluster export --format csv
```

导出的文件会保存在 `output/` 目录：

- `weekly_report_YYYYMMDD.md` - Markdown 格式周报
- `clusters_YYYYMMDD_HHMMSS.csv` - 簇明细 CSV
- `detection_*.json` - 检测结果 JSON
- `new_issues_*.json` - 疑似新问题 JSON

### 9. 查询历史记录

```bash
# 查看导入历史
ticket-cluster history --type imports

# 查看训练历史
ticket-cluster history --type training

# 查看项目统计
ticket-cluster history --type stats

# 按日期筛选
ticket-cluster history --type imports --start-date 2026-04-01 --end-date 2026-04-30

# 按产品线筛选
ticket-cluster history --type imports --product-line "用户账户"
```

## 完整命令参考

### init - 初始化项目

```bash
ticket-cluster init [--force]
```

**选项:**
- `--force, -f`: 强制覆盖现有配置

**示例:**
```bash
# 在当前目录初始化
ticket-cluster init

# 在指定目录初始化
ticket-cluster --project ~/my-project init

# 强制覆盖
ticket-cluster init --force
```

### import - 导入CSV

```bash
ticket-cluster import <csv_files...> [--import-id ID]
```

**参数:**
- `csv_files`: 一个或多个CSV文件路径

**选项:**
- `--import-id, -i`: 指定导入ID（默认使用时间戳）

**示例:**
```bash
# 导入单个文件
ticket-cluster import tickets.csv

# 导入多个文件
ticket-cluster import tickets1.csv tickets2.csv tickets3.csv

# 指定导入ID
ticket-cluster import tickets.csv --import-id 2026_week_15
```

### check - 数据校验

```bash
ticket-cluster check [--import-id ID]
```

**选项:**
- `--import-id, -i`: 指定要校验的导入ID（默认使用最新导入）

**示例:**
```bash
# 校验最新导入
ticket-cluster check

# 校验指定导入
ticket-cluster check --import-id 20260420_103000
```

### fit - 聚类训练

```bash
ticket-cluster fit [--algorithm ALGO] [--clusters N]
```

**选项:**
- `--algorithm, -a`: 聚类算法，可选 `kmeans` 或 `dbscan`（默认: kmeans）
- `--clusters, -n`: 目标聚类数量（K-Means专用）

**示例:**
```bash
# 使用默认参数
ticket-cluster fit

# 指定聚类数量
ticket-cluster fit --clusters 15

# 使用 DBSCAN
ticket-cluster fit --algorithm dbscan
```

### detect - 异常检测

```bash
ticket-cluster detect [--import-id ID]
```

**选项:**
- `--import-id, -i`: 指定要检测的导入ID（默认使用最新导入）

**示例:**
```bash
# 检测最新导入
ticket-cluster detect

# 检测指定导入
ticket-cluster detect --import-id 20260428_090000
```

### review - 人工复核

```bash
ticket-cluster review [--list] [--ticket-id ID] [--action TYPE] [--to-cluster N] [--tag TAG] [--reason TEXT]
```

**选项:**
- `--list, -l`: 列出当前簇和复核记录
- `--ticket-id, -t`: 指定工单ID
- `--action, -a`: 操作类型，可选 `move`, `tag`, `false-positive`
- `--to-cluster`: 目标簇ID（用于 move 操作）
- `--tag, -T`: 标签（用于 tag 操作，可多次使用）
- `--reason, -r`: 操作原因说明

**示例:**
```bash
# 查看列表
ticket-cluster review --list

# 移动工单
ticket-cluster review --ticket-id TK101 --action move --to-cluster 3

# 打标签
ticket-cluster review --ticket-id TK101 --action tag --tag 高优先级 --tag 需跟进

# 标记误报
ticket-cluster review --ticket-id TK101 --action false-positive --reason "文本相似度低"
```

### export - 导出报告

```bash
ticket-cluster export [--format FORMAT] [--output PATH]
```

**选项:**
- `--format, -f`: 导出格式，可选 `all`, `markdown`, `csv`, `json`（默认: all）
- `--output, -o`: 输出路径

**示例:**
```bash
# 导出所有格式
ticket-cluster export

# 只导出 Markdown
ticket-cluster export --format markdown

# 导出到指定目录
ticket-cluster export --output ~/reports
```

### history - 历史查询

```bash
ticket-cluster history [--type TYPE] [--start-date DATE] [--end-date DATE] [--product-line PL] [--channel CH] [--limit N]
```

**选项:**
- `--type, -t`: 查询类型，可选 `imports`, `training`, `stats`（默认: imports）
- `--start-date, -s`: 开始日期（格式: YYYY-MM-DD）
- `--end-date, -e`: 结束日期（格式: YYYY-MM-DD）
- `--product-line, -p`: 筛选产品线
- `--channel, -c`: 筛选渠道
- `--limit, -n`: 显示数量限制（默认: 50）

**示例:**
```bash
# 查看导入历史
ticket-cluster history --type imports

# 查看训练历史
ticket-cluster history --type training

# 查看统计信息
ticket-cluster history --type stats

# 按日期筛选
ticket-cluster history --start-date 2026-04-01 --end-date 2026-04-30

# 按产品线筛选
ticket-cluster history --product-line "订单退款"
```

## 项目结构

```
ticket_cluster_helper/
├── __init__.py           # 包初始化
├── cli.py                # CLI 入口
├── config.py             # 配置管理
├── csv_parser.py         # CSV 解析与脱敏
├── validator.py          # 数据校验
├── text_features.py      # 文本特征处理 (TF-IDF)
├── clustering.py         # 聚类算法
├── feedback_store.py     # 人工反馈存储
├── detector.py           # 异常检测规则
├── exporter.py           # 报告导出
├── history.py            # 历史查询
└── sample_data/          # 示例数据
    ├── historical_tickets_1.csv
    ├── historical_tickets_2.csv
    └── new_tickets.csv

tests/                     # 测试代码
├── __init__.py
├── test_config.py
├── test_csv_parser.py
└── test_validator.py

setup.py                   # 安装配置
requirements.txt           # 依赖列表
README.md                  # 本文档
```

## 数据格式说明

### CSV 字段要求

导入的 CSV 文件应包含以下字段：

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| 工单号 | string | 是 | 唯一标识 |
| 用户描述 | string | 是 | 用户投诉内容（核心文本） |
| 渠道 | string | 是 | 如：APP、网页端、客服热线 |
| 产品线 | string | 是 | 如：用户账户、订单退款、支付问题 |
| 时间 | datetime | 是 | 工单创建时间 |
| 处理人 | string | 是 | 处理客服 |
| 处理结论 | string | 是 | 最终处理结果 |
| 手机号 | string | 否 | 用户手机号（会脱敏） |
| 邮箱 | string | 否 | 用户邮箱（会脱敏） |
| 订单号 | string | 否 | 关联订单号（会脱敏） |

**示例 CSV:**

```csv
工单号,用户描述,渠道,产品线,时间,处理人,处理结论,手机号,邮箱,订单号
TK001,登录一直提示密码错误,APP,用户账户,2026-04-20 09:15:30,张三,已重置密码,13812345678,user@example.com,ORD20260420001
```

### 字段映射

如果你的 CSV 字段名不同，可以在 `config.json` 中配置字段映射：

```json
{
  "field_mapping": {
    "ticket_no": "工单号",
    "customer_text": "用户描述",
    "contact_channel": "渠道",
    "product_category": "产品线",
    "create_time": "时间",
    "handler": "处理人",
    "conclusion": "处理结论"
  }
}
```

## 脱敏规则

系统会自动对以下敏感信息进行脱敏处理：

### 字段级脱敏

| 字段类型 | 原始值 | 脱敏后 |
|----------|--------|--------|
| 手机号 | 13812345678 | 138****5678 |
| 邮箱 | user@example.com | us***@example.com |
| 订单号 | ORD202604200001 | ORD2****0001 |
| 身份证号 | 110101199001011234 | 110101********1234 |

### 文本级脱敏

用户描述中的敏感信息会被替换为占位符：

| 类型 | 原始文本 | 处理后 |
|------|----------|--------|
| 手机号 | 联系我13812345678 | 联系我[PHONE] |
| 邮箱 | 邮箱user@example.com | 邮箱[EMAIL] |
| 订单号 | 订单ORD12345678 | 订单[ORDER] |

## 算法说明

### 文本特征提取

1. **文本清洗**: 去除 URL、邮箱、特殊字符等
2. **中文分词**: 使用 jieba 进行分词
3. **停用词过滤**: 移除无意义的常用词
4. **TF-IDF 向量化**: 将文本转换为数值向量

### 聚类算法

**K-Means (默认):**
- 需要预先指定聚类数量
- 速度快，适合大数据量
- 适合已知问题类型数量的场景

**DBSCAN:**
- 自动发现聚类数量
- 可以发现任意形状的簇
- 可以检测离群点（疑似新问题）
- 参数较敏感

### 相似度计算

使用余弦相似度计算文本向量之间的相似度：

```
similarity = cos(A, B) = (A · B) / (||A|| * ||B||)
```

相似度阈值默认为 0.8，可在 `config.json` 中调整。

## 运行测试

```bash
# 运行所有测试
pytest

# 运行指定测试
pytest tests/test_config.py

# 运行测试并显示覆盖率
pytest --cov=ticket_cluster_helper
```

## 常见问题

### Q: 初始化失败怎么办？

A: 确保有足够的磁盘权限，或者使用 `--project` 指定其他目录：

```bash
ticket-cluster --project /tmp/ticket-project init
```

### Q: 聚类效果不好怎么调整？

A: 可以尝试：

1. 调整聚类数量：`ticket-cluster fit --clusters 15`
2. 调整相似度阈值：修改 `config.json` 中的 `similarity_threshold`
3. 添加自定义停用词：编辑 `config.json` 中的 `stopwords`
4. 尝试 DBSCAN 算法：`ticket-cluster fit --algorithm dbscan`

### Q: 如何处理大量数据？

A: 系统设计支持数千条工单的处理。如果数据量很大：

1. 分批导入：每次导入一个 CSV 文件
2. 使用 K-Means：比 DBSCAN 更快
3. 增加聚类数量：让每个簇更小、更精准

### Q: 检测结果不准确怎么优化？

A: 使用 `review` 命令提供人工反馈：

```bash
# 标记误报
ticket-cluster review --ticket-id TK101 --action false-positive

# 调整聚类
ticket-cluster review --ticket-id TK101 --action move --to-cluster 5
```

人工反馈会保存并影响后续的检测结果。

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或 PR。
