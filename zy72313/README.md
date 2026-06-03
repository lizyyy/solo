# Markov 客户流失转移分析系统

## 系统概述

本系统用于基于马尔可夫链模型分析客户流失状态转移，重点支持**可复盘的操作记录**和**业务复核流程**，确保所有操作透明可追溯。

## 核心特性

### 1. 边界规则（写死在代码里）

| 场景 | 规则 | 处理方式 |
|------|------|----------|
| 同一学生交了两版答案 | `same_student_multiple_answers: "review"` | 触发业务复核，不急着归正常 |
| 重复导入同一批旧公式截图 | `duplicate_import_handling: "skip"` | 文件哈希校验，跳过不翻倍 |
| 唐老师改了一条备注 | `annotation_update_mode: "versioned"` | 记录版本历史，显示改前改后 |
| 3D/图表展示点击 | `show_raw_data_on_click: true` | 回到原始数据、老师批注、复核链接 |

### 2. 完整操作审计链

- 所有导入、修改、回滚都记录版本
- 支持任意两版本对比
- 回滚操作本身也被记录

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 初始化系统

```bash
python cli.py init
```

### 标准三步工作流

```bash
# 步骤1: 导入旧公式截图
python cli.py import-data data/imports/formula_data.csv

# 步骤2: 唐老师补看老师批注（检查多版答案）
python cli.py check-answers

# 步骤3: 误差说明更新（处理复核）
python cli.py review review_20240101_120000 approve --author 唐老师 --comment "确认使用第2版答案"
```

## 命令参考

### 数据导入

```bash
# 正常导入（自动跳过重复）
python cli.py import-data data.csv

# 强制导入重复文件
python cli.py import-data data.csv --no-skip-duplicates

# 不检查多版答案（不推荐）
python cli.py import-data data.csv --no-check-multiple
```

### 复核管理

```bash
# 列出所有复核任务
python cli.py list-reviews

# 只看待处理的
python cli.py list-reviews --status pending

# 批准复核
python cli.py review <review_id> approve --author 唐老师 --comment "确认"

# 拒绝复核
python cli.py review <review_id> reject --author 业务运营 --comment "数据有误"

# 请求更多信息
python cli.py review <review_id> info --author 唐老师 --comment "请补充误差说明"
```

### 历史与回滚

```bash
# 查看版本历史
python cli.py history --limit 20

# 对比两个版本
python cli.py compare v_20240101_120000 v_20240101_130000

# 回滚到指定版本
python cli.py rollback v_20240101_120000 --author 唐老师 --reason "数据错误"
```

### 可视化

```bash
# 生成所有图表
python cli.py visualize --view all

# 只生成3D图表
python cli.py visualize --view 3d

# 带前缀输出
python cli.py visualize --prefix "2024Q1_"
```

### 数据点溯源（点击图表时）

```bash
# 查看客户完整历史（含学生ID、答案版本、来源文件）
python cli.py lookup CUST001
```

### 查看边界规则

```bash
python cli.py boundary-rules
```

## 文件结构

```
.
├── config.yaml              # 配置文件（含边界规则）
├── requirements.txt         # 依赖
├── cli.py                   # 命令行入口
├── markov_churn/
│   ├── __init__.py
│   ├── core.py              # Markov模型核心
│   ├── importer.py          # 导入系统（幂等性）
│   ├── history.py           # 版本历史与对比
│   ├── review.py            # 复核系统
│   ├── visualization.py     # 可视化（2D/3D）
│   └── exceptions.py        # 异常定义
└── data/
    ├── imports/             # 待导入文件
    ├── history/             # 版本历史
    ├── exports/             # 图表输出
    └── reviews.json         # 复核记录
```

## 边界规则详细说明

### 规则1: 同一学生多版答案

**触发条件**：导入时检测到同一 `student_id` 存在不同的 `answer_version`

**处理流程**：
1. 数据正常导入（保留所有版本）
2. 自动创建 `multiple_answers` 类型复核任务
3. 分配给「唐老师」和「业务运营」
4. 待人工确认使用哪一版

**为什么这样设计**：把返工留在明面上，不依赖口头约定。

### 规则2: 重复导入幂等性

**触发条件**：文件SHA256哈希匹配历史导入记录

**处理流程**：
1. 检测到重复文件
2. 默认跳过，返回 `status: skipped`
3. 不增加计数，不产生新版本

**为什么这样设计**：重复导入旧公式截图不翻倍。

### 规则3: 批注更新版本化

**触发条件**：任何对 `annotations` 或 `error_notes` 的修改

**处理流程**：
1. 记录修改前和修改后的值
2. 创建新版本，保留完整diff
3. 可随时对比历史版本

**为什么这样设计**：历史里能看出改前改后的差别。

### 规则4: 3D/图表先服务复核

**触发条件**：用户点击图表上的数据点

**处理流程**：
1. 不只有漂亮画面
2. 显示原始数据：客户ID、状态、时间戳
3. 显示溯源信息：学生ID、答案版本、来源文件
4. 提供复核链接和批注链接

**为什么这样设计**：服务复核优先，美观其次。

## 可复现命令记录

每次操作后系统都会输出可复现的命令，用于复盘：

```bash
# 导入命令
python cli.py import-data data/imports/formula_data_v1.csv

# 复核命令
python cli.py review review_20240101_120000 approve --author 唐老师

# 回滚命令（如果需要）
python cli.py rollback v_20240101_120000 --author 唐老师 --reason "误差说明有误"
```

## 配置边界规则

编辑 `config.yaml` 修改边界规则：

```yaml
boundary_rules:
  same_student_multiple_answers: "review"    # 多版答案：复核
  duplicate_import_handling: "skip"          # 重复导入：跳过
  annotation_update_mode: "versioned"        # 批注更新：版本化
  auto_approve_threshold: 0.95               # 自动批准阈值

visualization:
  show_raw_data_on_click: true               # 点击显示原始数据
  enable_review_link: true                   # 显示复核链接
```

## 注意事项

1. **同一学生交了两版答案时，别急着归正常** - 系统会自动创建复核任务，留给业务运营决定
2. **所有操作都有记录** - 包括回滚，没有「删除历史」的操作
3. **幂等性保障** - 同一文件导入多少次结果都一样
4. **先服务复核，再服务美观** - 3D图表再好看，也能回到原始数据
