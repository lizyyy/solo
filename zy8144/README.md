# 血库红细胞库存效期调拨看板

一个基于 Streamlit 的血库红细胞库存效期管理和调拨决策系统，支持多院区库存管理、血型相容性检查、临期预警和跨院调拨建议。

## 功能特性

- 📊 **库存概览** - 查看各院区、各血型的库存分布和效期状态
- 📋 **预约占用分析** - 分析用血预约，支持跨午夜预约检测
- ⏰ **临期优先** - 识别即将过期的血袋，给出分配优先级建议
- ⚠️ **问题检测** - 自动检测血型不相容、重复分配、时间重叠等问题
- 🚚 **跨院调拨建议** - 根据库存和需求给出智能调拨方案
- 📄 **报告导出** - 导出评审报告 (review_report.md) 和问题清单 (issues.csv)

## 业务逻辑处理

### 1. ABO/Rh 血型不相容处理
- 严格遵循血型相容规则：
  - ABO 相容：O→O/A/B/AB, A→A/AB, B→B/AB, AB→AB
  - Rh 相容：Rh- 可输给 Rh+/Rh-，Rh+ 只能输给 Rh+
- 自动检测并标记不相容的分配尝试
- 给出相容血型替代建议

### 2. 预约跨午夜处理
- 自动识别开始日期和结束日期不同的预约
- 检测跨午夜预约与其他预约的时间重叠
- 在报告中特别标记跨午夜用血需求
- 确保库存分配考虑跨日期的用血安排

### 3. 同一血袋重复占用检测
- 跟踪每个血袋的分配状态
- 检测同一血袋被分配给多个预约的情况
- 标记为严重问题并给出处理建议
- 确保每个血袋只能分配给一个预约

## 项目结构

```
zy8144/
├── app.py                  # Streamlit 主应用
├── requirements.txt        # 依赖包
├── README.md              # 本文档
├── config/                # 配置文件目录
│   ├── blood_compatibility.yaml   # 血型相容规则
│   └── campus_distance.yaml       # 院区距离配置
├── data/                  # 示例数据目录
│   ├── sample_inventory.csv       # 库存示例数据
│   └── sample_appointments.json   # 预约示例数据
├── src/                   # 核心业务逻辑
│   ├── __init__.py
│   ├── config_loader.py           # 配置加载器
│   ├── compatibility_checker.py   # 血型相容性检查
│   ├── inventory_manager.py       # 库存管理
│   ├── appointment_manager.py     # 预约管理
│   ├── allocation_engine.py       # 调拨引擎
│   ├── issue_detector.py          # 问题检测器
│   └── report_generator.py        # 报告生成器
├── tests/                 # 测试目录
│   └── test_core.py               # 核心功能测试
└── output/                # 导出文件目录
```

## 快速开始

### 1. 环境准备

确保已安装 Python 3.8+，然后创建虚拟环境：

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 运行应用

```bash
streamlit run app.py
```

应用将自动在浏览器中打开，默认地址：http://localhost:8501

### 4. 使用示例数据

启动应用后，在左侧侧边栏：
1. 选择"使用示例数据"
2. 点击"加载示例数据"按钮
3. 系统将自动加载预设的示例库存和预约数据

### 5. 使用自定义数据

1. 选择"上传自定义数据"
2. 上传以下文件：
   - 库存 CSV 文件
   - 预约 JSON 文件
   - (可选) 血型规则 YAML
   - (可选) 院区距离 YAML
3. 点击"加载数据"按钮

## 数据格式说明

### 1. 库存 CSV 格式

```csv
blood_bag_id,abo_type,rh_factor,blood_type,volume_ml,campus,storage_location,expiry_date,collection_date,status,donor_id
BAG001,O,+,O+,450,campus_1,冷库A-01,2026-05-08,2026-04-28,available,D001
```

字段说明：
- `blood_bag_id`: 血袋唯一编号
- `abo_type`: ABO 血型 (O/A/B/AB)
- `rh_factor`: Rh 因子 (+/-)
- `blood_type`: 完整血型 (如 O+, A-)
- `volume_ml`: 容量 (毫升)
- `campus`: 院区 ID
- `storage_location`: 存储位置
- `expiry_date`: 过期日期 (YYYY-MM-DD)
- `collection_date`: 采集日期
- `status`: 状态 (available/assigned/used)
- `donor_id`: 献血者 ID

### 2. 预约 JSON 格式

```json
[
  {
    "appointment_id": "APT001",
    "patient_id": "P001",
    "patient_name": "张三",
    "department": "外科",
    "campus": "campus_1",
    "required_blood_type": "A+",
    "required_volume_ml": 900,
    "scheduled_start_time": "2026-05-04T09:00:00",
    "scheduled_end_time": "2026-05-04T12:00:00",
    "urgency": "routine",
    "status": "pending",
    "assigned_blood_bags": [],
    "notes": "常规手术备血"
  }
]
```

字段说明：
- `appointment_id`: 预约唯一编号
- `patient_id`: 患者 ID
- `patient_name`: 患者姓名
- `department`: 科室
- `campus`: 院区 ID
- `required_blood_type`: 所需血型
- `required_volume_ml`: 所需容量 (毫升)
- `scheduled_start_time`: 开始时间 (ISO 格式)
- `scheduled_end_time`: 结束时间 (ISO 格式)
- `urgency`: 紧急程度 (emergency/routine)
- `status`: 状态
- `assigned_blood_bags`: 已分配血袋列表
- `notes`: 备注

### 3. 血型相容规则 YAML

```yaml
abo_compatibility:
  donor_to_recipient:
    O: ["O", "A", "B", "AB"]
    A: ["A", "AB"]
    B: ["B", "AB"]
    AB: ["AB"]

rh_compatibility:
  positive_to_negative: false

blood_type_groups:
  rare_types: ["AB-", "B-", "A-", "AB+"]
  common_types: ["O+", "A+", "B+", "O-"]
```

### 4. 院区距离配置 YAML

```yaml
campuses:
  - id: campus_1
    name: 总院
    code: C1
  - id: campus_2
    name: 东院
    code: C2
  - id: campus_3
    name: 西院
    code: C3

distance_matrix:
  units: minutes
  max_transfer_time: 30
  matrix:
    campus_1:
      campus_1: 0
      campus_2: 15
      campus_3: 20
    campus_2:
      campus_1: 15
      campus_2: 0
      campus_3: 25
    campus_3:
      campus_1: 20
      campus_2: 25
      campus_3: 0
```

## 运行测试

项目包含最小测试用例，可通过 pytest 运行：

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_core.py::TestCompatibilityChecker -v
```

测试覆盖以下核心功能：
- 血型相容性检查 (ABO/Rh)
- 跨午夜预约检测
- 重复分配检测
- 临期血袋识别
- 配置文件加载
- 报告生成

## 功能模块说明

### 1. 库存概览 (📊)
- 总血袋数和总容量统计
- 按血型和院区分布
- 效期状态分类 (临期/预警/正常)
- 可通过院区、血型、效期风险筛选

### 2. 预约占用 (📋)
- 预约列表展示
- 急诊和跨午夜预约标记
- 分配结果详情
- 分配血袋的相容性信息

### 3. 临期优先 (⏰)
- 临期血袋按优先级排序
- 匹配的预约建议
- 剩余天数和风险等级
- 无匹配时的调拨建议

### 4. 问题检测 (⚠️)
- 问题统计概览
- 按类型和严重程度分类
- 问题详情和处理建议
- 支持导出为 issues.csv

### 5. 调拨建议 (🚚)
- 跨院调拨血袋列表
- 调拨路线汇总
- 运输时间和紧急程度
- 来源和目标院区信息

### 6. 导出报告 (📄)
- 生成 review_report.md 评审报告
- 生成 issues.csv 问题清单
- 支持在线预览
- 一键下载或批量导出

## 筛选功能

在左侧侧边栏可设置以下筛选条件：
- **分析日期**: 设置分析基准日期，影响效期计算
- **院区**: 筛选特定院区的数据
- **血型**: 筛选特定血型的数据
- **效期风险**: 按临期风险筛选 (临期/预警/正常)

## 效期风险定义

- **临期 (critical)**: 剩余有效期 ≤ 2 天
- **预警 (warning)**: 剩余有效期 3-5 天
- **正常 (normal)**: 剩余有效期 > 5 天

## 相容性优先级

1. **完全匹配**: 同 ABO 同 Rh (优先级 1)
2. **ABO 匹配 Rh 不同**: 同 ABO 不同 Rh (优先级 2)
3. **ABO 相容 Rh 匹配**: 不同 ABO 同 Rh (优先级 3)
4. **ABO 相容 Rh 不同**: 不同 ABO 不同 Rh (优先级 4)

## 问题类型

系统会自动检测以下问题类型：

| 问题类型 | 严重程度 | 说明 |
|---------|---------|------|
| duplicate_assignment | critical | 同一血袋分配给多个预约 |
| incompatible_blood | critical | 血型不相容分配 |
| rare_shortage | critical/warning | 稀有血型库存短缺 |
| unmet_demand | critical/warning | 用血需求未满足 |
| expiring_soon | critical/warning | 血袋即将过期 |
| cross_midnight | warning | 预约跨午夜 |
| time_overlap | warning | 预约时间重叠 |

## 许可证

本项目仅供学习和内部使用。

## 技术栈

- **Python 3.8+**
- **Streamlit** - Web 应用框架
- **Pandas** - 数据处理
- **PyYAML** - YAML 配置解析
- **pytest** - 测试框架
