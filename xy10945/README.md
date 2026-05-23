# 物业水电抄表 CLI 工具

一个本地可运行的物业抄表数据处理工具，支持拍照转录和手填数据的校验。

## 功能特性

- CSV 解析与数据校验
- 倍率换算计算实际用量
- 异常用量检测（基于环比阈值）
- 缺表提示（对比参考表号）
- 多格式输出（终端摘要、JSON、Excel报告）
- 保留原始行号，便于定位问题

## 安装

```bash
pip install -e .
```

或

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 生成示例数据

```bash
meter-cli example
```

### 2. 处理抄表数据

```bash
# 基础用法
meter-cli process 抄表数据.csv

# 指定输出目录
meter-cli process 抄表数据.csv -o ./result

# 设置异常阈值
meter-cli process 抄表数据.csv -t 1.5

# 使用参考表号检测缺表
meter-cli process 抄表数据.csv -r 参考表号.csv

# 指定文件编码和分隔符
meter-cli process 抄表数据.csv -e gbk -d ";"
```

### 3. 查看帮助

```bash
meter-cli --help
meter-cli process --help
```

## CSV 输入格式

必需列：
- `住户`：住户标识
- `表号`：电表/水表编号
- `上月读数`：上期抄表读数
- `本月读数`：本期抄表读数

可选列：
- `倍率`：倍率（默认 1）
- `表类型`：表类型（water/electric，默认 electric）

## 退出码说明

- `0`：处理成功，无错误无异常
- `1`：处理完成但存在错误或异常数据
- `2`：输入错误（文件不存在、格式错误等）
- `3`：未知错误

## 输出文件

1. **终端摘要**：实时显示处理结果统计和错误明细
2. **JSON结果** (`meter_results_*.json`)：机器可读的完整处理结果
3. **Excel报告** (`抄表处理报告_*.xlsx`)：包含以下工作表：
   - 汇总：处理统计信息
   - 有效记录：正常数据
   - 异常用量：超出阈值的记录
   - 错误记录：所有错误明细（含原始数据）
   - 缺表记录：参考表号中缺失的表

## 错误类型

- `missing_field`：缺少必填字段
- `invalid_number`：数值格式无效
- `negative_reading`：读数为负数
- `reading_decreased`：本月读数小于上月
- `abnormal_usage`：用量异常偏离平均值
- `missing_meter`：缺表未抄
