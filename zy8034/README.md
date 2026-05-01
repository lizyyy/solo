# 机场行李转盘拥堵复盘看板

一个用于行李保障主管早高峰后复盘的 Streamlit 应用。

## 功能特性

- **数据输入**: 支持航班计划 CSV、行李扫描 CSV、转盘分配 JSON、人工干预 YAML
- **核心计算**:
  - 匹配航班转盘占用时间窗
  - 计算首件延迟
  - 计算末件超时
  - 检测转盘容量冲突
  - 分析改派影响
- **边界处理**:
  - 跨午夜航班自动处理
  - 扫描记录缺失检测
- **数据筛选**: 按日期、航站楼、转盘筛选
- **报告导出**: Markdown 和 CSV 格式
- **可视化**: 延迟分布图表

## 项目结构

```
.
├── app.py                      # Streamlit 主应用
├── modules/
│   ├── __init__.py
│   ├── data_parser.py         # 数据解析模块
│   ├── rule_calculator.py     # 规则计算模块
│   └── reporter.py            # 报告生成模块
├── sample_data/               # 示例数据
│   ├── flights.csv
│   ├── bag_scans.csv
│   ├── carousel_allocations.json
│   └── interventions.yaml
├── tests/
│   ├── __init__.py
│   └── test_core.py          # 核心功能测试
├── requirements.txt           # 依赖包
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行应用

```bash
streamlit run app.py
```

### 3. 访问应用

打开浏览器访问: http://localhost:8501

## 使用说明

### 数据文件格式

#### 1. 航班计划 (flights.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| flight_num | 航班号 | CA101 |
| arrival_date | 到达日期 | 2026-05-01 |
| arrival_time | 到达时间 | 06:30 |
| terminal | 航站楼 | T1 |
| expected_first_bag | 预计首件时间 | 06:45 |
| expected_last_bag | 预计末件时间 | 07:15 |
| bag_count | 行李数量 | 150 |

#### 2. 行李扫描 (bag_scans.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| flight_num | 航班号 | CA101 |
| scan_time | 扫描时间 | 2026-05-01 06:48 |
| bag_type | 扫描类型 | first/last |

#### 3. 转盘分配 (carousel_allocations.json)

```json
{
  "2026-05-01": {
    "T1": {
      "CA101": "C1"
    }
  }
}
```

#### 4. 人工干预 (interventions.yaml)

```yaml
interventions:
  - date: "2026-05-01"
    flight_num: "MU505"
    type: "carousel_reassign"
    from_carousel: "T2-1"
    to_carousel: "T2-2"
    reason: "T2-1 拥堵"
```

### 运行测试

```bash
pytest tests/ -v
```

## 技术栈

- Streamlit - Web 应用框架
- Pandas - 数据处理
- Plotly - 数据可视化
- PyYAML - YAML 解析
- Pytest - 测试框架
