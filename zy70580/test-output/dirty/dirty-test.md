# K8s 探针策略分析报告

**生成时间**: 2026/5/17 11:42:44

## 📊 分析概览

| 指标 | 数值 |
|------|------|
| 文件总数 | 2 |
| 成功解析 | 1 |
| 工作负载数 | 2 |
| 容器总数 | 3 |

## 🔍 探针配置统计

| 探针类型 | 配置数量 | 覆盖率 |
|----------|----------|--------|
| LivenessProbe | 1 | 33% |
| ReadinessProbe | 0 | 0% |
| StartupProbe | 0 | 0% |

## ⚠️ 问题统计

| 类型 | 数量 |
|------|------|
| ❌ 错误 | 0 |
| ⚠️ 警告 | 5 |

## 🌍 环境分组

| 环境 | 容器数量 |
|------|----------|
| 预发布环境 | 2 |
| 未知环境 | 1 |

## 📋 问题详情

### ⚠️ 警告

- **容器 app-without-probes 缺少 livenessProbe**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/missing-probes.yaml`
  - 工作负载: Deployment/no-probe-app
  - 容器: app-without-probes

- **容器 app-without-probes 缺少 readinessProbe**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/missing-probes.yaml`
  - 工作负载: Deployment/no-probe-app
  - 容器: app-without-probes

- **容器 sidecar 缺少 livenessProbe**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/missing-probes.yaml`
  - 工作负载: Deployment/no-probe-app
  - 容器: sidecar

- **容器 sidecar 缺少 readinessProbe**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/missing-probes.yaml`
  - 工作负载: Deployment/no-probe-app
  - 容器: sidecar

- **容器 job-container 缺少 readinessProbe**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/missing-probes.yaml`
  - 工作负载: CronJob/nightly-job
  - 容器: job-container

## ❌ 解析错误（坏行记录）

- **YAMLException**: end of the stream or a document separator is expected in "/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/broken-syntax.yaml" (41:1)

 38 |     targetPort: 80
 39 | ---
 40 | another bad line with invalid s ...
 41 | : invalid: : yaml :
------^
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/broken-syntax.yaml`
  - 行号: 41
  - 列号: 0

## 📦 探针配置详情

| 工作负载/容器 | 探针类型 | initialDelay(s) | period(s) | timeout(s) | failureThreshold |
|---------------|----------|-----------------|-----------|------------|------------------|
| nightly-job/job-container | liveness | 10 | 30 | 1 | 3 |

---
*报告由 K8s探针策略CLI 工具自动生成*