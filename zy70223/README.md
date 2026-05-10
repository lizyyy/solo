# 机房跳线变更审计器

## 安装运行

```bash
pip install -r requirements.txt
```

## 样例入口

样例数据在 `samples/` 目录下，包含：
- `port_ledger.csv` - 端口台账
- `change_orders.json` - 变更单
- `expected_links.csv` - 预期链路

## 核心操作

### 1. 导入端口台账
```bash
python audit.py import --ledger samples/port_ledger.csv
```

### 2. 应用变更单
```bash
python audit.py apply --change samples/change_orders.json
```

### 3. 校验链路
```bash
python audit.py verify --expected samples/expected_links.csv
```

## 如何检查结果

- 查看终端输出：处理行数、跳过的坏行、需要人工确认的记录
- 检查 `data/` 目录：
  - `current_state.json` - 当前状态（幂等，重跑不膨胀）
  - `audit_report.json` - 审计报告
  - `issues.csv` - 问题记录
