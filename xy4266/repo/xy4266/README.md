# 滴灌盐分回算器

一个用于温室种植技术员的本地 Python CLI 工具，帮助监测和管理滴灌系统中的盐分累积问题。

## 功能特性

- **init**: 初始化项目，创建作物、基质和阈值配置
- **import-day**: 导入每日灌溉记录并进行多重数据校验
- **simulate**: 估算根区盐分趋势和未来3天冲洗需求
- **report**: 导出 Markdown 建议、CSV 风险畦清单和 JSON 审计包

## 数据校验功能

导入数据时会自动进行以下校验：

- ✅ **缺字段检查**: 确保所有必填字段存在
- ✅ **时间倒序检查**: 检测日期顺序异常
- ✅ **EC单位混乱检查**: 自动识别并转换不同单位（mS/cm, μS/cm, dS/m）
- ✅ **排液率异常检查**: 检测过高或过低的排液率
- ✅ **重复畦号检查**: 防止同一畦号同一日期重复录入

## 安装

### 环境要求

- Python 3.8+
- pip 包管理器

### 安装步骤

```bash
# 克隆或下载项目后，进入项目目录
cd xy4266

# 安装依赖（可编辑模式）
pip install -e .
```

或使用 `pyproject.toml` 安装：

```bash
pip install .
```

开发依赖（用于运行测试）：

```bash
pip install -e ".[dev]"
```

## 快速开始

以下是一个完整的工作流程示例，使用临时目录进行验证。

### 1. 创建临时目录

```bash
# 创建临时测试目录
mkdir -p /tmp/tomato_greenhouse
cd /tmp/tomato_greenhouse
```

### 2. 初始化项目

```bash
# 初始化一个番茄种植项目
drip-salinity init \
  --name "番茄种植示范区" \
  --crop 番茄 \
  --planting-date 2024-01-15 \
  --substrate 椰糠 \
  --volume 100.0 \
  --beds A01,A02,A03,A04 \
  --ec-warning 4.0 \
  --ec-danger 5.0
```

参数说明：
- `--name`: 项目名称
- `--crop`: 作物类型（番茄、黄瓜、辣椒、生菜、草莓）
- `--planting-date`: 定植日期 (YYYY-MM-DD)
- `--substrate`: 基质类型（椰糠、泥炭、珍珠岩、蛭石、岩棉、混合基质）
- `--volume`: 每畦基质体积 (升)
- `--beds`: 畦号列表，用逗号分隔
- `--ec-warning`: EC预警阈值 (mS/cm)
- `--ec-danger`: EC危险阈值 (mS/cm)

### 3. 准备CSV数据文件

创建 `daily_records.csv` 文件，格式如下：

```csv
日期,畦号,灌溉量,灌溉EC,排液量,排液EC,基质含水率,EC单位,备注
2024-01-20,A01,200,2.5,50,3.2,58,mS/cm,正常灌溉
2024-01-20,A02,200,2.5,55,3.0,60,mS/cm,正常灌溉
2024-01-20,A03,200,2.5,20,4.5,50,mS/cm,排液率偏低
2024-01-20,A04,200,2.5,60,2.9,62,mS/cm,正常
```

**CSV字段说明**：

| 字段 | 说明 | 单位 |
|------|------|------|
| 日期 | 记录日期 | YYYY-MM-DD 或其他格式 |
| 畦号 | 畦的标识 | 字符串 |
| 灌溉量 | 每畦灌溉总量 | 升 (L) |
| 灌溉EC | 灌溉水电导率 | mS/cm 或其他 |
| 排液量 | 每畦排液总量 | 升 (L) |
| 排液EC | 排液电导率 | mS/cm 或其他 |
| 基质含水率 | 基质水分含量 | % |
| EC单位 | EC值单位 | mS/cm, μS/cm, dS/m |
| 备注 | 备注信息 | 可选 |

### 4. 导入数据

```bash
# 先试运行（仅校验，不保存）
drip-salinity import-day daily_records.csv --dry-run

# 确认无误后正式导入
drip-salinity import-day daily_records.csv
```

导入更多天数的数据：

```bash
# 第二天数据
cat > day2.csv << 'EOF'
日期,畦号,灌溉量,灌溉EC,排液量,排液EC,基质含水率,EC单位,备注
2024-01-21,A01,210,2.6,45,3.4,57,mS/cm,
2024-01-21,A02,210,2.6,58,3.2,61,mS/cm,
2024-01-21,A03,210,2.6,18,4.8,48,mS/cm,盐分持续累积
2024-01-21,A04,210,2.6,65,3.1,63,mS/cm,
EOF

drip-salinity import-day day2.csv
```

### 5. 模拟盐分趋势

```bash
# 分析所有畦的盐分趋势
drip-salinity simulate

# 只分析特定畦号
drip-salinity simulate --bed A03

# 显示历史趋势
drip-salinity simulate --show-history
```

输出示例：

```
╭─────────────────────────────────────────╮
│              模拟分析结果                │
├─────────────────────────────────────────┤
│ 盐分趋势分析完成                        │
│ 分析畦数: 4                             │
│ 记录总数: 8                             │
╰─────────────────────────────────────────╯

╭────────────────────────────────────────────────────────────────────────────────────────────╮
│                                          各畦盐分状态                                          │
├──────┬──────────────┬──────────┬──────────┬────────┬────────┬──────────────┤
│ 畦号  │ 当前EC       │ 趋势      │ 风险等级  │ 距预警  │ 距危险  │ 冲洗需求       │
├──────┼──────────────┼──────────┼──────────┼────────┼────────┼──────────────┤
│ A01  │ 2.85 mS/cm   │ 缓慢上升  │ 安全     │ 12 天  │ 23 天  │ -            │
│ A02  │ 2.78 mS/cm   │ 稳定     │ 安全     │ 15 天  │ 28 天  │ -            │
│ A03  │ 4.12 mS/cm   │ 快速上升  │ 预警     │ -      │ 5 天   │ 建议          │
│ A04  │ 2.72 mS/cm   │ 稳定     │ 安全     │ 16 天  │ 30 天  │ -            │
╰──────┴──────────────┴──────────┴──────────┴────────┴────────┴──────────────╯

╭──────────────────────────────────────────────────────────────────────────╮
│                                   冲洗建议                                   │
├──────┬────────┬────────┬──────────┬──────────────┬──────────────┤
│ 畦号  │ 当前EC  │ 目标EC  │ 紧急程度  │ 建议冲洗量     │ 冲洗液EC       │
├──────┼────────┼────────┼──────────┼──────────────┼──────────────┤
│ A03  │ 4.12   │ 2.75   │ 建议     │ 45.0 L       │ 1.38 mS/cm   │
╰──────┴────────┴────────┴──────────┴──────────────┴──────────────╯
```

### 6. 生成报告

```bash
# 生成所有格式的报告
drip-salinity report

# 只生成Markdown报告
drip-salinity report --format md

# 导出到指定目录
drip-salinity report -o ./output_reports
```

报告输出位置：
- `reports/salt_report_YYYYMMDD_HHMMSS.md`: Markdown 详细报告
- `reports/risk_beds_YYYYMMDD_HHMMSS.csv`: 风险畦清单
- `reports/history_data_YYYYMMDD_HHMMSS.csv`: 历史数据汇总
- `audit/audit_YYYYMMDD_HHMMSS.json`: JSON 审计包

### 7. 查看项目信息

```bash
drip-salinity info
```

## 使用示例数据

项目包含示例数据文件，位于 `examples/` 目录：

```bash
# 使用示例数据测试
cd /path/to/xy4266

# 创建临时项目
mkdir -p /tmp/test_project
cd /tmp/test_project

# 初始化
drip-salinity init --name "测试项目" --beds A01,A02,A03,A04

# 导入正常数据
drip-salinity import-day /path/to/xy4266/examples/sample_normal.csv

# 导入含警告的数据（观察校验功能）
drip-salinity import-day /path/to/xy4266/examples/sample_warnings.csv

# 导入含错误的数据（观察错误提示）
drip-salinity import-day /path/to/xy4266/examples/sample_errors.csv --dry-run

# 模拟分析
drip-salinity simulate

# 生成报告
drip-salinity report
```

示例数据说明：

| 文件 | 说明 |
|------|------|
| `sample_normal.csv` | 正常数据，5天4畦的记录 |
| `sample_warnings.csv` | 含警告的数据，排液率异常 |
| `sample_errors.csv` | 含错误的数据，用于测试校验功能 |

## 命令参考

### 全局选项

```bash
# 指定项目路径（默认为当前目录）
drip-salinity --project /path/to/my_project <command>

# 或使用环境变量
export DRIP_PROJECT=/path/to/my_project
drip-salinity <command>

# 查看版本
drip-salinity --version

# 查看帮助
drip-salinity --help
drip-salinity <command> --help
```

### init 命令

```bash
drip-salinity init [OPTIONS]

选项:
  -n, --name TEXT           项目名称 [默认: 温室滴灌项目]
  -c, --crop [番茄|黄瓜|辣椒|生菜|草莓]
                            作物类型 [默认: 番茄]
  -d, --planting-date TEXT  定植日期 (YYYY-MM-DD)
  -s, --substrate [椰糠|泥炭|珍珠岩|蛭石|岩棉|混合基质]
                            基质类型 [默认: 椰糠]
  -V, --volume FLOAT        每畦基质体积 (L) [默认: 100.0]
  -b, --beds TEXT           畦号列表，用逗号分隔 [默认: A01,A02,A03,A04]
  --ec-warning FLOAT        EC预警阈值 (mS/cm) [默认: 4.0]
  --ec-danger FLOAT         EC危险阈值 (mS/cm) [默认: 5.0]
  -f, --force               强制覆盖现有配置
```

### import-day 命令

```bash
drip-salinity import-day [OPTIONS] CSV_FILE

选项:
  -u, --ec-unit [mS/cm|μS/cm|dS/m]
                            默认EC单位 [默认: mS/cm]
  -n, --dry-run             仅校验，不保存数据
  -f, --force               忽略警告，强制导入
```

### simulate 命令

```bash
drip-salinity simulate [OPTIONS]

选项:
  -H, --show-history        显示历史趋势
  -b, --bed TEXT            指定畦号分析（默认分析所有）
```

### report 命令

```bash
drip-salinity report [OPTIONS]

选项:
  -o, --output-dir PATH     输出目录（默认项目reports目录）
  -f, --format [all|md|csv|json]
                            输出格式 [默认: all]
```

### info 命令

```bash
drip-salinity info
```

## 项目目录结构

```
my_project/
├── config/
│   └── project_config.json    # 项目配置文件
├── data/
│   ├── daily_records.json     # 导入的原始记录
│   └── salt_balances.json     # 盐平衡计算结果
├── reports/                    # 生成的报告
│   ├── salt_report_*.md
│   ├── risk_beds_*.csv
│   └── history_data_*.csv
├── audit/                      # 审计包
│   └── audit_*.json
└── temp/                       # 临时文件
```

## 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_config.py
pytest tests/test_csv_parser.py
pytest tests/test_calculator.py

# 带覆盖率的测试
pytest --cov=drip_salinity
```

## 盐平衡计算原理

### 基本公式

```
输入盐分质量 = 灌溉量 × 灌溉EC × 转换系数
输出盐分质量 = 排液量 × 排液EC × 转换系数
净盐分变化 = 输入盐分质量 - 输出盐分质量

转换系数: 1 mS/cm ≈ 10 meq/L (营养液)
```

### 根区EC估算

```
有效水体积 = 基质体积 × 基质含水率
EC变化 = 净盐分变化 / (有效水体积 × 转换系数)
实际变化 = EC变化 × 缓冲因子 (约0.7)
```

### 未来预测

基于最近7天的平均变化率进行保守预测，仅考虑上升趋势。

## 常见问题

### Q: EC单位有哪些？如何转换？

- **mS/cm** (毫西门子/厘米): 常用单位
- **μS/cm** (微西门子/厘米): 1 mS/cm = 1000 μS/cm
- **dS/m** (分西门子/米): 1 dS/m = 0.1 mS/cm = 100 μS/cm

工具会自动识别并统一转换为 mS/cm。

### Q: 正常排液率范围是多少？

- **正常范围**: 10% - 40%
- **排液率过低** (< 10%): 盐分容易累积，需要增加灌溉量
- **排液率过高** (> 40%): 灌溉过量，浪费水和肥料

### Q: 如何判断是否需要冲洗？

- **当前EC ≥ 危险阈值 (默认5.0 mS/cm)**: 立即冲洗
- **当前EC ≥ 预警阈值 (默认4.0 mS/cm)**: 建议冲洗
- **未来3天预测将超过阈值**: 提前准备冲洗

### Q: 冲洗操作要点？

1. 使用低EC水（建议 < 1.0 mS/cm）
2. 采用大流量、短间隔的方式
3. 监测排液EC，直到降至目标范围
4. 冲洗后记录操作，系统会重置累积计数

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

**滴灌盐分回算器** - 让温室种植的盐分管理更简单、更科学。
