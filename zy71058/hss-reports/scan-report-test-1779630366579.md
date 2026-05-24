# Helm Values 泄密扫描报告

> 生成时间: 2026-05-24T13:46:06.574Z
> 环境: test

## 📋 扫描信息

| 项目 | 内容 |
|------|------|
| 扫描时间 | 2026-05-24T13:46:06.574Z |
| 环境 | test |
| Values 文件 | `examples/values-test.yaml` |
| 例外配置 | `examples/bad-exceptions.yaml` |

## 📊 扫描摘要

| 统计项 | 数量 |
|--------|------|
| 扫描文件数 | 1 |
| 发现问题数 | 0 |
| 🔴 严重 | 0 |
| 🔴 高危 | 0 |
| 🟡 中危 | 0 |
| 🔵 低危 | 0 |
| 📌 已例外 | 30 |
| ⚠️  过期例外 | 0 |

## ✅ 未发现敏感信息

扫描未发现任何敏感信息。

## 📌 已例外的项目

- **[Internal Domain]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Intranet IP Address]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[AWS Access Key]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Database Password]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Basic Authentication]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Internal Domain]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[AWS Secret Key]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Internal Domain]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Internal Domain]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Internal Domain]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Database Password]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Kubernetes dockerconfigjson]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Generic API Key]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[JWT Token]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Basic Authentication]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Git Credentials]** content
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Internal Domain]** ingress.hosts[0].host
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Intranet IP Address]** database.host
  - 例外原因: 缺少必填字段测试 - 没有 createdBy 和 createdAt

- **[AWS Access Key]** database.password
  - 例外原因: 缺少必填字段测试 - 没有 createdBy 和 createdAt

- **[Basic Authentication]** database.url
  - 例外原因: 缺少必填字段测试 - 没有 createdBy 和 createdAt

- **[Internal Domain]** database.url
  - 例外原因: 缺少必填字段测试 - 没有 createdBy 和 createdAt

- **[AWS Access Key]** aws.access_key_id
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[AWS Secret Key]** aws.secret_access_key
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Internal Domain]** internal.api_url
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Internal Domain]** internal.k8s_service
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Database Password]** secrets.dockerconfigjson
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Kubernetes dockerconfigjson]** secrets.dockerconfigjson
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[JWT Token]** secrets.jwt_token
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Basic Authentication]** git.clone_url
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

- **[Git Credentials]** git.clone_url
  - 例外原因: 缺少匹配条件测试 - 没有 path/value/ruleId
  - 创建人: test

## ⚠️  警告

- 例外配置警告: 例外项 bad-exception-1 缺少 createdBy 字段，必须记录创建人
- 例外配置警告: 例外项 bad-exception-1 缺少 createdAt 字段
- 例外配置警告: 例外项 bad-exception-2 必须至少指定 path、value 或 ruleId 之一

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
