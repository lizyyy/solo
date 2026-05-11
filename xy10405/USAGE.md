# 外包工时争议 CLI 使用说明

## 安装依赖

```bash
pip install -r requirements.txt
```

## 命令概览

| 命令 | 说明 |
|------|------|
| `python worklog.py import <文件> --type <类型>` | 导入数据 |
| `python worklog.py analyze` | 分析争议 |
| `python worklog.py disputes` | 列出争议 |
| `python worklog.py dispute_detail <争议ID>` | 查看争议详情 |
| `python worklog.py add_note <争议ID> <备注>` | 添加处理备注 |
| `python worklog.py resolve <争议ID> --status <状态>` | 解决争议 |
| `python worklog.py adjust <工时ID> <新工时> <原因>` | 人工调整工时 |
| `python worklog.py report` | 生成结算报告 |
| `python worklog.py stats` | 查看数据统计 |

## 数据类型

- `worklogs`: 外包日报
- `tasks`: 任务看板导出
- `acceptance`: 客户验收意见

## 争议类型

| 类型 | 说明 | 处理影响 |
|------|------|----------|
| `overtime` | 超时 | 超过每日最大工时（默认8小时）的部分不计入 |
| `no_task` | 无对应任务 | 该工时全部不计入 |
| `unaccepted` | 未验收 | 工时暂扣，待验收后结算 |
| `duplicate` | 重复日报 | 重复的日报不计入 |
| `rejected` | 客户驳回 | 客户明确驳回的工时不计入 |

## 完整流程演示

### 第一步：初始化并导入数据

```bash
# 先删除旧数据（如果有）
rm -rf .worklog_data

# 导入任务看板
python worklog.py import samples/task_board.csv --type tasks

# 导入验收意见
python worklog.py import samples/acceptance.csv --type acceptance

# 导入日报
python worklog.py import samples/daily_reports.csv --type worklogs

# 再次导入同一个日报文件（应该提示重复）
python worklog.py import samples/daily_reports.csv --type worklogs

# 查看统计
python worklog.py stats
```

### 第二步：分析争议

```bash
# 运行争议分析
python worklog.py analyze
```

你应该看到类似输出：
```
发现以下争议:
  重复日报: 1 条
  超时: 2 条
  无对应任务: 1 条
  客户驳回: 2 条
  未验收: 2 条
```

### 第三步：查看争议列表

```bash
# 查看所有争议
python worklog.py disputes

# 只看待处理的
python worklog.py disputes --status open

# 按类型过滤
python worklog.py disputes --type overtime
```

### 第四步：查看争议详情并处理

```bash
# 查看某个争议的详情（替换 <争议ID> 为实际ID）
python worklog.py dispute_detail DSP-xxxxxxx

# 添加备注
python worklog.py add_note DSP-xxxxxxx "与外包团队确认中"

# 处理一个超时争议：接受系统建议调整
python worklog.py resolve DSP-xxxxxxx --status resolved --note "确认超时，按8小时计算"

# 处理一个无任务争议：确实没有对应任务，放弃结算
python worklog.py resolve DSP-xxxxxxx --status waived --note "确认无对应任务，放弃结算"

# 处理一个未验收争议：等待客户验收，标记为pending
python worklog.py resolve DSP-xxxxxxx --status pending --note "等待客户下周验收"

# 或者直接调整工时记录
python worklog.py adjust LOG-xxxxxxxx 6 "实际只工作了6小时"
```

### 第五步：生成结算报告

```bash
# 终端显示报告
python worklog.py report

# 导出为文本文件
python worklog.py report -o settlement_report.txt

# 导出为JSON
python worklog.py report --format json -o settlement_report.json
```

报告将清晰显示：
- 总工时和总金额
- 可结算工时和金额
- 暂不可结算工时和金额（标注原因）
- 待处理争议列表

### 第六步：重新导入新数据并重新计算

```bash
# 假设有新的日报文件
# python worklog.py import new_reports.csv --type worklogs

# 重新分析（会识别新的争议，不重复已有争议）
python worklog.py analyze

# 查看更新后的报告
python worklog.py report
```

## 样例数据说明

`samples/` 目录包含的测试数据覆盖了所有争议场景：

| 场景 | 数据行 | 说明 |
|------|--------|------|
| 正常工时 | 张三 5/1-2 任务001, 李四 5/1-2 任务003 | 已验收，无争议 |
| 超时 | 张三 5/3 任务002 (10小时) | 超过8小时，争议2小时 |
| 重复日报 | 张三 5/3 任务002 (重复8小时) | 同日同任务重复提交 |
| 无任务 | 张三 5/4 任务999 | TASK-999 不在看板中 |
| 客户驳回 | 张三5/3、李四5/3 任务002/004 | 验收记录标记为驳回 |
| 未验收 | 李四5/4 任务005 | 无验收记录 |

## 注意事项

1. **重复导入保护**：同一内容的文件重复导入会自动跳过
2. **人工调整历史**：所有 `adjust` 操作都会记录前后差异，可在 `log_detail` 中查看
3. **争议不重复创建**：`analyze` 命令不会重复创建相同类型的争议
4. **数据持久化**：所有数据保存在 `.worklog_data/` 目录，JSON格式可直接查看

## 典型工作流

项目经理日常：

1. 月末收到外包日报、看板导出、验收邮件
2. 用 `import` 命令分别导入三类数据
3. 运行 `analyze` 自动识别争议
4. 用 `disputes` 查看争议列表
5. 逐个 `dispute_detail` 查看，与外包/客户沟通
6. 用 `add_note` 记录沟通进展
7. 用 `resolve` 或 `adjust` 处理后运行 `report`
8. 根据报告中的「可结算金额」付款，「暂不可结算」部分标注原因
