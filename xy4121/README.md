# 折弯展开复核器 (Bend Checker)

一个专为小型钣金厂工艺员设计的本地 CLI 工具，用于折弯工艺展开计算与风险核查。

## 核心功能

- **K因子智能选择**: 根据材料、厚度、折弯半径自动计算适用的K因子
- **展开尺寸计算**: 基于标准折弯扣除公式计算精确的展开毛坏尺寸
- **折弯顺序规划**: 基于法兰长度、折弯方向等规则规划最优折弯顺序
- **吨位计算**: 计算每道折弯所需压力，匹配车间设备能力
- **风险检查**:
  - 干涉检查: 检测折弯过程中的法兰碰撞、工具干涉
  - 孔边距检查: 检查孔到折弯线的距离是否满足最小要求
  - 吨位超限检查: 检测所需吨位是否超过设备安全负载
  - 重复零件检测: 识别相同规格的零件便于合并排产

## 技术原理

### K因子与折弯扣除计算

K因子表示钣金折弯时中性轴位置的系数，影响展开长度计算：

```
K因子调整规则:
- R/t < 1.0  → K = min(基准K, 0.33)
- 1.0 ≤ R/t < 2.0 → K = min(基准K, 0.38)
- R/t ≥ 2.0 → K = 基准K
```

折弯扣除(Bend Deduction)计算公式:

```
折弯扣除 = 2 × 内侧偏移量 - 中性轴弧长

其中:
  内侧偏移量 = (R + t) × tan(θ/2)
  中性轴弧长 = π × (R + K × t) × θ / 180
  
变量说明:
  R = 折弯内半径
  t = 材料厚度
  θ = 折弯角度(度)
  K = K因子
```

### 吨位计算公式

```
吨位 = (抗拉强度 × 折弯长度 × 厚度²) / (1000 × V槽宽度) × 安全系数

安全系数: 1.25 (行业标准)
V槽宽度: 自动采用 8 × t 或按模具配置
```

### 孔边距安全标准

| 孔类型 | 最小距离建议 |
|--------|-------------|
| 圆形孔 | ≥ 1.5 × t + 孔半径 |
| 长圆形/方形孔 | ≥ 2.0 × t + 孔半径 |

## 安装

```bash
# 克隆或下载项目后，在项目目录执行
pip install -e .

# 或使用 requirements.txt
pip install -r requirements.txt
pip install -e .
```

验证安装:
```bash
bend-checker --version
bend-checker --help
```

## 临时目录验证流程

以下是快速验证工具功能的完整流程：

### 1. 创建工作目录并初始化

```bash
# 创建临时工作目录
mkdir -p /tmp/bend_checker_test && cd /tmp/bend_checker_test

# 初始化车间配置
bend-checker init --name "测试车间"
```

### 2. 查看默认配置

```bash
# 查看当前状态
bend-checker status

# 输出示例:
# ==================================================
# 折弯展开复核器 - 状态信息
# ==================================================
# 车间名称: 测试车间
# 配置目录: /tmp/bend_checker_test/.bend_checker
#
# 车间资源:
#   - 材料种类: 11
#   - 设备数量: 4
#   - 模具数量: 6
```

### 3. 导入示例零件

使用项目中的示例数据：

```bash
# 导入示例零件 (替换为你的项目实际路径)
bend-checker import --parts /Users/mac/pro/solocoder/pro/xy4121/repo/xy4121/examples/sample_parts.csv
```

### 4. 执行工艺规划

```bash
# 计算展开、折弯顺序、吨位 (使用默认折弯长度100mm)
bend-checker plan

# 或指定折弯长度
bend-checker plan --bend-length 150
```

### 5. 执行风险检查

```bash
bend-checker check
```

### 6. 导出报告

```bash
# 导出 Markdown 格式
bend-checker report --format markdown

# 导出 CSV 格式
bend-checker report --format csv

# 导出 JSON 格式
bend-checker report --format json

# 导出全部格式
bend-checker report --format all -o ./reports/
```

### 7. 查看生成的报告

```bash
# 查看 Markdown 报告
cat bend_check_report.md

# 查看 CSV 报告
cat bend_check_report_summary.csv
```

## 完整命令说明

### 全局选项

```bash
bend-checker [OPTIONS] COMMAND [ARGS]...

选项:
  -v, --verbose      显示详细输出
  -d, --config-dir   指定配置目录路径
  --version          显示版本号
  --help             显示帮助信息
```

### init - 初始化车间配置

```bash
bend-checker init [OPTIONS]

选项:
  -n, --name TEXT    车间名称 (默认: "默认车间")
  -f, --force        强制覆盖现有配置
```

初始化后将在当前目录创建 `.bend_checker/` 目录，包含：
- `config.json` - 车间主配置
- `materials.json` - 材料库 (11种默认材料)
- `machines.json` - 设备库 (4台默认折弯机)
- `dies.json` - 模具库 (6套默认V模)

### import - 导入数据

```bash
bend-checker import [OPTIONS]

选项:
  -p, --parts FILE      零件CSV文件路径
  -d, --dies FILE       模具JSON文件路径
  -m, --machines FILE   设备JSON文件路径
  -t, --materials FILE  材料JSON文件路径
  --template            生成导入模板文件
```

#### 生成模板

```bash
# 生成所有导入模板到 import_templates/ 目录
bend-checker import --template
```

#### 零件CSV格式说明

```csv
part_number,part_name,material_grade,material_thickness,quantity,overall_length,overall_width,notes
P-001,左侧板,SPCC,1.5,50,150,80,标准U型件
```

折弯信息列 (支持多折弯):
```csv
bend_id,bend_angle,bend_radius,flange_length,inside_length,direction,k_factor_override,die_v_width,bend_notes
B1,90,1.5,25,100,up,,,第一个折弯
```

孔信息列 (支持多孔):
```csv
hole_id,hole_type,diameter,width,height,x_position,y_position,distance_to_bend,hole_notes
H1,circular,8,,,20,15,15,安装孔
```

### plan - 工艺规划计算

```bash
bend-checker plan [OPTIONS]

选项:
  -l, --bend-length FLOAT   折弯长度(mm)，默认100.0
```

执行内容:
1. 计算展开尺寸 (含各折弯扣除详情)
2. 规划折弯顺序 (推荐顺序和风险提示)
3. 计算吨位和设备匹配 (推荐设备)

### check - 风险检查

```bash
bend-checker check
```

执行内容:
1. 干涉检查 (法兰碰撞、工具干涉)
2. 孔边距检查 (孔到折弯线距离)
3. 重复零件检测 (相同规格零件识别)

### report - 导出报告

```bash
bend-checker report [OPTIONS]

选项:
  -f, --format [markdown|csv|json|all]  输出格式，默认markdown
  -o, --output PATH                      输出文件或目录路径
```

#### 报告内容

**Markdown报告** (`bend_check_report.md`):
- 车间信息摘要
- 零件列表和展开尺寸
- 折弯顺序规划详情
- 吨位计算和设备匹配
- 所有风险问题汇总
- 重复零件列表

**CSV报告**:
- `*_summary.csv` - 零件摘要
- `*_bends.csv` - 折弯详情
- `*_issues.csv` - 问题清单
- `*_duplicates.csv` - 重复零件

**JSON报告**: 完整结构化数据

### status - 查看状态

```bash
bend-checker status
```

显示:
- 车间配置信息
- 当前会话已导入的零件
- 各步骤执行状态

## 项目结构

```
bend_checker/
├── __init__.py          # 包初始化
├── cli.py               # 命令行入口
├── models/              # 数据模型
│   ├── __init__.py
│   ├── material.py      # 材料模型 (K因子、折弯扣除计算)
│   ├── part.py          # 零件、折弯、孔数据类
│   ├── machine.py       # 折弯机设备模型
│   └── die.py           # 模具模型
├── geometry/            # 几何计算
│   ├── __init__.py
│   ├── unfold.py        # 展开尺寸计算
│   └── sequence.py      # 折弯顺序规划
├── rules/               # 规则引擎
│   ├── __init__.py
│   ├── interference.py  # 干涉检查
│   ├── tonnage.py       # 吨位计算
│   ├── hole_distance.py # 孔边距检查
│   └── duplicate.py     # 重复零件检测
├── storage/             # 存储模块
│   ├── __init__.py
│   ├── config.py        # 配置管理
│   ├── csv_import.py    # CSV导入
│   └── json_import.py   # JSON导入导出
└── report/              # 报告模块
    ├── __init__.py
    ├── markdown.py      # Markdown报告生成
    ├── csv_export.py    # CSV导出
    └── json_export.py   # JSON导出

examples/                 # 示例数据
├── sample_parts.csv      # 5个示例零件
└── test_part_with_issues.csv  # 带风险的测试零件

tests/                    # 测试模块
├── test_material.py      # 材料计算测试 (14个)
├── test_geometry.py      # 几何计算测试 (9个)
├── test_rules.py         # 规则引擎测试 (18个)
└── test_storage.py       # 存储模块测试 (8个)
```

## 默认配置资源

### 默认材料库

| 牌号 | 厚度 | 抗拉强度 | K因子 | 最小折弯半径 |
|------|------|----------|-------|-------------|
| SPCC | 1.0mm | 270MPa | 0.33 | 0.8mm |
| SPCC | 1.5mm | 270MPa | 0.35 | 1.0mm |
| SPCC | 2.0mm | 270MPa | 0.38 | 1.5mm |
| SPCC | 3.0mm | 270MPa | 0.40 | 2.0mm |
| SUS304 | 1.0mm | 520MPa | 0.35 | 1.0mm |
| SUS304 | 1.5mm | 520MPa | 0.38 | 1.5mm |
| SUS304 | 2.0mm | 520MPa | 0.40 | 2.0mm |
| AL1060 | 1.0mm | 110MPa | 0.30 | 0.5mm |
| AL1060 | 1.5mm | 110MPa | 0.32 | 0.8mm |
| AL5052 | 1.0mm | 195MPa | 0.33 | 0.8mm |
| AL5052 | 2.0mm | 195MPa | 0.36 | 1.5mm |

### 默认设备库

| 设备ID | 名称 | 最大吨位 | 工作台长度 |
|--------|------|----------|-----------|
| WC67Y-30 | 30吨数控折弯机 | 30吨 | 1600mm |
| WC67Y-63 | 63吨数控折弯机 | 63吨 | 2500mm |
| WC67Y-100 | 100吨数控折弯机 | 100吨 | 3200mm |
| WC67Y-160 | 160吨数控折弯机 | 160吨 | 4000mm |

### 默认模具库

| 模具ID | V槽宽度 | V槽角度 | 适用厚度 |
|--------|---------|---------|----------|
| V6 | 6mm | 90° | 0.5-1.0mm |
| V8 | 8mm | 90° | 0.8-1.5mm |
| V12 | 12mm | 90° | 1.2-2.0mm |
| V16 | 16mm | 90° | 1.5-3.0mm |
| V20 | 20mm | 90° | 2.0-4.0mm |
| V25 | 25mm | 90° | 2.5-5.0mm |

## 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定模块测试
python -m pytest tests/test_material.py -v
python -m pytest tests/test_rules.py -v
```

共包含 **49** 个测试用例，覆盖所有核心功能。

## 常见问题

### Q: 如何添加自定义材料?

```bash
# 1. 生成材料模板
bend-checker import --template

# 2. 编辑 import_templates/materials_template.json

# 3. 导入自定义材料
bend-checker import --materials import_templates/materials_template.json
```

### Q: K因子可以手动指定吗?

可以。在零件CSV的 `k_factor_override` 列填入具体数值，将覆盖材料库的默认K因子。

### Q: 如何处理非90°折弯?

在 `bend_angle` 列填入实际角度，计算时会自动应用角度系数:
- 角度 < 90°: 吨位按比例降低
- 角度 > 90°: 吨位按 1.0 + (θ-90)/180 增加

## 依赖

- Python 3.8+
- click >= 8.0.0
- python-dateutil >= 2.8.0

## 许可证

MIT License
