# 家具定制厂板材余料匹配 CLI

一个专为家具定制厂设计的板材余料数据验证与错误统计工具。

## 功能特点

### 业务专属错误检测
- **毫米/厘米混用检测**: 自动识别尺寸单位不一致的问题（家具行业常见痛点）
- **旋转限制验证**: 检查板材旋转角度是否符合规范（无/0度/90度/180度）
- **重复行检测**: 识别反复修改同一条记录导致的重复数据
- **缺列检查**: 验证CSV文件的列完整性

### 可复跑输出
- 记录已处理文件状态，避免重复处理
- 支持 `--rerun` 强制重新处理
- 输出按固定规则排序，便于 `diff` 比较

### 错误分类统计
将业务错误与普通格式错误分开统计：
1. 毫米/厘米混用（业务错误）
2. 旋转限制错误（业务错误）
3. 重复行（业务错误）
4. 缺列（格式错误）
5. 文件读取/解析错误（格式错误）

## 目录结构

```
furniture_offcut_matcher/
├── offcut_matcher.py      # 主CLI工具
├── README.md              # 本说明文档
├── good/                  # 正常文件
│   ├── order_2026_001.csv
│   ├── order_2026_002.csv
│   └── offcut_inventory.csv
├── bad/                   # 包含错误的测试文件
│   ├── unit_mixed_mm_cm.csv    # 毫米/厘米混用
│   ├── rotation_errors.csv     # 旋转限制错误
│   ├── missing_columns.csv     # 缺列
│   ├── duplicate_rows.csv      # 重复行
│   └── mixed_errors.csv        # 混合错误
├── empty/                 # 空文件测试
│   ├── empty_offcuts.csv       # 完全空文件
│   └── only_header.csv         # 只有表头
├── tests/                 # 部分成功测试
│   ├── partial_success_1.csv  # 部分成功场景1
│   └── partial_success_2.csv  # 部分成功场景2
└── output/                # 输出目录（自动生成）
    ├── result_YYYYMMDD_HHMMSS.json
    └── processing_state.json
```

## 使用方法

### 基本使用
```bash
cd furniture_offcut_matcher
python3 offcut_matcher.py
```

### 处理指定目录
```bash
python3 offcut_matcher.py ./good          # 仅处理正常文件
python3 offcut_matcher.py ./bad           # 仅处理错误文件
```

### 便捷参数
```bash
python3 offcut_matcher.py --good          # 处理good目录
python3 offcut_matcher.py --bad           # 处理bad目录
python3 offcut_matcher.py --test          # 运行所有测试
python3 offcut_matcher.py --rerun         # 强制重跑所有文件
```

### 完整测试
```bash
python3 offcut_matcher.py --test
```
这将依次处理 `good/`、`bad/`、`empty/`、`tests/` 四个目录的所有文件。

## 测试覆盖场景

| 场景 | 测试文件 | 预期结果 |
|------|----------|----------|
| 正常文件 | `good/*.csv` | 0错误，全部成功 |
| 毫米/厘米混用 | `bad/unit_mixed_mm_cm.csv` | 单位混用错误统计 |
| 旋转限制错误 | `bad/rotation_errors.csv` | 旋转错误统计 |
| 缺列 | `bad/missing_columns.csv` | 缺列错误统计 |
| 重复行 | `bad/duplicate_rows.csv` | 重复行错误统计 |
| 混合错误 | `bad/mixed_errors.csv` | 各类错误分别统计 |
| 空文件 | `empty/empty_offcuts.csv` | 标记为empty |
| 只有表头 | `empty/only_header.csv` | 0数据行，正常处理 |
| 部分成功 | `tests/partial_success_*.csv` | 部分行成功，部分行报错，文件整体标记为成功 |
| 可复跑 | 所有文件 | 第二次运行跳过已处理文件 |

## 输出说明

### 控制台输出示例
```
============================================================
家具定制厂板材余料匹配 - 处理报告
运行ID: 20260519_143022
处理目录: ./bad
============================================================

文件统计:
  总文件数: 5
  成功处理: 5
  跳过(已处理): 0
  空文件: 0
  失败: 0

错误分类统计:
  毫米/厘米混用: 12
  旋转限制错误: 8
  格式错误: 0
  重复行: 2
  缺列: 6
  总错误数: 28

毫米/厘米混用详情 (前5条):
  unit_mixed_mm_cm.csv 行2: 剩余长度=244 -> 单位混用 - 疑似厘米值
  ...

旋转限制错误详情 (前5条):
  rotation_errors.csv 行2: '45度' 不在有效值 ['0度', '180度', '90度', '无']
  ...

结果文件已保存到 output/result_20260519_143022.json
============================================================
```

### JSON输出结构
结果JSON按固定键名排序，便于diff比较：
```json
{
  "directory": "./bad",
  "failed": 0,
  "file_results": [...],
  "run_id": "20260519_143022",
  "successful": 5,
  "total_errors": 28,
  "total_files": 5,
  "unit_mismatch_count": 12,
  "unit_mismatch_details": [...],
  "rotation_errors_count": 8,
  "rotation_errors_details": [...],
  ...
}
```

## 业务背景

家具定制厂板材余料匹配常见痛点：

1. **反复修改同一条记录**: 操作员反复修改余料记录，最后只剩一个结果，导致历史数据丢失
2. **毫米/厘米混用**: 设计用毫米，仓库录入用厘米，导致匹配失败
3. **旋转限制不规范**: 木纹方向限制导致实际无法使用匹配的余料
4. **缺列导致无法匹配**: CSV导出缺列，匹配算法无法运行

本工具专门针对这些业务痛点设计。

## 命令行参数

| 参数 | 说明 |
|------|------|
| `directory` | 要处理的目录路径（默认: 当前目录） |
| `--output, -o` | 输出目录（默认: ./output） |
| `--rerun, -r` | 重新处理所有文件（忽略已处理状态） |
| `--good` | 仅处理good目录（正常文件） |
| `--bad` | 仅处理bad目录（错误文件） |
| `--test` | 运行所有测试用例 |
| `-h, --help` | 显示帮助信息 |
