# 生态样方复核看板

用于野外调查团队收工后检查样方记录的本地Web应用。

## 功能

- 读取和解析：样方调查CSV、物种名录JSON、样方坐标GeoJSON、规则YAML
- 数据清洗：物种名称标准化，处理同物异名
- 多样性指数：计算Shannon和Simpson多样性指数
- 异常检测：
  - 拼写漂移检测
  - 重复记录检测
  - 样方面积不一致检测
  - 外来入侵物种集中检测
  - 空坐标检测
- 可视化：
  - 交互式地图（Leaflet）
  - 多样性指数柱状图（Chart.js）
  - 样地筛选功能
  - 异常标记展示
- 导出功能：summary.md 和 anomalies.csv

## 目录结构

```
.
├── main.py                # 主程序入口
├── requirements.txt       # Python依赖
├── modules/               # 核心模块
│   ├── __init__.py
│   ├── data_parser.py     # 数据解析
│   ├── metrics.py         # 多样性指数计算
│   ├── validation.py      # 异常检测规则
│   └── exporter.py        # 报告导出
├── static/
│   └── templates/
│       └── dashboard.html # 前端可视化
├── example_data/          # 示例数据
│   ├── quadrat_survey.csv
│   ├── species_list.json
│   ├── quadrat_coords.geojson
│   └── rules.yaml
└── data/                  # 工作数据目录（自动创建）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动应用

```bash
python main.py
```

首次运行会自动将 `example_data/` 下的示例数据复制到 `data/` 目录。

### 3. 访问看板

浏览器打开：http://localhost:5000

## 使用说明

### 数据格式

1. **quadrat_survey.csv**：样方调查数据
   - site_id：样地ID
   - quadrat_id：样方ID
   - species_name：物种名称
   - count：个体数量
   - area：样方面积
   - latitude：纬度
   - longitude：经度

2. **species_list.json**：物种名录
   - valid_species：有效物种列表
   - synonyms：同物异名映射
   - invasive_species：外来入侵物种列表

3. **quadrat_coords.geojson**：样方坐标
   - GeoJSON格式的点位数据

4. **rules.yaml**：校验规则
   - invasive_threshold：入侵物种比例阈值
   - standard_area：标准样方面积
   - 其他开关选项

### 使用流程

1. 将您的数据放入 `data/` 目录（替换示例数据）
2. 启动应用并打开浏览器
3. 查看总体统计和样方地图
4. 检查异常检测结果
5. 点击"导出报告"生成 summary.md 和 anomalies.csv

## 核心模块说明

- **data_parser**：处理各种格式数据的加载和清洗
- **metrics**：实现Shannon和Simpson多样性指数
- **validation**：实现所有异常检测逻辑
- **exporter**：处理Markdown报告和CSV表格导出

## 技术栈

- 后端：Flask + Python
- 前端：原生HTML/CSS/JS
- 地图：Leaflet
- 图表：Chart.js
- 数据处理：Pandas

## 许可证

MIT
