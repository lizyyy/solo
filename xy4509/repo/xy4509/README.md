# 缫丝工艺计算工具

为缫丝小厂工艺员设计的本地科学计算工具，帮助解决手算补水、煮茧时间和出丝率判断容易出错的问题。

## 功能特点

- **蚕茧批次管理**: 支持多批次合并、查询、删除
- **含水率抽检**: 记录抽检数据，自动计算含水率
- **煮茧温度曲线**: 管理温度曲线，优化煮茧参数
- **缫丝断头记录**: 记录断头数据，评估风险
- **交货等级管理**: 记录交货信息，计算实际出丝率
- **智能计算引擎**:
  - 补水计算：根据当前和目标含水率计算补水量
  - 煮茧参数建议：根据等级和含水率推荐温度时间
  - 出丝率预估：结合历史数据预估产丝量
  - 断头风险评估：分析风险因素，提前预警
- **数据导入导出**: 支持CSV/JSON格式，导出Markdown工艺单
- **本地数据存储**: 使用SQLite本地数据库，数据安全可靠

## 环境要求

- Python 3.8+
- pip 包管理工具

## 安装步骤

### 方式一：开发模式安装（推荐）

```bash
# 进入项目目录
cd /path/to/silk-processing-tool

# 以开发模式安装
pip install -e .
```

### 方式二：直接安装依赖

```bash
pip install click pandas numpy sqlalchemy pydantic rich python-dateutil
```

## 快速开始

### 1. 查看帮助

```bash
# 查看主命令帮助
silk-tool --help

# 查看子命令帮助
silk-tool batch --help
silk-tool calculate --help
silk-tool data --help
```

### 2. 导入示例数据

项目提供了示例数据文件，位于 `examples/` 目录下：

```bash
# 导入JSON格式的完整示例数据
silk-tool data import --file examples/sample_data.json

# 或者分别导入CSV文件
silk-tool data import --file examples/batches.csv
silk-tool data import --file examples/moisture_inspections.csv
```

### 3. 查看批次列表

```bash
silk-tool batch list
```

### 4. 计算工艺参数

```bash
# 计算指定批次的工艺参数
silk-tool calculate --batch-id BATCH-2026-001

# 计算并保存结果到数据库
silk-tool calculate --batch-id BATCH-2026-001 --save

# 计算并导出Markdown工艺单
silk-tool calculate --batch-id BATCH-2026-001 --export-md process_sheet.md

# 指定目标含水率进行计算
silk-tool calculate --batch-id BATCH-2026-001 --target-moisture 12.5
```

## 完整验证流程

### 步骤1：环境准备

```bash
# 检查Python版本
python --version

# 安装项目
pip install -e .

# 验证安装
silk-tool --version
```

### 步骤2：创建测试数据

#### 方式A：使用示例数据

```bash
# 导入完整示例数据
silk-tool data import --file examples/sample_data.json
```

#### 方式B：手动添加数据

```bash
# 添加蚕茧批次
silk-tool batch add \
  --batch-id TEST-001 \
  --source "测试产地" \
  --purchase-date "2026-05-01" \
  --weight 1000.0 \
  --grade 4A \
  --supplier "测试供应商" \
  --notes "测试批次"

# 查看批次列表
silk-tool batch list
```

### 步骤3：计算工艺参数

```bash
# 计算工艺参数并显示结果
silk-tool calculate --batch-id BATCH-2026-001

# 预期输出包含：
# - 补水计算：当前含水率、目标含水率、需补水量
# - 煮茧参数建议：建议温度、建议时间、浸泡时间、蒸汽压力
# - 出丝率预估：预估出丝率、预估产丝量
# - 断头风险评估：风险等级、预估断头数、风险因素
# - 异常数据提示（如有）
# - 警告信息（如有）
```

### 步骤4：保存和复核

```bash
# 计算并保存结果
silk-tool calculate --batch-id BATCH-2026-001 --save

# 查看数据库统计
silk-tool stats

# 添加人工复核备注
silk-tool review \
  --calculation-id CALC-BATCH-2026-001-xxxxxxxxxxxx \
  --notes "复核通过，参数合理，可以执行" \
  --reviewer "张工艺员"
```

### 步骤5：导出工艺单

```bash
# 导出Markdown格式工艺单
silk-tool calculate \
  --batch-id BATCH-2026-001 \
  --export-md output/工艺单_BATCH-2026-001.md

# 导出JSON格式数据
silk-tool data export \
  --output output/batch_data.json \
  --format json \
  --batch-id BATCH-2026-001
```

### 步骤6：搜索和查询

```bash
# 按等级搜索批次
silk-tool search --grade 5A

# 按来源搜索
silk-tool search --source "苏州"

# 按日期范围搜索
silk-tool search --start-date "2026-04-01" --end-date "2026-04-30"

# 组合条件搜索
silk-tool search --grade 4A --source "嘉兴"
```

### 步骤7：合并批次

```bash
# 合并多个批次
silk-tool batch merge \
  --batch-ids BATCH-2026-001 \
  --batch-ids BATCH-2026-002 \
  --target-moisture 12.0
```

### 步骤8：清理测试数据

```bash
# 删除测试批次（需要确认）
silk-tool batch delete --batch-id TEST-001
```

## 数据格式说明

### CSV格式

#### 蚕茧批次 (batches.csv)

| 字段名 | 说明 | 示例 |
|--------|------|------|
| batch_id | 批次编号 | BATCH-2026-001 |
| source | 来源产地 | 江苏苏州 |
| purchase_date | 收购日期 | 2026-04-15 |
| total_weight_kg | 总重量(kg) | 1500.5 |
| grade | 蚕茧等级 | 5A |
| supplier | 供应商 | 苏州蚕业合作社 |
| notes | 备注 | 春茧，质量较好 |

#### 含水率抽检 (moisture_inspections.csv)

| 字段名 | 说明 | 示例 |
|--------|------|------|
| inspection_id | 抽检编号 | INSP-001 |
| batch_id | 关联批次编号 | BATCH-2026-001 |
| inspection_date | 抽检日期 | 2026-04-16 |
| sample_weight_g | 样品重量(g) | 100.0 |
| dry_weight_g | 烘干后重量(g) | 88.0 |
| moisture_content | 含水率(%) | (可选，自动计算) |
| inspector | 抽检人 | 张工 |
| notes | 备注 | 第一次抽检 |

### JSON格式

参考 `examples/sample_data.json` 文件，包含完整的数据结构示例。

## 计算逻辑说明

### 1. 含水率计算

```
含水率(%) = (样品重量 - 烘干后重量) / 样品重量 × 100
```

### 2. 补水计算

```
干重 = 批次总重量 × (1 - 当前含水率/100)
目标总重量 = 干重 / (1 - 目标含水率/100)
需补水量 = 目标总重量 - 批次总重量
```

### 3. 煮茧参数建议

- **基础参数**: 根据蚕茧等级确定基础温度和时间
- **含水率调整**: 
  - 含水率偏低：适当提高温度、延长时间
  - 含水率偏高：适当降低温度、缩短时间
- **历史数据参考**: 结合同等级历史曲线进行优化

### 4. 出丝率预估

- **基础出丝率**: 根据蚕茧等级确定
- **含水率影响**: 
  - 含水率偏低：出丝率下降约5%
  - 含水率偏高：出丝率下降约3%
- **历史数据参考**: 结合同等级历史交货记录

### 5. 断头风险评估

风险因素包括：
- 含水率偏离最优范围
- 煮茧温度过高或过低
- 煮茧时间过长或过短
- 历史断头记录偏高

风险等级：
- **低**: < 0.3次/小时
- **中**: 0.3-0.8次/小时
- **较高**: 0.8-1.5次/小时
- **高**: > 1.5次/小时

## 命令参考

### 批次管理

```bash
silk-tool batch list          # 列出所有批次
silk-tool batch add           # 添加新批次
silk-tool batch delete        # 删除批次
silk-tool batch merge         # 合并批次
```

### 数据导入导出

```bash
silk-tool data import         # 导入数据
silk-tool data export         # 导出数据
```

### 计算功能

```bash
silk-tool calculate           # 计算工艺参数
silk-tool review              # 添加复核备注
```

### 查询功能

```bash
silk-tool search              # 搜索批次
silk-tool stats               # 查看统计信息
```

## 配置说明

### 数据库位置

默认数据库位置：`~/.silk_processing/data.db`

如需指定其他位置，可以通过代码初始化时指定：

```python
from silk_processing.database import DatabaseManager

db = DatabaseManager(db_path="/path/to/custom.db")
```

### 等级参数配置

等级参数定义在 `silk_processing/calculator.py` 的 `GRADE_PARAMS` 字典中，包括：

- 基础煮茧温度
- 基础煮茧时间
- 基础出丝率
- 最优含水率范围
- 断头风险阈值

如需调整，可以根据实际生产经验修改对应数值。

## 常见问题

### Q1: 导入数据时提示"批次已存在"怎么办？

A: 这是因为数据库中已存在相同批次编号的数据。可以：
- 使用新的批次编号
- 先删除已存在的批次（`silk-tool batch delete`）
- 修改导入文件中的批次编号

### Q2: 计算结果中出现异常数据提示怎么办？

A: 异常数据提示表示某些参数超出正常范围，请：
- 仔细检查输入数据是否正确
- 确认含水率、重量等数值是否合理
- 如有必要，调整目标参数重新计算

### Q3: 如何备份数据？

A: 直接复制数据库文件即可：

```bash
# 备份数据库
cp ~/.silk_processing/data.db backup_20260501.db

# 恢复数据库
cp backup_20260501.db ~/.silk_processing/data.db
```

### Q4: 支持哪些蚕茧等级？

A: 支持的等级包括：
- 6A、5A、4A、3A、2A、1A（优质等级）
- A、B、C、D（普通等级）

交货等级包括：
- 特级、一级、二级、三级、等外品

### Q5: 如何添加新的煮茧温度曲线？

A: 可以通过导入JSON数据添加，格式如下：

```json
{
  "cooking_curves": [{
    "curve_id": "CURVE-001",
    "batch_id": "BATCH-2026-001",
    "cooking_date": "2026-04-18 08:00:00",
    "curve_name": "我的自定义曲线",
    "temperature_points": [
      {"time_min": 0, "temperature": 25},
      {"time_min": 5, "temperature": 60},
      {"time_min": 10, "temperature": 85},
      {"time_min": 15, "temperature": 97},
      {"time_min": 20, "temperature": 97},
      {"time_min": 25, "temperature": 80}
    ]
  }]
}
```

## 更新日志

### v1.0.0 (2026-05-05)

- 初始版本发布
- 实现蚕茧批次管理功能
- 实现含水率抽检记录功能
- 实现煮茧温度曲线管理功能
- 实现断头记录和风险评估功能
- 实现交货等级记录功能
- 实现工艺参数计算引擎
- 实现CSV/JSON数据导入导出
- 实现Markdown工艺单导出
- 提供CLI命令行接口
- 提供本地SQLite数据存储

## 技术支持

如有问题或建议，请通过以下方式联系：
- 检查项目目录下的示例数据和代码
- 参考本文档的完整验证流程
- 查看命令帮助信息（`--help`）

## 许可证

本工具仅供内部使用，数据存储在本地，不涉及网络传输，保护生产数据安全。
