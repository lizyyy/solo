# 合同日志采样处理工具

一个用于合同处理和日志采样的命令行工具，支持合同校验、失败记录管理、支付回执管理等功能。

## 功能特性

1. **时间顺序校验** - 自动检测乙方签署时间是否早于甲方
2. **重复提交处理** - 同一合同再次提交时复用旧结果或提示冲突
3. **失败项单独保存** - 失败记录独立存储，方便接手查看
4. **异常样本导出** - 异常样本自动导出，方便同事复核
5. **演示数据生成** - 包含正常合同和故意设置时间顺序错误的测试合同
6. **支付回执管理** - 支持人工备注入库，按调用方查询
7. **清晰的返回码** - 不同错误类型对应不同返回码

## 安装

```bash
pip install -e .
```

## 快速开始

### 运行完整演示

```bash
contract-tool run-demo
```

这个命令会：
1. 生成包含3条正常合同和1条时间顺序错误的测试合同
2. 处理所有合同数据
3. 显示处理结果（带颜色）
4. 导出失败报告
5. 导出异常样本

### 生成演示数据

```bash
# 生成包含错误合同的演示数据
contract-tool generate-demo -o data/demo/batch.json

# 只生成正常合同
contract-tool generate-demo --no-include-error -o data/demo/normal.json
```

### 处理合同数据

```bash
contract-tool process data/demo/batch.json -o output/result.json
```

### 导出失败报告

```bash
contract-tool export-failures -o output/failures_report.json
```

### 按调用方查询支付回执

```bash
contract-tool query-receipts payment_service_001 -o output/receipts.json
```

## 返回码说明

| 返回码 | 说明 |
|--------|------|
| 0 | 全部处理成功 |
| 1 | 通用错误 |
| 2 | 存在失败项 |
| 3 | 存在冲突项（重复提交） |
| 4 | 数据格式错误 |

## 项目结构

```
.
├── contract_tool/
│   ├── __init__.py          # 包初始化
│   ├── models.py            # 数据模型定义
│   ├── storage.py           # 数据存储层
│   ├── processor.py         # 核心业务逻辑
│   ├── demo_data.py        # 演示数据生成
│   └── cli.py               # 命令行接口
├── data/
│   ├── submissions/          # 提交的合同数据
│   ├── results/              # 处理结果
│   ├── failures/             # 失败记录
│   ├── receipts/             # 支付回执
│   └── demo/                 # 演示数据
├── output/
│   ├── abnormal_samples/     # 异常样本导出
│   └── failures_report.json  # 失败报告
├── setup.py
└── requirements.txt
```

## 数据模型

### ContractSubmission（合同提交）
- batch_id: 批次ID
- contract_id: 合同ID
- contract_name: 合同名称
- party_a/party_b: 甲乙双方
- sign_time_a/sign_time_b: 甲乙签署时间
- supplements: 离线合同补充页
- payment_receipts: 支付回执

### ProcessingResult（处理结果）
- status: 处理状态（pending/verified/rejected/conflict）
- failure_type: 失败类型
- error_message: 错误信息
- is_reused: 是否复用旧结果

### FailureRecord（失败记录）
- 包含完整的提交数据，方便复核

### PaymentReceipt（支付回执）
- manual_remark: 人工备注
- caller: 调用方标识

## 演示数据说明

演示数据包含：
- **3条正常合同**：时间顺序正确
- **1条测试合同**：故意设置乙方签署时间早于甲方，用于验证时间顺序校验功能

所有合同都包含：
- 离线合同补充页（2条/合同）
- 支付回执（含人工备注

## 使用场景

### 场景1：首次提交合同批次
```bash
contract-tool process data/batch.json
```

### 场景2：重复提交同一合同
- 如果之前校验通过：自动复用结果
- 如果之前校验失败：返回冲突状态

### 场景3：查看失败原因
```bash
contract-tool export-failures
```

### 场景4：按调用方查看支付回执
```bash
contract-tool query-receipts caller_id
```
