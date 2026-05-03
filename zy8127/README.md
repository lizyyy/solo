# 🐄 奶牛日粮配方偏差复核看板

一个基于 Streamlit 的奶牛日粮配方偏差复核系统，帮助营养师分析和复核日粮配方的实际营养水平、库存消耗和潜在风险。

## ✨ 功能特性

- **营养计算**：按牛群计算实际干物质、粗蛋白、净能量、钙磷比例（干物质基础）
- **库存分析**：计算全群日消耗量、预测库存可用天数和缺口
- **问题检测**：自动检测以下问题：
  - 🔴 检测值缺失（使用库存标称值作为后备）
  - 🔴 原料批次过期/即将过期（14天预警）
  - 🔴 配方超预算/超库存
  - 🟡 营养指标偏差（可配置容忍度）
  - 🟡 钙磷比例异常（目标1.5-2.5:1）
  
- **数据可视化**：
  - 雷达图：单个牛群营养指标目标 vs 实际
  - 柱状图：多牛群对比、库存 vs 消耗预测
  
- **导出功能**：
  - 📄 生成完整的 `ration_report.md` 报告
  - 📊 导出 `issues.csv` 问题列表

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动应用

```bash
streamlit run app.py
```

应用将自动在浏览器中打开，默认地址：`http://localhost:8501`

### 3. 使用示例数据

启动应用后，**"使用示例数据"** 选项默认已勾选，系统会自动加载 `data/` 目录下的示例数据。

你可以立即看到：
- 5个牛群的日粮配方分析
- 多种预设的问题场景（过期原料、缺失检测数据、库存不足等）
- 完整的报告导出功能

## 📁 数据文件格式

### 必需的4个数据文件

#### 1. feed_inventory.csv - 饲料库存

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| feed_id | string | 饲料ID | F001 |
| feed_name | string | 饲料名称 | 玉米青贮 |
| batch_number | string | 批次号 | S2025A |
| quantity_kg | float | 库存数量(kg) | 25000 |
| unit_cost_cny_kg | float | 单位成本(元/kg) | 0.45 |
| dry_matter_percent | float | 标称干物质(%) | 35.0 |
| expiry_date | date | 过期日期 | 2026-06-30 |
| storage_location | string | 存储位置 | 青贮窖1 |

#### 2. lab_results.csv - 实验室检测结果

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| feed_id | string | 饲料ID | F001 |
| test_date | date | 检测日期 | 2025-04-15 |
| dry_matter_actual | float | 实际干物质(%) | 34.5 |
| crude_protein_percent | float | 粗蛋白(%, DM基础) | 8.2 |
| net_energy_mcal_kg | float | 净能(Mcal/kg, DM基础) | 1.55 |
| calcium_percent | float | 钙(%, DM基础) | 0.45 |
| phosphorus_percent | float | 磷(%, DM基础) | 0.25 |

#### 3. herd_groups.csv - 牛群分组

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| group_id | string | 牛群ID | G001 |
| group_name | string | 牛群名称 | 高产泌乳牛 |
| cow_count | integer | 牛头数 | 150 |
| average_weight_kg | float | 平均体重(kg) | 650 |
| stage | string | 生理阶段 | early_lactation |

#### 4. ration_plan.yaml - 日粮配方

```yaml
version: "1.0"
date: 2025-04-15
created_by: "营养师"

herd_rations:
  G001:
    group_name: "高产泌乳牛"
    target_dry_matter_kg: 26.0
    target_crude_protein_percent: 17.5
    target_net_energy_mcal_kg: 1.75
    target_calcium_percent: 0.80
    target_phosphorus_percent: 0.42
    budget_cny_per_head_daily: 85.0
    feeds:
      - feed_id: F001
        as_fed_kg: 30.0
      - feed_id: F002
        as_fed_kg: 4.5
      # ... 更多饲料
```

## 🧪 运行测试

```bash
python -m pytest tests/ -v
```

或者：

```bash
pytest tests/ -v
```

## 📊 示例数据说明

示例数据设计包含以下场景，用于演示系统的检测能力：

### 过期/即将过期原料

| 饲料 | 过期日期 | 当前日期(2026-05-03) | 状态 |
|------|----------|---------------------|------|
| 苜蓿干草 | 2025-12-15 | 已过期 | 🔴 error |
| 棉籽 | 2025-11-01 | 已过期 | 🔴 error |
| 酒糟 | 2025-10-15 | 已过期 | 🔴 error |
| 预混料 | 2026-02-28 | 已过期 | 🔴 error |

### 缺少实验室检测数据

| 饲料 | 缺少的数据 | 处理方式 |
|------|-----------|---------|
| 棉籽(F005) | 全部营养指标 | 干物质使用库存值，其他缺失 |
| 磷酸氢钙(F006) | 全部营养指标 | 干物质使用库存值，其他缺失 |

### 营养指标偏差

由于实验室检测值与配方目标值的差异，系统会自动计算并标记偏差。

## 📐 计算逻辑说明

### 单位换算

- **饲喂量(As-Fed)** → **干物质(Dry Matter)**:
  ```
  Dry Matter kg = As-Fed kg × (Dry Matter % / 100)
  ```

- **营养指标均基于干物质(DM)计算**：
  ```
  营养总量 = Dry Matter kg × (营养成分% / 100)
  日粮营养% = (Σ各饲料营养总量) / (Σ各饲料Dry Matter) × 100
  ```

### 钙磷比例

- **目标范围**: 1.5:1 ~ 2.5:1
- **警告范围**: <1.5 或 >2.5
- **错误范围**: <1.2 或 >3.0

### 库存消耗计算

```
日消耗量 = Σ(各牛群饲喂量 × 牛头数)
可用天数 = 当前库存 / 日消耗量
预测缺口 = max(0, 日消耗量 × 预测天数 - 当前库存)
```

## 🗂️ 项目结构

```
.
├── app.py                  # Streamlit 主应用
├── requirements.txt        # 依赖清单
├── README.md              # 本文档
├── data/                  # 示例数据
│   ├── feed_inventory.csv
│   ├── lab_results.csv
│   ├── herd_groups.csv
│   └── ration_plan.yaml
├── src/                   # 核心模块
│   └── ration_calculator.py
└── tests/                 # 测试文件
    └── test_calculator.py
```

## 🔧 配置参数

在应用侧边栏可以调整：

| 参数 | 范围 | 默认值 | 说明 |
|------|------|--------|------|
| 库存预测天数 | 7-90天 | 30天 | 计算库存缺口的时间范围 |
| 营养偏差容忍度 | 1-20% | 5% | 超过此值标记为警告 |

## 📋 问题类型说明

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| expired_batch | error | 原料已过期 |
| expiring_soon | warning | 14天内即将过期 |
| inventory_shortfall | error/warning | 预测期内库存不足 |
| missing_lab_data | warning | 缺少实验室检测数据 |
| nutrient_deviation | warning/error | 营养指标超偏差 |
| ca_p_ratio_deviation | warning/error | 钙磷比例异常 |
| budget_exceeded | warning/error | 日粮成本超预算 |
| budget_underutilized | info | 日粮成本低于预算10%以上 |

## 📝 导出文件说明

### ration_report.md

包含以下章节：
1. **概览**：牛群数量、饲料种类、问题统计
2. **牛群营养情况**：各牛群详细营养指标和配方
3. **库存消耗分析**：库存明细和预测
4. **问题明细**：按严重程度分类的问题列表

### issues.csv

包含以下字段：
- issue_type: 问题类型
- severity: 严重程度 (error/warning/info)
- group_id: 相关牛群ID（如适用）
- feed_id: 相关饲料ID（如适用）
- message: 问题描述
- details: 详细信息（JSON格式字符串）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
