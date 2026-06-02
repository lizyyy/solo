# 异常交易规则蒸馏评测工具

专为模型评测同事小孟设计的AI/ML评测工具，实现样本、模型输出、人工复核、指标对比和报告的闭环管理。

## 核心特性

1. **来源可追溯** - 每条规则蒸馏结果都能追到原始来源和处理时间
2. **版本不覆盖** - 模型版本变更后旧报告永久保存，不会被无声覆盖
3. **备注补录** - 支持临时补充备注，补录前后差异清晰可见
4. **差异分离** - 重跑同一批样本时，指标变化和样本变化可分开解释
5. **判断留痕** - 完整记录判断过程，别人接手时无需再问

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 一键运行演示

```bash
python run_demo.py
```

## 完整使用流程

### 1. 初始化数据库

```bash
python cli.py init
```

### 2. 导入数据

```bash
# 导入样本数据
python cli.py import-data samples examples/samples.json

# 导入模型输出（指定版本号）
python cli.py import-data model-outputs examples/model_outputs_v1.json v1.0 --description "基线版本"

# 导入阈值配置
python cli.py import-data thresholds examples/thresholds.json
```

### 3. 规则蒸馏

```bash
python cli.py distill v1.0
```

### 4. 查看规则列表

```bash
# 查看所有规则
python cli.py list-data rules

# 按版本筛选
python cli.py list-data rules --model-version v1.0
```

### 5. 规则溯源（关键功能）

```bash
python cli.py trace <规则ID>

# 导出溯源信息到文件
python cli.py trace <规则ID> -o trace_output.json
```

### 6. 人工复核

```bash
# 通过
python cli.py review <规则ID> 小孟 通过 --comment "规则正确，来源可查"

# 不通过
python cli.py review <规则ID> 小孟 不通过 --comment "引用缺失" --corrected-rule "修正后的规则内容"

# 需要修改
python cli.py review <规则ID> 小孟 需要修改 --comment "置信度偏低"
```

### 7. 添加备注

```bash
python cli.py add-note <规则ID> "这是一条临时补充的备注说明" --created-by 小孟
```

### 8. 生成报告

```bash
python cli.py report v1.0 --report-name "v1.0版本评测报告" --created-by 小孟
```

### 9. 导出报告

```bash
python cli.py export-report <报告ID> report_output.json
```

### 10. 版本对比

```bash
python cli.py compare v1.0 v2.0
```

### 11. 查看数据

```bash
# 查看所有模型版本
python cli.py list-data versions

# 查看所有报告
python cli.py list-data reports

# 查看阈值配置
python cli.py list-data thresholds
```

## 数据结构

### 核心数据表

1. **samples** - 样本数据
2. **model_versions** - 模型版本管理
3. **model_outputs** - 模型输出结果
4. **thresholds** - 阈值配置
5. **rule_distillations** - 规则蒸馏结果（核心）
6. **reviews** - 人工复核记录
7. **notes** - 备注信息
8. **reports** - 评测报告
9. **comparison_history** - 版本对比历史

## 典型工作流

```
小孟的一天：
1. 跑一小包材料 → import-data samples + model-outputs
2. 批量蒸馏规则 → distill
3. 查看规则质量 → list-data rules
4. 发现问题，临时补备注 → add-note
5. 人工复核重点案例 → review
6. 生成评测报告 → report
7. 月底复盘时，对比新旧版本 → compare
8. 拿出报告解释指标变化 → export-report
```

## 文件说明

- [database.py](file:///Users/lzy/pro/solo/workspaces/zy72187/database.py) - 数据库模型定义
- [core.py](file:///Users/lzy/pro/solo/workspaces/zy72187/core.py) - 核心业务逻辑
- [cli.py](file:///Users/lzy/pro/solo/workspaces/zy72187/cli.py) - 命令行接口
- [run_demo.py](file:///Users/lzy/pro/solo/workspaces/zy72187/run_demo.py) - 演示脚本
- [examples/](file:///Users/lzy/pro/solo/workspaces/zy72187/examples) - 示例数据目录
