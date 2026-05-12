# 会议纪要行动项 CLI 使用指南

## 项目简介

一个本地可运行的会议纪要行动项管理工具，围绕会议纪要中的行动项拆解、负责人分配、截止日期、依赖关系和完成回收展开。

### 核心特性

- ✅ **自动解析**: 支持 Markdown 和纯文本纪要，自动提取行动项
- 👥 **多负责人**: 支持同一句中多个负责人（如"李研发、赵设计负责..."）
- ⏰ **截止日期**: 识别多种日期格式（YYYY-MM-DD、本周五、明天等）
- 🔗 **依赖关系**: 支持行动项之间的依赖，自动检测阻塞
- 🔄 **幂等性**: 重复导入同一纪要不会重复创建
- 📜 **审计追踪**: 所有修改记录操作者、前后差异和原因
- 📊 **多维度报告**: 按状态、负责人查看，计算闭环率

## 本地启动

### 环境要求

- Python 3.8+
- 依赖：`click`, `rich`

### 安装

```bash
cd /path/to/project
pip3 install click rich
```

### 运行方式

使用 Python 模块方式运行：

```bash
python3 -m meeting_ai.cli [命令] [参数]
```

为方便使用，可以设置别名：

```bash
alias meeting-ai="python3 -m meeting_ai.cli"
```

## 快速开始（主要演示路径）

### 步骤 1: 初始化数据库

```bash
# 清空旧数据（如果有）
rm -rf .meeting-ai

# 初始化
python3 -m meeting_ai.cli init
```

### 步骤 2: 添加参会人和角色

```bash
# 添加角色
python3 -m meeting_ai.cli people add-role "产品经理" --description "负责产品规划"
python3 -m meeting_ai.cli people add-role "研发工程师" --description "负责技术开发"
python3 -m meeting_ai.cli people add-role "测试工程师" --description "负责质量保证"
python3 -m meeting_ai.cli people add-role "设计师" --description "负责UI设计"

# 添加参会人并分配角色
python3 -m meeting_ai.cli people add "张产品" --role "产品经理"
python3 -m meeting_ai.cli people add "李研发" --role "研发工程师"
python3 -m meeting_ai.cli people add "王测试" --role "测试工程师"
python3 -m meeting_ai.cli people add "赵设计" --role "设计师"

# 查看
python3 -m meeting_ai.cli people list
```

### 步骤 3: 生成并导入会议纪要

```bash
# 生成产品会议样例
python3 -m meeting_ai.cli generate samples/product.md --type product

# 生成研发会议样例
python3 -m meeting_ai.cli generate samples/dev.md --type dev

# 生成测试会议样例
python3 -m meeting_ai.cli generate samples/test.md --type test

# 导入纪要
python3 -m meeting_ai.cli import-cmd samples/product.md
python3 -m meeting_ai.cli import-cmd samples/dev.md
python3 -m meeting_ai.cli import-cmd samples/test.md
```

### 步骤 4: 检查状态

```bash
python3 -m meeting_ai.cli check
```

### 步骤 5: 查看报告

```bash
# 查看所有行动项
python3 -m meeting_ai.cli report

# 按负责人分组查看
python3 -m meeting_ai.cli report --by-assignee

# 只看逾期的
python3 -m meeting_ai.cli report --status overdue

# 只看某个负责人
python3 -m meeting_ai.cli report --assignee "李研发"
```

### 步骤 6: 设置依赖关系

```bash
# 查看行动项 ID
python3 -m meeting_ai.cli report

# 假设 #2 依赖 #1
python3 -m meeting_ai.cli update 2 --depends 1 --reason "原型依赖需求文档"

# 再次检查，#2 应该被标记为阻塞
python3 -m meeting_ai.cli check
```

### 步骤 7: 完成行动项

```bash
# 尝试直接完成 #2（应该失败，因为依赖未完成）
python3 -m meeting_ai.cli complete 2 --reason "已完成"

# 先完成依赖 #1
python3 -m meeting_ai.cli complete 1 --reason "需求文档已评审通过"

# 再次检查，阻塞应该解除
python3 -m meeting_ai.cli check

# 现在可以完成 #2
python3 -m meeting_ai.cli complete 2 --reason "原型设计已完成"

# 查看最终状态
python3 -m meeting_ai.cli check
python3 -m meeting_ai.cli report
```

### 步骤 8: 查看历史和审计

```bash
# 查看某个行动项的详细信息和历史
python3 -m meeting_ai.cli detail 1 --history

# 查看所有审计日志
python3 -m meeting_ai.cli audits
```

## 失败路径演示

### 失败场景 1: 重复导入

```bash
# 第一次导入
python3 -m meeting_ai.cli import-cmd samples/product.md

# 第二次导入（应该跳过）
python3 -m meeting_ai.cli import-cmd samples/product.md
# 输出：⚠ 该纪要已导入，跳过重复导入
```

### 失败场景 2: 完成被阻塞的行动项

```bash
# 设置依赖
python3 -m meeting_ai.cli update 2 --depends 1

# 尝试完成 #2
python3 -m meeting_ai.cli complete 2
# 输出：✗ [DEPENDENCIES_INCOMPLETE] 无法完成，依赖未完成: #1
```

### 失败场景 3: 负责人不在名单

```bash
# 导入一个包含未知负责人的纪要
# (系统会给出警告，但仍然导入)
python3 -m meeting_ai.cli import-cmd samples/product.md

# 检查时会看到警告
python3 -m meeting_ai.cli check
# 输出：⚠ [UNKNOWN_ASSIGNEE] 行动项 #X 的负责人 'XXX' 不在名单中
```

### 失败场景 4: 逾期检测

```bash
# 修改一个行动项的截止日期为过去
python3 -m meeting_ai.cli update 1 --due 2024-01-01 --reason "设置为过去日期测试"

# 检查
python3 -m meeting_ai.cli check
# 状态概览中 逾期 数量会增加
```

## 命令详解

### `init` - 初始化数据库

```bash
python3 -m meeting_ai.cli init
```

创建本地 SQLite 数据库（`.meeting-ai/actions.db`）。

### `generate` - 生成样例纪要

```bash
python3 -m meeting_ai.cli generate <输出文件> --type <product|dev|test>
```

内置三种类型的样例：
- `product`: 产品需求评审会议
- `dev`: 技术方案评审会议
- `test`: 测试计划会议

### `import-cmd` - 导入纪要

```bash
python3 -m meeting_ai.cli import-cmd <文件路径> [--operator 操作者] [--force]
```

- 自动解析 Markdown/文本中的行动项
- 基于内容 hash 防止重复导入
- 检测并警告：负责人不在名单、缺少截止日期

### `check` - 检查状态

```bash
python3 -m meeting_ai.cli check
```

- 自动检测并标记逾期
- 自动检测并标记阻塞
- 显示状态概览、错误和警告
- 计算闭环率

### `report` - 生成报告

```bash
python3 -m meeting_ai.cli report [--by-assignee] [--status <状态>] [--assignee <姓名>]
```

状态选项：`pending`, `in_progress`, `blocked`, `overdue`, `done`, `cancelled`

### `detail` - 查看详情

```bash
python3 -m meeting_ai.cli detail <行动项ID> [--history]
```

- 显示行动项完整信息
- `--history` 显示历史修改记录

### `complete` - 标记完成

```bash
python3 -m meeting_ai.cli complete <行动项ID> [--reason 原因] [--operator 操作者]
```

- 检查依赖是否完成
- 记录操作者和原因

### `start` - 标记进行中

```bash
python3 -m meeting_ai.cli start <行动项ID> [--reason 原因]
```

### `cancel` - 取消

```bash
python3 -m meeting_ai.cli cancel <行动项ID> [--reason 原因]
```

### `update` - 修改

```bash
python3 -m meeting_ai.cli update <行动项ID> [--due YYYY-MM-DD] [--assignee 姓名1,姓名2] [--depends ID1,ID2] [--reason 原因]
```

修改时会记录前后差异和操作者。

### `people` 相关

```bash
# 查看参会人和角色
python3 -m meeting_ai.cli people list

# 添加参会人
python3 -m meeting_ai.cli people add <姓名> [--email 邮箱] [--role 角色]

# 添加角色
python3 -m meeting_ai.cli people add-role <角色名> [--description 描述]
```

### `audits` - 审计日志

```bash
python3 -m meeting_ai.cli audits
```

查看最近 100 条操作记录。

## 纪要格式指南

系统可以自动解析以下格式的行动项：

### 负责人格式

- `@张产品 完成需求文档`
- `张产品负责完成需求文档`
- `李研发、赵设计负责设计原型`
- `负责人：张产品、李研发`

### 截止日期格式

- `截止 2026-05-15`
- `截止本周五`
- `明天完成`
- `(2026-05-15)`

### 依赖格式

- `依赖：需求文档`
- `等待：#1 完成`

### 完整示例

```markdown
# 产品需求评审会议
会议时间: 2026-05-10
参会人: 张产品, 李研发, 王测试

## 行动项

1. 张产品负责完成需求文档初稿，截止 2026-05-15
2. 李研发、赵设计负责设计页面原型，截止 2026-05-16，依赖：需求文档
3. @王测试 准备测试用例，截止本周五
4. @张产品 同步业务方确认验收标准
```

## 业务规则

1. **同一句多个负责人**: 使用 `、`, `,`, `和`, `及` 分隔
2. **缺截止日期**: 导入时警告，状态为待办
3. **负责人不在名单**: 导入时警告，检查时持续警告
4. **依赖未完成**: 自动标记为阻塞，无法完成
5. **重复导入**: 基于内容 hash 自动跳过
6. **重复执行/回调**: 所有状态变更幂等
7. **人工修正**: 所有修改记录操作者、前后差异和原因

## 数据存储

所有数据存储在当前目录下的 `.meeting-ai/actions.db`（SQLite 数据库）。

主要表结构：
- `participants`: 参会人
- `roles`: 角色
- `meetings`: 会议
- `action_items`: 行动项
- `audit_logs`: 审计日志
- `import_records`: 导入记录（用于幂等性）

## 状态流转

```
pending (待办)
    ↓
in_progress (进行中) ←→ blocked (阻塞，依赖未完成)
    ↓
done (已完成) 或 cancelled (已取消)

overdue (逾期): pending/in_progress/blocked 状态下截止日期已过
```

## 操作者设置

默认使用当前系统用户名作为操作者。可以通过环境变量覆盖：

```bash
export MEETING_AI_OPERATOR="张三"
```

或在命令中指定：

```bash
python3 -m meeting_ai.cli complete 1 --operator "张三"
```

## 故障排除

### 数据库已存在

```bash
rm -rf .meeting-ai
python3 -m meeting_ai.cli init
```

### 解析不准确

系统使用正则表达式解析，对于复杂格式可能不准确。可以：
1. 使用 `detail` 查看解析结果
2. 使用 `update` 手动修正（会记录差异）
3. 审计日志中可追溯所有修改
