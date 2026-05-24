# CI 失败聚类分析报告

生成时间: 2026-05-24 23:20:52

## 概览

| 指标 | 数值 |
|------|------|
| 总失败次数 | 4 |
| 聚类数量 | 1 |
| 未聚类失败 | 2 |

## 聚类算法说明

### 日志切片 (Log Slicing)
- 自动识别错误起始位置（Error/Traceback/Exception 等）
- 提取完整错误栈，截断无意义的输出
- 支持多段错误识别

### 签名归一化 (Signature Normalization)
- **路径归一化**: 替换文件系统路径为 `<PATH>`
- **UUID/HEX 归一化**: 替换唯一标识为 `<UUID>`/`<HEX>`
- **行号归一化**: 替换行号为 `<N>`
- **时间戳归一化**: 替换时间戳为 `<TS>`
- **过滤无关栈帧**: 过滤第三方库栈帧

### 矩阵聚合 (Matrix Aggregation)
- 分析每个聚类在各个矩阵维度（OS/版本/架构）上的分布
- 识别是否在特定配置下集中出现

### 抖动评分 (Jitter Score)
- 衡量失败的随机性：`0 = 完全确定`，`1 = 完全随机`
- 基于涉及的提交数量和任务名称多样性计算
- **低抖动（<0.3）**: 确定性失败，特定条件必现
- **中抖动（0.3-0.7）**: 半随机，可能和时序/环境相关
- **高抖动（>0.7）**: 高度随机，需要关注稳定性问题

## 聚类详情

### 聚类 1: `5ab80adc`

| 属性 | 值 |
|------|-----|
| 失败次数 | 2 |
| 错误类型 | AssertionError |
| 错误分类 | AssertionError |
| 涉及提交数 | 2 |
| 抖动评分 | 1.000 |
| 重跑成功率 | 0.0% |

#### 归一化错误信息

```
AssertionError: Expected <N> but got <N>
```

#### 关键词

`assert`, `assertionerror`, `but`, `expected`, `got`, `load_fixtures`, `path`, `result`, `self`, `setup`, `test_addition`

#### 矩阵覆盖

- **os**:
  - `ubuntu-latest`: ██████████ 2 (100.0%)
- **python_version**:
  - `"3.10"`: █████░░░░░ 1 (50.0%)
  - `3.9`: █████░░░░░ 1 (50.0%)

#### 涉及的失败记录

| 提交 | 任务 | 矩阵 | 重跑次数 | 重跑成功 |
|------|------|------|----------|----------|
| `b2c3d4e5` | linux-python-3.10-te | os=ubuntu-latest,python_versio | 1 | ✗ |
| `e5f6a7b8` | linux-python-3.9-tes | os=ubuntu-latest,python_versio | 3 | ✗ |

## 未聚类的失败

共 2 条未聚类的失败记录（出现次数 < 2）:

- `c3d4e5f6` - macos-python-3.9-tests: ConnectionError: Failed to connect to database server at localhost:5432...
- `f6a7b8c9` - linux-node-18-tests: TimeoutError: Test timed out after 30000ms...

## 分析参数

```json
{
  "similarity_threshold": 0.85,
  "min_cluster_size": 2,
  "rerun_threshold": 1,
  "normalize_paths": true,
  "normalize_hex": true,
  "normalize_numbers": true,
  "normalize_uuids": true,
  "normalize_timestamps": true
}
```
