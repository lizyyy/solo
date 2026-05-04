# 冷链实验室质检助手

一个专为小型冷链实验室设计的桌面质检助手系统，帮助管理温控记录、样本交接、风险分析和报告导出。

## 功能特性

- **数据导入**：支持导入温控记录CSV、样本交接JSON、冰箱探头告警、人工复核备注
- **风险分析**：
  - 连续超温检测（按样本批次计算连续超温时间段）
  - 交接断点检测（检测样本交接过程中的时间和位置断层）
  - 重复编号风险（检测跨批次和批次内的重复样本ID）
- **复核管理**：在详情页补充复核结论、生成整改待办
- **报告导出**：生成Markdown质检报告和CSV问题清单
- **本地存储**：使用SQLite数据库，无需额外依赖

## 项目结构

```
xy4318/
├── app.py                      # Flask主应用入口
├── config.py                   # 配置文件
├── requirements.txt             # Python依赖
├── README.md              # 本文档
├── models/                      # 数据库模型
│   ├── __init__.py
│   └── models.py
├── services/                   # 业务逻辑服务
│   ├── __init__.py
│   ├── file_service.py        # 文件导入服务
│   ├── analysis_service.py    # 数据分析服务
│   └── report_service.py      # 报告导出服务
├── routes/                     # Flask路由
│   ├── __init__.py
│   ├── api.py                 # RESTful API
│   └── views.py               # 页面视图
├── templates/                  # HTML模板
│   ├── index.html              # 主页
│   └── detail.html             # 风险详情页
├── static/                     # 静态资源
│   ├── css/
│   │   └── style.css           # 样式文件
│   └── js/
│       └── app.js              # 前端逻辑
├── data/                        # 数据目录
│   ├── cold_chain.db           # SQLite数据库（运行时生成）
│   └── samples/                # 示例数据
│       ├── temperature_records.csv
│       ├── sample_transfer.json
│       ├── alarm_records.csv
│       └── review_notes.csv
├── uploads/                    # 上传文件临时目录（运行时生成）
└── exports/                    # 导出文件目录（运行时生成）
```

## 安装部署

### 环境要求

- Python 3.8+
- pip (Python包管理器)

### 安装步骤

1. **进入项目目录**

```bash
cd /path/to/xy4318
```

2. **创建虚拟环境（推荐）**

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
# macOS/Linux:
source venv/bin/activate

# Windows (PowerShell):
# .\venv\Scripts\Activate.ps1
```

3. **安装依赖**

```bash
pip install -r requirements.txt
```

### 启动应用

```bash
python app.py
```

应用启动后，访问：`http://localhost:5000`

## 使用说明

### 1. 数据导入

在主页的"数据导入"标签页，您可以导入以下类型的文件：

#### 温控记录 CSV

字段说明：
- `batch_number`: 批次号（可选，导入时可手动指定）
- `probe_id`: 探头ID
- `location`: 位置
- `temperature`: 温度（摄氏度）
- `record_time`: 记录时间

示例文件：`data/samples/temperature_records.csv`

#### 样本交接 JSON

字段说明：
- `batch_number`: 批次号
- `sample_id`: 样本ID
- `sample_name`: 样本名称
- `from_location`: 起始位置
- `to_location`: 目标位置
- `transfer_time`: 交接时间
- `transfer_person`: 交接人
- `temperature`: 交接时温度
- `status`: 状态
- `notes`: 备注

示例文件：`data/samples/sample_transfer.json`

#### 冰箱探头告警 CSV

字段说明：
- `batch_number`: 批次号
- `probe_id`: 探头ID
- `location`: 位置
- `alarm_type`: 告警类型
- `alarm_level`: 告警级别
- `temperature`: 温度
- `start_time`: 开始时间
- `end_time`: 结束时间
- `duration_minutes`: 持续时间（分钟）
- `ack_person`: 确认人
- `ack_time`: 确认时间
- `description`: 描述

示例文件：`data/samples/alarm_records.csv`

#### 人工复核备注 CSV

字段说明：
- `batch_number`: 批次号
- `sample_id`: 样本ID
- `review_time`: 复核时间
- `reviewer`: 复核人
- `temperature_check`: 温度检查结果
- `packaging_check`: 包装检查结果
- `documentation_check`: 文档检查结果
- `overall_status`: 整体状态
- `comments`: 备注

示例文件：`data/samples/review_notes.csv`

### 2. 风险分析

导入数据后，切换到"风险分析"标签页：

1. **选择批次**：可选择特定批次或所有批次
2. **运行分析**：点击"运行分析"按钮
3. **查看风险**：系统将检测以下类型的风险：
   - **连续超温**：温度持续超出阈值范围（默认：-20°C ~ -15°C）且持续时间超过阈值（默认：5分钟）
   - **交接断点**：样本交接过程中，上一次交接的目标位置与下一次交接的起始位置不一致
   - **重复样本ID**：同一样本ID出现在多个批次中
   - **批次内重复**：同一样本ID在同一批次中多次记录

4. **风险等级**：
   - 🔴 **严重 (Critical)**：超温超过30分钟或温度高于-10°C；交接断点超过2小时；样本ID出现在3个以上批次
   - 🟠 **高 (High)**：超温超过15分钟或温度高于-12°C；交接断点超过1小时；样本ID出现在2个以上批次
   - 🟡 **中 (Medium)**：超温超过5分钟；交接断点少于1小时；批次内样本ID重复

### 3. 风险详情与复核

点击任意风险项，进入风险详情页：

#### 添加复核结论

点击"添加结论"按钮，填写：
- **复核人**：执行复核的人员
- **结论类型**：确认风险/误报/已整改/需进一步调查
- **根本原因**：问题的根本原因分析
- **纠正措施**：已采取的纠正措施
- **预防措施**：预防此类问题的措施
- **责任部门/人员**：责任归属
- **截止日期**：整改截止日期
- **状态**：待处理/进行中/已完成
- **备注**：其他说明

#### 添加整改待办

点击"添加待办"按钮，填写：
- **标题**：待办事项标题（必填）
- **描述**：详细描述
- **负责人**：执行人
- **截止日期**：完成截止日期
- **优先级**：严重/高/中/低
- **状态**：待处理/进行中/已完成

#### 更新风险状态

在详情页顶部可直接更新风险状态：
- 待处理
- 复核中
- 已解决
- 已关闭

### 4. 报告导出

切换到"报告导出"标签页：

#### Markdown 质检报告

- **预览**：点击"预览"按钮在页面中查看报告内容
- **导出**：点击"导出下载"按钮下载Markdown格式的完整报告

报告包含：
- 数据摘要（温控记录、样本交接、告警记录、复核备注统计
- 风险统计（按等级分类）
- 风险详情（每个风险的详细信息）
- 复核结论
- 整改待办
- 附录（检测阈值配置、风险等级定义）

#### CSV 问题清单

导出CSV格式的风险问题列表，包含：
- 风险ID、批次号、风险类型、风险等级、状态
- 描述、位置、开始时间、结束时间、持续时间
- 温度、样本ID/探头ID、创建时间、更新时间

### 5. 导入历史

切换到"导入历史"标签页，查看所有文件导入记录，包括：
- 文件类型
- 文件名
- 记录数量
- 导入时间

## 配置说明

在 `config.py` 中可修改以下配置：

```python
# 温度阈值（摄氏度）
TEMPERATURE_LOWER_THRESHOLD = -20.0  # 超低温冰箱标准下限
TEMPERATURE_UPPER_THRESHOLD = -15.0  # 超低温冰箱标准上限

# 超温持续时间阈值（分钟）
OVERTEMP_DURATION_THRESHOLD = 5  # 持续超过5分钟才视为风险
```

## 验证流程

### 快速验证

1. **启动应用**

```bash
python app.py
```

2. **访问应用**

打开浏览器访问：`http://localhost:5001`

3. **导入示例数据**

在"数据导入"标签页：
- 下载示例数据（页面底部提供示例数据下载链接）
- 依次导入以下文件（来自 `data/samples/` 目录）：
  1. `temperature_records.csv`（温控记录）
  2. `sample_transfer.json`（样本交接）
  3. `alarm_records.csv`（告警记录）
  4. `review_notes.csv`（复核备注）

4. **运行风险分析**

切换到"风险分析"标签页：
- 点击"运行分析"按钮
- 验证是否检测到以下风险：
  - 连续超温（PROBE-001 在 08:15-08:25 温度升至 -9°C）
  - 交接断点（SAMPLE-001 从运输箱A到超低温冰箱1号的位置断层）
  - 重复样本ID（SAMPLE-003 出现在 BATCH-2024-001 和 BATCH-2024-002）
  - 批次内重复（SAMPLE-004 在 BATCH-2024-001 中多次记录）

5. **查看风险详情**

点击任意风险项，进入详情页：
- 验证风险信息是否完整
- 尝试添加复核结论
- 尝试添加整改待办
- 尝试更新风险状态

6. **导出报告**

切换到"报告导出"标签页：
- 预览 Markdown 报告
- 导出 Markdown 报告
- 导出 CSV 问题清单

7. **查看导入历史**

切换到"导入历史"标签页：
- 验证所有导入记录是否正确显示

## API 接口

### 文件上传

- `POST /api/upload/temperature` - 上传温控记录CSV
- `POST /api/upload/transfer` - 上传样本交接JSON
- `POST /api/upload/alarm` - 上传告警记录CSV
- `POST /api/upload/review` - 上传复核备注CSV

### 数据查询

- `GET /api/batches` - 获取批次列表
- `GET /api/batches/<batch_number>/overview` - 获取批次概览
- `GET /api/import/history` - 获取导入历史
- `GET /api/risks` - 获取风险列表（支持 batch_number 参数过滤）
- `GET /api/risks/<risk_id>` - 获取风险详情

### 风险分析

- `POST /api/analysis/run` - 运行风险分析

### 风险管理

- `PUT /api/risks/<risk_id>/status` - 更新风险状态
- `POST /api/risks/<risk_id>/conclusions` - 添加复核结论
- `POST /api/risks/<risk_id>/todos` - 添加整改待办

### 报告导出

- `GET /api/export/markdown` - 导出Markdown报告（支持 batch_number 参数）
- `GET /api/export/csv` - 导出CSV问题清单（支持 batch_number 参数）
- `GET /api/export/preview/markdown` - 预览Markdown报告

## 技术栈

- **后端框架**：Flask 2.3.3
- **ORM**：Flask-SQLAlchemy 3.0.5
- **数据库**：SQLite
- **数据处理**：pandas 2.0.3
- **前端**：原生 HTML/CSS/JavaScript
- **跨域**：Flask-CORS 4.0.0

## 常见问题

### Q: 支持哪些日期时间格式？

A: 系统支持多种日期时间格式：
- `YYYY-MM-DD HH:MM:SS`
- `YYYY-MM-DD HH:MM`
- `YYYY/MM/DD HH:MM:SS`
- `YYYY/MM/DD HH:MM`
- `YYYY-MM-DDTHH:MM:SS`
- `DD-MM-YYYY HH:MM:SS`
- `YYYY-MM-DD`
- 以及 pandas 可解析的其他格式

### Q: 如何修改温度阈值？

A: 在 `config.py` 文件中修改以下配置：
```python
TEMPERATURE_LOWER_THRESHOLD = -20.0  # 下限
TEMPERATURE_UPPER_THRESHOLD = -15.0  # 上限
OVERTEMP_DURATION_THRESHOLD = 5      # 持续时间阈值（分钟）
```

### Q: 数据库文件存储在哪里？

A: SQLite 数据库文件位于 `data/cold_chain.db`，首次运行时自动创建。

### Q: 导出的文件存储在哪里？

A: 导出的文件存储在 `exports/` 目录中，文件名格式为：
- Markdown报告：`质检报告_YYYYMMDD_HHMMSS.md`
- CSV问题清单：`问题清单_YYYYMMDD_HHMMSS.csv`

## 更新日志

### v1.0.0 (2024-05-01)

- 初始版本发布
- 实现数据导入功能（温控记录、样本交接、告警记录、复核备注）
- 实现风险分析功能（连续超温、交接断点、重复编号）
- 实现复核结论管理
- 实现整改待办管理
- 实现报告导出功能（Markdown、CSV）
- 提供示例数据和完整的验证流程

## 许可证

本项目仅供学习和内部使用。

## 联系方式

如有问题或建议，请联系开发团队。
