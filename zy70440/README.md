# 路径归并工具 (Path Merger)

售后录音权限路径归并命令行工具，用于检测和分析客服坐席在处理售后录音时的权限路径与实际访问路径的差异，识别权限放大等问题。

## 功能特性

- ✅ **路径归并核心算法**：智能合并权限路径与实际访问路径
- ✅ **权限放大检测**：自动识别实际访问超出权限范围的情况
- ✅ **跨天录音检测**：检测跨零点的售后录音会话
- ✅ **数据完整性校验**：检测缺失数据和格式错误
- ✅ **结果缓存机制**：支持重复提交时复用历史结果，检测内容冲突
- ✅ **统一查询入口**：按批次、状态、问题类型等多维度查询
- ✅ **失败项单独保存**：便于后续人工处理和接手
- ✅ **人工修正记录**：支持人工审核修正并标注来源和处理依据
- ✅ **详细报告生成**：处理前后对比、执行时间统计、改进建议
- ✅ **自检测试程序**：覆盖各种边界情况的自动化测试

## 安装

```bash
pip install -r requirements.txt
pip install -e .
```

## 快速开始

### 1. 生成样例数据

```bash
path-merger gen-sample
```

### 2. 使用样例数据运行处理

```bash
path-merger process --sample
```

### 3. 运行自检程序

```bash
path-merger self-test
```

## 命令详解

### 处理路径归并

```bash
# 使用样例数据
path-merger process --sample --batch-id MY_BATCH_001

# 使用自定义数据文件
path-merger process --input ./data/samples/my_data.json

# 不使用缓存
path-merger process --sample --no-cache

# 不生成报告
path-merger process --sample --no-report
```

### 查询处理结果

```bash
# 查询所有记录
path-merger query

# 按批次查询
path-merger query --batch-id SAMPLE_20240515

# 按状态查询
path-merger query --status failed

# 按问题类型查询（权限放大）
path-merger query --issue-type permission_over_grant

# 按坐席查询
path-merger query --agent-id AGENT_003

# 输出JSON格式
path-merger query --format json

# 简要输出
path-merger query --format brief
```

### 生成报告

```bash
# 生成并显示报告
path-merger report --batch-id SAMPLE_20240515

# 保存报告到文件
path-merger report --batch-id SAMPLE_20240515 --output ./my_report.txt
```

### 查看统计信息

```bash
# 全局统计
path-merger stats

# 按批次统计
path-merger stats --batch-id SAMPLE_20240515

# 详细统计
path-merger stats --detail
```

### 人工修正记录

```bash
path-merger fix RECORD_ID_001 "/correct/path1" "/correct/path2" \
    --reason "人工审核确认：这些路径属于正常业务范围"
```

### 缓存管理

```bash
# 清除指定批次缓存
path-merger clear-cache --batch-id SAMPLE_20240515

# 清除所有缓存
path-merger clear-cache

# 强制清除（不提示）
path-merger clear-cache --force
```

### 生成样例数据

```bash
path-merger gen-sample

# 保存到指定位置
path-merger gen-sample --output ./my_samples.json
```

### 运行自检

```bash
path-merger self-test
```

## 数据格式

### 输入记录格式

```json
[
  {
    "record_id": "SAMPLE_20240515_001",
    "batch_id": "SAMPLE_20240515",
    "source": "after_sales_recording",
    "recording_id": "REC_20240515_0900_A001",
    "agent_id": "AGENT_001",
    "customer_id": "CUST_10001",
    "start_time": "2024-05-15T09:00:00",
    "end_time": "2024-05-15T09:15:00",
    "permission_path": [
      "/customer/profile/basic",
      "/customer/service/history"
    ],
    "actual_path": [
      "/customer/profile/basic",
      "/customer/service/history",
      "/customer/service/detail"
    ]
  }
]
```

## 项目结构

```
path_merger/
├── __init__.py          # 包初始化
├── models.py            # 数据模型定义
├── merger.py            # 路径归并核心逻辑
├── cache.py             # 缓存管理和冲突检测
├── query.py             # 统一查询引擎
├── reporter.py          # 报告生成器
├── sample_data.py       # 样例数据生成
└── cli.py               # 命令行接口
data/
├── samples/             # 样例数据目录
├── cache/               # 缓存目录
├── results/             # 处理结果目录
├── failed/              # 失败记录目录
├── manual_fixes/        # 人工修正记录目录
└── reports/             # 报告输出目录
main.py                  # 主入口文件
requirements.txt         # 依赖列表
setup.py                 # 安装配置
README.md                # 项目文档
```

## 检测的问题类型

| 问题类型 | 说明 |
|---------|------|
| permission_over_grant | 权限被误放大，实际访问路径超出权限范围 |
| path_mismatch | 路径长度不匹配 |
| cross_day_boundary | 录音跨天（跨越零点） |
| missing_data | 数据缺失（权限路径或实际路径为空） |
| format_error | 格式错误 |
| duplicate_record | 重复记录 |

## 处理状态

| 状态 | 说明 |
|------|------|
| success | 处理成功 |
| failed | 处理失败 |
| conflict | 内容冲突（与缓存数据不一致） |
| skipped | 跳过（复用缓存结果） |
| manual_fix | 人工修正 |

## 测试覆盖

自检程序覆盖以下边界情况：

1. ✅ 完全匹配的路径归并
2. ✅ 权限放大问题检测
3. ✅ 跨天录音检测
4. ✅ 数据缺失检测
5. ✅ 路径层级归并逻辑
6. ✅ 人工修正功能验证

## License

MIT
