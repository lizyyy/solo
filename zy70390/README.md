# 影子账号清理 CLI

安全团队每季度清理账号时，发现同一个人在 Git、BI、CRM 里名字和邮箱不完全一致，很难判断哪些是影子账号。

这个 CLI 工具读取 HR 员工状态、各系统账号清单和权限列表，按邮箱、姓名、手机号、员工号做匹配，识别：
- 离职未禁用账号
- 转岗残留高权限账号
- 无人认领账号
- 重复账号

## 功能特性

- **多字段匹配**: 按邮箱、姓名、手机号、员工号匹配，支持历史邮箱和历史部门
- **置信度计算**: 匹配结果给出置信度和证据字段，同名员工标记为歧义（不自动合并）
- **风险评估**: 识别5种风险类型，给出风险等级和建议动作
- **人工认领**: 支持人工认领账号，留历史记录
- **服务账号豁免**: 豁免要有负责人和到期时间，不能永久忽略
- **禁用计划**: 支持创建账号禁用计划，检查过期
- **报告生成**: 支持 JSON 和 HTML 格式报告

## 安装

```bash
# 使用 Poetry 安装依赖
poetry install

# 或使用 pip
pip install -e .
```

## 快速开始

```bash
# 1. 初始化（已完成，直接用样例数据）
python -m shadow_account_cleaner init

# 2. 查看所有命令
python -m shadow_account_cleaner --help

# 3. 匹配账号与员工
python -m shadow_account_cleaner match

# 4. 评估风险
python -m shadow_account_cleaner risk

# 5. 人工认领账号
python -m shadow_account_cleaner mark-owner ACC007 --owner EMP001 --reason "确认归属" --by "SEC001"

# 6. 服务账号豁免
python -m shadow_account_cleaner mark-owner ACC010 --exemption --exemption-days 90 --reason "CI自动化服务账号" --by "SEC001"

# 7. 创建禁用计划
python -m shadow_account_cleaner plan-disable ACC004 --days 7 --reason "离职员工账号" --by "SEC001"

# 8. 查看禁用计划
python -m shadow_account_cleaner plans

# 9. 查看认领历史
python -m shadow_account_cleaner history

# 10. 生成完整报告
python -m shadow_account_cleaner report -o output/report.json
python -m shadow_account_cleaner report -o output/report.html -f html
```

## 命令说明

| 命令 | 说明 |
|------|------|
| `init` | 初始化配置和目录 |
| `match` | 匹配账号与HR员工数据 |
| `risk` | 评估账号风险 |
| `mark-owner` | 人工标记账号归属（认领/豁免） |
| `history` | 查看人工认领历史记录 |
| `plan-disable` | 创建账号禁用计划 |
| `plans` | 查看禁用计划列表 |
| `report` | 生成完整的清理报告 |

## 数据文件格式

### 1. HR 员工数据 (`data/employees.yaml`)

```yaml
- employee_id: "EMP001"
  name: "张三"
  email: "zhangsan@company.com"
  phone: "13800138001"
  department: "技术部"
  position: "高级工程师"
  status: "active"           # active/terminated/transferred
  join_date: "2020-01-15"
  termination_date: null      # 离职日期（仅terminated状态）
  previous_departments: []    # 历史部门（转岗记录）
  previous_emails: []         # 历史邮箱
```

### 2. 系统账号清单 (`data/accounts.yaml`)

```yaml
- account_id: "ACC001"
  system: "git"
  username: "zhangsan"
  name: "张三"
  email: "zhangsan@company.com"
  phone: "13800138001"
  employee_id: "EMP001"
  status: "active"           # active/disabled
  last_login: "2026-05-10 14:30:00"
  is_service_account: false
  service_account_owner: null
  service_account_expiry: null
```

### 3. 权限列表 (`data/permissions.yaml`)

```yaml
- permission_id: "PERM001"
  account_id: "ACC001"
  system: "git"
  role: "developer"
  permissions: ["repo:read", "repo:write"]
  is_high_risk: false
  granted_at: "2020-01-20 10:30:00"
```

## 风险类型

| 风险类型 | 说明 | 建议动作 |
|---------|------|---------|
| `terminated_employee` | 离职员工账号仍活跃 | 立即禁用 |
| `transferred_stale` | 转岗员工仍持有原部门高权限 | 重新评估权限 |
| `unclaimed` | 无法匹配到任何在职员工 | 确认归属或禁用 |
| `duplicate` | 同一员工在同一系统有多个活跃账号 | 合并或清理 |
| `service_account_expired` | 服务账号豁免已过期 | 重新评估或禁用 |

## 样例数据说明

样例数据包含以下场景：

| 账号 | 场景 | 预期风险 |
|------|------|---------|
| ACC001-ACC003 | 正常在职员工 | 无风险 |
| ACC004 | 离职员工（吴九）账号未禁用 | 中风险 |
| ACC005 | 离职员工（郑十）有CRM高权限 | 高风险 |
| ACC006 | 转岗员工（赵六）残留CRM高权限 | 高风险 |
| ACC007 | 无人账号，90天未登录 | 高风险 |
| ACC008 | 无人账号，测试账号 | 中风险 |
| ACC009 | 张三的重复账号 | 中风险 |
| ACC010 | 服务账号，豁免有效 | 无风险 |
| ACC011 | 服务账号，豁免已过期 | 高风险 |
| ACC012-ACC014 | 正常在职员工 | 无风险 |

特别注意：
- **张三 (EMP001 vs EMP009)**: 同名不同人，不会自动合并，标记为歧义匹配
- **李四 (EMP002)**: 邮箱变更（lisi.old@company.com → lisi@company.com），通过历史邮箱匹配
- **赵六 (EMP004)**: 已转岗但仍有原部门高权限

## 配置文件

`shadow_account_cleaner.yaml`:

```yaml
data_directory: "./data"
output_directory: "./output"
history_file: "./output/history.json"

systems:
  git:
    high_risk_roles: ["admin", "owner", "maintainer"]
  bi:
    high_risk_roles: ["admin", "super_admin", "data_owner"]
  crm:
    high_risk_roles: ["admin", "system_admin", "data_manager"]
```

## 工作流程

1. **数据导入**: 从 HR 系统、Git、BI、CRM 导出数据到 `data/` 目录
2. **自动匹配**: 运行 `match` 命令，查看匹配结果和置信度
3. **人工确认**: 对低置信度和歧义匹配，运行 `mark-owner` 认领
4. **风险评估**: 运行 `risk` 命令，查看风险账号
5. **制定计划**: 对风险账号创建 `plan-disable` 或 `mark-owner --exemption`
6. **生成报告**: 运行 `report` 命令，导出给管理层审批
7. **执行清理**: 按计划执行禁用，更新计划状态

## 历史记录

所有人工操作都会记录在 `output/history.json` 中，包括：
- 认领时间、操作人、原因
- 豁免到期时间
- 禁用计划状态

每季度运行时，会读取上季度的认领和豁免记录，避免重复工作。
