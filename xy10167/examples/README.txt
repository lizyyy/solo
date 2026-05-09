质检抽样复核 CLI - 示例文件说明
================================

文件列表:
---------
1. rules.yaml / rules.json - 抽样规则配置
   - 定义了三种批量范围的抽检规则
   - 包含抽样数量和合格阈值

2. batches.json - 批次数据（包含样本和复检）
   - 3个示例批次
   - B20260501-001: 有1个不合格样本，已复检通过
   - B20260501-002: 有2个不合格样本，未复检
   - B20260502-001: 全部合格

3. declared.json - 申报数据
   - 用于对比计算值与申报值的差异

4. merge_spec.yaml - 批次合并配置
   - 演示如何合并 B20260501-001 和 B20260501-002

5. csv_format/ - CSV格式示例数据
   - batches.csv - 批次信息
   - samples.csv - 样本信息
   - rechecks.csv - 复检记录

6. dirty_data_example.json - 脏数据示例
   - 包含各种格式问题的数据
   - 用于测试数据清理功能

快速使用命令:
-------------
# 生成示例文件
qc-audit init-examples

# 执行审计复核（对比申报数据）
qc-audit audit examples/rules.yaml examples/batches.json -d examples/declared.json

# 合并批次后审计
qc-audit merge examples/rules.yaml examples/batches.json examples/merge_spec.yaml

# 查看历史运行
qc-audit list-runs

# 重新计算历史审计
qc-audit recalc <run_id>

# 生成抽样计划
qc-audit plan 1500 examples/rules.yaml