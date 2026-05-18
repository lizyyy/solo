# 口岸仓储代理滞箱费用复核 CLI

基于配置文件驱动的滞箱费用自动复核工具，支持多文件批量处理、输出分类、错误汇总等功能。

## 功能特性

- ✅ **配置驱动**: 所有计算规则放在配置文件中，改口径无需改源码
- ✅ **输出分离**: 查验、节假日、改港、可复跑记录分别输出，不混入正常结果
- ✅ **固定排序**: 结果按固定规则排序，方便用 diff 对比变化
- ✅ **容错处理**: 单个文件/记录解析失败，工具继续处理其他文件，最后汇总错误
- ✅ **多格式支持**: 支持 CSV、Excel (.xlsx, .xls) 格式输入
- ✅ **批量处理**: 支持处理单个文件或整个目录

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 基本用法

```bash
# 处理单个文件
python detention_fee_cli.py sample_data/正常滞箱数据.csv

# 处理多个文件
python detention_fee_cli.py sample_data/正常滞箱数据.csv sample_data/查验记录数据.csv

# 处理整个目录
python detention_fee_cli.py sample_data/
```

### 高级选项

```bash
# 指定配置文件
python detention_fee_cli.py sample_data/ -c my_config.yaml

# 指定输出目录
python detention_fee_cli.py sample_data/ -o my_output

# 显示详细处理信息
python detention_fee_cli.py sample_data/ -v
```

## 输入文件格式

输入文件需要包含以下字段（大小写不敏感，空格自动转换为下划线）：

| 字段名 | 说明 | 必填 |
|--------|------|------|
| BL_NO | 提单号 | 是 |
| CONTAINER_NO | 箱号 | 是 |
| CONTAINER_TYPE | 箱型 (20GP, 40GP, 40HQ) | 是 |
| SHIPPING_LINE | 船公司 | 是 |
| ARRIVAL_DATE | 到港日期 | 是 |
| RELEASE_DATE | 放行日期 | 是 |
| INSPECTION | 是否查验 (Y/N, YES/NO, 是/否, 有/无) | 否 |
| INSPECTION_DATE | 查验日期 | 否 |
| PORT_CHANGE | 是否改港 (Y/N, YES/NO, 是/否, 有/无) | 否 |
| ORIGINAL_PORT | 原港口 | 否 |
| NEW_PORT | 新港口 | 否 |
| REMARKS | 备注 | 否 |

## 输出文件说明

工具会在输出目录生成以下文件：

| 文件名 | 说明 |
|--------|------|
| 正常结果.csv | 正常滞箱费用记录 |
| 查验记录.csv | 包含查验的记录 |
| 节假日记录.csv | 期间包含节假日的记录 |
| 改港记录.csv | 包含改港的记录 |
| 可复跑记录.csv | 备注包含"复核"、"待确认"、"疑问"的记录 |
| 处理汇总.txt | 统计信息和错误详情 |

## 配置文件说明

`config.yaml` 包含所有计算规则：

```yaml
detention_fee_rules:
  free_days:                    # 免箱期设置
    default: 7
    special_lines:              # 特殊船公司免箱期
      MSC: 14
      MAERSK: 10
      COSCO: 12
  
  daily_rates:                  # 每日费率阶梯
    20GP:
      1-7: 150
      8-14: 300
      15+: 450
    40GP:
      1-7: 250
      8-14: 500
      15+: 750
    40HQ:
      1-7: 300
      8-14: 600
      15+: 900
  
  holidays:                     # 节假日列表
    - "2024-01-01"
    - ...

  inspection_exempt_days: 3    # 查验豁免天数
  port_change_penalty: 500     # 改港罚金

output:
  sort_by:                      # 排序规则
    - "container_no"
    - "bl_no"
  output_separate_files: true
  encoding: "utf-8-sig"

input:
  supported_formats:            # 支持的输入格式
    - ".csv"
    - ".xlsx"
    - ".xls"
  date_formats:                 # 支持的日期格式
    - "%Y-%m-%d"
    - "%Y/%m/%d"
    - "%d-%m-%Y"
    - "%d/%m/%Y"
```

## 排序规则

结果默认按 `container_no` -> `bl_no` 排序，可在配置文件中修改 `output.sort_by` 自定义排序字段。

## 可复跑记录判定

备注字段包含以下关键词时，会被归类为"可复跑记录"：
- 复核
- 待确认
- 疑问

## 错误处理

- 单条记录处理失败不影响其他记录
- 单个文件处理失败不影响其他文件
- 所有错误信息会在处理汇总中列出

## 使用示例

### 测试样例数据

```bash
# 处理所有样例数据
python detention_fee_cli.py sample_data/ -v
```

预期输出：
```
开始处理 6 个文件...
  处理: 正常滞箱数据.csv
    成功处理 5 条记录
  处理: 查验记录数据.csv
    成功处理 3 条记录
  处理: 节假日数据.csv
    成功处理 3 条记录
  处理: 改港数据.csv
    成功处理 3 条记录
  处理: 可复跑数据.csv
    成功处理 3 条记录
  处理: 含错误数据.csv
    成功处理 2 条记录

处理完成!
  输出目录: /xxx/output
  正常结果: 9 条
  查验记录: 3 条
  节假日记录: 3 条
  改港记录: 3 条
  可复跑记录: 3 条
  处理失败: 2 条

错误汇总:
  [1] 文件 [含错误数据.csv] 第 3 行处理失败: 无法解析日期: 无效日期
  [2] 文件 [含错误数据.csv] 第 4 行处理失败: 缺少必要日期字段: 提单号=BL202408003, 箱号=MSKU3333333
```

## 项目结构

```
.
├── detention_fee_cli.py      # CLI 主程序
├── config.yaml               # 配置文件
├── requirements.txt          # 依赖列表
├── README.md                 # 使用说明
└── sample_data/              # 业务样例数据
    ├── 正常滞箱数据.csv
    ├── 查验记录数据.csv
    ├── 节假日数据.csv
    ├── 改港数据.csv
    ├── 可复跑数据.csv
    └── 含错误数据.csv
```
