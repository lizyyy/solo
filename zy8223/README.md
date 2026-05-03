# 🌳 行道树台风倒伏风险复盘看板

台风过后树木风险评估与处置决策支持系统。

## 📋 功能特点

- **多源数据导入**: 支持树木台账 CSV、巡查事件 JSONL、小时级风雨 CSV、风险规则 YAML
- **综合风险评估**: 计算风雨暴露、浅根、高龄、积水等多维度风险因子
- **智能筛选**: 按路段、树种、处置状态、风险等级多维度筛选
- **边界情况处理**:
  - ✅ 跨午夜台风过程的连续性识别
  - ✅ 同一树木多次巡查的状态聚合（取最新状态）
  - ✅ 缺失经纬度的优雅处理
- **导出功能**: 生成风险清单 CSV 和复盘报告 Markdown

## 🗂️ 项目结构

```
zy8223/
├── app.py                    # Streamlit 主应用
├── requirements.txt          # 依赖包
├── README.md                 # 本文档
├── modules/
│   ├── __init__.py
│   ├── data_loader.py        # 数据加载模块
│   ├── risk_calculator.py    # 风险计算模块
│   └── exporter.py           # 导出模块
├── sample_data/              # 示例数据
│   ├── tree_inventory.csv    # 树木台账
│   ├── inspection_events.jsonl   # 巡查事件
│   ├── weather_hourly.csv    # 小时级气象数据
│   └── risk_rules.yaml       # 风险规则配置
└── output/                   # 导出文件目录（运行时创建）
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 2. 启动应用

```bash
# 进入项目目录
cd /Users/lzy/pro/solocoder/pro/zy8223/repo/zy8223

# 启动 Streamlit
streamlit run app.py
```

### 3. 访问应用

应用启动后，浏览器会自动打开 `http://localhost:8501`

### 4. 体验功能

**方式一：使用示例数据**
- 点击左侧边栏的「📊 加载示例数据」按钮
- 设置筛选条件（可选）
- 点击「🔍 应用筛选并计算风险」

**方式二：上传自己的数据**
- 分别上传四种数据文件
- 点击「🔄 加载上传的数据」
- 计算风险并查看结果

## 📁 数据格式说明

### 1. 树木台账 (tree_inventory.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| tree_id | string | 树木唯一标识 |
| road_name | string | 路段名称 |
| tree_species | string | 树种 |
| tree_age | int | 树龄（年） |
| root_depth_category | string | 根系类别：浅根/中根/深根 |
| has_water_pool | boolean | 是否位于易积水区域 |
| latitude | float | 纬度（可选） |
| longitude | float | 经度（可选） |

**示例：**
```csv
tree_id,road_name,tree_species,tree_age,root_depth_category,has_water_pool,latitude,longitude
T001,中山路,樟树,35,浅根,True,31.2304,121.4737
T002,中山路,悬铃木,20,中根,False,31.2306,121.4739
```

### 2. 巡查事件 (inspection_events.jsonl)

每行一个 JSON 对象：

| 字段 | 类型 | 说明 |
|------|------|------|
| tree_id | string | 树木ID |
| inspection_time | string | 巡查时间，格式：YYYY-MM-DD HH:MM:SS |
| disposal_status | string | 处置状态：待处置/处置中/已处置/无需处置 |
| damage_type | string | 损坏类型：fall_over(倒伏)/branch_break(断枝)/leaning(倾斜)/root_exposed(露根) |
| inspector | string | 巡查员（可选） |
| typhoon_event | string | 台风事件名称（可选） |

**示例：**
```jsonl
{"tree_id": "T001", "inspection_time": "2024-07-25 14:30:00", "disposal_status": "待处置", "damage_type": "fall_over", "inspector": "张三"}
{"tree_id": "T002", "inspection_time": "2024-07-25 15:00:00", "disposal_status": "处置中", "damage_type": "branch_break", "inspector": "李四"}
```

### 3. 小时级气象数据 (weather_hourly.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| time | string | 时间，格式：YYYY-MM-DD HH:MM:SS |
| wind_speed | float | 风速 (m/s) |
| rainfall | float | 降雨量 (mm/h) |
| temperature | float | 温度 (可选) |

**示例（包含跨午夜台风）：**
```csv
time,wind_speed,rainfall
2024-07-24 22:00:00,28,26
2024-07-24 23:00:00,30,28
2024-07-25 00:00:00,32,30
2024-07-25 01:00:00,34,28
```

### 4. 风险规则 (risk_rules.yaml)

可配置风险阈值和权重。

**示例：**
```yaml
wind_risk:
  thresholds:
    - wind_speed: 10
      risk_level: low
    - wind_speed: 20
      risk_level: medium
    - wind_speed: 30
      risk_level: high
  weights:
    exposure_hours: 0.3
    max_wind: 0.7

root_risk:
  shallow_root_factor: 1.5
  categories:
    浅根: high
    中根: medium
    深根: low

overall_risk:
  weights:
    wind_risk: 0.35
    root_risk: 0.25
    age_risk: 0.20
    water_risk: 0.20
  thresholds:
    low: 30
    medium: 60
    high: 80
```

## 📊 界面功能

### 左侧边栏
- **数据导入**: 加载示例数据或上传自定义数据
- **筛选条件**:
  - 选择路段
  - 选择树种
  - 处置状态筛选
  - 风险等级筛选
  - 台风时段选择

### 主界面标签页

1. **🎯 优先处置清单**
   - 按风险优先级排序的树木列表
   - 支持筛选：仅倒伏、仅断枝、仅高/中风险、仅待处置
   - 按路段和树种汇总

2. **📊 风险分布**
   - 风险等级分布柱状图
   - 处置状态分布
   - 损坏类型分布
   - 风险因子统计

3. **🗂️ 详细列表**
   - 可搜索的完整风险列表
   - 自定义显示列
   - 单棵树详情查看

4. **📥 数据导出**
   - 导出 risk_items.csv
   - 导出 tree_risk_review.md
   - Markdown 报告预览

## 📤 输出文件说明

### risk_items.csv

包含以下字段：
- 基本信息：优先级、树木ID、路段、树种、树龄、根系类型
- 风险评分：综合风险评分、各维度风险评分
- 巡查状态：处置状态、损坏类型、巡查次数
- 位置信息：经纬度
- 气象暴露：最大风速、暴露时长、累计降雨

### tree_risk_review.md

完整的复盘报告，包含：
- 台风过程信息
- 总体统计
- 优先处置清单（TOP 20）
- 按路段/树种汇总
- 风险因子分析（浅根、高龄、易积水）
- 处置建议

## ⚠️ 边界情况处理

### 1. 跨午夜台风过程
系统会自动识别连续的台风时段，即使跨越午夜。时间间隔不超过3小时的记录会被合并为一个台风过程。

### 2. 同一树木重复巡查
当同一树木被多次巡查时，系统会：
- 保留所有巡查记录
- 取最新的巡查记录作为当前状态
- 在详情页显示巡查次数

### 3. 缺失经纬度
- 系统会标记缺失经纬度的树木
- 不影响风险计算
- 统计中会显示缺失经纬度的数量

### 4. 数据缺失
- 缺少气象数据：风风险和水风险评分为0
- 缺少巡查数据：处置状态为"未知"
- 缺少风险规则：使用默认规则

## 🔧 自定义配置

### 修改风险权重
编辑 `sample_data/risk_rules.yaml` 中的 `overall_risk.weights` 部分：

```yaml
overall_risk:
  weights:
    wind_risk: 0.35    # 风风险权重
    root_risk: 0.25    # 根风险权重
    age_risk: 0.20     # 龄风险权重
    water_risk: 0.20   # 水风险权重
```

### 修改风险阈值
调整 `thresholds` 来改变风险等级的划分：

```yaml
overall_risk:
  thresholds:
    low: 30      # 低于30为极低风险
    medium: 60   # 30-60为低风险，60-80为中风险
    high: 80     # 高于80为高风险
```

## 🛠️ 模块说明

### modules/data_loader.py
- `DataLoader` 类：负责加载和预处理各种数据格式
- 处理数据验证、类型转换、缺失值标记

### modules/risk_calculator.py
- `RiskCalculator` 类：实现各种风险计算逻辑
- 风风险、根风险、龄风险、水风险的独立计算
- 综合风险加权汇总

### modules/exporter.py
- `Exporter` 类：负责数据导出
- CSV 格式风险清单
- Markdown 格式复盘报告

## 📝 更新日志

- v1.0.0: 初始版本发布
  - 支持四种数据格式导入
  - 多维度风险计算
  - 智能筛选和优先排序
  - CSV 和 Markdown 导出

## 📄 许可证

本项目仅供内部使用。

---

如有问题，请查看代码注释或联系开发团队。
