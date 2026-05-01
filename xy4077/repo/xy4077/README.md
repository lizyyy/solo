# 展箱震动温湿度复核员

一个给博物馆展品运输押运员用的本地自动化工具脚本，用于自动复核传感器数据、路书、展箱清单和交接照片。

## 功能特性

- **init** - 初始化运输配置和阈值设置
- **import** - 导入传感器 CSV、路书和展箱清单，校验时间轴、单位、箱号和缺采样
- **analyze** - 识别冲击峰值、持续超温超湿、开箱时段与路书不一致、照片缺失和交接节点缺证
- **review** - 记录人工复核结论
- **export** - 导出 Markdown 到馆复核报告、CSV 问题清单和 JSON 审计包

## 项目结构

```
xy4077/
├── pyproject.toml          # 项目配置文件
├── src/
│   └── exhibit_inspector/
│       ├── __init__.py     # 版本信息
│       ├── cli/            # 命令行接口
│       │   ├── __init__.py
│       │   └── main.py     # CLI 主程序
│       ├── models/         # 数据模型
│       │   ├── __init__.py
│       │   ├── audit.py    # 审计包模型
│       │   ├── box.py      # 展箱信息模型
│       │   ├── config.py   # 运输配置和阈值模型
│       │   ├── issues.py   # 问题模型
│       │   ├── photo.py    # 照片记录模型
│       │   ├── review.py   # 复核记录模型
│       │   ├── route.py    # 路书模型
│       │   └── sensor.py   # 传感器记录模型
│       ├── parsers/        # CSV 解析器
│       │   ├── __init__.py
│       │   ├── base.py     # 解析器基类
│       │   ├── box_parser.py
│       │   ├── photo_parser.py
│       │   ├── route_parser.py
│       │   ├── sensor_parser.py
│       │   └── utils.py    # 解析工具函数
│       ├── rules/          # 规则引擎
│       │   ├── __init__.py
│       │   ├── base.py     # 规则基类
│       │   ├── engine.py   # 规则引擎
│       │   ├── evidence_validator.py
│       │   ├── missing_photo_detector.py
│       │   ├── missing_sample_detector.py
│       │   ├── photo_validator.py
│       │   ├── shock_detector.py
│       │   └── temp_humid_detector.py
│       ├── storage/        # 存储模块
│       │   ├── __init__.py
│       │   ├── json_store.py
│       │   └── session_manager.py
│       ├── timeline/       # 时间轴对齐
│       │   ├── __init__.py
│       │   ├── aligner.py
│       │   ├── mapper.py
│       │   └── validator.py
│       └── reports/        # 报告生成
│           ├── __init__.py
│           ├── csv_exporter.py
│           ├── json_audit.py
│           └── markdown_report.py
├── test_flow.py            # 完整流程测试脚本
└── test_project.py         # 基础测试脚本
```

## 安装

### 环境要求

- Python 3.9 或更高版本

### 安装步骤

```bash
# 克隆或下载项目到本地
cd xy4077

# 创建虚拟环境（可选但推荐）
python3 -m venv .venv
source .venv/bin/activate  # macOS/Linux
# 或 .venv\Scripts\activate  # Windows

# 安装依赖
pip3 install -e .
```

## 使用方法

### 快速测试

运行测试脚本验证完整流程：

```bash
cd xy4077
python3 test_flow.py
```

这将：
1. 创建临时测试数据
2. 解析传感器数据、路书、展箱清单、照片清单
3. 运行规则引擎检测问题
4. 生成 Markdown 报告、CSV 问题清单、JSON 审计包

### 命令行使用

```bash
# 初始化运输配置
exhibit-inspector init \
    --shipment-id "TEST_20240115" \
    --shipment-name "测试运输任务" \
    --origin "始发博物馆" \
    --destination "目的博物馆" \
    --carrier "运输公司"

# 导入数据
exhibit-inspector import \
    --sensor sensor_data.csv \
    --route route_book.csv \
    --boxes box_list.csv \
    --photos photo_list.csv

# 分析检测问题
exhibit-inspector analyze

# 记录复核结论
exhibit-inspector review \
    --issue-id "ISSUE_001" \
    --reviewer "张三" \
    --status "reviewed" \
    --conclusion "false_positive" \
    --comments "经核实为正常震动"

# 导出报告
exhibit-inspector export --output ./output/
```

## 数据格式说明

### 传感器 CSV 格式

支持两种格式：

**多列格式（推荐）：**
```csv
时间,箱号,传感器ID,X轴(g),Y轴(g),Z轴(g),温度(°C),湿度(%),设备型号
2024-01-15 08:00:00,EX001,S001,0.05,0.03,0.02,20.0,50.0,MSR165
```

**单列格式：**
```csv
时间,箱号,传感器编号,类型,数值,单位
2024-01-15 08:00:00,EX001,S001,shock,0.05,g
2024-01-15 08:00:00,EX001,S001,temperature,20.0,°C
2024-01-15 08:00:00,EX001,S001,humidity,50.0,%
```

### 路书 CSV 格式

```csv
序号,地点,阶段,计划开始时间,计划结束时间,联系人,备注
1,库房,departure,2024-01-15 08:00:00,2024-01-15 08:10:00,张三,准备装载
2,高速公路,transit,2024-01-15 08:10:00,2024-01-15 09:00:00,李四,运输中
3,博物馆,arrival,2024-01-15 09:00:00,2024-01-15 09:30:00,王五,卸载交接
```

**阶段类型：**
- `departure` - 出发
- `transit` - 运输
- `stopover` - 经停
- `arrival` - 到达
- `checkpoint` - 检查点

### 展箱清单 CSV 格式

```csv
箱号,箱名,传感器编号,尺寸,重量(kg),展品,备注
EX001,主展箱,S001,80x60x20,15,《蒙娜丽莎》复制品,重要展品
EX002,副展箱,S002,60x50x15,10,《星空》复制品,次要展品
```

### 照片清单 CSV 格式

```csv
文件名,拍摄时间,箱号,照片类型,拍摄人,备注
EX001_loading_01.jpg,2024-01-15 08:05:00,EX001,loading_photo,张三,装载前
EX001_transit_01.jpg,2024-01-15 08:30:00,EX001,transit_photo,李四,运输中
EX001_unloading_01.jpg,2024-01-15 09:15:00,EX001,unloading_photo,王五,卸载后
```

## 检测规则

### 冲击峰值检测

- 检测 X/Y/Z 三轴及合成加速度是否超过阈值
- 默认阈值：1.5g（可配置）
- 超过阈值 2 倍标记为严重

### 温湿度超限检测

- 温度范围：15°C - 25°C（可配置）
- 湿度范围：40% - 60%（可配置）
- 持续超过 5 分钟触发告警

### 缺采样检测

- 检测采样间隔是否异常
- 默认采样间隔：5 分钟
- 超过 15 分钟无数据触发告警

### 照片缺失检测

- 检查各阶段是否有必要的照片记录
- 必需照片类型：装载、卸载、封条检查

## 报告输出

### Markdown 报告

包含：
- 问题摘要（按严重程度统计）
- 运输信息和阈值设置
- 路书节点列表
- 展箱信息
- 问题分类统计
- 问题详情（按严重程度排序）

### CSV 问题清单

包含以下字段：
- issue_id - 问题编号
- severity - 严重程度
- issue_type - 问题类型
- description - 问题描述
- box_id - 展箱编号
- sensor_id - 传感器编号
- start_time - 开始时间
- end_time - 结束时间
- detected_at - 检测时间
- notes - 备注

### JSON 审计包

完整的审计数据，包含：
- 会话元数据
- 运输配置
- 路书信息
- 展箱列表
- 照片列表
- 传感器记录数量
- 检测到的问题
- 复核记录
- 分析摘要

## 示例数据

测试脚本会自动生成示例数据，包含以下场景：

1. **正常数据**：大部分时间内温湿度正常，震动在阈值内
2. **冲击峰值**：08:10 和 08:15 有两次超过阈值的震动（2.5g、3.2g）
3. **温度超限**：08:30 - 08:50 温度达到 26-27°C（超过 25°C 阈值）
4. **湿度过低**：09:00 - 09:15 湿度降到 35-40%（低于 40% 阈值）
5. **照片缺失**：缺少卸载照片和封条照片

## 开发说明

### 运行测试

```bash
# 运行完整流程测试
python3 test_flow.py

# 运行基础测试
python3 test_project.py
```

### 模块说明

- **models/** - Pydantic 数据模型，定义所有数据结构
- **parsers/** - CSV 解析器，支持多种表头格式
- **rules/** - 规则引擎，包含各种检测逻辑
- **storage/** - 会话存储，使用 JSON 文件持久化
- **reports/** - 报告生成器，支持 Markdown、CSV、JSON 格式
- **cli/** - 命令行接口

### 扩展检测规则

可以通过继承 `BaseRule` 类添加新的检测规则：

```python
from .base import BaseRule, RuleResult

class CustomDetector(BaseRule[list[SensorRecord]]):
    def __init__(self):
        super().__init__("custom_detector")
    
    def execute(self, records: list[SensorRecord]) -> RuleResult:
        # 实现检测逻辑
        pass
```

## 许可证

MIT License

## 注意事项

1. 本工具仅用于本地处理数据，不会上传到任何服务器
2. 所有数据保存在本地文件系统中
3. 请确保传感器数据的时间格式一致，支持 ISO 格式和常见日期时间格式
4. 温湿度单位自动转换支持：摄氏度 ↔ 华氏度

## 临时目录验证流程

按照以下步骤在临时目录中验证完整流程：

```bash
# 1. 创建临时测试目录
mkdir -p /tmp/exhibit_test && cd /tmp/exhibit_test

# 2. 创建测试数据（使用 test_flow.py 中的数据格式）

# 3. 初始化运输配置
exhibit-inspector init \
    --shipment-id "TEMP_TEST_001" \
    --shipment-name "临时测试任务" \
    --origin "库房A" \
    --destination "展馆B" \
    --carrier "快速运输"

# 4. 导入数据
exhibit-inspector import \
    --sensor sensor_data.csv \
    --route route_book.csv \
    --boxes box_list.csv

# 5. 分析检测
exhibit-inspector analyze

# 6. 导出报告
exhibit-inspector export --output ./reports/

# 7. 查看报告
open ./reports/review_report.md  # 或使用文本编辑器
```
