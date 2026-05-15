# 数据导入差异命令行工具

用于物业报修单数据导入、差异比较、字段溯源的命令行工具。

## 功能特性

- ✅ **跨天物业报修单样例数据生成
- ✅ **来源混杂问题记录** - 每条字段标记来源系统
- ✅ **失败项单独保存** - 包含完整输入数据和错误原因
- ✅ **边界记录测试** - 报告中显示输入和失败原因
- ✅ **字段溯源** - 每个字段可追溯到原始来源
- ✅ **本地持久化** - 重启后仍可查询历史数据
- ✅ **灰度发布备忘** - 人工修正记录带字段路径和处理依据

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 一键完整演示

```bash
python cli.py full-demo
```

这将自动执行完整流程：
1. 生成样例数据
2. 批量导入数据
3. 添加灰度发布备忘人工修正记录
4. 生成完整报告

## 详细使用说明

### 生成样例数据

```bash
python cli.py generate-samples [output_file]
```

### 批量导入数据

```bash
python cli.py import-batch <input_file>
```

### 查看导入批次列表

```bash
python cli.py list-batches
```

### 生成导入报告

```bash
python cli.py generate-report <batch_id> <output_file>
```

### 查看工单详情（含字段溯源）

```bash
python cli.py show-order WO2024051011
```

### 查看失败记录

```bash
python cli.py show-failures [batch_id]
```

### 添加人工修正记录

```bash
python cli.py add-correction <order_id> <field_path> <new_value> <reason> <source> <processing_basis> [--gray-release]
```

示例（灰度发布备忘）：
```bash
python cli.py add-correction WO2024051011 status 已完成 "状态更新异常" "运维团队" "灰度发布备忘录第3条" --gray-release
```

### 查看人工修正记录

```bash
python cli.py list-corrections [order_id]
```

## 样例数据说明

样例数据包含 **13条记录**，分布如下：

### 正常记录（10条）
- 跨天报修日期：2024-05-10 ~ 2024-05-12
- 来源系统：物业系统A、物业系统B、报修小程序、人工录入
- 报修类型：水电、空调、电梯、门窗、消防
- 楼栋：A栋、B栋、C栋、D栋

### 来源混杂记录（1条）
- **工单ID**: WO2024051011
- **各字段来源：
  - order_id: 物业系统A（自动编号）
  - description: 电话报修（人工转录）
  - assignee: 调度系统B（自动分配）
  - status: 移动端APP（师傅更新）

### 边界失败记录（2条）

1. **缺少字段测试** (WO2024051012)
   - 缺少必填字段：repair_type、report_date
   - 错误类型：VALIDATION_ERROR
   - 失败原因：缺少必填字段

2. **格式错误测试** (WO12)
   - order_id长度不足5位
   - report_date格式错误(2024/05/11)
   - 错误类型：VALIDATION_ERROR

## 主流程说明

```
输入JSON文件
    ↓
[1. 数据验证
    ├─ 检查必填字段
    ├─ 验证字段格式
    └─ 提取字段溯源元数据
    ↓
[2. 数据处理
    ├─ 日期格式转换
    ├─ 构建工单对象
    └─ 保存字段来源信息
    ↓
[3. 差异比较
    ├─ 与已有工单对比
    └─ 记录字段变更记录
    ↓
[4. 持久化存储
    ├─ 成功工单 → 保存到数据库
    └─ 失败记录 → 单独保存（含原始输入和错误原因）
    ↓
[5. 生成报告
    ├─ 批次统计信息
    ├─ 失败记录详情（含原始输入）
    └─ 差异变更记录
```

## 失败路径说明

工具会捕获并保存以下类型的失败：

### 1. VALIDATION_ERROR - 验证失败
- 缺少必填字段
- 字段格式错误（如日期格式）
- 字段长度不符合要求

### 2. PROCESSING_ERROR - 处理失败
- 数据类型转换失败
- 日期解析失败

每个失败记录包含：
- 完整的原始输入数据
- 详细的错误信息
- 字段溯源信息
- 处理建议
- 失败时间戳

## 字段溯源说明

每个字段都包含以下溯源信息：
- **field_path**: 字段路径（如"description"）
- **source**: 来源系统（如"电话报修"）
- **source_type**: 来源类型（如"人工转录"）
- **processing_rule**: 处理规则（如"WO+日期+序号"）
- **raw_value**: 原始值
- **processed_value**: 处理后的值

## 灰度发布备忘人工修正记录

人工修正记录包含：
- 字段路径：明确标记修改的字段
- 原值/新值：变更前后对比
- 原因：修正原因说明
- 来源：修正操作来源
- 处理依据：参考的处理规则或备忘录条款
- 灰度发布标记：是否为灰度发布相关修正

## 数据持久化

数据存储在 `./data/db.json` 文件中，包含：
- repair_orders: 成功导入的工单
- failed_records: 失败记录
- import_results: 导入批次结果
- manual_corrections: 人工修正记录

**重启程序后所有历史数据仍可查询！

## 目录结构

```
.
├── cli.py                      # 命令行入口
├── requirements.txt             # 依赖文件
├── data_diff_tool/
│   ├── __init__.py         # 包初始化
│   ├── models.py           # 数据模型
│   ├── storage.py          # 存储层
│   ├── processor.py        # 核心处理逻辑
│   └── sample_data.py    # 样例数据生成
└── data/                   # 数据存储目录
```

## 注意事项

1. 失败记录会单独保存为JSON文件，方便其他人接手时可以直接查看原因
2. 报告中包含边界记录的完整输入数据和失败原因，便于问题排查
3. 所有字段都保留了来源信息，可追溯到原始输入来源
