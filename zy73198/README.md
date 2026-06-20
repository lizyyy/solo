# 📊 优化调参图表解释系统

> 让每一个数字都有迹可循，让每一次调参都清晰透明

## 🎯 解决的问题

教研编辑阿宁说最耽误人的不是录入，而是同一题被两个版本答案覆盖。本系统解决以下痛点：

1. **版本历史追踪** - 避免同一题被两个版本答案覆盖，排班同事能看出哪一步让结果变化
2. **原始数据保留** - 参数表拿到手多半不齐整，保留原始来源，避免把脏数据修得看不出痕迹
3. **边界问题处理** - 拿除零边界压系统时，不光冒一个警告，还能告诉接手的人该怎么处理
4. **通俗易懂解释** - 社区公示前要能讲给不看代码的人听，数字从哪来要有线索
5. **数据溯源能力** - 如果坏数据影响解释，接手的人能顺着提示回到参数表的原始对象
6. **现场材料打包** - 带一包像现场会收到的材料就行

---

## 🚀 快速开始（阿宁看这里！）

### 第一步：先跑这条命令 - 生成演示数据

```bash
# 安装依赖
pip install -r requirements.txt

# 生成演示数据（首次使用必跑）
python -m src.cli demo
```

### 第二步：再看这份历史时间线

```bash
# 查看版本时间线，了解哪一步让结果变化
python -m src.cli timeline
```

### 第三步：查看图表解释

```bash
# 查看指定版本的解释（通俗易懂版）
python -m src.cli explain --version v3
```

### 第四步：遇到问题追溯数据

```bash
# 追溯坏数据来源，回到参数表的原始对象
python -m src.cli trace --param 分母
```

### 第五步：打包现场材料

```bash
# 打包材料包，生成像现场会收到的材料
python -m src.cli package --name "6月调参结果公示" --output ./output
```

---

## 📋 完整命令列表

| 命令 | 说明 |
|------|------|
| `python -m src.cli demo` | 生成演示数据（3个版本，含除零边界） |
| `python -m src.cli timeline` | 查看版本时间线 |
| `python -m src.cli versions` | 列出所有版本 |
| `python -m src.cli explain --version v1` | 生成图表解释 |
| `python -m src.cli compare --version1 v1 --version2 v2` | 比较两个版本 |
| `python -m src.cli trace --param 分母` | 追溯坏数据来源 |
| `python -m src.cli package --name "..." --output ./output` | 打包现场材料 |
| `python -m src.cli import_params ...` | 导入新参数 |

---

## 🏗️ 项目结构

```
/Users/maca/pro/solo/workspaces/zy73198/
├── src/
│   ├── __init__.py
│   ├── parameter_manager.py    # 参数管理模块（版本追踪、原始数据保留）
│   ├── chart_explainer.py      # 图表解释引擎（变更追溯、除零边界处理）
│   ├── data_lineage.py         # 数据溯源系统（坏数据追溯到原始对象）
│   ├── material_packer.py      # 现场材料打包功能
│   └── cli.py                  # 命令行工具
├── web/
│   └── index.html              # Web可视化界面
├── requirements.txt            # 依赖清单
└── README.md                   # 本文件
```

---

## 🔧 核心模块说明

### 1. 参数管理模块 ([parameter_manager.py](file:///Users/maca/pro/solo/workspaces/zy73198/src/parameter_manager.py))

**功能**：
- 版本追踪：每一次参数变更都创建新版本，避免覆盖
- 原始来源保留：导入参数时必须提供原始数据，避免脏数据被修得看不出痕迹
- 版本比较：清晰看出哪一步让结果变化
- 版本时间线：供非技术人员查看历史

**关键类**：
- `ParameterSource` - 记录参数来源信息，保留原始数据
- `ParameterVersion` - 记录每一次参数变更，包含父版本关联
- `ParameterManager` - 核心管理器，支持导入、比较、追溯

### 2. 图表解释引擎 ([chart_explainer.py](file:///Users/maca/pro/solo/workspaces/zy73198/src/chart_explainer.py))

**功能**：
- 安全除法：处理除零边界，给出具体处理建议
- 通俗易懂解释：用自然语言解释计算过程，给不看代码的人听
- 计算步骤记录：数字从哪来要有线索，每一步都可追溯
- 边界问题检测：除零、负值等异常情况自动检测并给出处理建议

**关键类**：
- `BoundaryIssue` - 边界问题记录，包含问题描述和处理建议
- `CalculationStep` - 计算步骤记录，包含输入输出和溯源信息
- `ChartExplanation` - 完整的图表解释，通俗易懂
- `ChartExplainer` - 核心解释器

### 3. 数据溯源系统 ([data_lineage.py](file:///Users/maca/pro/solo/workspaces/zy73198/src/data_lineage.py))

**功能**：
- 坏数据追溯：顺着提示回到参数表的原始对象
- 溯源图：可视化数据流转路径
- 问题报告：生成完整的追溯报告，包含处理建议

**关键类**：
- `LineageNode` - 溯源节点，记录数据的每一次流转
- `DataIssueReport` - 数据问题报告，包含完整追溯链
- `DataLineageTracker` - 溯源追踪器

### 4. 材料打包功能 ([material_packer.py](file:///Users/maca/pro/solo/workspaces/zy73198/src/material_packer.py))

**功能**：
- 生成材料包README，告诉阿宁先跑哪条命令、再看哪份历史时间线
- 生成版本时间线（HTML + CSV）
- 生成图表解释报告（HTML + JSON）
- 生成边界问题处理建议
- 生成数据溯源报告
- 生成各版本参数表
- 生成原始数据副本

**打包后的材料清单**：
```
材料包/
├── 00_材料包说明.md          # 先看这个！
├── 01_版本时间线.html        # 可视化时间线
├── 01_版本时间线.csv         # 表格格式
├── 02_图表解释报告.html      # 通俗易懂版
├── 02_图表解释报告.json      # 原始数据
├── 03_边界问题处理建议.md    # 问题及处理建议
├── 04_数据溯源报告/          # 各参数追溯报告
├── 05_参数表/                # 各版本参数表
├── 06_原始数据副本/          # 原始数据备份
└── manifest.json             # 材料清单
```

---

## 💻 命令行工具详解 ([cli.py](file:///Users/maca/pro/solo/workspaces/zy73198/src/cli.py))

### 生成演示数据

```bash
python -m src.cli demo
```

创建3个版本的示例数据：
- **v1**：初始参数（分子=25，分母=100，总数=500，样本量=50）
- **v2**：修正分子和总数（分子=30，总数=550）
- **v3**：添加A/B值，分母设为0（测试除零边界处理）

### 查看版本时间线

```bash
python -m src.cli timeline
```

显示所有版本的时间线，包括：
- 版本名称和创建时间
- 创建人
- 数据来源
- 变更描述
- 参数变更详情

### 生成图表解释

```bash
python -m src.cli explain --version v3
```

输出：
- 通俗易懂的解释（给不看代码的人听）
- 关键结论
- 边界问题及处理建议
- 计算过程（每一步的输入输出）
- 数据来源

### 比较两个版本

```bash
python -m src.cli compare --version1 v1 --version2 v2
```

输出：
- 参数变更详情（新增/删除/修改）
- 计算结果变化
- 哪一步让结果变化

### 追溯坏数据

```bash
python -m src.cli trace --param 分母
```

输出：
- 参数历史变更记录
- 首次出现信息（来源、录入人、原始数据）
- 处理建议
- 溯源关系图

### 打包现场材料

```bash
python -m src.cli package --name "6月调参结果公示" --output ./output
```

生成完整的材料包，包含：
- 材料包说明（告诉阿宁先跑哪条命令）
- 版本时间线
- 图表解释报告
- 边界问题处理建议
- 数据溯源报告
- 参数表
- 原始数据副本

### 导入新参数

```bash
python -m src.cli import_params \
  --params '{"分子": 10, "分母": 5}' \
  --source_type excel \
  --source_id data.xlsx \
  --source_name "6月数据表格" \
  --raw_data '{"分子": 10, "分母": 5, "备注": "原始录入"}' \
  --created_by 阿宁 \
  --version_name v4 \
  --change_description "更新6月数据" \
  --change_reason "收到最新数据"
```

---

## 🌐 Web界面

打开 `web/index.html` 即可查看可视化界面，包含：
- 快速开始指南
- 核心功能介绍
- 常用命令展示
- 演示数据引导

---

## 🧪 运行测试

```bash
# 安装依赖
pip install -r requirements.txt

# 运行完整演示
python -m src.cli demo

# 查看时间线
python -m src.cli timeline

# 查看解释
python -m src.cli explain --version v3

# 追溯数据
python -m src.cli trace --param 分母

# 打包材料
python -m src.cli package --name "测试材料包" --output ./output
```

---

## 📝 使用场景示例

### 场景1：阿宁发现同一题被两个版本答案覆盖

1. 运行 `python -m src.cli timeline` 查看版本历史
2. 运行 `python -m src.cli compare --version1 v1 --version2 v2` 比较差异
3. 清晰看出哪一步让结果变化

### 场景2：参数表不齐整，怀疑有脏数据

1. 运行 `python -m src.cli trace --param 分母` 追溯来源
2. 查看首次出现的原始数据副本
3. 联系录入人确认数据准确性

### 场景3：除零边界测试

1. 运行 `python -m src.cli explain --version v3` 查看解释
2. 系统自动检测到除零问题
3. 给出具体的处理建议，告诉接手的人该怎么处理

### 场景4：社区公示前准备材料

1. 运行 `python -m src.cli package --name "6月公示" --output ./output`
2. 打开 `02_图表解释报告.html` 查看通俗易懂的解释
3. 确认数字从哪来都有线索
4. 直接用于社区公示

---

## 🔐 数据安全

- 所有原始数据都保留副本，避免脏数据被修得看不出痕迹
- 每一次参数变更都记录创建人，可追溯责任
- 数据溯源功能确保任何问题都能回到原始对象

---

## 📞 联系信息

如有疑问，请参考各版本中的创建人信息，或查看材料包中的数据溯源报告。

---

**让每一个数字都有迹可循，让每一次调参都清晰透明** ✨
