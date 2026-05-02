# 危化品库位相容性预检系统

一个用于高校实验室安全员在试剂入库前进行安全检查的Python CLI工具。

## 功能特性

- **库位容量检查**：检查申请入库的化学品体积是否超过库位剩余容量
- **危险类别禁混检查**：基于相容性规则检查危险化学品是否可以混放
- **标签缺失检查**：检查化学品是否缺少危险类别标签
- **入库申请冲突检查**：检查多个入库申请之间的冲突
- **同义危险类别归一化**：自动处理"酸类"、"强酸性物质"等同义表述
- **可替代库位建议**：为违规申请提供合适的替代库位建议
- **多格式报告输出**：生成Markdown审计报告、CSV违规列表和放置计划

## 项目结构

```
chemical_compatibility_checker/
├── __init__.py          # 包初始化
├── parsers.py           # 解析校验模块
├── rules.py             # 规则引擎模块
├── placement.py         # 库位计算模块
└── reports.py           # 报告导出模块
sample_data/             # 示例数据文件
├── chemicals.csv        # 化学品信息
├── storage.yaml         # 库位配置
├── compatibility.json   # 相容性规则
└── inbound.csv          # 入库申请
cli.py                   # CLI入口
requirements.txt         # 依赖文件
README.md                # 本文档
```

## 安装

1. 克隆或下载项目到本地

2. 安装依赖：

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 使用示例数据

项目已提供示例数据，可直接运行测试：

```bash
python cli.py check \
  -c sample_data/chemicals.csv \
  -s sample_data/storage.yaml \
  -comp sample_data/compatibility.json \
  -i sample_data/inbound.csv \
  -o output
```

### 2. 创建自定义示例数据

也可以使用CLI命令生成示例数据：

```bash
python cli.py init_sample my_sample_data
```

## 使用方法

### 命令语法

```bash
python cli.py check [OPTIONS]
```

### 参数说明

| 参数 | 简写 | 必需 | 说明 |
|------|------|------|------|
| `--chemicals` | `-c` | 是 | 化学品信息CSV文件路径 |
| `--storage` | `-s` | 是 | 库位信息YAML文件路径 |
| `--compatibility` | `-comp` | 是 | 相容性规则JSON文件路径 |
| `--inbound` | `-i` | 是 | 入库申请CSV文件路径 |
| `--output-dir` | `-o` | 否 | 输出文件目录（默认：当前目录） |
| `--verbose` | `-v` | 否 | 显示详细输出 |

### 示例命令

```bash
# 基本使用
python cli.py check -c chemicals.csv -s storage.yaml -comp compatibility.json -i inbound.csv

# 指定输出目录并显示详细信息
python cli.py check -c chemicals.csv -s storage.yaml -comp compatibility.json -i inbound.csv -o ./results -v

# 查看帮助
python cli.py check --help

# 查看版本
python cli.py --version
```

## 输入文件格式

### 1. chemicals.csv（化学品信息）

| 字段 | 说明 | 示例 |
|------|------|------|
| chemical_id | 化学品唯一标识 | CHEM-001 |
| name | 化学品名称 | 浓硫酸 |
| dangerous_categories | 危险类别（逗号分隔） | 强酸,腐蚀性物质 |
| volume | 单瓶体积 | 500 |
| unit | 单位 | ml |

**注意**：`dangerous_categories` 支持多个类别，用逗号分隔。系统会自动进行同义归一化。

### 2. storage.yaml（库位信息）

```yaml
locations:
  - id: A-01                    # 库位唯一标识
    name: 强酸存储区             # 库位名称
    capacity: 100               # 总容量
    unit: L                      # 容量单位
    allowed_categories:         # 允许存储的危险类别（可选）
      - 强酸
      - 酸类
    forbidden_categories:       # 禁止存储的危险类别（可选）
      - 强碱
      - 易燃液体
    current_chemicals:          # 当前已存储的化学品
      - chemical_id: CHEM-005
        volume: 10
```

### 3. compatibility.json（相容性规则）

```json
{
  "normalization": {
    "强酸": ["酸类", "强酸性物质", "腐蚀性酸"],
    "强碱": ["碱类", "强碱性物质", "腐蚀性碱"]
  },
  "incompatible_pairs": [
    {"category1": "强酸", "category2": "强碱", "severity": "critical"}
  ],
  "storage_rules": [
    {"category": "强酸", "requirements": ["通风", "防腐蚀"]}
  ]
}
```

**关键说明**：
- `normalization`：定义同义危险类别映射，解决"酸类"、"强酸性物质"等不同表述的归一化问题
- `incompatible_pairs`：定义不相容的危险类别对，severity可选值：critical, high, medium, low
- `storage_rules`：各类别化学品的存储要求

### 4. inbound.csv（入库申请）

| 字段 | 说明 | 示例 |
|------|------|------|
| request_id | 申请唯一标识 | REQ-001 |
| chemical_id | 化学品ID（对应chemicals.csv） | CHEM-001 |
| requested_location | 申请的库位ID（可选） | A-01 |
| volume | 入库体积 | 20 |

## 输出文件说明

### 1. audit.md（审计报告）

完整的Markdown格式审计报告，包含：
- 执行摘要（申请统计、违规统计）
- 库位利用率变化
- 数据完整性警告
- 违规详情（按严重程度分组）
- 放置计划详情
- 各库位利用率
- 建议与注意事项

### 2. violations.csv（违规详情）

| 列名 | 说明 |
|------|------|
| 违规ID | 唯一标识 |
| 规则编号 | 违反的规则ID |
| 严重程度 | 严重/高/中/低 |
| 消息 | 违规描述 |
| 申请ID | 相关申请ID |
| 化学品ID | 相关化学品ID |
| 库位ID | 相关库位ID |
| 详细信息 | JSON格式的详细信息 |

### 3. placement_plan.csv（放置计划）

| 列名 | 说明 |
|------|------|
| 申请ID | 入库申请ID |
| 化学品ID | 化学品ID |
| 化学品名称 | 化学品名称 |
| 申请库位 | 申请人指定的库位 |
| 最终库位 | 系统建议的最终库位 |
| 体积(L) | 入库体积 |
| 状态 | 通过/需人工审核/拒绝 |
| 违规数量 | 发现的违规数 |
| 推荐替代库位 | 前3个推荐的替代库位（带适配度分数） |

## 检查规则说明

### 规则ID和严重程度

| 规则ID | 规则名称 | 严重程度 | 说明 |
|--------|----------|----------|------|
| CAPACITY-001 | 库位容量不足 | HIGH | 申请体积超过库位剩余容量 |
| MIXING-001 | 禁止类别冲突 | CRITICAL | 化学品类别在库位禁止列表中 |
| MIXING-002 | 允许类别不匹配 | HIGH | 化学品类别不在库位允许列表中 |
| MIXING-003 | 与现有化学品不相容 | 动态 | 与库位中已有化学品不相容 |
| LABEL-001 | 化学品不存在 | HIGH | 化学品ID不存在于目录中 |
| LABEL-002 | 缺少危险类别标签 | CRITICAL | 化学品没有危险类别 |
| LABEL-003 | 无效类别值 | MEDIUM | 危险类别包含无效值 |
| CONFLICT-001 | 多申请容量冲突 | HIGH | 同一库位多申请总容量超限 |
| CONFLICT-002 | 多申请类别冲突 | MEDIUM | 同一库位多申请化学品类别不同 |
| CONFLICT-003 | 重复申请引用 | LOW | 同一化学品被多次申请 |

### 重要设计考虑

#### 1. 同义危险类别归一化

**问题**：不同人员可能使用不同表述描述同一类危险化学品，例如：
- "强酸"、"酸类"、"强酸性物质"、"腐蚀性酸"
- "强碱"、"碱类"、"强碱性物质"、"腐蚀性碱"

**解决方案**：
- 在 `compatibility.json` 的 `normalization` 字段定义映射关系
- `Normalizer` 类自动将所有别名归一化为标准名称
- 所有规则检查都基于归一化后的标准名称进行

#### 2. 同一库位剩余容量不足

**问题**：
- 单个申请可能超过库位容量
- 多个申请同时申请同一库位，总容量可能超过剩余容量

**解决方案**：
- `check_storage_capacity` 检查单个申请是否超过剩余容量
- `check_inbound_conflicts` 检查同一库位多个申请的总容量
- 放置计划生成时会考虑所有申请的累积影响

## 运行测试

项目包含pytest测试，运行以下命令执行测试：

```bash
# 安装测试依赖
pip install pytest

# 运行所有测试
pytest tests/ -v

# 运行测试并显示覆盖率
pytest tests/ -v --cov=chemical_compatibility_checker
```

## 测试覆盖范围

- `test_parsers.py`：文件解析和数据校验
- `test_rules.py`：规则引擎和归一化逻辑
- `test_placement.py`：库位计算和替代库位寻找
- `test_reports.py`：报告导出功能

## 常见问题

### Q1: 如何添加新的危险类别？

在 `compatibility.json` 中：
1. 在 `normalization` 中添加新类别的同义词映射
2. 在 `incompatible_pairs` 中定义与其他类别的不相容关系
3. 在 `storage_rules` 中添加存储要求

### Q2: 如何处理单位转换？

当前版本假设所有输入使用相同单位（推荐使用升L）。如需支持多单位，可在 `parsers.py` 中添加单位转换逻辑。

### Q3: 替代库位的适配度分数如何计算？

适配度分数（0-100）基于以下因素：
- 容量足够：+30分
- 匹配允许类别：+20分
- 库位中已有相同类别化学品：+15分
- 库位名称匹配类别关键词：+10分
- 与现有化学品潜在冲突：-5分/项
- 不在允许列表中：-10分

## 版本历史

- **1.0.0** (2024-05-03)
  - 初始版本发布
  - 支持基本的相容性检查
  - 支持同义危险类别归一化
  - 支持替代库位建议
  - 支持多种报告格式输出

## 许可证

本项目仅供教育和内部使用。

## 联系方式

如有问题或建议，请联系系统管理员。
