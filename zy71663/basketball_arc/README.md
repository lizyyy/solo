# 篮球投篮弧线教具

出手角度、初速度与命中窗口的关系分析工具。

## 启动

```bash
cd basketball_arc
python main.py <子命令> [选项]
```

依赖：Python 3.8+，matplotlib（轨迹图/命中窗口图导出时需要，CLI计算不需要）。

## 先放哪份样例

```bash
# 1) 先做数据校验，看清缺项和异常
python main.py validate sample_data.json

# 2) 批量对比
python main.py compare sample_data.json

# 3) 单次计算
python main.py calc --angle 52 --velocity 7.2

# 4) 命中窗口
python main.py window --angle 52 --velocity 7.2

# 5) 导出轨迹图
python main.py export --angle 52 --velocity 7.2 --format png --output shot.png
```

## 子命令

| 命令 | 用途 |
|------|------|
| `calc` | 单次投篮轨迹计算，显示偏差、入筐角、最高点 |
| `window` | 命中窗口：角度-速度网格搜索，找出可命中范围 |
| `compare` | 批量参数对比（从JSON文件读取球员数据） |
| `validate` | 数据校验：检测角度单位错、篮筐高度漏填、速度异常 |
| `export` | 导出轨迹CSV或PNG |
| `history` | 查看历史操作记录 |

## 失败记录在哪看

所有操作的中间痕迹保存在 `basketball_arc/history/` 目录下，每次操作生成一个带时间戳的JSON文件，包含输入参数、校验问题、修正记录、计算结果。

```bash
python main.py history --limit 10
python main.py history --detail 20260530_120000_calc.json
```

## 关键公式与单位

- 重力加速度 g = 9.80665 m/s²
- 轨迹：x = v₀·cos(θ)·t，y = h₀ + v₀·sin(θ)·t − ½gt²
- 角度单位：**度(°)**，不支持弧度输入（弧度值会被检测并换算）
- 速度单位：**m/s**，km/h会被检测并提示
- 篮筐标准高度：3.048 m（10英尺）
- 篮筐内径：0.4572 m（18英寸），球径：0.23876 m（9.4英寸）
- 命中容差 = (篮筐内径 − 球径) / 2 ≈ 0.109 m

## 样例数据说明

`sample_data.json` 含8条球员记录，包含：

- 弧度制角度（0.87 rad ≈ 49.85°）
- 出手高度和篮筐高度缺失
- 速度 36 m/s（疑似 km/h）
- 重复记录
- 角度为负值
- 篮筐高度 2.5m（看起来正常但偏低，cm/m混淆）
- 正常参照数据
