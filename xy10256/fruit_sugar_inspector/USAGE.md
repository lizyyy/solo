# 水果分拣糖度抽检器 - 使用说明

## 系统概述

这是一个用于水果分拣线按糖度抽检分级的工具系统。主要解决以下问题：
- 抽样不足导致的等级判定不准确
- 批次混入导致的等级争议
- 糖度边界值导致的分级纠纷

## 目录结构

```
fruit_sugar_inspector/
├── main.py                  # 主程序入口
├── sample_generator.py      # 样例数据生成器
├── modules/                 # 核心模块
│   ├── __init__.py
│   ├── config.py           # 配置和分级标准
│   ├── batch_importer.py   # 批次导入
│   ├── sampler.py          # 抽样模块
│   ├── classifier.py       # 等级判定
│   ├── anomaly_detector.py # 异常检测
│   └── reporter.py         # 报告生成
├── data/
│   ├── samples/            # 样例数据
│   └── output/             # 输出结果
└── USAGE.md                # 使用说明
```

## 快速开始

### 1. 生成样例数据

进入项目目录并运行造数命令：

```bash
cd fruit_sugar_inspector
python main.py generate
```

这将生成 5 个样例批次：

| 批次编号 | 类型 | 预期结果 | 特点 |
|---------|------|---------|------|
| BATCH_APPLE_001 | 苹果 | 正常通过 | 糖度分布均匀的一级苹果 |
| BATCH_PEAR_001 | 梨 | 正常通过 | 糖度分布均匀的特级梨 |
| BATCH_ORANGE_002 | 柑橘 | **待复核** | 大量样本靠近分级边界（等级争议） |
| BATCH_APPLE_002 | 苹果 | **已拦截** | 两个不同等级批次混入 |
| BATCH_PEAR_002 | 梨 | **待复核** | 抽样数量不足 |

### 2. 查看样例数据

```bash
python main.py list
```

### 3. 处理批次数据

处理一个正常批次（顺利样例）：

```bash
python main.py process -f data/samples/BATCH_APPLE_001.json -v
```

处理一个等级争议批次（触发复核）：

```bash
python main.py process -f data/samples/BATCH_ORANGE_002.json -v
```

处理一个批次混入批次（触发拦截）：

```bash
python main.py process -f data/samples/BATCH_APPLE_002.json -v
```

## 命令详解

### generate 命令

生成样例数据：

```bash
python main.py generate                # 使用默认目录
python main.py generate -o /path/to/dir # 指定输出目录
```

### list 命令

列出可用的样例数据：

```bash
python main.py list                    # 默认目录
python main.py list -d /path/to/dir     # 指定目录
```

### process 命令

处理批次数据：

```bash
python main.py process -f <文件路径>     # 基本处理
python main.py process -f <文件路径> -v  # 详细模式
python main.py process -f <文件路径> -s 42  # 指定随机种子（可复现）
```

参数说明：
- `-f, --file`: 批次数据文件路径（必需）
- `-s, --seed`: 随机种子，用于复现相同的抽样结果
- `-v, --verbose`: 详细输出模式，显示每个步骤的详细信息

## 输出文件说明

每个批次处理后会生成 3 个文件：

### 1. 中间结果 (intermediate_*.json)

保存抽样过程的中间数据，用于重跑时比较：
- 批次基本信息
- 抽样参数
- 选中的样本列表

### 2. JSON报告 (report_*.json)

完整的结构化报告，包含：
- 批次信息
- 抽样统计
- 分级结果
- 异常检测详情
- 建议措施

### 3. TXT报告 (report_*.txt)

人类可读的文本报告，方便打印和查阅。

## 分级标准

系统支持三种水果的糖度分级：

### 苹果 (apple)
| 等级 | 糖度范围 | 说明 |
|------|---------|------|
| 特级 | ≥14.0°Brix | 最高品质 |
| 一级 | 12.0-14.0°Brix | 高品质 |
| 二级 | 10.0-12.0°Brix | 普通品质 |
| 等外 | <10.0°Brix | 低品质 |

### 梨 (pear)
| 等级 | 糖度范围 | 说明 |
|------|---------|------|
| 特级 | ≥13.0°Brix | 最高品质 |
| 一级 | 11.0-13.0°Brix | 高品质 |
| 二级 | 9.0-11.0°Brix | 普通品质 |
| 等外 | <9.0°Brix | 低品质 |

### 柑橘 (orange)
| 等级 | 糖度范围 | 说明 |
|------|---------|------|
| 特级 | ≥12.0°Brix | 最高品质 |
| 一级 | 10.0-12.0°Brix | 高品质 |
| 二级 | 8.5-10.0°Brix | 普通品质 |
| 等外 | <8.5°Brix | 低品质 |

## 异常检测规则

系统会检测以下异常情况：

### 警报级别（触发拦截）

1. **抽样数量不足**
   - 条件：抽样数量 < 30 个
   - 阈值：最低要求 30 个，推荐 50 个

2. **批次混入**
   - 条件：次要等级占比 > 15%
   - 说明：两个不同等级的批次可能被混合

3. **等级争议风险高**
   - 条件：靠近分级边界的样本 > 8%
   - 说明：大量样本的糖度接近边界值，容易引发争议

### 警告级别（建议复核）

1. 抽样数量低于推荐值（< 50 个）
2. 潜在批次混入可能（次要等级 8-15%）
3. 存在边界样本（< 8%）
4. 分级置信度低于 95%

## 完整工作流程示例

### 场景1：正常批次处理

```bash
# 1. 生成样例数据
python main.py generate

# 2. 查看批次列表
python main.py list

# 3. 处理正常苹果批次
python main.py process -f data/samples/BATCH_APPLE_001.json -v

# 4. 查看报告
cat data/output/report_BATCH_APPLE_001_*.txt
```

预期结果：
- 状态：正常
- 等级：一级
- 置信度：约 97%
- 无警报和警告

### 场景2：等级争议批次

```bash
# 处理等级争议批次
python main.py process -f data/samples/BATCH_ORANGE_002.json -v

# 查看报告
cat data/output/report_BATCH_ORANGE_002_*.txt
```

预期结果：
- 状态：已拦截 / 待复核
- 大量样本靠近分级边界
- 建议：对边界样本进行复核检测

### 场景3：批次混入批次

```bash
# 处理批次混入批次
python main.py process -f data/samples/BATCH_APPLE_002.json -v

# 查看报告
cat data/output/report_BATCH_APPLE_002_*.txt
```

预期结果：
- 状态：已拦截
- 等级分布分散（特级和二级混合）
- 建议：核查批次来源，确认是否存在混批

### 场景4：比较前后差异

```bash
# 第一次处理
python main.py process -f data/samples/BATCH_APPLE_001.json -s 123

# 第二次处理（相同种子，抽样结果一致）
python main.py process -f data/samples/BATCH_APPLE_001.json -s 123

# 比较两次报告差异
diff data/output/report_BATCH_APPLE_001_*.txt
```

## 自定义批次数据

你可以创建自己的批次数据文件。格式如下：

```json
{
    "batch_id": "MY_BATCH_001",
    "fruit_type": "apple",
    "batch_size": 1000,
    "production_date": "2026-05-10",
    "source_farm": "my_farm",
    "description": "我的批次",
    "measurements": [
        {"id": "S1", "sugar": 12.5, "measurement_time": "2026-05-10 08:00:00"},
        {"id": "S2", "sugar": 13.2, "measurement_time": "2026-05-10 08:00:05"}
    ]
}
```

必填字段：
- `batch_id`: 批次编号
- `fruit_type`: 水果类型（apple/pear/orange）
- `batch_size`: 批次数量
- `production_date`: 生产日期
- `source_farm`: 来源农场
- `measurements`: 测量数据数组，每个元素包含 `id` 和 `sugar`

## 配置说明

修改 `modules/config.py` 可以调整：

1. **分级标准** (`GRADE_STANDARDS`)
   - 各等级的糖度范围
   - 有效糖度范围

2. **抽样规则** (`SAMPLING_RULES`)
   - 最低抽样数量：30
   - 推荐抽样数量：50
   - 抽样比例：5%
   - 批次混入阈值：15%
   - 等级争议阈值：8%
   - 置信度阈值：95%

## 故障排除

### 问题：文件找不到

确保：
- 已进入正确的目录
- 文件路径正确（相对路径或绝对路径）

### 问题：抽样结果不一致

使用 `-s` 参数指定随机种子可以复现相同的抽样结果。

### 问题：报告不生成

检查：
- Python 版本 ≥ 3.6
- 输出目录有写入权限

## 技术支持

如需修改分级标准或调整检测规则，请编辑 `modules/config.py` 文件。
