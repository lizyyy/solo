# 🌧️ 梅雨季晾衣干燥预估器

一个本地命令行工具，帮助你在梅雨季估算衣物干燥时间，评估霉味/回潮风险，并给出优化建议。

## 功能特性

- **干燥时间估算**: 根据布料类型、含水量、温湿度、风速、日照、衣架间距，计算每件衣服的干燥时间
- **分时段干燥曲线**: 模拟每小时的干燥过程，生成详细的干燥曲线
- **风险评估**: 评估霉味风险和回潮风险，标记高风险衣物和危险时段
- **方案对比**: 对比两个晾晒方案，分析哪个更快、哪个风险更高
- **多格式输出**: 终端摘要、Markdown报告、HTML报告、机器可读JSON

## 项目结构

```
laundry_dryer/
├── __init__.py           # 包初始化
├── __main__.py           # 入口模块
├── models.py             # 数据模型定义
├── input_parser.py       # 输入解析 (JSON/CSV)
├── validator.py          # 数据校验
├── drying_model.py       # 干燥曲线计算模型
├── risk_assessment.py    # 霉味/回潮风险规则
├── report_generator.py   # 报告导出
└── cli.py                # CLI命令入口

examples/
├── scenario1_normal.json     # 正常场景样例
├── scenario2_optimized.json  # 优化场景样例 (用于对比)
├── scenario3_high_risk.json  # 高风险异常样例
└── clothing_list.csv         # CSV衣物清单样例
```

## 环境要求

- Python 3.8+
- 无需额外依赖 (使用标准库)

## 快速开始

### 1. 查看帮助

```bash
# 显示完整帮助信息
python -m laundry_dryer help

# 或使用默认帮助
python -m laundry_dryer -h
```

### 2. 模拟晾晒场景

```bash
# 正常场景
python -m laundry_dryer simulate examples/scenario1_normal.json

# 优化场景
python -m laundry_dryer simulate examples/scenario2_optimized.json

# 高风险场景
python -m laundry_dryer simulate examples/scenario3_high_risk.json
```

### 3. 对比两个方案

```bash
# 对比正常场景 vs 优化场景
python -m laundry_dryer compare examples/scenario1_normal.json examples/scenario2_optimized.json

# 导出对比报告
python -m laundry_dryer compare examples/scenario1_normal.json examples/scenario2_optimized.json --md -o output/
```

### 4. 导出报告

```bash
# 导出所有格式 (Markdown + HTML + JSON)
python -m laundry_dryer export examples/scenario1_normal.json

# 仅导出指定格式
python -m laundry_dryer export examples/scenario1_normal.json --md --html

# 指定输出目录
python -m laundry_dryer export examples/scenario1_normal.json --all -o output/
```

## 输入格式

### JSON 场景文件

```json
{
  "name": "场景名称",
  "description": "场景描述",
  "start_time": "2024-06-15 08:00:00",
  "clothing_items": [
    {
      "name": "衣物名称",
      "fabric_type": "cotton",
      "weight_kg": 0.3,
      "moisture_content_pct": 55,
      "drying_location": "阳台",
      "hanger_spacing_cm": 15
    }
  ],
  "weather_periods": [
    {
      "start_hour": 8,
      "duration_hours": 4,
      "temperature_c": 22,
      "humidity_pct": 75,
      "wind_speed_kph": 8,
      "is_sunny": false,
      "uv_index": 2
    }
  ]
}
```

#### 字段说明

**衣物字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 衣物名称 |
| fabric_type | string | 布料类型 (见下方) |
| weight_kg | float | 重量 (kg) |
| moisture_content_pct | float | 含水量百分比 (%) |
| drying_location | string | 晾晒位置 |
| hanger_spacing_cm | float | 衣架间距 (cm) |

**天气时段字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| start_hour | int | 开始小时 (0-23) |
| duration_hours | int | 持续小时数 |
| temperature_c | float | 温度 (℃) |
| humidity_pct | float | 湿度 (%) |
| wind_speed_kph | float | 风速 (km/h) |
| is_sunny | bool | 是否晴天 |
| uv_index | float | 紫外线指数 (0-11) |

#### 支持的布料类型

| 英文名 | 中文名 | 干燥速度 |
|--------|--------|----------|
| cotton | 棉 | 中等 |
| wool | 羊毛 | 慢 |
| silk | 丝绸 | 快 |
| linen | 亚麻 | 快 |
| polyester | 聚酯纤维 | 很快 |
| nylon | 尼龙 | 很快 |
| denim | 牛仔布 | 很慢 |
| sweater | 毛衣 | 最慢 |

#### 支持的晾晒位置

| 位置 | 说明 |
|------|------|
| 阳台 / balcony | 推荐，通风良好 |
| 室内 / indoor | 一般 |
| 室外 / outdoor | 最佳 |
| 卫生间 / bathroom | 不推荐，高湿度 |
| 衣帽间 / closet | 不推荐 |
| 走廊 / hallway | 一般 |
| 车库 / garage | 不推荐 |

### CSV 衣物清单

```csv
name,fabric_type,weight_kg,moisture_content_pct,drying_location,hanger_spacing_cm
白色T恤,cotton,0.3,55,阳台,15
牛仔裤,denim,0.8,65,阳台,18
```

## 核心计算模型

### 干燥曲线原理

本工具使用**指数衰减模型**计算干燥速度：

```
每小时干燥率 = 基础干燥率 × 温度因子 × 湿度因子 × 风速因子 × 日照因子 × 间距因子 × 位置因子
```

**各因子说明**:

1. **温度因子**: 温度越高，干燥越快。每升高10℃，干燥速度约增加1倍
2. **湿度因子**: 湿度越高，干燥越慢。湿度>90%时几乎无法干燥
3. **风速因子**: 风速越高，干燥越快。风速>20 km/h后增益递减
4. **日照因子**: 晴天干燥更快，紫外线有额外增益
5. **间距因子**: 间距越近，空气流通越差，干燥越慢。最优间距约20cm
6. **位置因子**: 室外>阳台>室内>卫生间

### 风险评估规则

**霉味风险**:
- 干燥时间 > 24小时: +20分
- 初始含水量 > 60%: +15分
- 湿度 ≥ 90% 且 含水量 > 20%: +3分/小时
- 夜间晾晒 + 干燥时间 > 8小时: +10分
- 衣架间距 < 10cm: +10分

**回潮风险**:
- 夜间湿度 > 80%: +15分
- 湿度 > 90%: +10分
- 最终含水量 > 20%: +20分
- 湿度波动 > 30%: +10分

**风险等级**:
- 低风险: < 30分
- 中风险: 30-60分
- 高风险: 60-80分
- 极高风险: ≥ 80分

## 样例说明

### 场景1: 正常晾晒场景

**条件**:
- 4件衣物: 棉T恤、牛仔裤、羊毛毛衣、真丝衬衫
- 位置: 阳台
- 天气: 梅雨季典型天气 (湿度70-90%, 温度18-25℃)
- 时段: 8:00-次日8:00

**预期结果**:
- 真丝衬衫最快干燥 (室内位置但布料易干)
- 牛仔裤最慢干燥 (牛仔布保水性强)
- 夜间湿度升高，存在一定回潮风险

### 场景2: 优化晾晒场景

**条件**:
- 同样的4件衣物
- 位置: 室外 (部分) + 阳台
- 衣架间距: 增加到20-25cm
- 天气: 更优的天气 (有日照、风速更高)

**预期结果**:
- 干燥时间显著缩短
- 风险等级降低
- 可与场景1对比验证优化效果

### 场景3: 高风险异常场景

**条件**:
- 厚牛仔裤、厚毛衣、棉毛巾、羊毛围巾
- 位置: 卫生间 (高湿度)
- 衣架间距: 3-8cm (非常拥挤)
- 天气: 夜间晾晒、温度12-16℃、湿度88-98%、无风

**预期结果**:
- 干燥时间极长 (> 48小时)
- 风险等级: 极高风险
- 大量警告信息和优化建议

## 输出示例

### 终端摘要

```
============================================================
🌧️ 梅雨季晾衣干燥预估器 - 场景: 梅雨季正常晾晒场景
============================================================

📊 天气概览:
   平均温度: 21.6℃
   平均湿度: 79.6%
   平均风速: 6.2 km/h

👕 衣物干燥时间预估:
----------------------------------------
   ✅ 白色T恤 (cotton): 19小时 [中风险]
   ✅ 牛仔裤 (denim): 35小时 [高风险]
   ✅ 羊毛毛衣 (wool): 41小时 [高风险]
   ✅ 真丝衬衫 (silk): 12小时 [低风险]

📈 统计摘要:
   最快干燥: 真丝衬衫 - 12小时
   最慢干燥: 羊毛毛衣 - 41小时
   平均干燥时间: 26.8 小时
   整体风险等级: 高风险

⚠️ 高风险衣物警告:
   - 牛仔裤: 霉味风险75.0, 回潮风险65
     * 干燥时间超过24小时（35.0小时），增加霉味风险
     * 初始含水量较高（65%）
     * 夜间晾晒，湿度通常上升，增加回潮风险

💡 优化建议:
   1. ⚠️ 高风险衣物需要关注: 牛仔裤, 羊毛毛衣
   2. 💨 环境湿度较高，建议使用风扇或除湿机加速干燥
   3. ⏰ 牛仔裤预计需要35小时才能干燥，建议分批晾晒或使用烘干设备
   4. 🌙 夜间晾晒湿度较高，建议将衣物移至室内干燥环境
```

### 输出文件位置

使用 `export` 命令后，会在当前目录或指定目录生成以下文件:

```
output/
├── scenario1_normal_report.md     # Markdown报告
├── scenario1_normal_report.html   # HTML报告 (带样式)
└── scenario1_normal_report.json   # 机器可读JSON
```

## CLI 命令参考

### `simulate` - 模拟晾晒场景

```bash
python -m laundry_dryer simulate <scenario.json>
```

**参数**:
- `scenario.json`: 场景文件路径

**输出**: 终端摘要

---

### `compare` - 对比两个方案

```bash
python -m laundry_dryer compare <a.json> <b.json> [options]
```

**参数**:
- `a.json`: 方案A文件路径
- `b.json`: 方案B文件路径
- `--md, --markdown`: 导出Markdown对比报告
- `-o, --output`: 输出目录

**输出**: 终端对比摘要 + 可选的Markdown报告

---

### `export` / `report` - 导出报告

```bash
python -m laundry_dryer export <scenario.json> [options]
```

**参数**:
- `scenario.json`: 场景文件路径
- `--md, --markdown`: 导出Markdown报告
- `--html`: 导出HTML报告
- `--json`: 导出JSON报告
- `--all`: 导出所有格式 (默认)
- `-o, --output`: 输出目录

**输出**: 终端摘要 + 选择的报告文件

---

### `help` - 显示帮助

```bash
python -m laundry_dryer help
```

## 数据校验

工具会自动校验输入数据，常见错误包括:

| 错误 | 说明 |
|------|------|
| 衣物名称不能为空 | 必须填写name字段 |
| 布料类型无效 | 使用支持的布料类型 |
| 重量超出范围 | 0.01-50 kg |
| 含水量超出范围 | 0-200% |
| 衣架间距超出范围 | 0-100 cm |
| 温度超出范围 | -10-50 ℃ |
| 湿度超出范围 | 0-100% |
| 风速超出范围 | 0-200 km/h |
| 天气时段重叠 | 时段不能有时间重叠 |

## 常见问题

**Q: 为什么需要估算干燥时间？**

梅雨季空气湿度大，衣物很难干燥，容易产生霉味。通过精确估算，你可以:
- 选择最佳晾晒时间
- 优化衣物布局
- 及时使用辅助设备 (风扇、除湿机)
- 避免衣物发霉

**Q: 这个模型准确吗？**

模型基于以下原理构建:
- 布料保水性实验数据
- 干燥学基本原理
- 环境因素影响规律

实际干燥时间还会受到具体环境影响，建议结合实际情况调整。

**Q: 如何获得更准确的结果？**

1. 准确测量衣物重量
2. 观察脱水后的湿润程度估算含水量
3. 提供更详细的天气时段划分
4. 如实填写晾晒位置和衣架间距

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
