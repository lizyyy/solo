# 误差传播参数回放

月底封账前用的误差传播计算与参数回放工具。数学老师老叶可以自己指定输入输出目录复跑，
排班同事可以复核"人工确认前后到底改了什么"，所有异常都能追溯到题目清单的原始说法，
不会只给一句含糊警告。

## 功能特点

- **公式符号偏导**：用 sympy 解析公式、求各偏导数（符号解），不是只给数值
- **值与不确定度成对换算**：输入单位（如 mV、kΩ）先统一换算到 SI 基本单位再计算，
  避免"公式写对了但单位一换结果就偏"
- **量纲校验**：自动校验公式结果量纲与 result_unit 是否一致
- **边界样本**：题目清单里夹着除零、单位混用、零不确定度、负开方等边界题，
  方便检验异常处理
- **异常可追溯**：每条异常都带 `trace` 字段，指回题目清单的原始说法
- **人工确认差异**：排班同事填完确认记录后，一表对照"确认前/确认后/差值/依据"
- **版本回放**：参数版本一变更就能重放所有题目，看每个版本下的结果变化

## 目录结构

```
replay.py              # 命令行入口
units.py               # 单位换算 + 量纲代数
error_propagation.py   # 误差传播核心计算
diff.py                # 人工确认前后差异
report.py              # HTML 报告生成
requirements.txt       # Python 依赖
sample_input/          # 样例输入
  题目清单.json        # 8 道题（4 标准 + 4 边界）
  参数版本.json        # 3 个版本的参数变更记录
sample_output/         # 样例输出（运行后生成）
```

## 快速开始

### 1. 安装依赖

需要 Python 3.8+。

```bash
pip install -r requirements.txt
```

唯一核心依赖是 `sympy`（用于符号微分和公式解析）。

### 2. 跑样例

```bash
python replay.py --input sample_input --output sample_output
```

终端会打印简洁的**终端摘要**（只给结论和异常指针），
完整的公式、偏导、追溯链、截图说明全部落到 `sample_output/report.html`，
二者绝不混在一起。

### 3. 查看报告

用浏览器打开 `sample_output/report.html`。报告包含：

- **追溯总览**：从题目清单出发，逐题跳到截图说明
- **参数版本变更日志**：每个版本改了什么
- **题目明细**：每道题一张卡片，所有版本的参数、偏导、结果、异常、截图说明同页
- **异常清单**：所有异常及其在题目清单里的原始说法
- **人工确认前后差异**：排班同事复核用——确认前、确认后、差值、依据一表对照

### 4. 看命令帮助

```bash
python replay.py --help
```

## 输入文件格式

### 题目清单 (`题目清单.json`)

```json
{
  "题目": [
    {
      "id": "Q-001",
      "title": "电阻测量",
      "formula": "V / I",
      "variables": {
        "V": {"value": 10.0, "uncertainty": 0.1, "unit": "V"},
        "I": {"value": 2.0, "uncertainty": 0.05, "unit": "A"}
      },
      "result_unit": "Ω",
      "category": "standard",
      "original_statement": "测得电压 V=10.0±0.1 V，电流 I=2.0±0.05 A，求电阻 R。"
    }
  ]
}
```

- `category` 为 `"boundary"` 时会在报告中高亮（边界样本）
- `original_statement` 是题目清单的原始说法，异常时会追溯到这里

### 参数版本 (`参数版本.json`)

```json
{
  "版本": [
    {
      "version": "v1.0",
      "description": "初版参数",
      "overrides": {}
    },
    {
      "version": "v1.1",
      "description": "修正后",
      "overrides": {
        "Q-001": {"I": {"uncertainty": 0.02}}
      }
    }
  ]
}
```

`overrides` 按题目 ID 分组，只改需要改的变量字段。

## 人工确认流程

1. 首次运行会在输出目录生成 `确认记录.json` 模板，所有条目状态为 `pending`
2. 排班同事逐条核对：
   - 确认无误：`status` 填 `"confirmed"`
   - 需要修正：`status` 填 `"adjusted"`，并写 `confirmed_value`、`confirmed_uncertainty`、`确认说明`
3. 重新运行 `replay.py`，报告底部就会出现"人工确认前后差异"表

## 支持的单位

基本量纲：kg、m、s、A、K。

常用单位：V、mV、kV、A、mA、Ω、kΩ、MΩ、m、cm、mm、km、
s、ms、min、h、kg、g、mg、Hz、kHz、N、J、kJ、W、mW、kW、
Pa、kPa、MPa、K、% 等。

复合单位用 `*` 和 `/` 和 `^` 组合，如 `m/s^2`、`kg*m/s^2`。

## 老叶复核路径（从题目清单追到截图说明）

1. 打开 `report.html`
2. 看顶部"追溯总览"表，点某题的"截图说明↗"
3. 跳到题目卡片，蓝色追溯链一目了然：题目清单 → 公式 → 偏导数 → 结果/异常 → 截图说明
4. 异常的话，红色异常框里有完整 trace，黄色块是题目清单原始说法
5. 卡片末尾的【截图说明】pre 块是可直接截图留档的完整文字说明
