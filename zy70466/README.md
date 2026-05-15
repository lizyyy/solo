# 财务结转表处理工具 (Finance Carrier)

容器镜像标签命令行工具，用于处理多源财务结转表，支持批次号冲突检测、候选清单生成、统一查询等功能。

## 安装

```bash
pip install -e .
```

## 主要功能

- 处理多源财务结转表
- 批次号冲突检测与处理
- 清理/回滚前生成候选清单（安全机制）
- 统一查询入口（成功/异常路径）
- 处理人追踪与审计
- 清晰的错误码和错误信息

## 快速开始

```bash
# 查看帮助
fcarrier --help

# 处理财务结转表
fcarrier process data/samples/normal_finance_data.xlsx

# 查询处理记录
fcarrier query --status all

# 生成回滚候选清单
fcarrier rollback --generate-candidates
```

## 错误码

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1 | 通用错误 |
| 2 | 文件不存在 |
| 3 | 批次号冲突 |
| 4 | 数据验证失败 |
| 5 | 候选清单为空 |
