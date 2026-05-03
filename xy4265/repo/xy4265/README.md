# 条款红线落点器

法务合同盖章前复核工具 - 本地桌面 GUI 应用

## 功能特性

### 解决的核心痛点

- ⚠️ **必改条款被漏过**：自动识别红线规则，标记必改风险项
- 🔄 **同一风险被不同人重复改**：智能检测重复风险，避免重复劳动
- 📝 **签署版和审批版不一致**：版本对比功能，检测条款变更差异

### 主要功能

| 功能 | 说明 |
|------|------|
| 数据导入 | 支持导入条款 JSON、审批意见 CSV、客户红线 YAML |
| 条款树 | 树形结构展示合同条款层级，直观查看整体结构 |
| 风险分析 | 基于关键词匹配自动检测风险，按级别分类展示 |
| 重复检测 | 自动识别相同规则/关键词的重复风险 |
| 人工复核 | 支持确认/驳回/标记已解决，添加复核备注 |
| 本地存储 | 所有数据本地保存，无需联网，保护敏感信息 |
| 导出功能 | 导出 Markdown 复核单、CSV 风险表、JSON 审计包 |

## 安装说明

### 环境要求

- Python 3.8+
- macOS / Windows / Linux

### 安装依赖

```bash
cd 项目目录
pip install -r requirements.txt
```

### 启动应用

```bash
python main.py
```

## 使用指南

### 快速验证流程

#### 1. 启动应用

```bash
python main.py
```

#### 2. 新建项目

- 点击菜单 **文件 → 新建项目**
- 输入项目名称：`示例合同复核`
- 点击 **创建**

#### 3. 导入示例数据

依次导入 `sample_data` 目录下的三个示例文件：

**导入条款 JSON：**
- 菜单 **文件 → 导入条款JSON**
- 选择 `sample_data/clauses_sample.json`
- 点击打开

**导入审批意见 CSV：**
- 菜单 **文件 → 导入审批意见CSV**
- 选择 `sample_data/comments_sample.csv`
- 点击打开

**导入客户红线 YAML：**
- 菜单 **文件 → 导入客户红线YAML**
- 选择 `sample_data/redlines_sample.yaml`
- 点击打开

系统会自动分析风险，底部状态栏显示分析结果。

#### 4. 查看条款树

左侧面板点击 **条款树** 标签：
- 以树形结构展示合同条款层级
- 展开/折叠查看子条款
- 点击条款查看右侧内容

#### 5. 查看风险列表

左侧面板点击 **风险列表** 标签：

列说明：
- 🟠🟢：风险级别（🔴严重 / 🟠高 / 🟡中 / 🟢低）
- 状态：待处理 / 已确认 / 已解决 / 已驳回
- 条款：关联的条款标题
- 命中关键词：匹配的红线关键词
- 重复：是否为重复风险

#### 6. 人工复核操作

选中某个风险项后，右侧 **复核操作** 面板：

| 操作按钮 | 说明 |
|---------|------|
| 确认风险 - 需要修改 | 确认该风险确实存在，需要修改 |
| 驳回 - 无需修改 | 认为该风险不存在，或无需处理 |
| 标记为已解决 | 表示该风险已通过修改解决 |
| 重置为待处理 | 恢复到待处理状态 |

**复核备注：** 在 **风险详情** 面板的"复核备注"文本框中可以添加说明文字。

#### 7. 保存项目

- 菜单 **文件 → 保存项目**
- 项目保存到 `~/.clause_redline/projects/` 目录

#### 8. 导出文件

##### 导出 Markdown 复核单

- 菜单 **导出 → Markdown复核单**
- 选择保存路径
- 生成的文件包含：
  - 项目基本信息
  - 风险统计（按级别、按状态）
  - 必改条款检查
  - 各级别风险详情
  - 条款树结构

##### 导出 CSV 风险表

- 菜单 **导出 → CSV风险表**
- 包含所有风险项的详细信息，可直接用 Excel 打开

##### 导出 CSV 统计汇总

- 菜单 **导出 → CSV统计汇总**
- 包含按风险级别、处理状态的统计数据

##### 导出 JSON 审计包

- 菜单 **导出 → JSON审计包**
- 生成 ZIP 压缩包，包含：
  - `project.json`：完整项目数据
  - `summary.json`：统计摘要
  - `decisions.json`：复核决策记录
  - `audit_info.json`：审计信息

### 示例数据说明

`sample_data` 目录包含完整的示例数据：

| 文件 | 内容 |
|------|------|
| `clauses_sample.json` | 10条合同条款（含嵌套子条款），涵盖付款、保密、知识产权、争议解决等常见合同条款 |
| `comments_sample.csv` | 4条审批意见示例，来自不同审批人 |
| `redlines_sample.yaml` | 7条红线规则，其中2条为**必改规则**（付款期限、争议解决） |

#### 红线规则示例

```yaml
- rule_id: "rule_001"
  category: "付款条款"
  description: "付款期限过短风险"
  keywords:
    - "工作日内"
    - "十五个工作日"
  risk_level: "critical"
  is_mandatory: true    # 必改规则
  remediation: "建议延长付款期限至30个工作日"
```

## 项目结构

```
xy4265/
├── main.py                    # 主入口文件
├── requirements.txt           # 依赖列表
├── README.md                 # 本文档
├── models/                   # 数据模型
│   ├── __init__.py
│   └── data_models.py        # 核心数据类定义
├── parser/                   # 解析校验模块
│   ├── __init__.py
│   ├── clause_parser.py      # 条款JSON解析器
│   ├── comment_parser.py     # 审批意见CSV解析器
│   ├── redline_parser.py     # 客户红线YAML解析器
│   └── validator.py          # 数据校验器
├── rules/                    # 规则引擎模块
│   ├── __init__.py
│   └── rule_engine.py        # 风险匹配、重复检测
├── storage/                  # 状态存储模块
│   ├── __init__.py
│   ├── project_store.py      # 项目持久化管理
│   └── session_store.py      # 复核会话管理
├── version_compare/          # 版本对比模块
│   ├── __init__.py
│   └── version_comparator.py # 版本差异检测
├── exporters/                # 导出模块
│   ├── __init__.py
│   ├── markdown_exporter.py  # Markdown复核单导出
│   ├── csv_exporter.py       # CSV风险表导出
│   └── json_audit_exporter.py # JSON审计包导出
├── gui/                      # GUI界面模块
│   ├── __init__.py
│   └── app.py                # Tkinter主应用
├── sample_data/              # 示例数据
│   ├── __init__.py
│   ├── clauses_sample.json   # 条款示例
│   ├── comments_sample.csv   # 审批意见示例
│   └── redlines_sample.yaml  # 红线规则示例
└── tests/                    # 测试模块
    ├── __init__.py
    └── test_clause_redline.py # pytest测试用例
```

## 模块说明

### 1. 数据模型 (`models/`)

定义核心数据类：

- `Clause`：合同条款，支持父子层级
- `RedlineRule`：客户红线规则
- `ApprovalComment`：审批意见
- `RiskItem`：风险项
- `Project`：项目/合同
- `ReviewSession`：复核会话

### 2. 解析校验 (`parser/`)

- **ClauseParser**：解析条款JSON，自动构建树形结构
- **CommentParser**：解析审批意见CSV
- **RedlineParser**：解析客户红线YAML
- **DataValidator**：数据完整性校验（ID重复、字段缺失等）

### 3. 规则引擎 (`rules/`)

- **RiskMatcher**：关键词匹配检测风险
- **DuplicateDetector**：检测重复风险（相同规则+关键词）
- **RuleEngine**：整合分析，状态管理

### 4. 状态存储 (`storage/`)

- **ProjectStore**：项目本地持久化（JSON格式）
- **ProjectSerializer**：项目序列化/反序列化
- **SessionStore**：复核会话记录

**存储位置：** `~/.clause_redline/projects/`

### 5. 版本对比 (`version_compare/`)

- **VersionComparator**：比较两个版本的条款和风险
- 检测新增、删除、修改的条款
- 检测新增、已解决、状态变更的风险

### 6. 导出 (`exporters/`)

- **MarkdownExporter**：生成带风险统计、必改检查的复核单
- **CSVExporter**：导出风险详情表和统计汇总表
- **JSONAuditExporter**：导出ZIP压缩的审计包

### 7. GUI界面 (`gui/`)

基于 Tkinter 的桌面应用：

- 左侧双面板：条款树 / 风险列表
- 右侧三面板：风险详情 / 复核操作 / 条款内容
- 菜单栏：文件、导出、工具、帮助

## 运行测试

项目使用 pytest 进行测试：

```bash
# 安装pytest
pip install pytest

# 运行所有测试
pytest tests/ -v

# 运行指定测试
pytest tests/test_clause_redline.py -v
```

测试覆盖：
- 条款解析器测试
- 审批意见解析器测试
- 红线规则解析器测试
- 数据校验器测试
- 风险匹配器测试
- 重复检测器测试
- 规则引擎测试
- 项目序列化器测试
- 版本比较器测试
- 所有导出器测试
- 项目存储管理器测试

## 数据格式说明

### 条款 JSON 格式

```json
[
  {
    "clause_id": "clause_001",
    "title": "第一条 合作内容",
    "content": "条款内容...",
    "order": 1,
    "parent_id": null,
    "metadata": {}
  },
  {
    "clause_id": "clause_002",
    "title": "1.1 子条款",
    "content": "子条款内容...",
    "order": 1,
    "parent_id": "clause_001",
    "metadata": {}
  }
]
```

### 审批意见 CSV 格式

```csv
comment_id,clause_id,reviewer,comment_text,risk_level,action_required,created_at,version
comm_001,clause_001,张三,"意见内容",high,请修改,2025-01-15T10:30:00,v1
```

### 客户红线 YAML 格式

```yaml
- rule_id: "rule_001"
  category: "付款条款"
  description: "风险描述"
  keywords:
    - "关键词1"
    - "关键词2"
  risk_level: "critical"  # critical/high/medium/low
  is_mandatory: true      # 是否必改
  remediation: "修改建议"
  priority: 1
```

## 常见问题

### Q: 数据存储在哪里？

所有项目数据存储在用户主目录下：
- macOS/Linux: `~/.clause_redline/projects/`
- Windows: `C:\Users\用户名\.clause_redline\projects\`

### Q: 是否需要联网？

不需要。所有功能均在本地运行，数据不会上传。

### Q: 支持哪些文件格式？

- 条款：`.json`
- 审批意见：`.csv`
- 客户红线：`.yaml` / `.yml`
- 导出：`.md` / `.csv` / `.json` / `.zip`

### Q: 必改规则是什么？

`is_mandatory: true` 的规则标记为必改规则。这些规则匹配到的风险会被特别关注，导出时会单独列出"必改条款检查"章节。

## 版本历史

- **v1.0.0** (2025-05-03)
  - 初始版本发布
  - 支持条款树、风险列表、人工复核
  - 支持三种导出格式
  - 完整的测试覆盖

## 许可证

内部使用工具。
