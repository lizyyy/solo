# Gas Isolator - 燃气阀门隔离影响分析工具

为燃气抢修调度员设计的阀门隔离影响分析工具，支持计算最小阀门隔离集合、受影响用户分析和旁通路径查找。

## 功能特性

- 解析管网节点/管段 CSV、阀门状态 YAML、抢修点 JSON、重点用户 CSV
- 构建燃气管网图模型（支持识别断开孤岛）
- 计算最小阀门隔离集合
- 分析受影响区域和重点用户
- 查找可连通的旁通路径
- 导出隔离计划 Markdown、受影响用户 CSV 和可交互网络地图 HTML

## 安装

```bash
pip install -r requirements.txt
```

## 项目结构

```
zy8055/
├── gas_isolator/
│   ├── __init__.py       # 包入口
│   ├── parser.py           # 数据解析模块
│   ├── graph_model.py    # 图模型模块
│   ├── solver.py         # 隔离求解模块
│   ├── exporter.py       # 报告导出模块
│   └── cli.py          # 命令行接口
├── sample_data/          # 示例数据
│   ├── nodes.csv
│   ├── pipes.csv
│   ├── valves.yaml
│   ├── repair.json
│   └── customers.csv
└── requirements.txt
```

## 快速开始

### 1. 使用示例数据生成隔离计划

```bash
python -m gas_isolator plan \
  --nodes sample_data/nodes.csv \
  --pipes sample_data/pipes.csv \
  --valves sample_data/valves.yaml \
  --repair sample_data/repair.json \
  --customers sample_data/customers.csv \
  --output-dir output
```

### 预期输出

```
正在解析数据...
正在构建管网图...
正在计算隔离方案...
正在分析受影响用户...
正在查找旁通路径...
正在导出报告...

✅ 隔离计划生成完成！
   - 隔离计划: output/isolation_plan.md
   - 受影响用户: output/affected_customers.csv
   - 网络图: output/network_map.html

📊 分析结果:
   - 需关闭阀门: 2 个
   - 受影响节点: 5 个
   - 受影响用户: 3 户
```

## 输入文件格式

### 节点 CSV (nodes.csv)

| 字段 | 说明 |
|------|------|
| node_id | 节点唯一标识 |
| x | X坐标 |
| y | Y坐标 |
| type | 节点类型 (source/normal) |
| pressure | 压力值 |

### 管段 CSV (pipes.csv)

| 字段 | 说明 |
|------|------|
| pipe_id | 管段唯一标识 |
| from_node | 起始节点 |
| to_node | 结束节点 |
| diameter | 管径 |
| length | 管长 |
| material | 材质 |
| island | 是否孤岛 (true/false) |

### 阀门 YAML (valves.yaml)

```yaml
valves:
  V1:
    node: N2
    pipe: P1
    status: open
    type: gate
```

### 抢修点 JSON (repair.json)

```json
{
  "id": "R001",
  "location": "位置描述",
  "type": "抢修类型",
  "nodes": ["N3", "N4"],
  "pipe": "P3"
}
```

### 重点用户 CSV (customers.csv)

| 字段 | 说明 |
|------|------|
| customer_id | 用户唯一标识 |
| name | 用户名称 |
| priority | 优先级 (1最高) |
| node | 连接节点 |
| type | 用户类型 |
| contact | 联系方式 |

## 输出文件

### isolation_plan.md

包含：
- 抢修信息
- 需关闭阀门列表
- 受影响区域统计
- 受影响重点用户
- 旁通路径建议

### affected_customers.csv

受影响的重点用户清单

### network_map.html

可在浏览器中打开的燃气管网可视化图，显示：
- 正常节点（绿色）
- 受影响节点（红色）
- 开启阀门（蓝色）
- 关闭阀门（橙色）
- 断开孤岛（灰色）

## 边界情况处理

- **断开的孤岛**: 自动识别并标记
- **阀门状态缺失**: 默认按 `unknown` 处理，参与隔离方案
- **无可用阀门**: 自动降级策略
- **无旁通路径**: 提示未找到可用路径

## License

MIT
