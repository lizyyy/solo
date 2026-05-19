# Notebook 参数制品排查 CLI

用于追踪和验证 Jupyter Notebook 的运行参数、环境信息和输出制品的命令行工具，解决"只传截图无法复现"的问题。

## 核心功能

- **参数签名**: 为参数集生成唯一哈希签名，防止篡改
- **运行环境记录**: 自动记录 Python 版本、操作系统、依赖库等信息
- **制品版本管理**: 输出制品自动版本控制，支持校验和验证
- **复核流程**: 支持多人复核，记录复核意见和状态
- **双格式报告**: 同时生成机器可读(JSON)和人读(txt)报告，确保一致性

## 安装

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 生成样例数据（推荐先运行）

```bash
python cli.py samples
```

会生成 4 种样例记录：
- **正常输入**: 参数完整、签名有效、已复核通过
- **脏数据**: 参数签名被伪造，用于验证完整性检查
- **边界冲突**: 环境哈希不匹配，模拟版本冲突场景
- **空结果**: 无参数、无制品的空记录

### 2. 查看所有记录

```bash
python cli.py list
```

### 3. 显示单个记录详情

```bash
python cli.py show NB001_NORMAL
```

### 4. 验证记录完整性

```bash
python cli.py verify NB001_NORMAL
python cli.py verify NB002_DIRTY  # 会显示验证失败
```

### 5. 添加新记录

```bash
python cli.py add --name "新实验" --path "./notebooks/exp.ipynb" --params '{"lr": 0.01, "batch": 64}'
```

### 6. 添加输出制品

```bash
python cli.py add-artifact NB001_NORMAL --name "模型权重" --type "pkl" --file "./model.pkl"
```

### 7. 添加复核意见

```bash
python cli.py review NB001_NORMAL --reviewer "张三" --comment "结果可复现，参数合理" --status "approved"
```

### 8. 生成排查报告

```bash
python cli.py report --output "my_report"
```

会生成两个文件：
- `reports/my_report_machine.json`: 机器可读的结构化数据
- `reports/my_report_human.txt`: 人类可读的格式化报告

### 9. 导出制品索引

```bash
python cli.py export-index --output "full_index"
```

### 10. 归档记录

```bash
python cli.py archive NB001_NORMAL --output-dir "./archive/20240101"
```

## 项目结构

```
.
├── cli.py              # CLI 主入口
├── models.py           # 数据模型定义
├── storage.py          # 存储管理模块
├── reporter.py         # 报告生成模块
├── requirements.txt    # 依赖声明
├── notebook_artifacts/ # 数据存储目录
│   ├── records/        # 记录 JSON 文件
│   ├── artifacts/      # 输出制品
│   └── index.json      # 全局索引
└── reports/            # 生成的报告目录
```

## 验证机制

每条记录包含三层验证：

1. **参数签名验证**: 检查参数值的哈希签名是否匹配
2. **环境哈希验证**: 检查运行环境的完整性
3. **制品校验和验证**: 检查输出文件的内容是否被篡改

## 验收要点

- ✅ 机器可读输出(JSON)与人读报告(txt)内容一致
- ✅ 脏数据和边界冲突能被正确检测并标记验证失败
- ✅ 参数签名能防止未授权的参数修改
- ✅ 制品版本自动递增管理
- ✅ 复核流程完整，包含复核人、时间、意见、状态
