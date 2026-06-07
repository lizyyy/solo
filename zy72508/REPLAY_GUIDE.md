# 知识库失效链接追踪 - 复盘与重跑指南

## 快速开始

### 运行演示
```bash
python3 cli.py demo
```

### 运行完整流程
```bash
python3 cli.py run \
  --model-output ./sample_data/model_output.csv \
  --manual-judgments ./sample_data/manual_judgments.csv \
  --output-dir ./output
```

## 复盘命令

### 1. 查看所有重复用户反馈分组
```bash
python3 cli.py replay -s output/kb_link_tracking_state_XXXXXXXX_XXXXXX.pkl -d
```

### 2. 查看指定分组详情（周姐当时保留/剔除的理由）
```bash
python3 cli.py show-group -s output/kb_link_tracking_state_XXXXXXXX_XXXXXX.pkl -g <group_id>
```

### 3. 查看单条记录完整证据链
```bash
python3 cli.py replay -s output/kb_link_tracking_state_XXXXXXXX_XXXXXX.pkl -r <record_id>
```

## 系统核心特性

### ✅ 自检覆盖
- **重复导入检测**: 同一反馈+链接在多批次中重复导入
- **同一用户反馈重复计入检测**: 同一user_feedback_id出现多次
- **补录后自动重算**: 导入人工改判表后自动重新自检
- **导出一致性校验**: 确保明细、页面、接口读取同一份数据

### ✅ 证据留存
- **模型输出原始行号**: 每条记录保留原始文件行号
- **人工改动记录**: 所有人工改判保留原始行号和理由
- **完整状态变更日志**: 每一次状态变更都有操作人、时间、原因
- **复核理由永久保存**: 周姐的复核决定和理由随记录永久留存

### ✅ 三步流程
1. **模型输出片段第一次导入**: 导入后立即自检，标记重复
2. **标注负责人补看人工改判表**: 补录后自动重算，重复记录**不自动归正常**，留待复核
3. **证据回放更新**: 根据复核决定更新状态，所有操作留痕

### ✅ 统一数据源
- 导出明细CSV
- 页面展示
- API接口返回
- ➡️ 全部读取同一份`UnifiedDataStore`，确保数据完全一致

## 输出文件说明

每次运行后生成以下文件（在`./output`目录）：

| 文件 | 说明 | 用途 |
|------|------|------|
| `*_detail_*.csv` | 明细数据CSV | 导出给Excel处理 |
| `*_detail_*.json` | 明细数据JSON | API返回、程序处理 |
| `*_summary_*.json` | 汇总信息 | 总览统计 |
| `*_state_*.pkl` | 完整状态文件 | **用于复盘和重跑** |
| `*_workflow_*.json` | 流程日志 | 审计追溯 |

## 示例数据说明

### sample_data/model_output.csv
- FB001: 重复2次（相同链接）
- FB002: 重复2次（不同链接）
- FB003~FB006: 各1次（正常）

### sample_data/manual_judgments.csv
- FB001第二条: 标记为重复记录，予以剔除
- FB002两条: 标记为不同链接，都保留
- 其他: 正常人工改判

## 代码结构

```
kb_link_tracker/
├── __init__.py          # 包入口
├── models.py            # 数据模型定义
├── importer.py          # 数据导入模块
├── self_check.py        # 自检核心逻辑
├── store.py             # 统一数据存储
└── workflow.py          # 三步流程处理
cli.py                   # 命令行入口
```

## 关键代码参考

- 数据模型: [models.py](file:///Users/lzy/pro/solo/workspaces/zy72508/kb_link_tracker/models.py)
- 自检逻辑: [self_check.py](file:///Users/lzy/pro/solo/workspaces/zy72508/kb_link_tracker/self_check.py)
- 统一存储: [store.py](file:///Users/lzy/pro/solo/workspaces/zy72508/kb_link_tracker/store.py)
- 三步流程: [workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72508/kb_link_tracker/workflow.py)
