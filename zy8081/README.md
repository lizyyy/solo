# 田间试验随机区组复核看板

基于 Streamlit 的田间试验数据质量控制和可视化工具，支持育种试验员导入产量数据、天气数据和试验设计文件，进行数据校验、异常检测和报告导出。

## 功能特性

- **数据导入**: 支持导入 plot_yield.csv、weather.csv 和 trial_design.yaml 文件
- **数据校验**: 自动检测缺失区组、重复记录、无效格式等问题
- **产量分布**: 按品种/区组展示产量分布箱线图和直方图
- **异常检测**: 
  - 缺测地块识别
  - 边界行异常检测
  - 重复记录识别
  - 产量异常值检测
- **天气冲击分析**: 自动识别高温、暴雨、大风等天气事件
- **数据筛选**: 支持按区组和品种筛选
- **报告导出**: 导出 qc_report.md 质量报告和 cleaned_yield.csv 清洗数据

## 项目结构

```
.
├── app.py                    # Streamlit 主应用
├── src/
│   ├── data_parser.py        # 数据解析和校验模块
│   ├── block_statistics.py   # 区组统计模块
│   ├── anomaly_rules.py      # 异常检测规则模块
│   └── export_module.py      # 报告导出模块
├── sample_data/
│   ├── plot_yield.csv        # 示例产量数据
│   ├── weather.csv           # 示例天气数据
│   └── trial_design.yaml     # 示例试验设计
└── requirements.txt          # 依赖列表
```

## 安装依赖

```bash
pip install -r requirements.txt
```

## 运行方式

```bash
streamlit run app.py
```

## 文件格式说明

### plot_yield.csv

| 字段 | 类型 | 说明 |
|------|------|------|
| plot_id | string | 地块唯一标识 |
| block | int | 区组编号 |
| rep | int | 重复编号 |
| variety | string | 品种名称 |
| yield_kg | float | 产量(kg) |
| harvest_date | date | 收获日期 |
| notes | string | 备注信息 |

### weather.csv

| 字段 | 类型 | 说明 |
|------|------|------|
| date | date | 日期 |
| temperature_max | float | 最高温度(°C) |
| temperature_min | float | 最低温度(°C) |
| rainfall_mm | float | 降雨量(mm) |
| wind_speed_kph | float | 风速(km/h) |
| event | string | 天气事件备注 |

### trial_design.yaml

```yaml
trial_name: 试验名称
location: 试验地点
year: 2024
design_type: randomized_complete_block
total_blocks: 4
total_reps: 3
varieties:
  - name: 品种A
    code: VA001
  - name: 品种B
    code: VB002
block_dimensions:
  rows: 6
  cols: 4
boundary_rows: [1, 6]
plot_prefix: P
data_collection_start: 2024-09-01
data_collection_end: 2024-09-30
```

## 支持的异常检测

1. **缺失区组**: 检测试验设计中定义但数据中缺失的区组
2. **重复记录**: 检测同一地块多次记录的情况
3. **缺测地块**: 检测产量数据缺失的地块
4. **边界行异常**: 检测边界行产量与内部行差异显著的情况
5. **产量异常值**: 使用 IQR 方法检测产量极端值
6. **天气冲击**: 检测高温、暴雨、大风等极端天气事件

## 使用示例

1. 启动应用后，勾选"使用示例数据"即可查看示例效果
2. 或上传自己的 plot_yield.csv、weather.csv 和 trial_design.yaml 文件
3. 使用侧边栏筛选条件按区组和品种筛选数据
4. 查看各标签页的数据可视化和统计信息
5. 点击"导出 QC 报告和清洗数据"按钮导出报告