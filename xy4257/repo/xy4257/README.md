# 社区夜间噪声治理复盘工具

一个基于 Streamlit 的本地噪声治理数据分析工具，用于社区街道夜间噪声治理的复盘工作。

## 功能特性

### 📊 核心功能
- **数据导入**: 支持导入投诉热线 CSV、分贝仪 JSONL、执法记录和施工许可表
- **统一时间轴**: 将所有数据统一到时间轴上进行分析
- **智能检测**:
  - 自动检测重复投诉（同一噪声源、相近时间）
  - 噪声超标检测（夜间 ≤ 55dB, 昼间 ≤ 70dB）
  - 疑似违规施工检测（夜间无许可施工）
- **响应分析**: 分析执法响应时间和效率
- **人工核实**: 支持对检测结果进行人工标记核实
- **数据导出**: 导出 Markdown 周报和 CSV 问题清单

### 📁 模块结构
```
├── app.py                    # 主应用入口
├── requirements.txt           # 依赖包
├── parsers/                   # 数据解析模块
│   ├── __init__.py
│   ├── complaints.py          # 投诉数据解析
│   ├── decibel_meter.py       # 分贝仪数据解析
│   ├── enforcement_records.py # 执法记录解析
│   └── construction_permits.py# 施工许可解析
├── metrics/                   # 指标计算模块
│   ├── __init__.py
│   └── calculator.py          # 超标时长、重复投诉、响应延迟计算
├── rules/                     # 规则引擎模块
│   ├── __init__.py
│   └── engine.py              # 时间匹配、违规检测
├── visualization/             # 可视化模块
│   ├── __init__.py
│   └── charts.py              # 图表绘制
├── storage/                   # 状态存储模块
│   ├── __init__.py
│   └── state_store.py         # 人工标记已核实状态存储
├── export/                    # 导出模块
│   ├── __init__.py
│   └── exporter.py            # Markdown周报、CSV导出
└── sample_data/               # 示例数据模块
    ├── __init__.py
    └── generator.py           # 测试数据生成
```

## 安装与运行

### 环境要求
- Python 3.9+
- pip 包管理器

### 安装步骤

1. 安装依赖包：
```bash
pip install -r requirements.txt
```

2. 运行应用：
```bash
streamlit run app.py
```

3. 浏览器会自动打开应用页面（默认地址：http://localhost:8501）

## 使用指南

### 快速开始

1. **加载示例数据**：点击左侧边栏的「加载示例数据」按钮，可快速体验所有功能

2. **上传真实数据**：
   - 投诉热线 CSV
   - 分贝仪 JSONL
   - 执法记录 CSV
   - 施工许可 CSV

3. **开始分析**：点击「开始分析」按钮

### 页面功能

#### 📊 数据概览
- 统计卡片：投诉总数、分贝测量次数、执法记录数、检测违规数
- 噪声趋势图
- 投诉分布图（按小区、按小时）
- 违规摘要图

#### 📋 投诉分析
- 重复投诉检测统计
- 投诉详情列表
- 人工核实功能

#### 🔊 噪声监测
- 超标统计
- 噪声趋势图
- 时段热力图
- 按地点统计

#### 🚔 执法响应
- 响应时间统计
- 响应时间分布图（饼图+箱线图）
- 执法记录详情

#### ⚠️ 违规检测
- 违规统计（按严重程度）
- 违规详情列表
- 违规核实功能

#### 🏗️ 施工许可
- 许可统计
- 许可详情列表

#### 📤 数据导出
- **周报导出**：生成 Markdown 格式的周报
- **问题清单**：导出违规记录 CSV
- **投诉清单**：导出投诉记录 CSV

## 数据格式说明

### 投诉热线 CSV
```csv
complaint_id,community,noise_source,complaint_time,description,reporter,phone
C001,幸福小区,施工噪声,2026-05-01 22:30:00,夜间施工扰民,张三,13800138000
```

### 分贝仪 JSONL
每行一个 JSON 对象：
```json
{"timestamp": "2026-05-01T22:30:00", "location": "幸福小区", "db_value": 75.5, "is_peak": false}
```

### 执法记录 CSV
```csv
enforcement_id,complaint_id,community,arrival_time,departure_time,action_taken,result,officer_name
E001,C001,幸福小区,2026-05-01 22:45:00,2026-05-01 23:30:00,现场劝阻,已劝阻,执法人员1
```

### 施工许可 CSV
```csv
permit_id,project_name,location,community,permit_start_date,permit_end_date,permitted_start_time,permitted_end_time,permitted_night_work,contractor
P001,道路改造工程,幸福小区周边,幸福小区,2026-05-01,2026-05-30,08:00,22:00,false,中建一局
```

## 配置说明

### 噪声阈值
- 夜间阈值（22:00 - 06:00）：55 dB
- 昼间阈值（06:00 - 22:00）：70 dB

### 重复投诉检测
- 时间窗口：60 分钟内
- 相似度阈值：0.6

### 响应时间分类
- 快速响应：< 15 分钟
- 正常响应：15-30 分钟
- 较慢响应：30-60 分钟
- 延迟响应：> 60 分钟

## 技术栈

- **前端框架**: Streamlit
- **数据处理**: Pandas, NumPy
- **可视化**: Plotly
- **状态管理**: 本地 JSON 文件

## 开发说明

### 项目结构
```
app.py                          # 主应用入口
├── parsers/                    # 数据解析
├── metrics/                    # 指标计算
├── rules/                      # 规则引擎
├── visualization/              # 图表绘制
├── storage/                    # 状态持久化
├── export/                     # 数据导出
└── sample_data/                # 示例数据
```

### 添加新功能
1. 在对应模块中实现功能
2. 在 `app.py` 中集成调用
3. 添加对应的页面渲染函数

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至开发者邮箱

---

**注意**: 本工具为本地运行的数据分析工具，所有数据仅存储在本地，不会上传到任何服务器。
