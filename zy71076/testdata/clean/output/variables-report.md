# Terraform 变量溯源报告

**生成时间**: 2026-05-24 22:59:42

---

## 📊 总览统计

| 指标 | 数值 |
|------|------|
| 变量总数 | 11 |
| 敏感变量 | 1 |
| 模块数量 | 2 |
| 冲突数量 | 9 |

## 📈 变量来源分布

| 来源 | 数量 | 优先级 |
|------|------|--------|
| 默认值 | 1 | 0 (最低) |
| 模块输入 | 4 | 5 |
| tfvars | 6 | 10 |
| 环境变量 | 0 | 15 (最高) |

## 📁 检测到的 tfvars 文件

- `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars`

## 🔍 变量详情

| 变量名 | 类型 | 敏感 | 生效来源 | 有效值 | 来源文件 |
|--------|------|------|----------|--------|----------|
| `api_key` | `string` | ✅ | `default` | `d***3` (已遮蔽) | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/variables.tf` |
| `enable_monitoring` | `bool` | ❌ | `tfvars` | `true` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| `environment` | `string` | ❌ | `tfvars` | `production` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| `instance_count` | `number` | ❌ | `tfvars` | `3` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| `instance_type` | `string` | ❌ | `tfvars` | `ecs.c6.large` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| `network.enable_nat` | `bool` | ❌ | `module_input` | `true` | - |
| `network.network_tags` | `map` | ❌ | `module_input` | `map[Project:production-app]` | - |
| `network.subnet_count` | `number` | ❌ | `module_input` | `3` | - |
| `network.vpc_cidr` | `string` | ❌ | `module_input` | `172.16.0.0/16` | - |
| `region` | `string` | ❌ | `tfvars` | `cn-shanghai` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| `tags` | `map` | ❌ | `tfvars` | `map[Env:prod Project:production-app Tier:web]` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |

## 📋 变量溯源详情

本节详细解释每个变量的所有可能来源及其优先级。

### api_key

- **类型**: `string`
- **敏感变量**: true
- **当前生效值**: `d***3` (已遮蔽)
- **生效来源**: `default`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 0 | `default` | `d***3` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/variables.tf` |

### enable_monitoring

- **类型**: `bool`
- **敏感变量**: false
- **当前生效值**: `true`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `true` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| 0 | `default` | `true` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/variables.tf` |

### environment

- **类型**: `string`
- **敏感变量**: false
- **当前生效值**: `production`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `production` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| 0 | `default` | `development` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'environment' has multiple values, 'tfvars' takes precedence
  - 涉及来源: tfvars (value: production), default (value: development)

### instance_count

- **类型**: `number`
- **敏感变量**: false
- **当前生效值**: `3`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `3` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| 0 | `default` | `1` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'instance_count' has multiple values, 'tfvars' takes precedence
  - 涉及来源: tfvars (value: 3), default (value: 1)

### instance_type

- **类型**: `string`
- **敏感变量**: false
- **当前生效值**: `ecs.c6.large`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `ecs.c6.large` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| 0 | `default` | `ecs.t5.large` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'instance_type' has multiple values, 'tfvars' takes precedence
  - 涉及来源: tfvars (value: ecs.c6.large), default (value: ecs.t5.large)

### network.enable_nat

- **类型**: `bool`
- **敏感变量**: false
- **当前生效值**: `true`
- **生效来源**: `module_input`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 5 | `module_input` | `true` | - |
| 0 | `default` | `false` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/modules/network/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'enable_nat' has multiple values, 'module_input' takes precedence
  - 涉及来源: module_input (value: true), default (value: false)

### network.network_tags

- **类型**: `map`
- **敏感变量**: false
- **当前生效值**: `map[Project:production-app]`
- **生效来源**: `module_input`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 5 | `module_input` | `map[Project:production-app]` | - |
| 0 | `default` | `map[Component:network]` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/modules/network/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'network_tags' has multiple values, 'module_input' takes precedence
  - 涉及来源: module_input (value: map[Project:production-app]), default (value: map[Component:network])

### network.subnet_count

- **类型**: `number`
- **敏感变量**: false
- **当前生效值**: `3`
- **生效来源**: `module_input`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 5 | `module_input` | `3` | - |
| 0 | `default` | `2` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/modules/network/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'subnet_count' has multiple values, 'module_input' takes precedence
  - 涉及来源: module_input (value: 3), default (value: 2)

### network.vpc_cidr

- **类型**: `string`
- **敏感变量**: false
- **当前生效值**: `172.16.0.0/16`
- **生效来源**: `module_input`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 5 | `module_input` | `172.16.0.0/16` | - |
| 0 | `default` | `10.0.0.0/16` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/modules/network/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'vpc_cidr' has multiple values, 'module_input' takes precedence
  - 涉及来源: module_input (value: 172.16.0.0/16), default (value: 10.0.0.0/16)

### region

- **类型**: `string`
- **敏感变量**: false
- **当前生效值**: `cn-shanghai`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `cn-shanghai` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| 0 | `default` | `cn-beijing` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'region' has multiple values, 'tfvars' takes precedence
  - 涉及来源: tfvars (value: cn-shanghai), default (value: cn-beijing)

### tags

- **类型**: `map`
- **敏感变量**: false
- **当前生效值**: `map[Env:prod Project:production-app Tier:web]`
- **生效来源**: `tfvars`

#### 所有值来源（按优先级排序）

| 优先级 | 来源类型 | 值 | 来源文件 |
|--------|----------|----|----------|
| 10 | `tfvars` | `map[Env:prod Project:production-app Tier:web]` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/terraform.tfvars` |
| 0 | `default` | `map[Owner:devops Project:demo]` | `/Users/lzy/pro/solo/workspaces/zy71076/testdata/clean/variables.tf` |

#### ⚠️ 检测到的问题

- **[INFO]** Variable 'tags' has multiple values, 'tfvars' takes precedence
  - 涉及来源: tfvars (value: map[Env:prod Project:production-app Tier:web]), default (value: map[Owner:devops Project:demo])

## ⚠️ 全局冲突与警告

### 1. [INFO] Variable 'tags' has multiple values, 'tfvars' takes precedence

**涉及来源:**
- `tfvars (value: map[Env:prod Project:production-app Tier:web])`
- `default (value: map[Owner:devops Project:demo])`

### 2. [INFO] Variable 'environment' has multiple values, 'tfvars' takes precedence

**涉及来源:**
- `tfvars (value: production)`
- `default (value: development)`

### 3. [INFO] Variable 'region' has multiple values, 'tfvars' takes precedence

**涉及来源:**
- `tfvars (value: cn-shanghai)`
- `default (value: cn-beijing)`

### 4. [INFO] Variable 'instance_count' has multiple values, 'tfvars' takes precedence

**涉及来源:**
- `tfvars (value: 3)`
- `default (value: 1)`

### 5. [INFO] Variable 'instance_type' has multiple values, 'tfvars' takes precedence

**涉及来源:**
- `tfvars (value: ecs.c6.large)`
- `default (value: ecs.t5.large)`

### 6. [INFO] Variable 'vpc_cidr' has multiple values, 'module_input' takes precedence

**涉及来源:**
- `module_input (value: 172.16.0.0/16)`
- `default (value: 10.0.0.0/16)`

### 7. [INFO] Variable 'subnet_count' has multiple values, 'module_input' takes precedence

**涉及来源:**
- `module_input (value: 3)`
- `default (value: 2)`

### 8. [INFO] Variable 'enable_nat' has multiple values, 'module_input' takes precedence

**涉及来源:**
- `module_input (value: true)`
- `default (value: false)`

### 9. [INFO] Variable 'network_tags' has multiple values, 'module_input' takes precedence

**涉及来源:**
- `module_input (value: map[Project:production-app])`
- `default (value: map[Component:network])`

## 📖 优先级规则说明

Terraform 变量值的优先级从高到低依次为：

1. **环境变量** (`TF_VAR_*`) - 优先级 15
2. **tfvars 文件** - 优先级 10
3. **模块输入变量** - 优先级 5
4. **默认值**（变量定义中的 default）- 优先级 0

当多个来源为同一个变量提供值时，优先级最高的值将生效。

---

*报告由 tfvars-trace 自动生成*
