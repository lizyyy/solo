# 仓库冻结快照库存释放校验 CLI 工具

用于校验仓库冻结快照中的库存批次，计算可释放和不可释放批次，重点处理批次拆分、负库存、在途占用等异常情况。

## 安装方法

```bash
pip install -e .
```

## 使用方法

### 基本命令

```bash
# 查看帮助
python -m warehouse_validator.cli --help

# 执行校验
python -m warehouse_validator.cli validate <输入文件路径> [选项]
```

### 参数说明

- `INPUT_PATH`: 输入文件路径（支持 CSV 和 Excel 格式）
- `-r, --rules PATH`: 规则文件路径 (JSON格式)
- `-o, --output PATH`: 输出目录路径（默认: ./output）
- `-d, --dry-run`: 试运行模式，不生成输出文件
- `-f, --force`: 覆盖已存在的输出文件

### 示例

```bash
# 使用默认规则校验
python -m warehouse_validator.cli validate examples/正常数据样例.csv -o output

# 使用自定义规则文件
python -m warehouse_validator.cli validate examples/正常数据样例.csv -r examples/规则文件样例.json -o output

# 试运行模式（不生成文件）
python -m warehouse_validator.cli validate examples/正常数据样例.csv --dry-run

# 强制覆盖已存在文件
python -m warehouse_validator.cli validate examples/正常数据样例.csv -o output --force
```

## 输入文件格式

必需列：
- 仓库编号、仓库名称、商品编码、商品名称、批次号
- 库存数量、冻结数量、在途数量、占用数量
- 库龄天数、入库日期、状态

## 输出文件

工具会生成以下 Excel 文件（带时间戳）：
- `*_可释放批次.xlsx` - 符合释放条件的批次
- `*_不可释放批次.xlsx` - 不符合释放条件的批次
- `*_异常情况_负库存.xlsx` - 负库存批次
- `*_异常情况_在途占用.xlsx` - 在途/占用批次
- `*_异常情况_批次拆分.xlsx` - 拆分批次记录
- `*_数据异常行.xlsx` - 格式错误/数据缺失的行

## 规则文件配置

```json
{
  "min_release_qty": 1,
  "max_age_days": 180,
  "allow_negative": false,
  "exclude_status": ["报废", "待检", "冻结"]
}
```

## 不可释放条件

1. 状态在排除列表中（如报废、待检）
2. 库龄超过最大天数
3. 存在冻结数量
4. 库存数量为负
5. 存在在途数量或占用数量
