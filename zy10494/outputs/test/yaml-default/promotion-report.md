# 镜像晋级清单报告

**生成时间**: 2026-05-17T04:11:32.309Z

**环境晋级**: dev → prod

**扫描门禁**: critical

**严格模式**: 关闭

## 执行摘要

| 指标 | 数值 |
|------|------|
| 总镜像数 | 5 |
| 通过 | 2 |
| 失败 | 3 |
| 通过率 | 40.00% |
| 问题总数 | 5 |
| 缺项总数 | 1 |
| Critical 问题 | 1 |
| High 问题 | 0 |

## 详细结果

### myapp:v1.0.0 - ✅ 通过

#### 检查详情

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 签名校验 | ✅ | 源环境:已签名, 目标环境:已签名 |
| 扫描门禁 | ✅ | C:0 H:2 M:5 L:12 (门禁:critical) |
| 部署记录 | ✅ | 源环境:已部署, 目标环境:已部署 |

#### 数据来源追溯

- 记录 1: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml` 第 1 行
  - 原始内容: `{"imageTag":"myapp:v1.0.0","environment":"dev","signed":true,"signer":"ci-bot","signatureFingerprint...`
- 记录 2: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml` 第 2 行
  - 原始内容: `{"imageTag":"myapp:v1.0.0","environment":"prod","signed":true,"signer":"ci-bot","signatureFingerprin...`

---

### myapp:v1.1.0 - ❌ 失败

#### 问题列表

-  目标环境 prod 镜像未签名 - 必须签名才能晋级
  - 来源: /Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml:4
- **[CRITICAL]** 发现 1 个 Critical 级漏洞，超过门禁阈值
  - 来源: /Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml:4
-  源环境 dev 已部署，但目标环境 prod 无部署记录

#### 检查详情

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 签名校验 | ❌ | 源环境:已签名, 目标环境:未签名 |
| 扫描门禁 | ❌ | C:1 H:3 M:5 L:8 (门禁:critical) |
| 部署记录 | ❌ | 源环境:已部署, 目标环境:未部署 |

#### 数据来源追溯

- 记录 1: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml` 第 3 行
  - 原始内容: `{"imageTag":"myapp:v1.1.0","environment":"dev","signed":true,"signer":"ci-bot","signatureFingerprint...`
- 记录 2: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml` 第 4 行
  - 原始内容: `{"imageTag":"myapp:v1.1.0","environment":"prod","signed":false,"scanned":true,"critical":1,"high":3,...`

---

### auth-service:v2.0.0 - ❌ 失败

#### 问题列表

-  签名指纹不匹配: 源环境=sec999aaa, 目标环境=sec999bbb

#### 检查详情

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 签名校验 | ❌ | 源环境:已签名, 目标环境:已签名 |
| 扫描门禁 | ✅ | C:0 H:1 M:4 L:15 (门禁:critical) |
| 部署记录 | ✅ | 源环境:已部署, 目标环境:已部署 |

#### 数据来源追溯

- 记录 1: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml` 第 5 行
  - 原始内容: `{"imageTag":"auth-service:v2.0.0","environment":"dev","signed":true,"signer":"security-team","signat...`
- 记录 2: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml` 第 6 行
  - 原始内容: `{"imageTag":"auth-service:v2.0.0","environment":"prod","signed":true,"signer":"security-team","signa...`

---

### api-gateway:v3.2.1 - ✅ 通过

#### 检查详情

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 签名校验 | ✅ | 源环境:已签名, 目标环境:已签名 |
| 扫描门禁 | ✅ | C:0 H:0 M:0 L:5 (门禁:critical) |
| 部署记录 | ✅ | 源环境:已部署, 目标环境:已部署 |

#### 数据来源追溯

- 记录 1: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml` 第 7 行
  - 原始内容: `{"imageTag":"api-gateway:v3.2.1","environment":"dev","signed":true,"signer":"ops-team","signatureFin...`
- 记录 2: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml` 第 8 行
  - 原始内容: `{"imageTag":"api-gateway:v3.2.1","environment":"prod","signed":true,"signer":"ops-team","signatureFi...`

---

### database:v5.0.0 - ❌ 失败

#### 问题列表

-  镜像未进行安全扫描
  - 来源: /Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml:9

#### 缺项列表

- 目标环境 prod 无记录

#### 检查详情

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 签名校验 | ✅ | 源环境:未签名 |
| 扫描门禁 | ❌ | 未扫描 |
| 部署记录 | ✅ | 源环境:已部署 |

#### 数据来源追溯

- 记录 1: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.yaml` 第 9 行
  - 原始内容: `{"imageTag":"database:v5.0.0","environment":"dev","signed":false,"signatureFingerprint":"db111ddd","...`

---

## 附录

### 扫描门禁说明

- `critical`: 仅阻断 Critical 级漏洞 (默认)
- `high`: 阻断 High 及以上漏洞
- `medium`: 阻断 Medium 及以上漏洞
- `all`: 阻断所有等级漏洞

### 问题类型说明

- `signature_missing`: 缺少签名
- `signature_mismatch`: 签名不匹配
- `scan_missing`: 缺少扫描记录
- `scan_violation`: 扫描漏洞超过门禁
- `deployment_missing`: 缺少部署记录
- `deployment_mismatch`: 部署记录不匹配
