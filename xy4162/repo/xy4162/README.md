# ☕ 咖啡机清洁断点追踪台

一个专为连锁咖啡店区域督导设计的本地 Streamlit 复盘工具，用于追踪咖啡机清洁记录、维修工单和出杯量数据，自动识别潜在风险。

## 📋 功能特性

- **数据解析**: 支持导入清洁记录 CSV、维修工单 JSON 和出杯量 CSV
- **规则分析**: 自动识别四类风险：
  - 🔴 **超时未清洁**: 检测清洁间隔超过阈值的记录
  - 📋 **工单未闭环**: 追踪未完成的维修工单
  - 📊 **出杯异常**: 检测出杯量异常波动
  - ⚠️ **补填嫌疑**: 识别可能事后补填的清洁记录
- **可视化页面**: Streamlit 交互式界面，支持按门店/机器/风险类型筛选
- **手动标记**: 支持督导标记复核意见（待复核/已确认/已排除/已升级）
- **持久化存储**: 本地 JSON 文件保存复核记录
- **多格式导出**:
  - Markdown 复盘报告
  - CSV 风险清单
  - JSON 审计包

## 🚀 快速开始

### 环境要求

- Python 3.8+
- pip 包管理器

### 安装步骤

1. **克隆/进入项目目录**
```bash
cd xy4162
```

2. **创建虚拟环境（推荐）**
```bash
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows
```

3. **安装依赖**
```bash
pip install -r requirements.txt
```

4. **运行应用**
```bash
streamlit run app.py
```

应用将自动在浏览器中打开（默认地址: http://localhost:8501）

## 📖 使用指南

### 1. 数据导入

在左侧边栏选择数据来源：

**方式一：使用示例数据**
- 选择"使用示例数据"
- 点击"加载示例数据"按钮
- 系统将自动加载 `data/sample/` 目录下的示例数据

**方式二：上传数据文件**
- 选择"上传数据文件"
- 分别上传以下文件：
  - **清洁记录 CSV**: 包含门店、机器、清洁时间等信息
  - **维修工单 JSON**: 包含工单ID、问题类型、状态等信息
  - **出杯量 CSV**: 包含门店、机器、记录时间、出杯数等信息
- 点击"解析并分析"按钮

### 2. 数据筛选

数据加载后，可在左侧边栏使用以下筛选条件：

- **门店**: 选择特定门店查看
- **机器**: 选择特定机器查看
- **风险类型**: 按风险类型筛选（超时未清洁/工单未闭环/出杯异常/补填嫌疑）
- **风险等级**: 按严重程度筛选（严重/高/中/低）
- **复核状态**: 按复核状态筛选（待复核/已确认/已排除/已升级）

### 3. 风险详情查看

在"风险详情"区域，点击展开器查看每个风险的详细信息：

- **风险ID**: 唯一标识符
- **风险类型**: 风险分类
- **风险等级**: 严重程度
- **门店/机器**: 发生位置
- **描述**: 风险详细说明
- **复核状态/意见**: 已有复核记录（如有）

### 4. 标记复核意见

对每个风险进行复核：

1. 在风险详情右侧的"标记复核"区域
2. 选择**复核状态**：
   - `待复核`: 尚未处理（默认）
   - `已确认风险`: 确认风险存在，需要跟进
   - `已排除风险`: 经核实不存在风险
   - `已升级处理`: 已上报上级处理
3. 输入**复核意见**（可选）
4. 点击**保存**按钮

### 5. 导出报告

在"导出报告"区域，可导出以下格式：

**Markdown 复盘报告**
- 包含风险概览、按类型/等级/门店分布、风险详情
- 适合打印或分享

**CSV 风险清单**
- 表格格式，便于导入 Excel 进一步分析
- 包含所有风险字段和复核状态

**JSON 审计包**
- 完整审计信息
- 包含风险数据、复核记录、源数据统计
- 适合存档和程序处理

### 6. 原始数据查看

在页面底部的"原始数据查看"区域，可通过标签页查看：

- **清洁记录**: 所有导入的清洁记录
- **维修工单**: 所有导入的工单信息
- **出杯记录**: 所有导入的出杯量数据

## 📁 项目结构

```
xy4162/
├── app.py                    # Streamlit 主应用入口
├── config.py                 # 配置参数
├── requirements.txt          # Python 依赖
├── README.md                 # 本文档
├── data/
│   ├── sample/              # 示例数据
│   │   ├── cleaning_records.csv
│   │   ├── work_orders.json
│   │   └── volume_records.csv
│   ├── input/               # 输入数据目录（用户可放置文件）
│   ├── output/              # 导出文件目录
│   └── storage/             # 持久化存储目录
│       ├── reviews.json     # 复核记录
│       └── sessions.json    # 会话记录
├── src/                     # 源代码模块
│   ├── __init__.py
│   ├── parser.py            # 数据解析模块
│   ├── analyzer.py          # 规则分析模块
│   ├── storage.py           # 持久化模块
│   ├── exporter.py          # 导出模块
│   └── utils.py             # 工具函数
└── tests/                   # 测试文件
    ├── __init__.py
    ├── test_parser.py
    ├── test_analyzer.py
    └── test_storage.py
```

## ⚙️ 配置说明

可在 `config.py` 中调整以下参数：

### 清洁规则
- `CLEANING_INTERVAL_HOURS = 4`: 建议清洁间隔（小时）
- `CLEANING_GRACE_MINUTES = 30`: 宽限时间（分钟）
- `LATE_CLEANING_THRESHOLD_HOURS = 6`: 超时清洁阈值（小时）

### 补填检测
- `BACKFILL_SUSPECT_MINUTES = 120`: 清洁前检查窗口（分钟）

### 出杯异常
- `HIGH_VOLUME_THRESHOLD = 50`: 高杯量阈值
- `ABNORMAL_VOLUME_RATIO = 0.3`: 异常波动比例（30%）

### 风险等级
```python
RISK_LEVELS = {
    "critical": "严重",
    "high": "高",
    "medium": "中",
    "low": "低"
}
```

### 复核状态
```python
REVIEW_STATUS = {
    "pending": "待复核",
    "confirmed": "已确认风险",
    "dismissed": "已排除风险",
    "escalated": "已升级处理"
}
```

## 📊 数据格式说明

### 清洁记录 CSV
| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| store_name | string | 门店名称 | 中关村店 |
| machine_id | string | 机器编号 | M001 |
| cleaning_time | datetime | 清洁时间 | 2026-05-01 08:00:00 |
| cleaning_type | string | 清洁类型 | 日常清洁 |
| operator | string | 操作人 | 张三 |

### 维修工单 JSON
```json
[
    {
        "workorder_id": "WO20260501001",
        "store_name": "中关村店",
        "machine_id": "M001",
        "issue_type": "锅炉故障",
        "reported_time": "2026-05-01 10:30:00",
        "assigned_time": "2026-05-01 11:00:00",
        "resolved_time": "2026-05-02 09:00:00",
        "closed_time": "2026-05-02 10:00:00",
        "status": "open",
        "description": "咖啡机锅炉压力异常",
        "reported_by": "张三",
        "priority": "high"
    }
]
```

工单状态说明：
- `open`: 已创建，待处理
- `in_progress`: 处理中
- `closed`: 已关闭

### 出杯量 CSV
| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| store_name | string | 门店名称 | 中关村店 |
| machine_id | string | 机器编号 | M001 |
| record_time | datetime | 记录时间 | 2026-05-01 08:00:00 |
| cup_count | integer | 出杯数 | 12 |
| drink_type | string | 饮品类型 | 拿铁 |

## 🧪 运行测试

项目包含单元测试，可使用 pytest 运行：

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_parser.py -v

# 生成覆盖率报告
pytest tests/ --cov=src -v
```

## 🔍 风险检测规则详解

### 1. 超时未清洁 (late_cleaning)
**检测逻辑**：
- 按门店和机器分组清洁记录
- 计算相邻两次清洁的时间间隔
- 如果间隔 > `LATE_CLEANING_THRESHOLD_HOURS`（默认6小时），标记为风险

**风险等级判定**：
- 6-8小时: 中 (medium)
- 8-12小时: 高 (high)
- >12小时: 严重 (critical)

### 2. 工单未闭环 (unclosed_workorder)
**检测逻辑**：
- 检查所有工单状态
- 状态为 `open` 或 `in_progress` 的工单标记为风险
- 计算工单持续时间（从上报时间到当前时间）

**风险等级判定**：
- 24-48小时: 中 (medium)
- 48-72小时: 高 (high)
- >72小时: 严重 (critical)

### 3. 出杯异常 (abnormal_volume)
**检测逻辑**：
- 按门店、机器、日期聚合出杯量
- 计算每台机器的历史平均日出杯量
- 如果当日出杯量与平均值偏差 > `ABNORMAL_VOLUME_RATIO`（默认30%）
- 或当日出杯量 > `HIGH_VOLUME_THRESHOLD`（默认50杯）
- 标记为异常

**风险等级判定**：
- 30%-50%偏差: 中 (medium)
- 50%-80%偏差: 高 (high)
- >80%偏差: 严重 (critical)

### 4. 补填嫌疑 (backfill_suspect)
**检测逻辑**：
- 对于每条清洁记录，检查清洁时间前2小时内的出杯记录
- 如果该时间段内出杯记录为0，标记为中等风险
- 如果该时间段内出杯数 < 5杯，标记为低风险

**设计意图**：
- 正常情况下，清洁操作应该发生在出杯高峰之后
- 如果清洁时间前没有出杯记录，可能是事后补填

## 📝 开发说明

### 添加新的风险类型
1. 在 `src/analyzer.py` 中添加新的分析方法，遵循 `analyze_xxx()` 命名模式
2. 在 `analyze_all()` 方法中调用新方法
3. 更新 `get_risk_type_name()` 函数添加类型名称映射
4. 在 `config.py` 中添加相关配置参数（如需要）

### 自定义导出格式
在 `src/exporter.py` 中：
- `export_markdown_report()`: 自定义 Markdown 报告格式
- `export_risk_csv()`: 自定义 CSV 字段
- `export_audit_json()`: 自定义审计包结构

## ❓ 常见问题

**Q: 数据文件有编码问题？**
A: 确保文件使用 UTF-8 编码保存。Windows 用户可使用"另存为"时选择 UTF-8。

**Q: 时间格式不被识别？**
A: 支持以下时间格式：
- `YYYY-MM-DD HH:MM:SS`
- `YYYY-MM-DD HH:MM`
- `YYYY/MM/DD HH:MM:SS`
- `YYYY/MM/DD HH:MM`
- `YYYY-MM-DD`
- `YYYY/MM/DD`

**Q: 如何修改阈值参数？**
A: 直接编辑 `config.py` 文件中的对应参数，重启应用后生效。

**Q: 复核记录保存在哪里？**
A: 保存在 `data/storage/reviews.json` 文件中，可直接备份该文件。

## 📄 许可证

本项目仅供内部使用。

---

**最后更新**: 2026-05-02
