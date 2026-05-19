# 密钥到期催办负责人转交排查CLI

一个用于管理系统账号密钥到期提醒、负责人转交和状态跟踪的命令行工具。

## 核心功能

- **到期分级提醒**：根据剩余天数自动分级（URGENT/WARNING/NOTICE/SAFE）
- **负责人自动转交**：负责人休假时自动转交给备份负责人
- **催办去重**：相同级别的催办在一定时间内不会重复发送
- **状态机管理**：pending → reminded → transferred → resolved → closed
- **双格式报告**：机器可读（JSON）和人类可读（Markdown）

## 安装

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 导入样例数据

```bash
# 导入正常样例数据
python cli.py import-data samples/normal_data.json

# 导入内置样例
python cli.py import-data --sample normal
```

### 2. 查看密钥列表

```bash
# 人类可读格式
python cli.py list

# 机器可读格式
python cli.py list --json-output
```

### 3. 查看密钥详情

```bash
python cli.py show SEC001
```

### 4. 发送催办通知

```bash
# 单个密钥催办
python cli.py remind SEC001

# 批量催办（预览模式）
python cli.py remind-all --dry-run

# 批量催办（实际发送）
python cli.py remind-all
```

### 5. 转交负责人

```bash
python cli.py transfer SEC001 李四 --operator 管理员 --reason "工作调整"
```

### 6. 处理密钥并添加结论

```bash
python cli.py resolve SEC001 --type renewed --operator 管理员 --remarks "已完成密钥轮换"
```

结论类型：
- `renewed`：已续期
- `deprecated`：已废弃
- `transferred_permanently`：已永久转交
- `other`：其他

### 7. 导出报告

```bash
# JSON格式
python cli.py export -o report.json --format json

# Markdown格式
python cli.py export -o report.md --format md --title "月度密钥管理报告"
```

## 验收测试

运行完整的验收测试，验证正常样例、异常样例和数据一致性：

```bash
python acceptance_test.py
```

测试内容包括：
1. **正常样例**：完整流程测试（导入、查询、催办、转交、处理、导出）
2. **异常样例**：边界情况和错误处理（不存在的密钥、重复催办、不存在的负责人、重复ID、空数据）
3. **数据一致性**：验证历史记录、报告数据、错误提示的一致性

## 项目结构

```
.
├── cli.py              # CLI入口文件
├── models.py           # 数据模型定义
├── rules.py            # 核心规则引擎
├── store.py            # 数据持久化
├── reporter.py         # 报告生成器
├── requirements.txt    # 依赖列表
├── acceptance_test.py  # 验收测试脚本
├── samples/            # 样例数据目录
│   ├── normal_data.json      # 正常样例：标准业务场景，可完整走通全流程
│   ├── dirty_data.json       # 脏数据样例：包含过期、重复催办、休假负责人等边界
│   ├── conflict_data.json    # 边界冲突样例：状态机边界、转交链冲突、备份循环等
│   └── empty_data.json       # 空数据样例：验证空输入的处理逻辑
└── data/               # 运行时数据目录（自动创建）
```

## 样例数据说明

### normal_data.json - 正常业务场景
包含3个典型密钥，分别处于不同到期等级（URGENT/WARNING/SAFE），负责人状态正常，用于演示标准业务流程：导入 → 列表查看 → 详情查看 → 催办 → 转交 → 处理 → 导出报告。

### dirty_data.json - 脏数据边界
- DIRTY001：已过期密钥（超期5天），测试过期处理逻辑
- DIRTY002：即将到期密钥，测试重复催办去重
- DIRTY003：休假负责人密钥，测试自动转交逻辑（李四休假，备份为王五）

### conflict_data.json - 边界冲突场景
包含6种复杂冲突场景，用于验证系统鲁棒性：
- CONFLICT001：已关闭密钥，测试操作限制
- CONFLICT002：已处理密钥，测试状态边界
- CONFLICT003：备份循环密钥，测试转交链循环防护
- CONFLICT004：双休假密钥，负责人和备份都休假的极端场景
- CONFLICT005：已转交密钥，测试多次转交的状态流转
- CONFLICT006：已催办密钥，测试提醒后状态的操作限制

### empty_data.json - 空输入测试
不含任何数据，用于验证空列表、空查询等边界情况的处理。

## 核心规则说明

### 到期分级规则

| 剩余天数 | 级别 | 颜色 | 催办间隔 |
|---------|------|------|---------|
| < 0     | EXPIRED | 红色 | 每天 |
| 0-3 天 | URGENT | 橙色 | 每天 |
| 4-7 天 | WARNING | 黄色 | 每3天 |
| 8-14 天 | NOTICE | 蓝色 | 每7天 |
| 15-30 天 | INFO | 灰色 | 不自动催办 |
| > 30 天 | SAFE | 绿色 | 不自动催办 |

### 负责人转交规则

1. 当负责人休假且密钥需要处理时（URGENT/WARNING/NOTICE级别），自动转交给备份负责人
2. 转交历史会记录完整的操作人、时间和原因
3. 可以手动强制执行转交操作

### 催办去重规则

同一密钥在以下时间内不会重复发送相同级别的催办：
- URGENT：24小时
- WARNING：3天
- NOTICE：7天
- INFO/SAFE：30天

### 状态流转规则

```
pending → reminded → transferred → resolved → closed
   ↓          ↓            ↓           ↓
   └──────────┴────────────┴───────────┘ ← 可回退到 pending
```

## 代码引用

- **CLI命令行接口**：[cli.py](file:///Users/lzy/pro/solo/workspaces/zy70739/cli.py)
- **数据模型**：[models.py](file:///Users/lzy/pro/solo/workspaces/zy70739/models.py)
- **规则引擎**：[rules.py](file:///Users/lzy/pro/solo/workspaces/zy70739/rules.py)
- **数据存储**：[store.py](file:///Users/lzy/pro/solo/workspaces/zy70739/store.py)
- **报告生成**：[reporter.py](file:///Users/lzy/pro/solo/workspaces/zy70739/reporter.py)
- **验收测试**：[acceptance_test.py](file:///Users/lzy/pro/solo/workspaces/zy70739/acceptance_test.py)

## 许可证

MIT
