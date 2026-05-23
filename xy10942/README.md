# 会议纪要行动项CLI

一个本地可运行的Python命令行工具，用于从Markdown格式的会议纪要中提取、管理和跟踪待办事项。

## 功能特性

### 核心功能
- **Markdown解析**: 智能识别会议纪要中的待办事项列表
- **负责人归并**: 自动按负责人分组统计待办事项
- **日期识别**: 支持多种日期格式（YYYY-MM-DD、YYYY/MM/DD、MM-DD、YYYY年MM月DD日等）
- **延期标记**: 自动识别已延期的任务（截止日期早于当前日期）
- **看板导出**: 生成多种格式的输出报告

### 输出格式
1. **终端摘要**: 实时显示统计信息，包括按负责人和状态分组的统计
2. **机器可读结果**: JSON和CSV格式，方便后续处理和集成
3. **人类可读报告**: Markdown格式，包含表格视图和异常行

### 输入校验与错误处理
- 检查输入文件是否存在
- 验证输入文件是否为Markdown格式
- 检查输出路径是否为有效目录
- 保留异常/坏行的原始位置信息

### 重复运行规则
- **覆盖模式**（默认）: 每次运行会覆盖已有报告文件
- **追加模式**（`-a` 选项）: 将新结果追加到已有报告文件

## 使用方法

### 基本用法
```bash
python3 action_items_cli.py -i meeting_notes.md
```

### 指定输出目录
```bash
python3 action_items_cli.py -i meeting_notes.md -o ./my_output
```

### 追加模式
```bash
python3 action_items_cli.py -i meeting_notes.md -a
```

### 自定义状态关键词
```bash
python3 action_items_cli.py -i meeting_notes.md -s Todo InProgress Done Blocked
```

### 完整帮助
```bash
python3 action_items_cli.py -h
```

## 命令行参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--input` | `-i` | 输入Markdown会议纪要文件路径（必需） | - |
| `--output` | `-o` | 输出目录 | `./action_items_output` |
| `--append` | `-a` | 追加模式，不覆盖已有报告 | False |
| `--status` | `-s` | 自定义状态关键词列表 | 待办 进行中 完成 阻塞 延期 |
| `--verbose` | `-v` | 显示详细信息 | False |

## 支持的待办事项格式

### 1. GitHub风格任务列表
```markdown
- [ ] @张三 完成项目需求文档 2026-05-20
- [x] @李四 已完成任务
```

### 2. 普通列表项
```markdown
- @王五 进行系统测试 2026-05-25
* 未分配任务 待办
```

### 3. 编号列表
```markdown
1. 负责人：王五 准备测试环境 2026-05-18
```

### 4. 待办前缀
```markdown
待办：召开需求评审会议 2026-05-19
```

### 5. 延期原因标记
```markdown
- [ ] @李四 开发用户登录模块 2026-05-15 延期原因: 依赖接口未就绪
```

## 输出文件说明

运行后会在输出目录生成以下文件：

1. **action_items.json** - JSON格式的完整数据
2. **action_items.csv** - CSV格式的数据表格
3. **action_items_report.md** - 给同事看的美观报告

## 报告内容示例

### Markdown报告包含：
- 概览统计（总计、异常、延期数量）
- 按负责人分类的表格视图
- 按状态分类的任务列表
- 异常行（保留原始位置信息）

## 数据字段说明

每个行动项包含以下字段：

| 字段 | 说明 |
|------|------|
| `content` | 任务内容 |
| `assignee` | 负责人 |
| `due_date` | 截止日期 |
| `status` | 状态 |
| `delay_reason` | 延期原因 |
| `line_number` | 原始行号 |
| `raw_line` | 原始行内容 |
| `is_valid` | 是否为有效任务 |
| `source_file` | 源文件名 |
| `is_delayed` | 是否延期 |

## 示例

### 输入示例 (meeting_notes.md)
```markdown
# 项目周会纪要

## 待办事项
- [ ] @张三 完成项目需求文档 2026-05-20
- [ ] @李四 开发用户登录模块 2026-05-15 延期原因: 依赖接口未就绪
- [ ] @王五 进行系统测试 2026-05-25
- [ ] 未分配任务 待办
```

### 终端输出
```
正在处理文件: meeting_notes.md
输出目录: ./action_items_output
模式: 覆盖已有报告

============================================================
会议纪要行动项摘要
============================================================

总计: 4 个有效行动项
异常: 0 个异常行

按负责人统计:
  张三: 1 项 (延期: 0)
  李四: 1 项 (延期: 1)
  王五: 1 项 (延期: 0)
  未分配: 1 项 (延期: 0)

按状态统计:
  待办: 4 项

============================================================
JSON报告已生成: action_items_output/action_items.json
CSV报告已生成: action_items_output/action_items.csv
Markdown报告已生成: action_items_output/action_items_report.md

处理完成!
```

## 依赖要求

- Python 3.6+
- 标准库（无需额外安装依赖）

## 许可证

MIT License
