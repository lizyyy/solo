# 岩土实验室三轴试验复核工具

一个本地科学计算工具，用于自动复核岩土三轴试验数据。

## 功能特性

- **数据导入**：支持导入 CSV/JSON 格式的试验数据
- **自动计算**：
  - 峰值强度计算
  - 残余强度计算
  - 孔压异常检测
  - 破坏时刻识别
  - 仪器校准过期风险评估
  - 饱和度检查
- **人工改判**：支持人工修改计算结果和判定
- **数据导出**：
  - 导出 Markdown 格式的复核单
  - 导出 JSON 格式的详细数据
- **命令行界面**：支持命令行参数和交互式操作

## 项目结构

```
xy4550/
├── config.py              # 配置文件
├── main.py                # 主程序入口
├── requirements.txt       # 依赖包列表
├── test_manager.py        # 试验管理器
├── data_loader.py         # 数据加载器
├── core/
│   ├── __init__.py
│   └── calculator.py      # 核心计算模块
├── data/
│   ├── samples/           # 示例数据
│   │   ├── sample_registry.csv      # 试样登记
│   │   ├── stress_strain_curve.csv  # 应力应变曲线
│   │   ├── saturation_record.json   # 饱和度记录
│   │   └── instrument_calibration.json  # 仪器校准表
│   ├── processed/         # 处理后的数据
│   └── exported/          # 导出的文件
└── README.md
```

## 安装说明

### 1. 环境要求

- Python 3.8+
- pip 包管理器

### 2. 安装依赖

```bash
cd /Users/mac/pro/solocoder/pro/xy4550/repo/xy4550
pip install -r requirements.txt
```

## 验证流程

### 步骤 1: 查看可用试验

首先查看系统中已有的试验数据：

```bash
python main.py --list
```

预期输出：
```
============================================================
        岩土实验室三轴试验复核工具
        Triaxial Test Review Tool
============================================================

📂 正在加载数据...
✅ 数据加载完成!

📋 可用试验列表:

+------------+--------------+--------+-----------+------------+--------------+
| 试验编号   | 试样名称     | 土类   | 埋深(m)   | 试验日期   | 操作人员   |
+============+==============+========+===========+============+==============+
| T001       | 粉质黏土-1   | CL     | 3.2       | 2026-04-15 | 张三       |
+------------+--------------+--------+-----------+------------+--------------+
| T002       | 粉质黏土-2   | CL     | 3.5       | 2026-04-16 | 李四       |
+------------+--------------+--------+-----------+------------+--------------+
| T003       | 砂土-1       | SP     | 5.1       | 2026-04-17 | 王五       |
+------------+--------------+--------+-----------+------------+--------------+
| T004       | 黏土-1       | CH     | 8.5       | 2026-04-18 | 赵六       |
+------------+--------------+--------+-----------+------------+--------------+
| T005       | 粉土-1       | ML     | 2.8       | 2026-04-19 | 张三       |
+------------+--------------+--------+-----------+------------+--------------+
```

### 步骤 2: 处理试验数据

处理试验 T001：

```bash
python main.py --process T001
```

预期输出包含以下内容：

1. **试样基本信息**：显示试样编号、名称、土类、埋深等
2. **强度参数计算结果**：
   - 峰值强度：约 375.8 kPa（应变 7.0%）
   - 残余强度：约 297.0 kPa
3. **破坏时刻识别**：
   - 推荐破坏准则：应力下降5% 或 峰值点
4. **孔压异常检测**：
   - ✅ 未检测到异常（示例数据正常）
5. **饱和度检查**：
   - ✅ B值: 0.96（阈值: 0.95），已饱和
6. **仪器校准检查**：
   - 显示仪器信息和校准有效期
7. **最终判定**：
   - 整体状态：合格 或 需人工复核

### 步骤 3: 人工改判测试

测试人工改判功能：

```bash
# 修改峰值强度为 380.0 kPa
python main.py --process T001 --override-peak 380.0

# 修改残余强度为 300.0 kPa
python main.py --process T001 --override-residual 300.0

# 人工判定为合格，并添加备注
python main.py --process T001 --judgment 合格 --remarks "经复核，数据正常"
```

### 步骤 4: 导出结果

导出 Markdown 复核单和 JSON 明细：

```bash
# 导出所有格式
python main.py --export T001

# 仅导出 Markdown
python main.py --export T001 --md

# 仅导出 JSON
python main.py --export T001 --json
```

导出的文件位于：
- `data/exported/T001_review.md` - Markdown 复核单
- `data/exported/T001_details.json` - JSON 明细

### 步骤 5: 查看已处理的试验

```bash
python main.py --show T001
```

### 步骤 6: 交互式模式测试

进入交互式模式：

```bash
python main.py
```

在交互式模式下测试以下命令：

```
triaxial> list              # 列出所有试验
triaxial> process T001      # 处理试验 T001
triaxial> show T001         # 显示处理结果
triaxial> override T001 peak 380.0    # 修改峰值强度
triaxial> judge T001 合格 数据正常     # 人工判定
triaxial> export T001       # 导出结果
triaxial> help              # 查看帮助
triaxial> quit              # 退出
```

## 数据格式说明

### 1. 试样登记表 (CSV)

```csv
sample_id,test_id,sample_name,soil_type,depth,water_content,density,test_date,operator,remarks
S001,T001,粉质黏土-1,CL,3.2,28.5,1.85,2026-04-15,张三,常规试验
```

字段说明：
- `sample_id`: 试样编号
- `test_id`: 试验编号
- `sample_name`: 试样名称
- `soil_type`: 土类（按USCS分类）
- `depth`: 埋深 (m)
- `water_content`: 含水率 (%)
- `density`: 密度 (g/cm³)
- `test_date`: 试验日期 (YYYY-MM-DD)
- `operator`: 操作人员
- `remarks`: 备注

### 2. 应力应变曲线 (CSV)

```csv
test_id,strain(%),axial_stress(kPa),deviator_stress(kPa),pore_pressure(kPa),confining_pressure(kPa),time(s)
T001,0.0,0.0,0.0,0.0,200.0,0
T001,0.5,25.3,25.3,12.5,200.0,30
```

字段说明：
- `test_id`: 试验编号
- `strain(%)`: 轴向应变 (%)
- `axial_stress(kPa)`: 轴向应力 (kPa)
- `deviator_stress(kPa)`: 偏应力 (kPa)
- `pore_pressure(kPa)`: 孔隙水压力 (kPa)
- `confining_pressure(kPa)`: 围压 (kPa)
- `time(s)`: 试验时间 (s)

### 3. 饱和度记录 (JSON)

```json
{
  "test_id": "T001",
  "sample_id": "S001",
  "saturation_process": [
    {
      "step": 1,
      "time": "2026-04-15 09:00:00",
      "confining_pressure": 100.0,
      "back_pressure": 50.0,
      "pore_pressure": 45.2,
      "b_value": 0.85,
      "status": "未饱和"
    }
  ],
  "saturation_check": {
    "final_b_value": 0.96,
    "saturation_time_min": 60,
    "is_saturated": true,
    "remarks": "B值达到0.95以上，饱和度合格"
  }
}
```

### 4. 仪器校准表 (JSON)

```json
{
  "instruments": [
    {
      "instrument_id": "INST-001",
      "instrument_name": "三轴试验仪-1",
      "model": "GDS-Advanced",
      "calibration_date": "2025-06-15",
      "calibration_validity": "2026-06-14",
      "status": "正常"
    }
  ],
  "test_instrument_mapping": {
    "T001": "INST-001"
  }
}
```

## 核心计算算法

### 1. 峰值强度计算

- **算法**：最大偏应力法
- **原理**：在应力应变曲线中找到偏应力的最大值
- **输出**：峰值应力 (kPa)、峰值应变 (%)

### 2. 残余强度计算

- **算法**：稳定段平均值法
- **原理**：
  1. 找到峰值点后的数据段
  2. 计算应力变化率，找到变化率最小的稳定段
  3. 取稳定段的平均值作为残余强度
- **备用方法**：末段平均值法（取最后15个点的平均值）

### 3. 孔压异常检测

检测以下三种异常：
1. **突变异常**：相邻点孔压变化超过阈值（默认50kPa）
2. **超围压异常**：孔压超过围压的110%
3. **负值异常**：孔压小于-10kPa

### 4. 破坏时刻识别

多种破坏准则对比：
1. **峰值点法**：偏应力达到最大值的点
2. **应力降法**：峰值后应力下降到95%的点
3. **应变阈值法**：轴向应变达到15%的点
4. **孔压峰值法**：孔隙水压力达到最大值的点

### 5. 校准过期风险评估

基于校准日期和有效期计算：
- **高风险**：已过期
- **中风险**：30天内过期
- **低风险**：90天内过期
- **无风险**：90天以上过期

### 6. 饱和度检查

基于孔压系数B值：
- **阈值**：默认 0.95
- **已饱和**：B值 ≥ 0.95
- **未饱和**：B值 < 0.95

## 配置参数

可以在 `config.py` 中修改以下参数：

```python
TEST_CONFIG = {
    "pore_pressure_anomaly_threshold": 50.0,    # 孔压异常阈值 (kPa)
    "residual_min_points": 10,                    # 残余强度最小点数
    "failure_strain_threshold": 15.0,             # 破坏应变阈值 (%)
    "calibration_validity_days": 365,             # 校准有效期 (天)
    "saturation_b_value_threshold": 0.95,         # 饱和度B值阈值
}

OUTPUT_CONFIG = {
    "markdown_table_format": "grid",               # Markdown表格格式
    "decimal_places": 2,                           # 小数位数
}
```

## 测试用例

### 正常数据测试（T001）

预期结果：
- 峰值强度：约 375.8 kPa
- 残余强度：约 297.0 kPa
- 孔压异常：无
- 饱和度：合格（B=0.96）
- 仪器校准：正常

### 过期仪器测试（T002）

试验 T002 使用的仪器 INST-002 已过期（有效期至 2026-03-19）：

```bash
python main.py --process T002
```

预期结果：
- ⚠️ 警告：试验所用仪器校准已过期
- 自动判定：需复核

## 常见问题

### Q1: 如何添加自己的试验数据？

将数据文件放入 `data/samples/` 目录，确保格式与示例数据一致。或者在命令行中指定文件路径（需要修改代码支持）。

### Q2: 处理后的数据保存在哪里？

- 原始处理结果：`data/processed/{test_id}_processed.json`
- 导出的复核单：`data/exported/{test_id}_review.md`
- 导出的明细：`data/exported/{test_id}_details.json`

### Q3: 如何修改计算参数？

编辑 `config.py` 文件中的 `TEST_CONFIG` 配置项。

### Q4: 支持哪些土类？

支持所有土类，土类代码按 USCS（统一土壤分类系统）：
- CL: 低液限黏土
- CH: 高液限黏土
- ML: 低液限粉土
- SP: 级配不良砂土
- 等等

## 依赖包说明

- **pandas**: 数据处理和 CSV 读取
- **numpy**: 数值计算
- **scipy**: 科学计算（当前版本未直接使用，预留）
- **python-dateutil**: 日期处理
- **tabulate**: 表格格式化输出

## 版本历史

- **v1.0.0** (2026-05-05): 初始版本
  - 实现核心计算功能
  - 实现数据导入导出
  - 实现人工改判功能
  - 提供命令行界面

## 许可证

本工具仅供内部使用。

---

**注意**：本工具生成的结果仅供参考，最终判定应由专业工程师确认。
