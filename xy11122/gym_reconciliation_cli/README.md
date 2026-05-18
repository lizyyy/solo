# 健身私教馆课包消耗对账 CLI

用于处理健身私教馆课包消耗明细对账的命令行工具，支持异常检测、赠课/转让/冻结识别和报告生成。

## 目录结构

```
gym_reconciliation_cli/
├── data/
│   ├── normal/     # 正常文件
│   ├── bad/        # 问题文件（缺列、重复行、格式错误等）
│   └── empty/      # 空文件
├── src/            # 源代码
├── config/         # 配置文件
├── tests/          # 测试用例
└── reports/        # 输出报告
```

## 使用方法

### 基本使用

```bash
# 处理单个文件
python3 src/reconcile.py data/normal/202605_课包消耗明细_01.csv

# 处理整个目录
python3 src/reconcile.py data/

# 使用指定配置
python3 src/reconcile.py data/ -c config/config.json

# 遇到失败立即停止
python3 src/reconcile.py data/ --no-continue
```

### 输出报告

报告中包含：
- **处理统计**：文件数、行数、成功/失败统计
- **赠课记录**：包含来源文件名和行号
- **转让记录**：包含来源文件名和行号  
- **冻结/解冻记录**：包含来源文件名和行号
- **可复跑项**：标记可修复后重新处理的项目
- **错误详情**：具体错误信息和位置

## 业务规则

### 赠课识别
关键词：`赠课`, `活动`, `奖励`, `节日`
- 来源：[reconcile.py](file:///Users/mac/pro/solo/workspaces/xy11122/gym_reconciliation_cli/src/reconcile.py#L19-L128) 第19-128行

### 转让识别  
关键词：`转让`, `转赠`
- 来源：[reconcile.py](file:///Users/mac/pro/solo/workspaces/xy11122/gym_reconciliation_cli/src/reconcile.py#L20-L130) 第20-130行

### 冻结/解冻识别
关键词：`冻结`, `解冻`, `请假`, `假期`
- 来源：[reconcile.py](file:///Users/mac/pro/solo/workspaces/xy11122/gym_reconciliation_cli/src/reconcile.py#L21-L132) 第21-132行

### 可复跑项输出
- 来源：[reconcile.py](file:///Users/mac/pro/solo/workspaces/xy11122/gym_reconciliation_cli/src/reconcile.py#L180-L248) 第180-248行

## 测试场景

1. **缺列测试**：缺少必要列的文件
2. **重复行测试**：包含重复记录的文件
3. **空文件测试**：空文件或只有表头的文件
4. **部分失败继续处理**：测试 continue_on_failure 功能

运行测试：
```bash
python3 -m pytest tests/ -v
```
