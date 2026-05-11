# 冷链温控异常追溯 CLI

一个用于冷链物流温度异常追溯的命令行工具，帮助运营人员快速定位温度超温的原因和责任人。

## 功能特性

- 📊 读取并分析温度曲线数据
- 🚗 追踪车辆运输路线和装卸节点
- 📦 管理货品批次和拆分运输
- ⚠️ 根据阈值规则自动检测温度异常
- 🔍 处理传感器时间漂移问题
- 🕵️ 智能划分责任区间
- 📝 生成详细可读的追溯报告
- 🔄 防止重复数据导入

## 支持的数据格式

工具支持以下数据格式：
- **CSV** - 逗号分隔值文件
- **JSON** - JavaScript对象表示法

## 安装依赖

```bash
# 确保已安装 Python 3.7+
python3 --version

# 安装依赖
pip3 install -r requirements.txt
```

## 快速开始

### 1. 准备数据文件

请确保准备以下数据文件（示例文件见 `examples/` 目录）：

| 文件名 | 说明 | 必填 |
|--------|------|------|
| temperature.csv | 温度传感器数据 | 是 |
| vehicle_route.csv | 车辆路线数据 | 是 |
| nodes.csv | 装卸节点信息 | 是 |
| signoff.csv | 签收时间记录 | 是 |
| batches.csv | 货品批次信息 | 是 |
| thresholds.csv | 温控阈值规则 | 是 |

### 2. 运行追溯分析

```bash
# 基本用法
python3 cold_chain_trace.py --config examples/config.yaml

# 指定输出报告格式（支持 text 和 html）
python3 cold_chain_trace.py --config examples/config.yaml --format html

# 查看帮助
python3 cold_chain_trace.py --help
```

### 3. 查看报告

分析完成后，报告会保存在 `reports/` 目录下。

## 数据文件说明

### 温度数据 (temperature.csv)
```csv
sensor_id,vehicle_id,time,temperature
S001,V001,2024-01-01 08:00:00,2.5
S001,V001,2024-01-01 09:00:00,3.2
```
- `sensor_id`: 传感器编号
- `vehicle_id`: 车辆编号
- `time`: 时间戳 (格式: YYYY-MM-DD HH:MM:SS)
- `temperature`: 温度值（摄氏度）

### 车辆路线 (vehicle_route.csv)
```csv
route_id,vehicle_id,start_time,end_time,start_node,end_node,driver_id
R001,V001,2024-01-01 08:00:00,2024-01-01 12:00:00,NODE001,NODE002,D001
```

### 装卸节点 (nodes.csv)
```csv
node_id,node_name,node_type,address
NODE001,仓库A,起点,北京市朝阳区
NODE002,配送站B,终点,上海市浦东新区
```
- `node_type`: 起点/终点/中转

### 签收时间 (signoff.csv)
```csv
signoff_id,node_id,vehicle_id,batch_id,signoff_time,operator
SO001,NODE002,V001,B001,2024-01-01 12:30:00,张三
```

### 货品批次 (batches.csv)
```csv
batch_id,product_name,quantity,temperature_min,temperature_max,start_node,end_node,expected_delivery_time
B001,新冠疫苗,100,2,8,NODE001,NODE002,2024-01-01 13:00:00
```
- `temperature_min`: 最低允许温度
- `temperature_max`: 最高允许温度

### 阈值规则 (thresholds.csv)
```csv
rule_id,product_type,warning_min,warning_max,critical_min,critical_max,allowed_duration
RULE001,疫苗,2,8,0,10,15
```
- `allowed_duration`: 允许超温持续时间（分钟）

## 报告解读

报告包含以下部分：

1. **执行摘要** - 总体异常概览
2. **异常详情** - 每条异常的详细分析
   - 超温时间段
   - 超温程度（警告/严重）
   - 传感器时间漂移检测
   - 责任区间划分
3. **批次追踪** - 涉及的货品批次
4. **数据质量检查** - 缺失节点、数据缺口等
5. **建议行动** - 需要人工确认的事项

## 常见问题

**Q: 如何处理同一批货拆车运输？**
A: 系统会自动追踪同一批次ID的所有运输记录，合并分析温度数据。

**Q: 传感器时间不准确怎么办？**
A: 系统会检测时间漂移，并在报告中标注可能的时间偏差。

**Q: 重复导入数据会有问题吗？**
A: 不会，系统会根据数据指纹自动去重，避免重复计算。

## 故障排查

- **数据解析错误**: 检查CSV文件的列名和格式
- **时间格式错误**: 确保时间格式为 YYYY-MM-DD HH:MM:SS
- **找不到阈值规则**: 检查批次的产品类型与规则是否匹配

## 技术支持

如遇问题，请检查：
1. 数据文件格式是否正确
2. 所有必填字段是否完整
3. 时间格式是否一致
