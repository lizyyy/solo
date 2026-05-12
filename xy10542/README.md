# 法规条款变更分析 CLI 工具

一个帮助合规团队高效管理法规变更的命令行工具，支持：

- 比较法规版本差异
- 自动分析业务影响
- 追踪整改任务和责任人
- 完整的状态和审计追踪

## 功能特性

### 核心命令

| 命令 | 说明 |
|------|------|
| `init` | 初始化项目目录 |
| `import` | 导入法规、业务、映射、责任人数据 |
| `check` | 检查版本变更并分析业务影响 |
| `detail` | 查看整改任务详情和确认历史 |
| `report` | 生成整改状态报告 |
| `confirm` | 确认业务影响（幂等） |
| `update-status` | 更新整改状态 |
| `assign` | 分配责任人 |
| `set-deadline` | 设置整改期限 |
| `correct-mapping` | 人工修正映射（保留审计追踪） |
| `status` | 查看系统状态 |
| `demo` | 运行完整演示流程 |

### 核心规则实现

1. **条款编号变化但内容相近 → 自动识别为 `RENUMBERED` 类型
2. **同一条款影响多个业务 → 基于映射关系自动计算
3. **责任人缺失 → 按部门匹配，缺失时标记为"未指定"
4. **整改逾期 → 自动标记为 OVERDUE 状态
5. **重复确认 → 24小时内相同确认自动去重
6. **幂等保证 → 重复执行不产生副作用
7. **人工修正 → 记录 before/after 和操作人

## 快速开始

### 环境要求

- Python 3.8+
- pip 或 poetry

### 安装

```bash
# 方式一：使用 pip
pip install click rich pyyaml

# 方式二：使用 poetry
poetry install
```

### 本地启动

```bash
# 1. 初始化项目
python -m reg_compliance.cli init --force

# 2. 导入样例数据
python -m reg_compliance.cli import all

# 3. 检查版本变更
python -m reg_compliance.cli check --old v1 --new v2 --detail
```

或者使用快捷方式（已配置脚本）：

```bash
# 查看命令帮助
python -m reg_compliance.cli --help
```

## 内置样例数据

工具内置了完整的样例数据，覆盖三个业务域：

### 隐私法规（PRIV-xxx）

- **PRIV-001** 个人信息收集原则
  - v1: 合法、正当、必要原则
  - v2: 新增"诚信原则"、"不得欺诈"、"自愿明确具体"
- **PRIV-002 → PRIV-004** 个人信息存储期限（编号变更）
  - v1: 最短存储期限
  - v2: 新增"期限届满后删除或匿名化"
- **PRIV-003** 个人信息共享要求
  - v1: 取得单独同意
  - v2: 新增"敏感个人信息需书面同意"
- **PRIV-005** 新增条款：自动化决策

### 财务法规（FIN-xxx）

- **FIN-001** 财务报告披露
  - v1: 按规定编制报告
  - v2: 新增"单位负责人签名盖章"
- **FIN-002** 内部控制
  - v1: 健全内控
  - v2: 新增"负责人对内控有效性负责"
- **FIN-003** 新增条款：内部审计要求

### 客服法规（CS-xxx）

- **CS-001** 着装规范（无变化）
- **CS-002 → CS-004** 投诉处理时限（编号和内容变化）
  - v1: 7个工作日
  - v2: 3个工作日，最长15日

### 业务项

| 代码 | 名称 | 部门 | 风险级别 |
|------|------|------|----------|
| BUS-001 | 用户注册 | 产品部 | HIGH |
| BUS-002 | 数据共享平台 | 技术部 | HIGH |
| BUS-003 | 推荐算法 | 算法部 | MEDIUM |
| BUS-005 | 财务报表系统 | 财务部 | HIGH |
| BUS-006 | 客服热线 | 客服部 | MEDIUM |
| BUS-007 | 内部审计 | 审计部 | HIGH |

### 责任人

| 代码 | 姓名 | 部门 |
|------|------|------|
| R-001 | 张三 | 产品部 |
| R-002 | 李四 | 技术部 |
| R-003 | 王五 | 财务部 |
| R-004 | 赵六 | 客服部 |

## 主要演示路径

### 路径一：完整合规流程（成功路径）

```bash
# 1. 初始化
python -m reg_compliance.cli init --force

# 2. 导入数据
python -m reg_compliance.cli import all

# 3. 检查变更
python -m reg_compliance.cli check --old v1 --new v2 --detail

# 4. 确认影响
python -m reg_compliance.cli confirm \
  --business BUS-001 \
  --article PRIV-001 \
  --operator 合规员A \
  --comment "已确认用户注册流程受影响"

# 5. 查看详情
python -m reg_compliance.cli detail \
  --business BUS-001 \
  --history

# 6. 更新状态
python -m reg_compliance.cli update-status \
  --business BUS-001 \
  --article PRIV-001 \
  --status in_progress \
  --operator 合规员A

# 7. 设置截止日期
python -m reg_compliance.cli set-deadline \
  --business BUS-001 \
  --article PRIV-001 \
  --deadline 2026-06-12 \
  --operator 合规员A

# 8. 完成整改
python -m reg_compliance.cli update-status \
  --business BUS-001 \
  --article PRIV-001 \
  --status completed \
  --operator 合规员A

# 9. 生成报告
python -m reg_compliance.cli report --format summary
```

### 路径二：幂等验证

```bash
# 重复执行相同的 check 命令
python -m reg_compliance.cli check --old v1 --new v2

# 会提示：因幂等跳过的任务数

# 重复确认
python -m reg_compliance.cli confirm \
  --business BUS-001 \
  --article PRIV-001 \
  --operator 合规员A

# 24小时内会提示：跳过重复确认
```

## 失败路径演示

### 失败场景1：导入不存在的版本

```bash
# 检查不存在的版本
python -m reg_compliance.cli check --old v999 --new v1000

# 预期错误：找不到旧版本: v999
```

### 失败场景2：分配不存在的责任人

```bash
# 分配不存在的责任人
python -m reg_compliance.cli assign \
  --business BUS-001 \
  --article PRIV-001 \
  --responsible R-999 \
  --operator 合规员A

# 预期：错误或幂等跳过
```

### 失败场景3：日期格式错误

```bash
# 错误的日期格式
python -m reg_compliance.cli set-deadline \
  --business BUS-001 \
  --article PRIV-001 \
  --deadline 2026/06/12 \
  --operator 合规员A

# 预期错误：日期格式错误
```

## 数据存储

所有数据存储在 `./data/` 目录下：

- `articles.json` - 法规条款（按版本）
- `business.json` - 业务项
- `mappings.json` - 条款-业务映射
- `responsibles.json` - 责任人
- `changes.json` - 版本变更记录
- `tasks.json` - 整改任务
- `confirmations.json` - 确认历史
- `corrections.json` - 人工修正历史
- `check_history.json` - 检查历史

## 输出解读

### 变更类型

| 类型 | 颜色 | 说明 |
|------|------|------|
| ADDED | 绿色 | 新增条款 |
| REMOVED | 红色 | 删除条款 |
| MODIFIED | 黄色 | 内容修改 |
| RENUMBERED | 蓝色 | 编号变更但内容相近 |
| UNCHANGED | 灰色 | 无变化 |

### 风险级别

| 级别 | 颜色 | 说明 |
|------|------|------|
| HIGH | 红色 | 高风险（新增/删除/大幅修改 |
| MEDIUM | 黄色 | 中风险（编号变更/中度修改 |
| LOW | 绿色 | 低风险（小幅修改） |

### 任务状态

| 状态 | 颜色 | 说明 |
|------|------|------|
| PENDING | 青色 | 待处理 |
| IN_PROGRESS | 蓝色 | 整改中 |
| COMPLETED | 绿色 | 已完成 |
| OVERDUE | 红色 | 已逾期 |
| CANCELLED | 灰色 | 已取消 |

## 闭环判断

运行 `report --format summary` 会自动判断：

- **✓ 所有高风险整改已完成，业务闭环!
- **✗ 存在未完成的高风险整改，请及时处理

## 审计追踪

所有人工操作都会被记录：

- 确认历史 (`confirmations.json`)
- 修正历史 (`corrections.json`)

每条记录包含：
- 操作人
- 操作时间
- 变更前状态
- 变更后状态
- 备注说明
