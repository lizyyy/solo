# 轨迹预测缺失修补系统

## 项目概述

轨迹预测缺失修补系统，用于处理轨迹预测过程中的候选记录缺失修补工作流。系统支持候选表导入、参数YAML比对、阈值冲突检测、分层指标更新、问题追踪审计等功能，确保导出、页面、接口读取同一份结果数据。

## 安装依赖

```bash
pip install -r requirements.txt
```

## 运行入口

### a) 基础演示
```bash
python3 track_prediction_patch/examples/demo.py
```
展示完整的三步工作流：候选表导入 → 参数YAML补看 → 分层指标更新，包含阈值冲突的检测和人工处理流程。

### b) 3条重复导入样例
```bash
python3 track_prediction_patch/examples/demo_duplicate_issue.py
```
演示首次导入和追加导入场景，重点展示重复导入检测、状态变化、历史留痕、结果说明等功能。

### c) ⭐ 完整可复现验证（推荐）
```bash
python3 track_prediction_patch/examples/demo_verification.py
```
完整可复现的验证脚本，覆盖重复导入、阈值冲突、多问题并存、问题独立解决、统一结果层等所有核心特性的验证。

## 项目结构

```
track_prediction_patch/
├── __init__.py
├── core/                          # 核心业务逻辑层
│   ├── __init__.py
│   ├── workflow.py                # 三步工作流主入口
│   ├── conflict_detector.py       # 阈值冲突检测器
│   ├── reviewer.py                # 复核与审计模块
│   └── self_check.py              # 四项自检模块
├── models/                        # 数据模型层
│   ├── __init__.py
│   ├── candidate_table.py         # 召回候选表模型
│   ├── param_yaml.py              # 参数YAML模型
│   ├── patch_record.py            # 修补记录与问题模型
│   ├── unified_result.py          # 统一结果层模型
│   └── audit_log.py               # 审计日志模型
├── utils/                         # 工具函数层
│   ├── __init__.py
│   └── helpers.py                 # ID生成、时间、哈希等工具
└── examples/                      # 示例脚本
    ├── __init__.py
    ├── demo.py                    # 基础演示
    ├── demo_duplicate_issue.py    # 3条重复导入样例
    └── demo_verification.py       # 完整可复现验证
```

## 核心三步流程

| 步骤 | 名称 | 说明 | 关键动作 |
|------|------|------|----------|
| 第一步 | 召回候选表导入 | 导入轨迹预测候选记录 | 导入记录、检测重复导入、记录批次信息 |
| 第二步 | 参数YAML补看 | 算法工程师核对参数配置 | 加载YAML、检测阈值冲突、列出证据等待人工确认/驳回 |
| 第三步 | 分层指标更新 | 更新各分层的评估指标 | 写入分层指标、生成统一结果层、标记需要数据科学家复核的状态 |

## 关键设计规则

| 规则编号 | 规则内容 | 设计原因 |
|----------|----------|----------|
| R1 | 阈值冲突不自动拍板，列出证据让用户选确认或驳回 | 避免误判，保留人工决策能力 |
| R2 | 阈值旧值问题不急着归正常，留给数据科学家复核 | 阈值变更影响大，需要专业人员最终确认 |
| R3 | 导出明细、页面展示、接口返回读同一份结果 | 防止多渠道数据不一致，异常记录全渠道可见 |
| R4 | 一条轨迹同时存在多种问题时，所有问题都要在明细中保留 | 问题独立追踪，避免只显示一种导致遗漏 |
| R5 | 解决阈值冲突时，只标记阈值问题已解决，不自动处理重复导入等其他问题 | 问题解耦，每种问题需要独立的解决流程 |
| R6 | 重复导入检测在写入前执行，避免首次导入误判 | 先检查再写入，确保检测准确性 |

## 自检覆盖四项

| 检查项 | 说明 | 严重程度 |
|--------|------|----------|
| duplicate_import | 重复导入检测：检测同一轨迹记录是否被重复导入 | warning |
| old_threshold_report | 阈值旧值检测：候选表报告的阈值与当前YAML阈值不一致 | warning |
| needs_recalculation | 补录重算检测：参数YAML更新后分层指标是否需要重新计算 | error |
| export_consistency | 导出一致性检查：导出数据与统一结果层是否一致 | error |

## 统一结果层使用示例

```python
from track_prediction_patch.core import PatchWorkflow

workflow = PatchWorkflow(created_by="算法工程师小乔")

# ... 执行三步工作流 ...

# 获取统一结果
consistent_result = workflow.get_consistent_result()

# 导出版本
export_data = consistent_result["export"]

# 页面版本
page_data = consistent_result["page"]

# 接口版本
api_data = consistent_result["api"]

# 三个来源的 data_hash 完全一致
assert export_data["data_hash"] == page_data["data_hash"] == api_data["data_hash"]
```

统一结果层字段：
- `tier_metrics`: 分层指标数据
- `track_details`: 轨迹明细（含每条轨迹的问题列表）
- `issues_summary`: 问题汇总（按类型分组统计）
- `data_hash`: 数据哈希，用于校验一致性
- `version`: 结果版本号

## 验证清单

| 验证项 | 验证方式 | 预期结果 |
|--------|----------|----------|
| 首次导入不触发重复导入检测 | 首次导入5条记录，检查duplicate_import问题数 | 0条 |
| 追加导入正确检测重复 | 追加3条重复+2条新增，检查检测数量 | 3条重复 |
| 阈值冲突检测准确 | 候选表阈值0.7，YAML阈值0.8，检查冲突数 | 与记录数一致 |
| 多问题并存保留完整 | 同一轨迹同时有duplicate_import和threshold_mismatch | track_details.issue_types包含两种，issue_description用"|"连接 |
| 阈值解决不影响重复导入 | 解决阈值冲突后，检查重复导入问题状态 | duplicate_import仍为未解决 |
| 统一结果层一致性 | 检查export/page/api三个来源的data_hash | 三者完全相同 |
| 问题独立统计准确 | issues_summary.by_type中duplicate_import的unresolved > 0 | 统计与实际未解决问题一致 |
| 审计日志完整 | 每步操作都有操作人、时间、原因、变更内容 | 所有操作可追溯 |
