# 夜间噪声投诉溯源台

一个为社区环境热线值班员设计的本地数据分析与可视化工具，帮助快速分析夜间噪声投诉数据，区分短时施工、酒吧散场、道路施工等不同噪声源。

## 功能特性

- **数据导入与清洗**：支持导入居民投诉CSV、施工备案JSON、噪声监测分钟级记录和街区网格边界，自动处理时间格式、坐标转换和缺测数据
- **多维度聚合分析**：按街区和时段聚合分贝峰值、投诉密度和备案覆盖率
- **智能噪声源识别**：基于关键词、时间模式、噪声特征和备案信息，自动区分短时施工、酒吧散场、道路施工、交通噪声等
- **可视化展示**：趋势图、热区排行、可疑源解释，直观展示分析结果
- **人工标记与核实**：支持人工标记核实结论，本地保存会话
- **多格式导出**：支持导出 Markdown 简报、CSV 热区表和 JSON 审计包

## 项目结构

```
xy4310/
├── app.py                      # Streamlit 主应用程序
├── config.py                   # 配置文件
├── requirements.txt            # 依赖包列表
├── README.md                   # 本文档
├── data/
│   ├── raw/                   # 原始数据目录
│   ├── processed/             # 处理后数据目录
│   └── sample/                # 示例数据目录
├── sessions/                  # 会话存储目录
├── exports/                   # 导出文件目录
├── src/
│   ├── __init__.py
│   ├── data_parser/           # 数据解析模块
│   │   ├── __init__.py
│   │   ├── complaints.py      # 投诉CSV解析
│   │   ├── permits.py         # 备案JSON解析
│   │   ├── monitoring.py      # 噪声监测解析
│   │   └── grid.py            # 网格边界解析
│   ├── data_cleaner/          # 数据清洗模块
│   │   ├── __init__.py
│   │   ├── time_processor.py  # 时间格式处理
│   │   ├── coordinate_processor.py  # 坐标转换
│   │   └── missing_handler.py # 缺测数据处理
│   ├── metrics/               # 指标计算模块
│   │   ├── __init__.py
│   │   └── aggregator.py      # 聚合计算引擎
│   ├── rules/                 # 规则解释模块
│   │   ├── __init__.py
│   │   └── classifier.py      # 噪声源分类器
│   ├── storage/               # 状态存储模块
│   │   ├── __init__.py
│   │   └── session_manager.py # 会话管理器
│   ├── export/                # 导出模块
│   │   ├── __init__.py
│   │   └── exporter.py        # 数据导出器
│   └── sample_data/           # 示例数据模块
│       ├── __init__.py
│       └── generator.py       # 示例数据生成器
└── tests/                     # 测试目录
    ├── __init__.py
    ├── test_data_parser.py    # 数据解析测试
    └── test_rules.py          # 规则分类测试
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动应用

```bash
streamlit run app.py
```

应用将在浏览器中自动打开，默认地址为 `http://localhost:8501`

### 3. 验证流程

#### 方式一：使用示例数据（推荐）

1. 打开应用后，在左侧导航选择「数据导入」页面
2. 点击「加载示例数据」按钮，系统将自动生成并加载示例数据
3. 点击左侧导航的「执行分析」按钮，或进入「分析概览」页面点击「开始分析」
4. 在「分析概览」页面查看：
   - 核心指标卡片（平均噪声、总投诉数、备案覆盖率、热区数量）
   - 时间趋势图（24小时噪声变化、投诉时段分布）
   - 空间分布（热区排行）
   - 噪声源分析（类型分布、分类详情）
5. 在「人工核实」页面：
   - 选择投诉ID和标记类型
   - 选择核实结果和标记值
   - 添加备注信息
   - 点击「保存标记」
6. 在「数据导出」页面：
   - 生成并下载 Markdown 简报
   - 导出 CSV 热区表
   - 打包并下载 JSON 审计包
7. 在「会话管理」页面：
   - 创建新会话
   - 加载/删除历史会话
   - 查看当前会话信息

#### 方式二：使用自定义数据

1. 准备数据文件：
   - **居民投诉**：CSV格式，包含投诉单号、投诉时间、地点、经纬度、描述等字段
   - **施工备案**：JSON格式，包含备案编号、项目名称、开始/结束时间、地点、经纬度等
   - **噪声监测**：CSV/Excel格式，分钟级记录，包含监测点、时间、分贝值等
   - **街区网格**：JSON/GeoJSON格式，包含网格边界、区域类型、面积、人口等

2. 在「数据导入」页面分别上传对应文件

3. 后续步骤同方式一

## 数据格式说明

### 居民投诉数据 (CSV)

必需字段：
- `complaint_id` / `投诉单号` / `单号`：投诉唯一标识
- `complaint_time` / `投诉时间` / `时间`：投诉发生时间
- `location` / `投诉地点` / `地点`：投诉地点描述
- `longitude` / `经度` / `lon`：经度坐标
- `latitude` / `纬度` / `lat`：纬度坐标
- `description` / `投诉描述` / `描述`：投诉内容描述

可选字段：
- `complaint_type` / `投诉类型`：投诉类型
- `severity` / `严重程度`：严重程度

### 施工备案数据 (JSON)

必需字段：
- `permit_id` / `备案编号`：备案编号
- `project_name` / `项目名称`：项目名称
- `location` / `施工地点`：施工地点
- `longitude` / `经度`：经度坐标
- `latitude` / `纬度`：纬度坐标
- `start_time` / `开始时间`：开始时间
- `end_time` / `结束时间`：结束时间

可选字段：
- `construction_type` / `施工类型`：施工类型
- `contractor` / `施工单位`：施工单位
- `permit_status` / `备案状态`：备案状态

### 噪声监测数据 (CSV/Excel)

必需字段：
- `monitor_id` / `监测点编号`：监测点标识
- `monitor_time` / `监测时间`：监测时间
- `db_level` / `分贝值` / `db`：分贝值

可选字段：
- `db_peak` / `峰值分贝` / `lmax`：峰值分贝
- `db_leq` / `等效声级` / `leq`：等效连续声级
- `longitude` / `经度`：监测点经度
- `latitude` / `纬度`：监测点纬度
- `status` / `监测状态`：监测状态

### 街区网格数据 (JSON/GeoJSON)

支持标准 GeoJSON 格式或自定义 JSON 格式：

必需字段：
- `grid_id` / `网格编号`：网格唯一标识
- `grid_name` / `网格名称`：网格名称

可选字段：
- `area` / `面积`：区域面积（平方公里）
- `population` / `人口`：人口数量
- `zone_type` / `区域类型`：区域类型（居住区、商业区、工业区等）
- `boundary` / `边界坐标`：多边形边界坐标
- `longitude` / `经度`：网格中心经度
- `latitude` / `纬度`：网格中心纬度

## 噪声源分类规则

系统基于多维度特征进行智能分类：

| 噪声源类型 | 关键词特征 | 时间特征 | 噪声特征 | 持续时间 |
|-----------|-----------|---------|---------|---------|
| 短时施工 | 施工、装修、打孔、砸墙、电钻 | 白天为主 | 高波动，范围>20dB | 5-120分钟 |
| 酒吧散场 | 酒吧、KTV、夜店、唱歌、音乐 | 夜间22:00-02:00 | 中等波动 | 30-120分钟 |
| 道路施工 | 道路、修路、沥青、挖掘、土方 | 全天 | 稳定高噪声，标准差<3dB | >180分钟 |
| 交通噪声 | 车辆、堵车、鸣笛、货车 | 早晚高峰 | 平稳噪声 | 不定 |

## 运行测试

```bash
pytest tests/ -v
```

或运行特定测试文件：

```bash
pytest tests/test_data_parser.py -v
pytest tests/test_rules.py -v
```

## 配置说明

在 `config.py` 中可调整以下配置：

### 时间配置

```python
TIME_CONFIG = {
    "night_start_hour": 22,      # 夜间开始时间
    "night_end_hour": 6,          # 夜间结束时间
    "peak_hours": [18, 19, 20, 21, 22, 23, 0, 1],  # 高峰时段
    ...
}
```

### 噪声阈值

```python
NOISE_THRESHOLDS = {
    "residential_night": 55,    # 居住区夜间阈值
    "residential_day": 60,      # 居住区白天阈值
    "commercial_night": 60,     # 商业区夜间阈值
    ...
}
```

### 导出配置

```python
EXPORT_CONFIG = {
    "markdown_template": "report_template.md",
    "csv_encoding": "utf-8-sig",
    "json_indent": 2
}
```

## 技术栈

- **前端框架**：Streamlit
- **数据处理**：Pandas、NumPy
- **可视化**：Plotly
- **数据生成**：Faker
- **测试**：Pytest

## 许可证

MIT License

## 更新日志

### v1.0.0 (2024-05-04)

- 初始版本发布
- 实现数据解析模块（投诉、备案、监测、网格）
- 实现数据清洗模块（时间、坐标、缺测）
- 实现指标计算引擎
- 实现噪声源分类器
- 实现会话管理和标记功能
- 实现多格式导出
- 提供示例数据生成器
- 完成 Streamlit 可视化界面
