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
pip3 install -r requirements.txt
```

## 使用

```bash
# 查看帮助
python3 -m encoding_inspector --help

# 生成演示数据
python3 -m encoding_inspector generate-demo

# 执行巡检
python3 -m encoding_inspector scan ./data

# 查看报告列表
python3 -m encoding_inspector report list

# 查看指定报告
python3 -m encoding_inspector report show <report_id>

# 查看完整巡检流程
python3 -m encoding_inspector report full <report_id>
```

## 完整巡检流程

1. **生成演示数据**：`python3 -m encoding_inspector generate-demo`
2. **执行编码巡检**：`python3 -m encoding_inspector scan --output markdown`
3. **查看候选清单**：`python3 -m encoding_inspector list-candidates`
4. **添加人工备注**：`python3 -m encoding_inspector add-note <candidate_id> --note "确认清理"`
5. **确认执行操作**：`python3 -m encoding_inspector confirm <candidate_id>`
6. **查看失败项**：`python3 -m encoding_inspector list-failures`
7. **查看巡检报告**：`python3 -m encoding_inspector report list`
8. **查看版本历史**：`python3 -m encoding_inspector version-history`
