# 铁路货运预检工具 (Rail Freight Pre-check Tool)

一个用于铁路货运封车前预检装车方案的Python CLI工具。

## 功能特性

- **重量计算**：计算总重量、货物重量利用率，支持kg和t单位混用
- **轴重估算**：根据重心位置估算各轴载重
- **重心偏移计算**：计算纵横向重心偏移，检查是否超标
- **限界检查**：检查装载高度和宽度是否超出限制
- **危险品隔离检查**：检查不同类别危险品之间的隔离距离是否符合要求
- **多种输出格式**：
  - `issues.csv`：问题列表
  - `loading_report.md`：详细报告
  - `preview.html`：可视化预览页面

## 安装

```bash
# 克隆项目
cd zy8178

# 安装依赖
pip install -r requirements.txt
```

## 使用方法

### 基本用法

```bash
python -m rail_freight_checker \
  --vehicles samples/vehicles.csv \
  --cargo samples/cargo.json \
  --loading-plan samples/loading_plan.yaml \
  --rules samples/rules.yaml \
  --output-dir outputs/
```

### 命令行参数

| 参数 | 简写 | 说明 | 必填 |
|------|------|------|------|
| `--vehicles` | `-v` | 车辆参数CSV文件路径 | 是 |
| `--cargo` | `-c` | 货物尺寸重量JSON文件路径 | 是 |
| `--loading-plan` | `-p` | 装载方案YAML文件路径 | 是 |
| `--rules` | `-r` | 规则配置YAML文件路径 | 否 |
| `--output-dir` | `-o` | 输出目录路径（默认: ./outputs） | 否 |
| `--issues-only` | - | 仅输出问题列表，不生成完整报告 | 否 |
| `--verbose` | - | 显示详细输出信息 | 否 |

### Demo示例

使用示例数据运行预检：

```bash
# 完整运行（生成所有输出）
python -m rail_freight_checker \
  -v samples/vehicles.csv \
  -c samples/cargo.json \
  -p samples/loading_plan.yaml \
  -r samples/rules.yaml \
  -o outputs/

# 仅查看问题列表
python -m rail_freight_checker \
  -v samples/vehicles.csv \
  -c samples/cargo.json \
  -p samples/loading_plan.yaml \
  --issues-only
```

### 示例数据说明

示例数据位于 `samples/` 目录，包含以下边界情况：

1. **混用 kg/t 单位**：
   - `cargo_001`: 重量使用 "5t"
   - `cargo_002`: 重量使用 "20000kg"
   - `cargo_003`: 重量使用 "3吨"

2. **缺少货物尺寸**：
   - `cargo_005`: 只有重量，没有长、宽、高尺寸信息

3. **同车危险品隔离不足**：
   - `cargo_003`: 易燃液体（类别3）
   - `cargo_004`: 氧化剂（类别5.1）
   - 两者在装载方案中仅相距约500mm，小于规则要求的1000mm

## 输入文件格式

### 1. 车辆参数 CSV

```csv
id,type,tare_weight,max_load_weight,length,width,height_limit,axle_count,wheelbase,center_of_gravity_x
C70_001,敞车C70,23.8t,70t,13000mm,3140mm,4800mm,4,1830mm,6500mm
```

**字段说明**：
- `id`: 车辆唯一标识
- `type`: 车辆类型
- `tare_weight`: 自重（支持kg、t、吨单位）
- `max_load_weight`: 最大载重
- `length`: 车辆长度
- `width`: 车辆宽度
- `height_limit`: 高度限制
- `axle_count`: 轴数
- `wheelbase`: 轴距
- `center_of_gravity_x`: 车辆自身纵向重心位置

### 2. 货物尺寸重量 JSON

```json
[
  {
    "id": "cargo_001",
    "name": "机械设备A",
    "weight": "5t",
    "length": "2000mm",
    "width": "1500mm",
    "height": "1800mm",
    "is_dangerous": false
  },
  {
    "id": "cargo_003",
    "name": "化工原料C",
    "weight": "3吨",
    "length": "1000mm",
    "width": "1000mm",
    "height": "1200mm",
    "is_dangerous": true,
    "dangerous_category": "易燃液体",
    "dangerous_class": "3"
  }
]
```

**字段说明**：
- `id`: 货物唯一标识
- `name`: 货物名称
- `weight`: 重量（支持kg、t、吨单位）
- `length/width/height`: 尺寸（支持mm、cm、m单位）
- `is_dangerous`: 是否为危险品
- `dangerous_category`: 危险品类别
- `dangerous_class`: 危险品分类号

### 3. 装载方案 YAML

```yaml
vehicle_id: "C70_001"

cargo_items:
  - cargo_id: "cargo_001"
    x_position: "1000mm"  # 纵向位置（从车辆前端）
    y_position: "0mm"      # 横向位置（从车辆中心线，右侧为正）
    z_position: "0mm"      # 垂向位置（从车辆地板）
```

### 4. 规则配置 YAML

```yaml
max_longitudinal_offset: "100mm"    # 最大纵向重心偏移
max_lateral_offset: "50mm"          # 最大横向重心偏移
min_dangerous_goods_distance: "1000mm"  # 危险品最小隔离距离
axle_weight_tolerance: 0.05         # 轴重容差比例
over_weight_warning_threshold: 0.9  # 超重警告阈值（90%）
over_weight_error_threshold: 1.0     # 超重错误阈值（100%）
height_limit_tolerance: "0mm"        # 高度限制容差
width_limit_tolerance: "0mm"         # 宽度限制容差
```

## 输出文件说明

### 1. issues.csv

问题列表，包含以下列：
- 序号
- 级别（ERROR/WARNING/INFO）
- 类别
- 问题描述
- 详细信息
- 时间戳

### 2. loading_report.md

详细报告，包含：
- 检查结果概览
- 车辆信息
- 装载计算结果（重量、重心、轴重、限界）
- 货物清单
- 问题详情
- 建议

### 3. preview.html

可视化预览页面，使用Bootstrap样式，包含：
- 状态概览
- 关键指标卡片
- 问题详情
- 货物清单表格

## 测试

运行pytest测试：

```bash
pytest tests/ -v
```

测试覆盖以下边界情况：
- 混用 kg/t 单位
- 缺少货物尺寸
- 同车危险品隔离不足
- 正常装载场景

## 项目结构

```
zy8178/
├── rail_freight_checker/    # 主包
│   ├── __init__.py
│   ├── main.py              # CLI入口
│   ├── calculator.py        # 核心计算逻辑
│   ├── data_loader.py       # 数据加载
│   ├── output.py            # 输出生成
│   └── utils.py             # 工具函数
├── samples/                  # 示例数据
│   ├── vehicles.csv
│   ├── cargo.json
│   ├── loading_plan.yaml
│   └── rules.yaml
├── tests/                    # 测试用例
├── outputs/                  # 输出目录
├── requirements.txt
└── README.md
```

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 执行成功（无错误或仅有警告） |
| 1 | 程序错误（文件读取失败等） |
| 2 | 预检发现严重问题（ERROR级别） |

## 许可证

MIT License
