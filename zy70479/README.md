# SQL参数化检查命令行工具

用于检查支付渠道回执SQL中的参数化问题，防止SQL注入风险。

## 快速开始

### 环境要求

- Python 3.7+

### 安装依赖

```bash
pip install -r requirements.txt
```

### 一键运行演示

```bash
python cli.py demo
```

该命令会自动完成以下流程：
1. 生成复核支付渠道回执样例数据
2. 执行SQL参数化检查
3. 显示批次摘要和边缘节点清册汇总
4. 演示失败路径查询
5. 验证本地重启后数据持久化效果

---

## 启动方式

### 查看帮助

```bash
python cli.py --help
```

### 可用命令

| 命令 | 功能 | 示例 |
|------|------|------|
| `generate` | 生成样例数据 | `python cli.py generate` |
| `check` | 执行SQL检查 | `python cli.py check channel_receipts_sample.json` |
| `batches` | 列出所有批次 | `python cli.py batches` |
| `batch` | 查询批次详情 | `python cli.py batch BATCH20250101120000` |
| `business` | 查询业务单号历史 | `python cli.py business PAY202501010001` |
| `rules` | 查看规则版本 | `python cli.py rules` |

---

## 样例来源说明

样例数据模拟**复核支付渠道回执**场景，包含16条记录：

### 正常数据（10条）
- 来源：支付宝渠道回执
- 特点：正确使用参数化查询（?占位符）
- 预期结果：检查通过 ✓

### 风险数据（4条）
| 业务单号 | 来源 | 问题类型 |
|---------|------|---------|
| PAYxxx0011 | 微信支付 | 字符串拼接SQL |
| PAYxxx0012 | 银联 | f-string格式化SQL |
| PAYxxx0013 | 京东支付 | .format()方法格式化SQL |
| PAYxxx0014 | 美团支付 | %格式化SQL |

### 脏数据（2条）
| 业务单号 | 来源 | 问题 | 处理方式 |
|---------|------|------|---------|
| DIRTYxxx | 边缘节点清册-异常回执 | SQL为空，金额为负 | 标记跳过 |
| （空） | 边缘节点清册-缺失业务单号 | 业务单号为空 | 标记被吞，生成SWALLOWED序号追踪 |

---

## 主流程说明

```
用户输入检查文件
       ↓
生成唯一批次号
       ↓
记录使用的规则版本
       ↓
逐条处理记录：
   ├─ 业务单号为空 → 标记被吞
   ├─ SQL为空/异常 → 标记跳过
   └─ 正常检查 → 应用规则引擎
       ├─ 通过 → success
       └─ 发现问题 → fail + 错误详情 + 修正建议
       ↓
保存每条记录明细（异常、修正、结论）
       ↓
计算批次状态（部分成功/完成/失败）
       ↓
生成边缘节点清册汇总（按业务单号）
       ↓
持久化到SQLite数据库
```

### 状态定义

- **success**: SQL检查通过，无注入风险
- **fail**: 发现严重问题，需要修复
- **skipped**: 脏数据，已跳过
- **swallowed**: 业务单号缺失，记录被吞
- **partial_success**: 批次部分成功（有失败但非全部失败）
- **completed**: 批次全部成功
- **failed**: 批次全部失败

---

## 失败路径示例

### 1. 字符串拼接SQL

**输入**：
```python
sql = "SELECT * FROM payment_records WHERE business_no = '" + business_no + "'"
```

**检查结果**：
```
✗ [FAIL] PAYxxx0011
   错误: [R001] 字符串拼接检测: 发现 1 处匹配 - 使用参数化查询替代字符串拼接
   建议: 修正建议: 使用参数化查询替代字符串拼接
```

### 2. f-string格式化SQL

**输入**：
```python
sql = f"SELECT * FROM payment_records WHERE amount > {1000} AND status = 'success'"
```

**检查结果**：
```
✗ [FAIL] PAYxxx0012
   错误: [R002] f-string格式化检测: 发现 1 处匹配 - 使用参数化查询替代f-string格式化
   建议: 修正建议: 使用参数化查询替代f-string格式化
```

### 3. 查询被吞掉的记录

```bash
python cli.py batch <批次号>
```

在摘要中会看到：
```
⚠ 特别注意：有1条记录因业务单号为空被吞掉！
  请检查数据源，补充业务单号以确保每条记录都能被正确追踪。
```

---

## 核心特性

### 1. 数据持久化
- 使用SQLite本地存储所有批次和记录
- 本地重启后，之前的处理结论和材料摘要仍然可查询
- 支持按批次号或业务单号追溯历史

### 2. 规则版本化
- 每条检查记录关联当时使用的规则版本
- 规则变更后，旧批次仍能解释当时的判断口径
- 可查看历史规则版本列表

### 3. 部分成功保留明细
- 不因为部分失败就整批标为失败
- 保留每条记录的独立状态
- 批次状态分为：partial_success / completed / failed

### 4. 边缘节点清册汇总
- 最终摘要按业务单号分组展示
- 每条业务单包含：异常、修正、结论
- 特别标注被吞掉的记录

---

## 典型使用场景

### 场景1: 首次运行完整检查
```bash
# 1. 生成样例数据（或使用自有JSON/CSV）
python cli.py generate -o my_data.json

# 2. 执行检查
python cli.py check my_data.json

# 3. 查看批次摘要
python cli.py batches

# 4. 查看详细结果
python cli.py batch BATCHxxxx
```

### 场景2: 追溯特定业务单历史
```bash
# 多次处理同一业务单后，查看历史记录
python cli.py business PAY202501010001
```

### 场景3: 使用特定规则版本检查
```bash
# 查看可用规则版本
python cli.py rules

# 使用指定版本检查
python cli.py check my_data.json --rule-version v1.0
```

---

## 项目结构

```
.
├── cli.py                    # 命令行入口
├── requirements.txt          # 依赖清单
├── README.md                # 使用文档
└── sql_checker/
    ├── __init__.py
    ├── database.py          # 数据库层（持久化）
    ├── rules.py             # 规则引擎（版本化）
    ├── sample_data.py       # 样例数据生成
    └── processor.py         # 核心处理器（主流程/异常处理/汇总）
```
