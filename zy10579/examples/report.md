# Jenkins Job 参数审计报告

> 审计时间: 2026-05-17 23:24:23
> Job名称: examples
> 配置文件: /Users/lzy/pro/solo/workspaces/zy10579/examples/config.xml

## 📊 审计摘要

| 指标 | 数值 |
|------|------|
| 总参数数量 | 9 |
| 有默认值的参数 | 6 |
| 无默认值的参数 | 3 |
| 总构建步骤 | 3 |
| 危险步骤数量 | 2 |
| 解析错误数量 | 0 |

### 风险分布

| 风险等级 | 数量 |
|----------|------|

| SAFE | 0 |

| WARNING | 2 |

| DANGER | 4 |

| CRITICAL | 3 |


---

## ⚠️ 高风险参数 (CRITICAL/DANGER)


### ENVIRONMENT (DANGER)

- **参数类型**: StringParameterDefinition
- **默认值**: `production`
- **位置**: 第 0 行
- **风险原因**: 默认指向生产环境 | 参数被危险构建步骤使用
- **使用位置**: 步骤 0
- **描述**: 部署环境


### FORCE_DEPLOY (CRITICAL)

- **参数类型**: BooleanParameterDefinition
- **默认值**: `true`
- **位置**: 第 0 行
- **风险原因**: 可能强制覆盖资源 | 布尔参数默认为真，可能自动执行危险操作 | 参数被危险构建步骤使用
- **使用位置**: 步骤 0
- **描述**: 是否强制部署（覆盖现有实例）


### CLEAN_OLD_DATA (DANGER)

- **参数类型**: BooleanParameterDefinition
- **默认值**: `false`
- **位置**: 第 0 行
- **风险原因**: 可能清理数据 | 参数被危险构建步骤使用
- **使用位置**: 步骤 0
- **描述**: 部署前清理旧数据


### DEPLOY_STRATEGY (DANGER)

- **参数类型**: ChoiceParameterDefinition
- **默认值**: `无`
- **位置**: 第 0 行
- **风险原因**: 参数无默认值，需人工确认 | 参数被危险构建步骤使用
- **使用位置**: 步骤 0
- **描述**: 部署策略


### DELETE_TARGET (CRITICAL)

- **参数类型**: StringParameterDefinition
- **默认值**: `*`
- **位置**: 第 0 行
- **风险原因**: 可能触发删除操作 | 通配符默认值可能影响范围过大 | 参数被危险构建步骤使用
- **使用位置**: 步骤 1
- **描述**: 需要删除的目标资源


### API_TOKEN (CRITICAL)

- **参数类型**: PasswordParameterDefinition
- **默认值**: `无`
- **位置**: 第 0 行
- **风险原因**: 参数无默认值，需人工确认 | 敏感参数类型: PasswordParameterDefinition | 参数被危险构建步骤使用
- **使用位置**: 步骤 1
- **描述**: API访问令牌


### EXTRA_CONFIG (DANGER)

- **参数类型**: TextParameterDefinition
- **默认值**: `无`
- **位置**: 第 0 行
- **风险原因**: 参数无默认值，需人工确认 | 参数未被任何构建步骤使用，可能是冗余参数
- **使用位置**: 未使用
- **描述**: 额外配置内容



---

## 📋 所有参数详情

| 参数名 | 类型 | 默认值 | 风险等级 | 行号 | 备注 |
|--------|------|--------|----------|------|------|

| ENVIRONMENT | StringParameterDefinition | `production` | DANGER | 0 | 默认指向生产环境 | 参数被危险构建步骤使用 |

| SERVICE_NAME | StringParameterDefinition | `api-gateway` | WARNING | 0 | 参数被危险构建步骤使用 |

| FORCE_DEPLOY | BooleanParameterDefinition | `true` | CRITICAL | 0 | 可能强制覆盖资源 | 布尔参数默认为真，可能自动执行危险操作 | 参数被危险构建步骤使用 |

| CLEAN_OLD_DATA | BooleanParameterDefinition | `false` | DANGER | 0 | 可能清理数据 | 参数被危险构建步骤使用 |

| DEPLOY_STRATEGY | ChoiceParameterDefinition | `无` | DANGER | 0 | 参数无默认值，需人工确认 | 参数被危险构建步骤使用 |

| DELETE_TARGET | StringParameterDefinition | `*` | CRITICAL | 0 | 可能触发删除操作 | 通配符默认值可能影响范围过大 | 参数被危险构建步骤使用 |

| API_TOKEN | PasswordParameterDefinition | `无` | CRITICAL | 0 | 参数无默认值，需人工确认 | 敏感参数类型: PasswordParameterDefinition | 参数被危险构建步骤使用 |

| EXTRA_CONFIG | TextParameterDefinition | `无` | DANGER | 0 | 参数无默认值，需人工确认 | 参数未被任何构建步骤使用，可能是冗余参数 |

| UNUSED_PARAM | StringParameterDefinition | `test` | WARNING | 0 | 参数未被任何构建步骤使用，可能是冗余参数 |


---

## 🚨 危险构建步骤


### 步骤 #0 - hudson.tasks.Shell

- **位置**: 第 0 行
- **危险原因**: 递归删除命令
- **使用参数**: ENVIRONMENT, SERVICE_NAME, FORCE_DEPLOY, CLEAN_OLD_DATA, DEPLOY_STRATEGY


### 步骤 #1 - hudson.tasks.Shell

- **位置**: 第 0 行
- **危险原因**: 管道执行远程脚本
- **使用参数**: DELETE_TARGET, API_TOKEN



---

## ❌ 解析错误



---

## 💡 审计建议

1. **高风险参数**: 请重点检查标记为 CRITICAL 和 DANGER 的参数，确认其默认值是否合理
2. **无默认值参数**: 无默认值的参数需要每次构建时人工输入，建议添加合理的默认值
3. **冗余参数**: 未被任何步骤使用的参数建议清理
4. **危险步骤**: 包含危险命令的构建步骤需要添加额外的确认机制