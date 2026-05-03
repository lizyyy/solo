# 透析排班水处理预警台

血液透析室护士长专用本地数据分析与可视化工具，用于每周透析排班、水处理质量监控和风险预警。

## 功能特性

- **数据解析**: 自动解析透析机使用记录、水质检测表、患者时段安排、故障维修单
- **指标计算**: 机器负荷、消毒间隔、水质指标、高风险患者识别
- **规则引擎**: 高负荷检测、消毒间隔违规检测、水质异常检测、维修冲突检测
- **可视化界面**: 机器负荷热图、风险排行、调整建议
- **状态存储**: 人工标记处理结果、审计日志
- **多格式导出**: Markdown简报、CSV调整单、JSON审计包

## 项目结构

```
xy4289/
├── app.py                  # Flask Web应用主入口
├── config.py               # 配置参数
├── data_parser.py          # 数据解析模块
├── metrics_calculator.py   # 指标计算模块
├── rules_engine.py         # 规则引擎
├── storage_manager.py      # 状态存储模块
├── exporter.py             # 导出模块
├── requirements.txt        # 依赖包
├── data/                   # 示例数据目录
│   ├── machine_records.csv
│   ├── water_quality.csv
│   ├── patient_schedule.csv
│   └── maintenance_records.csv
├── tests/                  # 测试目录
│   ├── test_data_parser.py
│   └── test_rules_engine.py
├── templates/              # Web模板目录
├── storage/                # 状态存储目录
│   ├── audit/              # 审计日志
│   ├── alert_records.json
│   └── session_history.json
└── exports/                # 导出文件目录
```

## 快速开始

### 1. 环境准备

确保系统已安装 Python 3.8 或更高版本。

```bash
python3 --version
```

### 2. 安装依赖

```bash
cd /path/to/xy4289
pip install -r requirements.txt
```

### 3. 启动应用

```bash
python app.py
```

应用启动后，在浏览器中访问: http://localhost:5000

### 4. 验证流程

#### 步骤1: 加载示例数据

1. 打开浏览器访问 http://localhost:5000
2. 点击页面顶部的 **"加载示例数据"** 按钮
3. 等待数据加载完成（会显示成功提示）

#### 步骤2: 查看风险统计

加载数据后，页面会显示以下统计卡片：

- **🔴 紧急风险**: 需立即处理的严重问题
- **🟠 高危风险**: 需优先处理的重要问题
- **🟡 中危风险**: 建议关注的问题
- **🟢 透析机总数**: 系统中的透析机数量
- **👥 患者总数**: 本周安排透析的患者数
- **⚠️ 高风险患者**: 乙肝、丙肝、梅毒、HIV等感染类型患者

#### 步骤3: 查看机器负荷热图

热图显示每台机器每天的运行小时数：

- **绿色 (正常)**: < 8小时/天
- **黄色 (中等)**: 8-10小时/天
- **橙色 (较高)**: 10-12小时/天
- **红色 (超负荷)**: > 12小时/天

示例数据中 **M-001** 机器在 2026-05-01 运行了 **13小时**，应显示为红色。

#### 步骤4: 查看水质状态

右侧显示水质检测状态：

- 最新检测时间
- 异常参数（电导率、细菌数、内毒素）

示例数据中水质存在多项超标：
- 电导率: 0.14 (阈值: 0.1)
- 细菌数: 110 (阈值: 100)
- 内毒素: 0.04 (阈值: 0.03)

#### 步骤5: 查看风险预警列表

点击 **"风险预警列表"** 标签页，查看所有预警：

每条预警包含：
- 风险等级徽章 (CRITICAL/HIGH/MEDIUM)
- 预警类别（机器高负荷、连续超负荷运行、消毒间隔违规、水质异常等）
- 涉及机器/患者
- 问题描述
- 调整建议
- 状态标签（待处理/处理中/已解决/已忽略/已延期）
- **"更新状态"** 按钮

#### 步骤6: 查看高风险患者

点击 **"高风险患者"** 标签页，查看感染患者列表：

包含信息：
- 患者ID
- 患者姓名
- 感染类型（乙肝/丙肝/梅毒/HIV）
- 透析时间
- 机器ID

#### 步骤7: 更新预警状态

1. 在预警列表中点击某条预警的 **"更新状态"** 按钮
2. 在弹出的对话框中：
   - 选择新状态（待处理/处理中/已解决/已忽略/已延期）
   - 输入处理人姓名（可选）
   - 输入处理备注（可选）
3. 点击 **"确认更新"**
4. 页面会自动刷新，显示更新后的状态

#### 步骤8: 导出功能

页面顶部提供四种导出按钮：

1. **导出全部**: 同时导出三种格式文件
2. **导出简报**: Markdown 格式的完整报告
3. **导出调整单**: CSV 格式的调整方案
4. **导出审计包**: JSON 格式的完整审计数据

点击任意导出按钮后，文件会自动下载或显示导出成功提示。

### 5. 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_data_parser.py -v
pytest tests/test_rules_engine.py -v

# 查看测试覆盖率
pytest tests/ --cov=. --cov-report=html
```

## 配置参数

在 `config.py` 中可调整以下参数：

```python
# 机器运行限制
MAX_MACHINE_HOURS_PER_DAY = 12      # 每日最大运行小时数
MAX_CONSECUTIVE_DAYS = 3             # 最大连续运行天数
DISINFECTION_INTERVAL_HOURS = 48     # 最小消毒间隔（小时）

# 水质阈值
WATER_QUALITY_THRESHOLDS = {
    'conductivity': 0.1,      # 电导率阈值
    'bacteria_count': 100,    # 细菌数阈值
    'endotoxin': 0.03         # 内毒素阈值
}

# 高风险感染类型
RISK_PATIENT_TYPES = ['乙肝', '丙肝', '梅毒', 'HIV']
```

## 数据文件格式

### 1. 透析机使用记录 (machine_records.csv)

```csv
session_id,machine_id,patient_id,start_time,end_time,treatment_type
S001,M-001,P001,2026-05-01 08:00:00,2026-05-01 12:00:00,常规透析
```

字段说明：
- `session_id`: 会话ID
- `machine_id`: 机器ID
- `patient_id`: 患者ID
- `start_time`: 开始时间（支持多种格式）
- `end_time`: 结束时间
- `treatment_type`: 治疗类型

### 2. 水质检测表 (water_quality.csv)

```csv
test_id,test_time,conductivity,bacteria_count,endotoxin,ph,temperature,tester,remarks
WQ001,2026-05-01 08:00:00,0.08,50,0.01,7.2,25.5,张护士,正常
```

字段说明：
- `test_id`: 检测ID
- `test_time`: 检测时间
- `conductivity`: 电导率
- `bacteria_count`: 细菌数
- `endotoxin`: 内毒素
- `ph`: pH值
- `temperature`: 温度
- `tester`: 检测人
- `remarks`: 备注

### 3. 患者时段安排 (patient_schedule.csv)

```csv
patient_id,patient_name,treatment_time,machine_id,infection_type,doctor_notes
P001,张三,2026-05-01 08:00:00,M-001,,常规透析
P003,王五,2026-05-01 17:00:00,M-001,乙肝,高风险患者
```

字段说明：
- `patient_id`: 患者ID
- `patient_name`: 患者姓名
- `treatment_time`: 治疗时间
- `machine_id`: 分配的机器ID
- `infection_type`: 感染类型（乙肝/丙肝/梅毒/HIV）
- `doctor_notes`: 医生备注

### 4. 故障维修单 (maintenance_records.csv)

```csv
maintenance_id,machine_id,fault_time,repair_time,resolved_time,fault_type,fault_description,technician,repair_notes
M001,M-001,2026-04-28 10:00:00,2026-04-28 14:00:00,2026-04-28 16:00:00,透析器压力异常,压力波动,王工程师,已修复
```

字段说明：
- `maintenance_id`: 维修ID
- `machine_id`: 机器ID
- `fault_time`: 故障时间
- `repair_time`: 开始维修时间
- `resolved_time`: 解决时间（为空表示未解决）
- `fault_type`: 故障类型
- `fault_description`: 故障描述
- `technician`: 维修工程师
- `repair_notes`: 维修备注

## API 接口

### 数据加载

```http
POST /api/load-data
```

响应示例：
```json
{
    "success": true,
    "message": "数据加载成功",
    "data": {
        "risk_counts": {"critical": 5, "high": 3, "medium": 2},
        "total_alerts": 10,
        "machine_count": 5,
        "patient_count": 20,
        "high_risk_patient_count": 5
    }
}
```

### 获取仪表板数据

```http
GET /api/dashboard
```

### 更新预警状态

```http
POST /api/alerts/update-status
Content-Type: application/json

{
    "alert_id": "ALERT-20260503-0001",
    "status": "resolved",
    "processed_by": "张护士长",
    "notes": "已转移患者到备用机器"
}
```

### 导出接口

```http
GET /api/export/markdown  # 导出Markdown简报
GET /api/export/csv       # 导出CSV调整单
GET /api/export/json      # 导出JSON审计包
GET /api/export/all       # 导出全部格式
```

## 常见问题

### Q1: 如何添加自己的数据？

将您的CSV文件放入 `data/` 目录，文件名需要包含以下关键词：
- 透析机记录: 文件名包含 `machine`
- 水质检测: 文件名包含 `water`
- 患者安排: 文件名包含 `patient`
- 维修记录: 文件名包含 `maintenance`

### Q2: 支持哪些时间格式？

系统自动识别以下时间格式：
- `2026-05-01 08:00:00`
- `2026-05-01 08:00`
- `2026/05/01 08:00:00`
- `2026/05/01 08:00`
- `2026-05-01`
- `2026/05/01`

### Q3: 数据存储在哪里？

- 状态记录: `storage/alert_records.json`
- 会话历史: `storage/session_history.json`
- 审计日志: `storage/audit/` 目录
- 导出文件: `exports/` 目录

## 技术栈

- **后端**: Python 3.8+, Flask, Pandas
- **前端**: HTML5, CSS3, JavaScript (原生)
- **数据格式**: CSV, JSON, Markdown
- **测试**: pytest

## 许可证

本项目仅供内部使用。

---

**最后更新**: 2026-05-03
