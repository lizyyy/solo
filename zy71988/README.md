# 文件上传审计工具

用于接口迁移冻结前的审计追踪，解决迁移清单、报警记录、接口文档混杂时的审计缺口问题。

## 核心功能

1. **变更类型区分**：明确区分"补材料"和"改结论"
2. **可追溯性**：每条结论都能追溯到原始依据（迁移清单/报警记录/文档）
3. **争议识别**：自动识别幂等键失效、时间戳不一致等易争议记录
4. **结构化输出**：供下一班继续排查的审计清单

## 文件结构

- [models.py](file:///Users/lzy/pro/solo/workspaces/zy71988/models.py) - 数据模型定义
- [parsers.py](file:///Users/lzy/pro/solo/workspaces/zy71988/parsers.py) - 多格式数据解析器
- [matcher.py](file:///Users/lzy/pro/solo/workspaces/zy71988/matcher.py) - 关联匹配与争议分析引擎
- [report_generator.py](file:///Users/lzy/pro/solo/workspaces/zy71988/report_generator.py) - 审计报告生成
- [file_upload_audit.py](file:///Users/lzy/pro/solo/workspaces/zy71988/file_upload_audit.py) - 主入口程序

## 快速开始

### 运行示例

```bash
python3 file_upload_audit.py --example
```

会自动生成示例数据并执行完整审计流程。

### 使用真实数据

方式一：自动扫描目录

```bash
python3 file_upload_audit.py -D ./data -o ./output
```

目录中文件命名包含以下关键词即可自动识别：
- `migration` 或 `迁移` - 迁移清单
- `alarm` 或 `报警` - 报警记录
- `doc` 或 `文档` - 接口文档
- `audit` 或 `审计` - 审计日志

方式二：指定单个文件

```bash
python3 file_upload_audit.py \
  -m migrations.json \
  -a alarms.log \
  -d interface_docs.md \
  -l audit_logs.txt \
  -o ./output
```

## 支持的数据格式

- **JSON** - 结构化数据
- **CSV** - 表格数据
- **TXT/MD/LOG** - 文本格式（自动正则解析）

## 输出文件说明

| 文件名后缀 | 用途 | 说明 |
|-----------|------|------|
| `_traceable.txt` | 交接班清单 | 按优先级排序，带证据链追溯 |
| `_report.txt` | 完整报告 | 所有明细与关联关系 |
| `_summary.csv` | 概览统计 | 便于导入Excel |
| `_full.json` | 结构化数据 | 程序后续处理 |

## 争议记录处理

### 幂等键失效识别
- 同一幂等键出现在多条记录中
- 时间跨度超过5分钟或状态不一致
- 自动生成可复核原因与证据链

### 时间戳不一致
- 迁移清单与报警记录时差超过24小时
- 提示时钟不同步或数据滞后

## 变更类型判定规则

| 类型 | 判定条件 |
|------|---------|
| **改结论** | 出现"修改/变更/修正/修复"等关键词 |
| **补材料** | 出现"补充/完善/文档/说明"等关键词 + 无结论修改 |
| **信息补充** | 同时包含材料补充和信息更新 |
| **待确认** | 无法确定，需要人工复核 |

## 追溯格式说明

报告中的引用格式：
```
记录ID@源文件名:行号
```

例如：
- `MIG-003@migrations.json:3` - 迁移清单第3条
- `ALM-0004@alarms.json:4` - 报警日志第4行
- `file_delete:v1.1@interface_docs.md` - 接口文档中的特定版本
