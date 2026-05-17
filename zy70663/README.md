# 标签重打旧新映射打印状态排查CLI

仓库换系统后旧标签不能扫，管理员需要按SKU和库位批量生成新标签并保留映射。

## 功能特性

- ✅ CSV文件读取和验证
- ✅ 基于SKU+库位的新标签生成
- ✅ 旧标签到新标签的映射关系保留
- ✅ 重复标签和冲突检测
- ✅ 打印状态跟踪
- ✅ 机器可读报告（CSV）和人工可读报告（TXT）生成

## 安装

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 处理CSV文件（生成新标签和报告）

```bash
python label_cli.py process samples/01_normal_input.csv
```

参数说明：
- `-o, --output-dir`: 指定输出目录（默认: output）
- `-v, --verbose`: 显示详细处理信息

### 2. 仅验证CSV数据

```bash
python label_cli.py validate samples/02_dirty_data.csv
```

### 3. 查看输出文件列表

```bash
python label_cli.py list
```

## 样例数据

`samples/` 目录包含测试样例：

- `01_normal_input.csv` - 正常输入数据
- `02_dirty_data.csv` - 包含脏数据和格式问题
- `03_conflict_data.csv` - 包含重复标签和SKU库位冲突
- `04_empty_data.csv` - 空数据测试

## CSV格式要求

必需字段：
- `old_label`: 旧标签编号
- `sku`: SKU编码
- `location`: 库位（格式建议: A-01-01）

可选字段：
- `batch`: 批次号
- `print_status`: 打印状态（pending/printed/failed）

## 输出报告

处理完成后会生成以下4个文件：

1. **label_mapping_*.csv** - 完整的映射报告，包含新旧标签对应关系和错误信息
2. **print_list_*.csv** - 待打印清单，仅包含有效且未打印的记录
3. **conflict_report_*.csv** - 冲突详情报告
4. **summary_report_*.txt** - 人工可读的摘要报告

## 核心规则

### 新标签生成规则

```
WMS-V2-{SKU前8位}-{MD5哈希前8位}
```

哈希基于 `SKU-LOCATION-BATCH` 计算。

### 冲突检测规则

1. **旧标签重复**: 相同旧标签出现在多行
2. **SKU+库位冲突**: 相同SKU+库位被多个旧标签使用
3. **新标签冲突**: 新标签生成重复

## 示例

```bash
# 处理正常数据
python label_cli.py process samples/01_normal_input.csv -v

# 验证脏数据
python label_cli.py validate samples/02_dirty_data.csv

# 查看冲突数据处理结果
python label_cli.py process samples/03_conflict_data.csv
```
