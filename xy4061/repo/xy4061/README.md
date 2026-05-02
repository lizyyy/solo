# 跳板机权限漂移巡检员 (JumpGuard)

企业内网运维专用的权限一致性审计工具，用于定期审计堡垒机账号、LDAP组、服务器资产清单和sudoers配置，自动识别权限漂移问题。

## 功能特性

- **多源数据导入**：支持导入堡垒机账号CSV、LDAP组成员、服务器资产清单、sudoers片段
- **六大规则引擎**：自动识别孤儿账号、组权限漂移、sudo规则越权、资产环境不匹配、重复账号、坏数据行
- **隔离与审计**：问题自动存入 quarantine.json，所有操作写入审计日志
- **计划与执行**：支持 dry-run 计划预览，确认后执行，支持 undo 撤销
- **多格式报告**：导出 Markdown、CSV、JSON 三种格式的审计报告

## 项目结构

```
jumpguard/
├── __init__.py
├── cli.py              # CLI 入口
├── config.py           # 配置管理
├── parsers/            # 数据解析器
│   ├── __init__.py
│   ├── account.py      # 堡垒机账号解析
│   ├── ldap.py         # LDAP组解析
│   ├── asset.py        # 资产清单解析
│   └── sudoers.py      # sudoers解析
├── engine/             # 规则引擎
│   ├── __init__.py
│   └── rules.py        # 六大检查规则
├── storage/            # 状态存储
│   ├── __init__.py
│   ├── store.py        # 数据存储
│   ├── quarantine.py   # 问题隔离
│   └── journal.py      # 审计日志
├── executor/           # 计划执行
│   ├── __init__.py
│   ├── planner.py      # 计划生成
│   └── applier.py      # 执行与撤销
└── reporter/           # 报告生成
    ├── __init__.py
    └── generator.py    # 多格式报告

examples/               # 示例数据文件
tests/                  # 测试用例
pyproject.toml          # 项目配置
```

## 安装

```bash
# 安装依赖
pip install -e .
```

## 快速开始：临时目录验证全流程

### 1. 创建临时工作目录

```bash
mkdir -p /tmp/jumpguard_demo
cd /tmp/jumpguard_demo
```

### 2. 初始化工作区

```bash
jumpguard init
```

输出：
```
✅ 配置文件已创建: /tmp/jumpguard_demo/jumpguard.yaml
📁 工作区目录: /tmp/jumpguard_demo/data

工作区结构:
  /tmp/jumpguard_demo/data/imports/ - 导入的原始文件存档
  /tmp/jumpguard_demo/data/state/ - 状态和隔离数据
  /tmp/jumpguard_demo/data/reports/ - 审计报告输出
```

### 3. 准备示例数据

将项目中的示例数据复制到当前目录：

```bash
cp /path/to/jumpguard/examples/* .
```

或手动创建以下文件：

**accounts.csv** (堡垒机账号清单)
```csv
username,department,status,last_login,email,employee_id,role
zhangsan,运维部,active,2026-04-28,zhangsan@company.com,E001,系统管理员
lisi,测试部,active,2026-04-25,lisi@company.com,E002,测试工程师
wangwu,开发部,active,2026-04-20,wangwu@company.com,E003,开发工程师
zhaoliu,运维部,terminated,2026-03-15,zhaoliu@company.com,E004,系统管理员
qianqi,测试部,active,2026-04-22,qianqi@company.com,E005,测试工程师
sunba,开发部,inactive,2026-02-28,sunba@company.com,E006,开发工程师
zhoujiu,运维部,active,2026-04-30,zhoujiu@company.com,E007,数据库管理员
lisi,测试部,active,2026-04-15,lisi2@company.com,E002,测试工程师
,运维部,active,2026-04-20,unknown@company.com,E008,安全管理员
```

**ldap_groups.txt** (LDAP组成员列表)
```txt
# LDAP 组成员列表
production_admin: 生产环境管理员组
  zhangsan
  zhaoliu
  zhoujiu

test_admin: 测试环境管理员组
  lisi
  qianqi
  zhaoliu

dev_admin: 开发环境管理员组
  wangwu
  sunba
```

**assets.csv** (服务器资产清单)
```csv
hostname,ip_address,environment,department,owner,status,tags
prod-web-01,192.168.1.10,production,运维部,zhangsan,active,web,nginx
prod-db-01,192.168.1.20,production,运维部,zhoujiu,active,database,mysql
prod-app-01,192.168.1.30,production,运维部,zhangsan,active,app,java
test-web-01,192.168.2.10,test,测试部,lisi,active,web,nginx
test-db-01,192.168.2.20,test,测试部,qianqi,active,database,mysql
dev-web-01,192.168.3.10,dev,开发部,wangwu,active,web,nginx
```

**sudoers** (sudo规则片段)
```
# 危险规则1: 测试用户lisi有ALL权限 (越权)
lisi ALL=(root) NOPASSWD: ALL

# 危险规则2: 离职用户zhaoliu仍有权限
zhaoliu prod-web-01=(root) /bin/su, /usr/bin/passwd

# 危险规则3: 普通用户有rm -rf权限
qianqi prod-db-01=(root) /bin/rm -rf /data

# 正常规则
zhangsan prod-web-01=(root) /usr/bin/systemctl restart nginx

# 正常规则
zhoujiu prod-db-01=(root) /usr/bin/mysqldump

# 危险规则4: 测试用户在生产服务器有权限 (资产环境不匹配)
lisi prod-app-01=(root) /usr/bin/java -jar

# 危险规则5: NOPASSWD 危险
sunba dev-web-01=(root) NOPASSWD: /usr/bin/apt-get, /usr/bin/yum
```

### 4. 导入数据源

```bash
# 导入账号CSV
jumpguard import-account accounts.csv

# 导入LDAP组
jumpguard import-ldap ldap_groups.txt

# 导入资产清单
jumpguard import-asset assets.csv

# 导入sudoers
jumpguard import-sudoers sudoers
```

### 5. 执行权限检查

```bash
jumpguard check
```

预期输出：
```
🔍 开始权限一致性检查...

📊 检查结果统计:
   总计发现: X 个问题
   严重级别分布:
     - 严重: X
     - 高: X
     - 中: X
     - 低: X
   问题类型分布:
     - 孤儿账号: 2 (zhaoliu, sunba 已离职但仍在组中)
     - 组权限漂移: 1 (测试部用户在生产组)
     - sudo规则越权: 4 (ALL权限、危险命令、NOPASSWD)
     - 资产环境不匹配: 2 (测试用户在生产服务器)
     - 重复账号: 1 (lisi 出现两次)
     - 坏数据行: 1 (空用户名)

📁 问题详情已保存: /tmp/jumpguard_demo/data/state/quarantine.json
```

### 6. 查看当前状态

```bash
jumpguard status
```

### 7. 生成回收计划 (Dry-Run)

```bash
jumpguard plan-remediate
```

或按严重级别过滤：

```bash
jumpguard plan-remediate --severity critical,high
```

### 8. 执行回收计划

```bash
# 先模拟执行 (dry-run)
jumpguard apply-confirm --plan ./data/state/remediation_PLAN-xxxx.json --dry-run

# 正式执行
jumpguard apply-confirm --plan ./data/state/remediation_PLAN-xxxx.json --operator "zhangsan"
```

### 9. 撤销操作

```bash
# 查看可撤销的操作
jumpguard status

# 撤销指定操作
jumpguard undo <entry_id>
```

### 10. 生成审计报告

```bash
# 生成所有格式
jumpguard report

# 仅生成 Markdown
jumpguard report --format markdown

# 仅生成 CSV
jumpguard report --format csv
```

报告将生成在 `./data/reports/` 目录下。

## 命令参考

### 初始化

| 命令 | 说明 |
|------|------|
| `jumpguard init` | 初始化配置文件和工作区 |
| `jumpguard init --force` | 强制覆盖现有配置 |

### 数据导入

| 命令 | 说明 |
|------|------|
| `jumpguard import-account <file.csv>` | 导入堡垒机账号CSV |
| `jumpguard import-ldap <file>` | 导入LDAP组成员（支持多种格式） |
| `jumpguard import-asset <file.csv>` | 导入服务器资产清单 |
| `jumpguard import-sudoers <file>` | 导入sudoers规则片段 |

### 权限检查

| 命令 | 说明 |
|------|------|
| `jumpguard check` | 执行所有规则检查 |
| `jumpguard check --rules orphan_account,sudo_overreach` | 仅执行指定规则 |

### 计划与执行

| 命令 | 说明 |
|------|------|
| `jumpguard plan-remediate` | 生成回收计划 |
| `jumpguard plan-remediate --severity critical,high` | 按严重级别过滤 |
| `jumpguard apply-confirm --plan <plan.json>` | 执行回收计划 |
| `jumpguard apply-confirm --plan <plan.json> --dry-run` | 模拟执行 |
| `jumpguard apply-confirm --plan <plan.json> --items ITEM-0001,ITEM-0002` | 仅执行指定项 |
| `jumpguard undo <entry_id>` | 撤销操作 |

### 报告生成

| 命令 | 说明 |
|------|------|
| `jumpguard report` | 生成所有格式报告 |
| `jumpguard report --format markdown` | 仅生成 Markdown |
| `jumpguard report --format csv` | 仅生成 CSV |
| `jumpguard report --format json` | 仅生成 JSON |

### 状态查看

| 命令 | 说明 |
|------|------|
| `jumpguard status` | 显示工作区状态 |

## 检查规则说明

| 规则ID | 名称 | 严重级别 | 说明 |
|--------|------|----------|------|
| `orphan_account` | 孤儿账号 | critical | 账号状态为离职/禁用，但仍在LDAP组或sudoers中有权限 |
| `group_drift` | 组权限漂移 | high | 测试部门用户在生产管理员组，或生产部门用户仅在测试组 |
| `sudo_overreach` | sudo规则越权 | critical | 包含ALL权限、危险命令（su, rm -rf, passwd等）、NOPASSWD标志 |
| `asset_env_mismatch` | 资产环境不匹配 | high | 测试用户在生产服务器上有sudo权限 |
| `duplicate_account` | 重复账号 | medium | 同一账号在清单中出现多次 |
| `bad_row` | 坏数据行 | low | 数据校验失败的行（如空用户名等） |

## 配置文件说明

配置文件 `jumpguard.yaml` 包含以下配置项：

```yaml
workspace:
  data_dir: ./data           # 数据根目录
  imports_dir: ./data/imports  # 导入文件存档
  state_dir: ./data/state      # 状态存储
  reports_dir: ./data/reports  # 报告输出

sources:
  account_csv:
    required_columns: ["username", "department", "status", "last_login"]
    status_active: ["active", "enabled"]
    status_inactive: ["inactive", "disabled", "terminated"]
  
  ldap_groups:
    group_mapping:
      production_admin: production_admin
      test_admin: test_admin
  
  assets:
    env_column: environment
    env_production: ["prod", "production", "线上"]
    env_test: ["test", "testing", "测试"]
    env_dev: ["dev", "development", "开发"]
  
  sudoers:
    forbidden_commands: ["rm -rf /", "su", "sudo su"]
    forbidden_users: ["root"]

rules:
  enabled:
    - orphan_account
    - group_drift
    - sudo_overreach
    - asset_env_mismatch
    - duplicate_account
    - bad_row
  severity:
    orphan_account: critical
    group_drift: high
    sudo_overreach: critical
    asset_env_mismatch: high
    duplicate_account: medium
    bad_row: low
```

## 运行测试

```bash
pip install pytest
pytest tests/ -v
```

## 工作区目录结构

```
data/
├── imports/              # 导入的原始文件存档（带时间戳）
│   ├── 20260501_100000_accounts.csv
│   ├── 20260501_100100_ldap_groups.txt
│   ├── 20260501_100200_assets.csv
│   └── 20260501_100300_sudoers
├── state/                # 状态和隔离数据
│   ├── state.json         # 解析后的状态数据
│   ├── imports.json       # 导入历史
│   ├── journal.json       # 操作日志
│   ├── quarantine.json    # 问题隔离数据
│   └── audit_logs/        # 审计日志存档
│       └── audit_20260501_103000.json
└── reports/              # 审计报告输出
    ├── audit_report_20260501_103000.md
    ├── audit_report_20260501_103000.json
    └── csv_report_20260501_103000/
        ├── issues.csv
        ├── journal.csv
        └── summary.csv
```

## 注意事项

1. **数据安全**：该工具仅在本地分析数据，不会主动连接AD、LDAP或服务器进行修改
2. **Dry-Run模式**：`plan-remediate` 和 `--dry-run` 选项不会实际修改任何系统
3. **审计追踪**：所有操作都会记录在 `journal.json` 中，支持撤销
4. **原始文件保留**：导入的文件会自动存档到 `imports/` 目录，带时间戳

## License

MIT License
