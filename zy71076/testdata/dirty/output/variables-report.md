# Terraform 变量溯源报告

**生成时间**: 2026-05-24 22:58:07

---

## 📊 总览统计

| 指标 | 数值 |
|------|------|
| 变量总数 | 12 |
| 敏感变量 | 3 |
| 模块数量 | 2 |
| 冲突数量 | 15 |

## 📈 变量来源分布

| 来源 | 数量 | 优先级 |
|------|------|--------|
| 默认值 | 0 | 0 (最低) |
| 模块输入 | 5 | 5 |
| tfvars | 5 | 10 |
| 环境变量 | 2 | 15 (最高) |

## 📁 检测到的 tfvars 文件

- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars`
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars`

## 🔍 变量详情

| 变量名 | 类型 | 敏感 | 生效来源 | 有效值 | 来源文件 |
|--------|------|------|----------|--------|----------|
| `app_name` | `string` | ❌ | `tfvars` | `dev-app` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars` |
| `database.backup_enabled` | `bool` | ❌ | `module_input` | `true` | - |
| `database.db_name` | `string` | ❌ | `module_input` | `production_db` | - |
| `database.db_pass` | `string` | ✅ | `module_input` | `p***4` (已遮蔽) | - |
| `database.db_user` | `string` | ❌ | `module_input` | `prod_admin` | - |
| `database.storage_gb` | `number` | ❌ | `module_input` | `100` | - |
| `db_password` | `string` | ✅ | `environment` | `e***s` (已遮蔽) | - |
| `environment` | `string` | ❌ | `tfvars` | `development` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars` |
| `feature_flags` | `map` | ❌ | `tfvars` | `map[beta_api:true caching:true new_ui:true]` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars` |
| `instance_size` | `string` | ❌ | `tfvars` | `large` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars` |
| `replicas` | `number` | ❌ | `tfvars` | `1` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars` |
| `secret_key` | `string` | ✅ | `environment` | `e***5` (已遮蔽) | - |

## 📋 变量溯源详情

本节详细解释每个变量的所有可能来源及其优先级。

### app_name

- **类型**: `string`
- **敏感变量**: false
- **当前生效值**: `dev-app`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `dev-app` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars` |
| 10 | `tfvars` | `production-app` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars` |
| 0 | `default` | `my-app` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'app_name' has multiple values, 'tfvars' takes precedence
  - 涉及来源: tfvars (value: dev-app), tfvars (value: production-app), default (value: my-app)
- **[WARNING]** Variable 'app_name' is set in multiple tfvars files
  - 涉及来源: /Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars, /Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars

### database.backup_enabled

- **类型**: `bool`
- **敏感变量**: false
- **当前生效值**: `true`
- **生效来源**: `module_input`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 5 | `module_input` | `true` | - |
| 0 | `default` | `true` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/modules/database/variables.tf` |

### database.db_name

- **类型**: `string`
- **敏感变量**: false
- **当前生效值**: `production_db`
- **生效来源**: `module_input`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 5 | `module_input` | `production_db` | - |
| 0 | `default` | `appdb` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/modules/database/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'db_name' has multiple values, 'module_input' takes precedence
  - 涉及来源: module_input (value: production_db), default (value: appdb)

### database.db_pass

- **类型**: `string`
- **敏感变量**: true
- **当前生效值**: `p***4` (已遮蔽)
- **生效来源**: `module_input`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 5 | `module_input` | `p***4` | - |
| 0 | `default` | `p***3` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/modules/database/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'db_pass' has multiple values, 'module_input' takes precedence
  - 涉及来源: module_input (value: p***4), default (value: p***3)

### database.db_user

- **类型**: `string`
- **敏感变量**: false
- **当前生效值**: `prod_admin`
- **生效来源**: `module_input`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 5 | `module_input` | `prod_admin` | - |
| 0 | `default` | `admin` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/modules/database/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'db_user' has multiple values, 'module_input' takes precedence
  - 涉及来源: module_input (value: prod_admin), default (value: admin)

### database.storage_gb

- **类型**: `number`
- **敏感变量**: false
- **当前生效值**: `100`
- **生效来源**: `module_input`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 5 | `module_input` | `100` | - |
| 0 | `default` | `20` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/modules/database/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'storage_gb' has multiple values, 'module_input' takes precedence
  - 涉及来源: module_input (value: 100), default (value: 20)

### db_password

- **类型**: `string`
- **敏感变量**: true
- **当前生效值**: `e***s` (已遮蔽)
- **生效来源**: `environment`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 15 | `environment` | `e***s` | - |
| 10 | `tfvars` | `d***5` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars` |
| 0 | `default` | `c***e` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'db_password' has multiple values, 'environment' takes precedence
  - 涉及来源: environment (value: e***s), tfvars (value: d***5), default (value: c***e)

### environment

- **类型**: `string`
- **敏感变量**: false
- **当前生效值**: `development`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `development` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars` |
| 10 | `tfvars` | `production` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars` |
| 0 | `default` | `dev` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'environment' has multiple values, 'tfvars' takes precedence
  - 涉及来源: tfvars (value: development), tfvars (value: production), default (value: dev)
- **[WARNING]** Variable 'environment' is set in multiple tfvars files
  - 涉及来源: /Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars, /Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars

### feature_flags

- **类型**: `map`
- **敏感变量**: false
- **当前生效值**: `map[beta_api:true caching:true new_ui:true]`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `map[beta_api:true caching:true new_ui:true]` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars` |
| 0 | `default` | `map[beta_api:false caching:true new_ui:false]` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'feature_flags' has multiple values, 'tfvars' takes precedence
  - 涉及来源: tfvars (value: map[beta_api:true caching:true new_ui:true]), default (value: map[beta_api:false caching:true new_ui:false])

### instance_size

- **类型**: `string`
- **敏感变量**: false
- **当前生效值**: `large`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `large` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars` |
| 10 | `tfvars` | `medium` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars` |
| 0 | `default` | `small` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'instance_size' has multiple values, 'tfvars' takes precedence
  - 涉及来源: tfvars (value: large), tfvars (value: medium), default (value: small)
- **[WARNING]** Variable 'instance_size' is set in multiple tfvars files
  - 涉及来源: /Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars, /Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars

### replicas

- **类型**: `number`
- **敏感变量**: false
- **当前生效值**: `1`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `1` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars` |
| 10 | `tfvars` | `3` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars` |
| 0 | `default` | `1` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'replicas' has multiple values, 'tfvars' takes precedence
  - 涉及来源: tfvars (value: 1), tfvars (value: 3), default (value: 1)
- **[WARNING]** Variable 'replicas' is set in multiple tfvars files
  - 涉及来源: /Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars, /Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars

### secret_key

- **类型**: `string`
- **敏感变量**: true
- **当前生效值**: `e***5` (已遮蔽)
- **生效来源**: `environment`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 15 | `environment` | `e***5` | - |

## ⚠️ 全局冲突与警告

### 1. [WARNING] Variable 'app_name' is defined in multiple files

**涉及来源:**
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/override.tf`
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/variables.tf`

### 2. [INFO] Variable 'environment' has multiple values, 'tfvars' takes precedence

**涉及来源:**
- `tfvars (value: development)`
- `tfvars (value: production)`
- `default (value: dev)`

### 3. [WARNING] Variable 'environment' is set in multiple tfvars files

**涉及来源:**
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars`
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars`

### 4. [INFO] Variable 'db_password' has multiple values, 'environment' takes precedence

**涉及来源:**
- `environment (value: e***s)`
- `tfvars (value: d***5)`
- `default (value: c***e)`

### 5. [INFO] Variable 'instance_size' has multiple values, 'tfvars' takes precedence

**涉及来源:**
- `tfvars (value: large)`
- `tfvars (value: medium)`
- `default (value: small)`

### 6. [WARNING] Variable 'instance_size' is set in multiple tfvars files

**涉及来源:**
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars`
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars`

### 7. [INFO] Variable 'replicas' has multiple values, 'tfvars' takes precedence

**涉及来源:**
- `tfvars (value: 1)`
- `tfvars (value: 3)`
- `default (value: 1)`

### 8. [WARNING] Variable 'replicas' is set in multiple tfvars files

**涉及来源:**
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars`
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars`

### 9. [INFO] Variable 'feature_flags' has multiple values, 'tfvars' takes precedence

**涉及来源:**
- `tfvars (value: map[beta_api:true caching:true new_ui:true])`
- `default (value: map[beta_api:false caching:true new_ui:false])`

### 10. [INFO] Variable 'app_name' has multiple values, 'tfvars' takes precedence

**涉及来源:**
- `tfvars (value: dev-app)`
- `tfvars (value: production-app)`
- `default (value: my-app)`

### 11. [WARNING] Variable 'app_name' is set in multiple tfvars files

**涉及来源:**
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/terraform.tfvars`
- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/dirty/dev.tfvars`

### 12. [INFO] Variable 'db_user' has multiple values, 'module_input' takes precedence

**涉及来源:**
- `module_input (value: prod_admin)`
- `default (value: admin)`

### 13. [INFO] Variable 'db_pass' has multiple values, 'module_input' takes precedence

**涉及来源:**
- `module_input (value: p***4)`
- `default (value: p***3)`

### 14. [INFO] Variable 'storage_gb' has multiple values, 'module_input' takes precedence

**涉及来源:**
- `module_input (value: 100)`
- `default (value: 20)`

### 15. [INFO] Variable 'db_name' has multiple values, 'module_input' takes precedence

**涉及来源:**
- `module_input (value: production_db)`
- `default (value: appdb)`

## 📖 优先级规则说明

Terraform 变量值的优先级从高到低依次为：

1. **环境变量** (`TF_VAR_*`) - 优先级 15
2. **tfvars 文件** - 优先级 10
3. **模块输入变量** - 优先级 5
4. **默认值**（变量定义中的 default）- 优先级 0

当多个来源为同一个变量提供值时，优先级最高的值将生效。

---

*报告由 tfvars-trace 自动生成*
