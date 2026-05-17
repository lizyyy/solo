# 镜像晋级清单报告

**生成时间**: 2026-05-17T04:11:32.207Z

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
| Critical 问题 | 0 |
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

- 记录 1: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv` 第 2 行
  - 原始内容: `myapp:v1.0.0,dev,true,ci-bot,abc123def456,true,0,2,5,12,true,2024-01-15T10:00:00Z,dev-cluster`
- 记录 2: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv` 第 3 行
  - 原始内容: `myapp:v1.0.0,prod,true,ci-bot,abc123def456,true,0,2,5,12,true,2024-01-16T14:00:00Z,prod-cluster`

---

### myapp:v1.1.0 - ❌ 失败

#### 问题列表

-  目标环境 prod 镜像未签名 - 必须签名才能晋级
  - 来源: /Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv:5
-  镜像未进行安全扫描
  - 来源: /Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv:5
-  源环境 dev 已部署，但目标环境 prod 无部署记录

#### 检查详情

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 签名校验 | ❌ | 源环境:已签名, 目标环境:未签名 |
| 扫描门禁 | ❌ | 未扫描 |
| 部署记录 | ❌ | 源环境:已部署, 目标环境:未部署 |

#### 数据来源追溯

- 记录 1: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv` 第 4 行
  - 原始内容: `myapp:v1.1.0,dev,true,ci-bot,xyz789ghi012,true,0,0,3,8,true,2024-01-20T09:00:00Z,dev-cluster`
- 记录 2: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv` 第 5 行
  - 原始内容: `myapp:v1.1.0,prod,false,,,,true,1,3,5,8,false,,,prod-cluster`

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

- 记录 1: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv` 第 6 行
  - 原始内容: `auth-service:v2.0.0,dev,true,security-team,sec999aaa,true,2,5,10,20,true,2024-01-18T11:00:00Z,dev-cl...`
- 记录 2: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv` 第 7 行
  - 原始内容: `auth-service:v2.0.0,prod,true,security-team,sec999bbb,true,0,1,4,15,true,2024-01-19T16:00:00Z,prod-c...`

---

### api-gateway:v3.2.1 - ✅ 通过

#### 检查详情

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 签名校验 | ✅ | 源环境:已签名, 目标环境:已签名 |
| 扫描门禁 | ✅ | C:0 H:0 M:0 L:5 (门禁:critical) |
| 部署记录 | ✅ | 源环境:已部署, 目标环境:已部署 |

#### 数据来源追溯

- 记录 1: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv` 第 8 行
  - 原始内容: `api-gateway:v3.2.1,dev,true,ops-team,api777ccc,true,0,0,0,5,true,2024-01-10T08:00:00Z,dev-cluster`
- 记录 2: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv` 第 9 行
  - 原始内容: `api-gateway:v3.2.1,prod,true,ops-team,api777ccc,true,0,0,0,5,true,2024-01-11T12:00:00Z,prod-cluster`

---

### database:v5.0.0 - ❌ 失败

#### 问题列表

-  镜像未进行安全扫描
  - 来源: /Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv:10

#### 缺项列表

- 目标环境 prod 无记录

#### 检查详情

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 签名校验 | ✅ | 源环境:未签名 |
| 扫描门禁 | ❌ | 未扫描 |
| 部署记录 | ✅ | 源环境:已部署 |

#### 数据来源追溯

- 记录 1: `/Users/lzy/pro/solo/workspaces/zy10494/examples/sample-images.csv` 第 10 行
  - 原始内容: `database:v5.0.0,dev,false,,db111ddd,false,0,0,0,0,true,2024-01-05T15:00:00Z,dev-cluster`

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
