# 麻醉监护复盘板

宠物医院麻醉护士专用的本地桌面GUI工具，用于麻醉后监护数据的复盘分析。

## 功能特性

- **数据导入**：支持导入监护仪CSV数据、给药记录JSON和人工备注
- **风险检测**：自动检测低体温、血氧掉点、追加用药超时、复苏评分异常等风险
- **时间轴可视化**：按时间轴展示生命体征、给药节点和风险片段
- **复核机制**：支持人工确认/驳回风险，记录复核备注
- **本地存储**：所有数据本地保存，重启不丢失
- **多种导出格式**：
  - Markdown复盘报告
  - CSV风险清单
  - JSON审计包（含数据完整性哈希）

## 系统要求

- Python 3.8+
- macOS / Windows / Linux

## 快速开始

### 1. 安装依赖

```bash
# 克隆项目或进入项目目录
cd xy4235

# 安装Python依赖
pip install -r requirements.txt
```

### 2. 启动应用

```bash
python main.py
```

### 3. 使用示例数据测试

项目包含示例数据文件，位于 `sample_data/` 目录：

- `vital_signs_sample.csv` - 示例生命体征数据
- `medication_sample.json` - 示例给药记录

**测试流程：**

1. 启动应用
2. 点击菜单栏 **文件** → **新建病例** 或点击工具栏 **新建** 按钮
3. 点击 **导入CSV** 按钮，选择 `sample_data/vital_signs_sample.csv`
4. 点击 **导入JSON** 按钮，选择 `sample_data/medication_sample.json`
5. 点击 **检测风险** 按钮（或按F5），系统将自动检测风险
6. 在风险列表中选择风险，查看详情
7. 点击 **确认风险** 或 **驳回风险** 进行复核
8. 点击 **保存** 按钮保存病例
9. 点击 **导出** 按钮导出报告

## 项目结构

```
xy4235/
├── main.py                    # 应用入口
├── requirements.txt           # 依赖配置
├── README.md                 # 本文档
├── sample_data/              # 示例数据
│   ├── vital_signs_sample.csv
│   └── medication_sample.json
├── src/
│   ├── models/               # 数据模型
│   │   ├── case.py          # 病例模型
│   │   ├── vital_signs.py   # 生命体征模型
│   │   ├── medication.py    # 给药记录模型
│   │   ├── risk.py          # 风险模型
│   │   └── review.py        # 复核记录模型
│   ├── parsers/              # 导入解析器
│   │   ├── base_parser.py   # 基础解析器
│   │   ├── csv_parser.py    # CSV解析器
│   │   └── json_parser.py   # JSON解析器
│   ├── rules/                # 规则引擎
│   │   ├── rule_config.py   # 规则配置
│   │   ├── rule_engine.py   # 规则引擎核心
│   │   └── risk_rules.py    # 具体风险检测规则
│   ├── storage/              # 存储模块
│   │   ├── case_storage.py  # 病例存储
│   │   └── review_manager.py # 复核管理
│   ├── exports/              # 导出模块
│   │   ├── base_exporter.py # 基础导出器
│   │   ├── markdown_exporter.py  # Markdown导出
│   │   ├── csv_exporter.py  # CSV导出
│   │   └── json_audit_exporter.py # JSON审计包导出
│   └── gui/                  # GUI界面
│       ├── main_window.py   # 主窗口
│       ├── timeline_widget.py # 时间轴组件
│       ├── risk_table_widget.py # 风险列表组件
│       └── risk_detail_widget.py # 风险详情组件
└── tests/                    # 测试用例
    ├── test_models.py       # 数据模型测试
    ├── test_rules.py        # 规则引擎测试
    └── test_storage.py      # 存储模块测试
```

## 核心模块说明

### 1. 数据模型 (models/)

- **Case**: 病例模型，整合所有数据
- **VitalSigns**: 生命体征数据集，包含多条VitalSignsRecord
- **Medication**: 给药记录，包含多条MedicationRecord
- **Risk**: 风险对象，包含风险类型、严重程度、状态、复核历史
- **Review**: 复核记录管理

### 2. 导入解析器 (parsers/)

- **CSVParser**: 解析监护仪CSV数据
  - 支持多种编码（UTF-8、GBK等）
  - 自动识别时间格式
  - 自动列名映射（支持"体温"、"temperature"等多种列名）
  
- **JSONParser**: 解析给药记录JSON
  - 支持解析药物类型和给药途径
  - 支持解析手动备注和复苏评分

### 3. 规则引擎 (rules/)

内置8种风险检测规则：

| 规则 | 风险类型 | 说明 |
|------|----------|------|
| HypothermiaRule | 低体温 | 体温低于阈值持续一段时间 |
| SpO2DropRule | 血氧掉点 | 血氧低于阈值或突然下降 |
| MedicationOverdueRule | 用药超时 | 追加用药时间超过计划时间 |
| RecoveryScoreRule | 复苏评分 | 复苏评分低于阈值 |
| HypotensionRule | 低血压 | 收缩压低于阈值 |
| HypertensionRule | 高血压 | 收缩压高于阈值 |
| TachycardiaRule | 心动过速 | 心率高于阈值 |
| BradycardiaRule | 心动过缓 | 心率低于阈值 |

**规则配置** (`rule_config.py`):
- 支持物种特定配置（犬、猫等）
- 可配置各风险类型的检测阈值

### 4. 存储模块 (storage/)

- **CaseStorage**: 病例存储管理器
  - JSON格式本地存储
  - 内存缓存加速
  - 自动创建存储目录
  
- **ReviewManager**: 复核管理器
  - 支持确认/驳回风险
  - 支持批量操作
  - 记录复核历史和备注

### 5. 导出模块 (exports/)

- **MarkdownExporter**: 导出Markdown复盘报告
  - 包含病例基本信息
  - 生命体征摘要
  - 风险清单（按状态分类）
  - 复核记录汇总
  
- **CSVExporter**: 导出CSV风险清单
  - 包含风险ID、类型、严重程度、状态、时间、描述、复核信息
  
- **JSONAuditExporter**: 导出JSON审计包
  - 完整病例数据
  - 审计信息（导出时间、导出人）
  - 数据完整性哈希（SHA256）

### 6. GUI界面 (gui/)

- **MainWindow**: 主窗口
  - 菜单栏、工具栏、状态栏
  - 管理所有子组件
  
- **TimelineWidget**: 时间轴组件
  - 使用matplotlib绘制
  - 展示生命体征曲线
  - 标记给药节点
  - 高亮风险片段
  - 支持显示/隐藏各数据系列
  
- **RiskTableWidget**: 风险列表组件
  - 表格展示所有风险
  - 支持按状态筛选
  - 支持多选和批量操作
  - 右键菜单
  
- **RiskDetailWidget**: 风险详情组件
  - 显示风险详细信息
  - 显示复核历史
  - 支持输入复核备注
  - 确认/驳回按钮

## 数据格式说明

### 监护仪CSV格式

```csv
时间,体温(°C),心率(bpm),血氧(%),收缩压(mmHg),舒张压(mmHg),呼吸频率(bpm)
2024-01-15 09:00:00,37.8,120,98,110,65,25
2024-01-15 09:01:00,37.7,118,97,108,63,24
...
```

**支持的列名（不区分大小写）：**
- 时间/时间戳/timestamp/time
- 体温/temperature/temp
- 心率/heart_rate/hr/pulse
- 血氧/spo2/o2_sat
- 收缩压/systolic_bp/sbp
- 舒张压/diastolic_bp/dbp
- 呼吸频率/respiratory_rate/rr

### 给药记录JSON格式

```json
{
  "case_id": "CASE-20240115-001",
  "patient_name": "小黑",
  "species": "犬",
  "breed": "拉布拉多",
  "age": 3,
  "weight": 25.5,
  "surgery_type": "绝育手术",
  "medications": [
    {
      "medication_id": "MED-001",
      "name": "丙泊酚",
      "type": "induction",
      "records": [
        {
          "record_id": "REC-001",
          "medication_name": "丙泊酚",
          "admin_time": "2024-01-15 08:55:00",
          "scheduled_time": "2024-01-15 08:55:00",
          "dosage": 100.0,
          "dosage_unit": "mg",
          "route": "iv",
          "operator": "张医生",
          "notes": "诱导麻醉"
        }
      ]
    }
  ],
  "manual_notes": [
    {
      "timestamp": "2024-01-15 09:15:00",
      "note": "患者体温开始下降，注意保暖"
    }
  ],
  "recovery_score": {
    "score_time": "2024-01-15 10:10:00",
    "total_score": 6,
    "max_score": 10,
    "category_scores": {
      "consciousness": 1,
      "respiration": 2,
      "circulation": 1,
      "temperature": 1,
      "pain": 1
    }
  }
}
```

**药物类型 (type):**
- `induction` - 诱导麻醉
- `maintenance` - 维持麻醉
- `analgesic` - 镇痛
- `antibiotic` - 抗生素
- `anticholinergic` - 抗胆碱能
- `other` - 其他

**给药途径 (route):**
- `iv` - 静脉注射
- `im` - 肌肉注射
- `sc` - 皮下注射
- `oral` - 口服
- `inhalation` - 吸入
- `other` - 其他

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_models.py -v
pytest tests/test_rules.py -v
pytest tests/test_storage.py -v

# 生成覆盖率报告
pytest tests/ --cov=src --cov-report=html
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+N | 新建病例 |
| Ctrl+S | 保存病例 |
| Ctrl+Shift+C | 导入CSV |
| Ctrl+Shift+J | 导入JSON |
| F5 | 运行风险检测 |
| Ctrl+E, M | 导出Markdown报告 |
| Ctrl+E, R | 导出风险清单CSV |
| Ctrl+E, A | 导出JSON审计包 |
| Ctrl+Q | 退出 |

## 本地存储

病例数据存储在以下位置：

- **macOS**: `~/Library/Application Support/AnesthesiaReview/cases/`
- **Windows**: `%APPDATA%\AnesthesiaReview\cases\`
- **Linux**: `~/.local/share/AnesthesiaReview/cases/`

每个病例保存为一个JSON文件，文件名格式为 `{case_id}.json`。

## 常见问题

### 1. 导入CSV失败怎么办？

- 检查CSV文件编码（推荐UTF-8）
- 检查时间格式是否正确
- 检查列名是否包含必要字段（至少需要时间和至少一种生命体征）

### 2. 没有检测到风险？

- 检查生命体征数据是否包含异常值
- 可以通过修改 `rules/rule_config.py` 调整检测阈值
- 示例数据已包含预设的异常值，应该能检测到风险

### 3. 保存后重启数据丢失？

- 检查存储目录权限
- 确认病例已保存（状态栏会显示病例信息）
- 检查存储目录是否存在

## 版本历史

- **v1.0.0** (2024-01-15)
  - 初始版本
  - 支持CSV和JSON导入
  - 8种风险检测规则
  - 时间轴可视化
  - 复核机制
  - 三种导出格式
  - 本地持久化存储

## 许可证

本项目仅供内部使用。

## 联系方式

如有问题或建议，请联系开发团队。
