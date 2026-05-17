# Logfmt Structured CLI

解析混合了logfmt和自由文本格式的老服务日志文件，提取结构化字段，保留坏行记录。

## 安装

```bash
pip install -e .
```

## 使用示例

```bash
# 解析日志文件
logfmt parse logs/test.log

# 指定输出目录
logfmt parse logs/test.log -o output_dir

# 按时间排序
logfmt parse logs/test.log -s

# 静默模式
logfmt parse logs/test.log -q
```

## 输入目录结构

```
logs/
├── test.log        # 你的日志文件
└── ...
```

## 输出文件

```
logfmt_output/
├── test.ndjson         # 结构化的日志数据 (每行一个JSON)
├── test_bad.ndjson     # 无法解析的坏行记录
└── test_report.txt     # 可分享的分析报告
```

## 功能特性

- ✅ logfmt字段自动解析
- ✅ 类型自动转换 (int, float, bool, null)
- ✅ 坏行保留，包含原始位置和原因
- ✅ 字段统计分析
- ✅ 时间戳解析和排序
- ✅ NDJSON格式输出，便于机器处理
- ✅ 人类可读的终端摘要和报告
- ✅ 友好的错误处理，不抛traceback
