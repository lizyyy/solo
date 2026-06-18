# 深海采样报告汇总工具

港口工程师老何专用 —— 月底复核不再翻烂记录本。

## 先跑哪条命令？

```bash
python -m deep_sea_report --input ./sample_input --output ./output
```

或者更短：

```bash
python -m deep_sea_report -i ./sample_input -o ./output
```

## 跑完看什么？按顺序来

| 顺序 | 文件 | 用途 | 看什么 |
|------|------|------|--------|
| 1 | 终端屏幕 | 快速概览 | 总数、已确认/待补件/退回各多少条 |
| 2 | `output/summary_report.csv` | 汇总表 | 用 Excel 打开，按状态排序筛选 |
| 3 | `output/screenshot_notes.txt` | 截图说明 | **复核专用**，每条记录的问题详情、来源行号、原始内容都在这 |
| 4 | `output/raw_records_with_issues.json` | 原始数据追溯 | 保留原始记录本的一字一句，脏数据不擦除 |

> 💡 老何习惯：先看终端摘要心里有数，再开 CSV 过一遍，最后对着截图说明逐条复核。

## 能干什么

- **指定输入输出目录**：`-i` 输入，`-o` 输出，灵活方便
- **经纬度反写检测**：自动标出哪些行可能把经纬度写反了，保留来源行号
- **保留原始来源**：每条记录都能追溯到哪个文件、第几行、原始内容是什么
- **脏数据不瞎改**：只标记问题，不自动修正，痕迹全留着
- **状态三分法**：已确认 / 待补件 / 退回，月底复核一目了然
- **重跑不丢备注**：上次加的备注、截图说明，下次重跑还在

## 常用操作

### 正常汇总

```bash
python -m deep_sea_report -i ./sample_input -o ./output
```

### 清空历史重新来

```bash
python -m deep_sea_report -i ./sample_input -o ./output --reset
```

## 输入文件格式

支持 CSV / TXT / TSV，自动识别分隔符。

表头里只要包含这些关键字就能认出来（不区分大小写）：

| 字段 | 识别关键字 |
|------|-----------|
| 记录编号 | 编号、id、序号、记录号 |
| 站点名称 | 站点、站号、station、站位、站名 |
| 采样时间 | 时间、日期、time、date、采样时间 |
| 纬度 | 纬度、lat、latitude、北纬、南纬 |
| 经度 | 经度、lon、lng、longitude、东经、西经 |
| 深度 | 深度、水深、depth |
| 温度 | 温度、水温、temp、temperature |
| 盐度 | 盐度、sal、salinity |

### 经纬度写法（都支持）

- 十进制度：`31.2345`、`-25.1234`
- 度分格式：`31°30'N`、`31°30.5'`
- 度分秒格式：`31°30'15"N`
- 带方向标识：`N 31°30'`、`E 121°30'`

## 输出文件说明

### `summary_report.csv`
汇总报表，Excel 友好（UTF-8 BOM 编码）。包含状态、原始经纬度、解析后经纬度、是否反写、问题数量等。

### `screenshot_notes.txt`
截图说明文件。每条记录的详细问题清单、来源行号、原始内容全在这。
老何对着屏幕截图复核的时候，就看这份。

### `raw_records_with_issues.json`
完整原始记录，JSON 格式。保留了从船上记录本读出来的原始内容，
只在旁边追加问题标记，绝不修改原始数据。需要追溯的时候看这个。

### `report_state.json`
状态存档文件。记录了每条记录的备注、截图说明、状态。
下次重跑会自动加载，保证老何之前写的备注不会丢。

## 目录结构

```
.
├── deep_sea_report/          # 工具代码
│   ├── __init__.py
│   ├── __main__.py           # 命令行入口
│   ├── models.py             # 数据模型
│   ├── coordinates.py        # 经纬度解析与反写检测
│   ├── parser.py             # 记录本解析
│   ├── classifier.py         # 状态分类
│   ├── persistence.py        # 持久化与历史状态合并
│   └── report.py             # 报告输出
├── sample_input/             # 示例输入（可直接用来试）
│   ├── log_book_01.csv
│   └── log_book_02.csv
└── README.md                 # 你正在看的这份
```

## 环境要求

Python 3.7+，不需要安装第三方库。
