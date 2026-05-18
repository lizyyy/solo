# 儿童托管班接送授权名单处理工具

专门用于处理儿童托管班接送授权名单的命令行工具，支持证件过期检查、同名家长识别、可复跑增量处理等功能。

## 功能特性

- ✅ **证件过期检查**：自动识别已过期和即将过期的证件
- 👨‍👩‍👧 **同名家长识别**：自动发现同一家长接送多个儿童的情况
- 🔄 **可复跑增量处理**：支持增量处理，跳过已处理记录
- 📋 **分类输出**：将异常数据与正常数据分开输出，方便复核
- ⚙️ **灵活配置**：支持自定义验证规则和字段映射

## 安装依赖

```bash
cd daycare_auth
pip install -e .
```

## 使用方法

### 1. 生成配置文件（可选）

```bash
daycare-auth init-config --output rules.yaml
```

### 2. 处理授权名单

```bash
# 基础用法
daycare-auth process samples/normal_input output

# 使用自定义配置
daycare-auth process samples/normal_input output --config rules.yaml

# 指定参考日期（用于计算证件过期）
daycare-auth process samples/normal_input output --reference-date 2024-09-01

# 增量处理模式
daycare-auth process samples/rerun_input output --incremental
```

## 样例数据说明

`samples/` 目录包含三种样例数据：

### 1. normal_input - 正常输入
- 4条完整、规范的授权记录
- 所有字段齐全，证件在有效期内
- 用于测试正常流程

### 2. dirty_input - 脏数据输入
包含以下边界情况：
- 缺少儿童证件号
- 缺少与儿童关系字段
- 证件已过期
- 证件即将过期（30天内）
- 同名家长（张明同时接送小华和小丽）
- 同名家长（王建国同时接送小明和小强）

用于测试边界情况处理。

### 3. rerun_input - 重跑对照
- 2条新增记录
- 配合 `--incremental` 参数测试增量处理功能

## 输出文件说明

每次运行会在输出目录生成带时间戳的子目录，包含：

| 文件名 | 说明 |
|--------|------|
| `valid_records.csv` | 验证通过的正常记录 |
| `expired_id_records.csv` | 证件已过期的记录（需单独处理） |
| `warning_id_records.csv` | 证件即将过期的记录（需提醒） |
| `duplicate_parent_records.csv` | 同名家长的记录（需人工复核） |
| `invalid_records.csv` | 字段验证失败的记录（需补全信息） |
| `all_records.csv` | 所有原始记录（含处理标记） |
| `处理总结.txt` | 本次处理的统计汇总 |

## 配置文件说明

`rules.yaml` 包含以下配置项：

### validation_rules - 验证规则
- `id_expiry_days_warning`: 证件过期警告天数（默认30天）
- `id_expiry_days_error`: 证件过期错误天数（默认0天）
- `require_child_id`: 是否必须提供儿童证件号
- `require_parent_id`: 是否必须提供家长证件号
- `require_relationship`: 是否必须提供与儿童关系

### duplicate_handling - 重复处理
- `match_columns`: 用于判断重复的列
- `conflict_resolution`: 冲突解决策略

### output_settings - 输出设置
- `separate_expired`: 是否单独输出过期记录
- `separate_duplicates`: 是否单独输出重复记录
- `timestamp_format`: 时间戳格式
- `encoding`: 文件编码

### columns_mapping - 字段映射
支持自定义CSV列名与内部字段的映射关系。

## 运行测试

### 测试正常数据
```bash
daycare-auth process samples/normal_input output_test_normal -d 2024-09-01
```
预期输出：4条有效记录，0条异常记录

### 测试脏数据
```bash
daycare-auth process samples/dirty_input output_test_dirty -d 2024-09-01
```
预期输出：
- 证件已过期：3条
- 证件即将过期：2条
- 同名家长：4条
- 字段验证失败：2条

### 测试增量处理
```bash
# 第一次运行
daycare-auth process samples/normal_input output_test_rerun -d 2024-09-01

# 第二次运行（增量模式，加入新数据）
daycare-auth process samples/rerun_input output_test_rerun -d 2024-09-01 --incremental
```

## 项目结构

```
daycare_auth/
├── src/
│   ├── __init__.py
│   ├── config.py          # 配置管理
│   ├── data_reader.py     # 数据读取和解析
│   ├── validator.py       # 验证逻辑
│   ├── output_writer.py   # 结果输出
│   └── main.py           # CLI入口
├── samples/
│   ├── normal_input/     # 正常输入样例
│   ├── dirty_input/      # 脏数据样例
│   └── rerun_input/      # 重跑样例
├── tests/                 # 测试目录
├── pyproject.toml        # 项目配置
├── rules.yaml            # 规则配置
└── README.md             # 说明文档
```
