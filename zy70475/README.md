# 文件编码巡检工具

一个功能完整的命令行文件编码巡检工具，支持批量检测、候选清单确认、异常样本留存等功能。

## 功能特性

- 批量文件编码检测
- 过期审批催办列表演示数据
- 候选清单生成与人工确认机制
- 异常样本单独留存
- 失败项单独保存
- 多格式输出（JSON、Markdown）
- 版本冻结通知追踪

## 安装

```bash
pip install -r requirements.txt
```

## 使用

```bash
# 查看帮助
python -m encoding_inspector --help

# 生成演示数据
python -m encoding_inspector generate-demo

# 执行巡检
python -m encoding_inspector scan ./data

# 查看报告
python -m encoding_inspector report
```
