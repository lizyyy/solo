# Helm Values 泄密扫描报告

> 生成时间: 2026-05-24T11:17:24.236Z
> 环境: test

## 📋 扫描信息

| 项目 | 内容 |
|------|------|
| 扫描时间 | 2026-05-24T11:17:24.236Z |
| 环境 | test |
| Values 文件 | `examples/values-test.yaml` |
| 例外配置 | `examples/exceptions.yaml` |

## 📊 扫描摘要

| 统计项 | 数量 |
|--------|------|
| 扫描文件数 | 1 |
| 发现问题数 | 31 |
| 🔴 严重 | 7 |
| 🔴 高危 | 13 |
| 🟡 中危 | 2 |
| 🔵 低危 | 9 |
| 📌 已例外 | 1 |
| ⚠️  过期例外 | 7 |

## 🔍 发现的敏感信息

### 🔴 严重级别 (7 项)

#### AWS Access Key

| 属性 | 值 |
|------|-----|
| 规则 ID | `aws-access-key` |
| 严重级别 | 🔴 严重 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 55 |

**描述:**
检测 AWS 访问密钥 ID (AKIA 开头)

**证据:**
```
第 55 行发现敏感内容: "AKIAIOSFODNN7EXAMPLE"
```


#### Database Password

| 属性 | 值 |
|------|-----|
| 规则 ID | `database-password` |
| 严重级别 | 🔴 严重 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 55 |

**描述:**
检测数据库密码配置

**证据:**
```
第 55 行发现敏感内容: "password: "AKIAIOSFODNN7EXAMPLE""
```


#### AWS Secret Key

| 属性 | 值 |
|------|-----|
| 规则 ID | `aws-secret-key` |
| 严重级别 | 🔴 严重 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 60 |

**描述:**
检测 AWS 秘密访问密钥

**证据:**
```
第 60 行发现敏感内容: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```


#### Database Password

| 属性 | 值 |
|------|-----|
| 规则 ID | `database-password` |
| 严重级别 | 🔴 严重 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 67 |
| 编码方式 | Base64 |

**描述:**
检测数据库密码配置

**证据:**
```
第 67 行 Base64 解码后发现敏感信息: {"auths":{"registry.example.com":{"username":"admin","password":"supersecret"}}}...
```

**Base64 解码后 (已脱敏):**
```
{"au************************************************************************"}}}
```


#### AWS Access Key

| 属性 | 值 |
|------|-----|
| 规则 ID | `aws-access-key` |
| 严重级别 | 🔴 严重 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `aws.access_key_id` |

**描述:**
检测 AWS 访问密钥 ID (AKIA 开头)

**证据:**
```
路径 aws.access_key_id 中发现匹配: "AKIAIOSFODNN7EXAMPLE"
```


#### AWS Secret Key

| 属性 | 值 |
|------|-----|
| 规则 ID | `aws-secret-key` |
| 严重级别 | 🔴 严重 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `aws.secret_access_key` |

**描述:**
检测 AWS 秘密访问密钥

**证据:**
```
路径 aws.secret_access_key 中发现匹配: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```


#### Database Password

| 属性 | 值 |
|------|-----|
| 规则 ID | `database-password` |
| 严重级别 | 🔴 严重 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `secrets.dockerconfigjson` |
| 编码方式 | Base64 |

**描述:**
检测数据库密码配置

**证据:**
```
Base64 解码后: {"auths":{"registry.example.com":{"username":"admin","password":"supersecret"}}}
```

**Base64 解码后 (已脱敏):**
```
{"au************************************************************************"}}}
```


### 🔴 高危级别 (13 项)

#### Basic Authentication

| 属性 | 值 |
|------|-----|
| 规则 ID | `basic-auth` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 56 |

**描述:**
检测 HTTP Basic 认证字符串

**证据:**
```
第 56 行发现敏感内容: "https://admin:supersecret123@db.internal.corp""
```


#### Kubernetes dockerconfigjson

| 属性 | 值 |
|------|-----|
| 规则 ID | `kubernetes-dockerconfigjson` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 67 |

**描述:**
检测 Kubernetes 镜像拉取密钥 (base64 编码)

**证据:**
```
第 67 行发现敏感内容: "eyJhdXRocyI6eyJyZWdpc3RyeS5leGFtcGxlLmNvbSI6eyJ1c2VybmFtZSI6..."
```


#### Generic API Key

| 属性 | 值 |
|------|-----|
| 规则 ID | `generic-api-key` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 68 |

**描述:**
检测通用 API 密钥格式

**证据:**
```
第 68 行发现敏感内容: "token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
```


#### JWT Token

| 属性 | 值 |
|------|-----|
| 规则 ID | `jwt-token` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 68 |

**描述:**
检测 JSON Web Token

**证据:**
```
第 68 行发现敏感内容: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODk..."
```


#### Slack Webhook

| 属性 | 值 |
|------|-----|
| 规则 ID | `slack-webhook` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 71 |

**描述:**
检测 Slack Webhook URL

**证据:**
```
第 71 行发现敏感内容: "https://example.com/redacted-slack-webhook..."
```


#### Basic Authentication

| 属性 | 值 |
|------|-----|
| 规则 ID | `basic-auth` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 74 |

**描述:**
检测 HTTP Basic 认证字符串

**证据:**
```
第 74 行发现敏感内容: "https://deploy:mysecretpassword@github.com/org/repo.git""
```


#### Git Credentials

| 属性 | 值 |
|------|-----|
| 规则 ID | `git-credentials` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 74 |

**描述:**
检测 Git 凭证 URL

**证据:**
```
第 74 行发现敏感内容: "https://deploy:mysecretpassword@github.com"
```


#### Basic Authentication

| 属性 | 值 |
|------|-----|
| 规则 ID | `basic-auth` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `database.url` |

**描述:**
检测 HTTP Basic 认证字符串

**证据:**
```
路径 database.url 中发现匹配: "https://admin:supersecret123@db.internal.corp"
```


#### Kubernetes dockerconfigjson

| 属性 | 值 |
|------|-----|
| 规则 ID | `kubernetes-dockerconfigjson` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `secrets.dockerconfigjson` |

**描述:**
检测 Kubernetes 镜像拉取密钥 (base64 编码)

**证据:**
```
路径 secrets.dockerconfigjson 中发现匹配: "eyJhdXRocyI6eyJyZWdpc3RyeS5leGFtcGxlLmNvbSI6eyJ1c2..."
```


#### JWT Token

| 属性 | 值 |
|------|-----|
| 规则 ID | `jwt-token` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `secrets.jwt_token` |

**描述:**
检测 JSON Web Token

**证据:**
```
路径 secrets.jwt_token 中发现匹配: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxM..."
```


#### Slack Webhook

| 属性 | 值 |
|------|-----|
| 规则 ID | `slack-webhook` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `slack.webhook` |

**描述:**
检测 Slack Webhook URL

**证据:**
```
路径 slack.webhook 中发现匹配: "https://example.com/redacted-slack-webhook..."
```


#### Basic Authentication

| 属性 | 值 |
|------|-----|
| 规则 ID | `basic-auth` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `git.clone_url` |

**描述:**
检测 HTTP Basic 认证字符串

**证据:**
```
路径 git.clone_url 中发现匹配: "https://deploy:mysecretpassword@github.com/org/rep..."
```


#### Git Credentials

| 属性 | 值 |
|------|-----|
| 规则 ID | `git-credentials` |
| 严重级别 | 🔴 高危 |
| 分类 | credential |
| 文件 | `examples/values-test.yaml` |
| 路径 | `git.clone_url` |

**描述:**
检测 Git 凭证 URL

**证据:**
```
路径 git.clone_url 中发现匹配: "https://deploy:mysecretpassword@github.com"
```


### 🟡 中危级别 (2 项)

#### Intranet IP Address

| 属性 | 值 |
|------|-----|
| 规则 ID | `intranet-ip` |
| 严重级别 | 🟡 中危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 52 |

**描述:**
检测内网 IP 地址 (10.x, 172.16-31.x, 192.168.x)

**证据:**
```
第 52 行发现敏感内容: "10.0.0.100"
```


#### Intranet IP Address

| 属性 | 值 |
|------|-----|
| 规则 ID | `intranet-ip` |
| 严重级别 | 🟡 中危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `database.host` |

**描述:**
检测内网 IP 地址 (10.x, 172.16-31.x, 192.168.x)

**证据:**
```
路径 database.host 中发现匹配: "10.0.0.100"
```


### 🔵 低危级别 (9 项)

#### Internal Domain

| 属性 | 值 |
|------|-----|
| 规则 ID | `internal-domain` |
| 严重级别 | 🔵 低危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 31 |

**描述:**
检测常见内网域名后缀

**证据:**
```
第 31 行发现敏感内容: "chart-example.local"
```


#### Internal Domain

| 属性 | 值 |
|------|-----|
| 规则 ID | `internal-domain` |
| 严重级别 | 🔵 低危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 56 |

**描述:**
检测常见内网域名后缀

**证据:**
```
第 56 行发现敏感内容: "db.internal.corp"
```


#### Internal Domain

| 属性 | 值 |
|------|-----|
| 规则 ID | `internal-domain` |
| 严重级别 | 🔵 低危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 62 |

**描述:**
检测常见内网域名后缀

**证据:**
```
第 62 行发现敏感内容: "internal"
```


#### Internal Domain

| 属性 | 值 |
|------|-----|
| 规则 ID | `internal-domain` |
| 严重级别 | 🔵 低危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 63 |

**描述:**
检测常见内网域名后缀

**证据:**
```
第 63 行发现敏感内容: "api.service.internal"
```


#### Internal Domain

| 属性 | 值 |
|------|-----|
| 规则 ID | `internal-domain` |
| 严重级别 | 🔵 低危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `content` |
| 行号 | 64 |

**描述:**
检测常见内网域名后缀

**证据:**
```
第 64 行发现敏感内容: "my-app.default.svc.cluster.local"
```


#### Internal Domain

| 属性 | 值 |
|------|-----|
| 规则 ID | `internal-domain` |
| 严重级别 | 🔵 低危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `ingress.hosts[0].host` |

**描述:**
检测常见内网域名后缀

**证据:**
```
路径 ingress.hosts[0].host 中发现匹配: "chart-example.local"
```


#### Internal Domain

| 属性 | 值 |
|------|-----|
| 规则 ID | `internal-domain` |
| 严重级别 | 🔵 低危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `database.url` |

**描述:**
检测常见内网域名后缀

**证据:**
```
路径 database.url 中发现匹配: "db.internal.corp"
```


#### Internal Domain

| 属性 | 值 |
|------|-----|
| 规则 ID | `internal-domain` |
| 严重级别 | 🔵 低危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `internal.api_url` |

**描述:**
检测常见内网域名后缀

**证据:**
```
路径 internal.api_url 中发现匹配: "api.service.internal"
```


#### Internal Domain

| 属性 | 值 |
|------|-----|
| 规则 ID | `internal-domain` |
| 严重级别 | 🔵 低危 |
| 分类 | network |
| 文件 | `examples/values-test.yaml` |
| 路径 | `internal.k8s_service` |

**描述:**
检测常见内网域名后缀

**证据:**
```
路径 internal.k8s_service 中发现匹配: "my-app.default.svc.cluster.local"
```


## 📌 已例外的项目

- **[AWS Access Key]** database.password
  - 例外原因: 这是测试环境的示例 AWS 密钥，用于演示
  - 创建人: devops-team
  - 过期时间: 2099-12-31

## ⚠️  已过期的例外（需要处理！）

- **[Internal Domain]** content
  - 过期时间: 2020-01-01
  - 例外原因: 过期的例外示例

- **[AWS Access Key]** content
  - 过期时间: 2020-01-01
  - 例外原因: 过期的例外示例

- **[Database Password]** content
  - 过期时间: 2020-01-01
  - 例外原因: 过期的例外示例

- **[AWS Secret Key]** content
  - 过期时间: 2020-01-01
  - 例外原因: 过期的例外示例

- **[Internal Domain]** ingress.hosts[0].host
  - 过期时间: 2020-01-01
  - 例外原因: 过期的例外示例

- **[AWS Access Key]** aws.access_key_id
  - 过期时间: 2020-01-01
  - 例外原因: 过期的例外示例

- **[AWS Secret Key]** aws.secret_access_key
  - 过期时间: 2020-01-01
  - 例外原因: 过期的例外示例

## 📖 扫描说明

### 严重级别说明
- **严重 (Critical)**: 明确的凭证泄露，如 AWS 密钥、数据库密码
- **高危 (High)**: 敏感配置、API 密钥、认证信息
- **中危 (Medium)**: 内网地址、编码后的敏感数据
- **低危 (Low)**: 内部域名、证书文件等

### 例外配置
如需例外某些发现，请在例外配置文件中添加例外项。例外项支持按规则 ID、路径、值进行匹配，并可设置过期时间。

### Base64 检测
本工具会自动检测并解码 Base64 编码的值，然后检查解码后的内容是否包含敏感信息。
