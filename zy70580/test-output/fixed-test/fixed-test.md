# K8s 探针策略分析报告

**生成时间**: 2026/5/17 13:34:05

## 📊 分析概览

| 指标 | 数值 |
|------|------|
| 文件总数 | 1 |
| 成功解析 | 0 |
| 工作负载数 | 3 |
| 容器总数 | 1 |

## 🔍 探针配置统计

| 探针类型 | 配置数量 | 覆盖率 |
|----------|----------|--------|
| LivenessProbe | 1 | 100% |
| ReadinessProbe | 0 | 0% |
| StartupProbe | 0 | 0% |

## ⚠️ 问题统计

| 类型 | 数量 |
|------|------|
| ❌ 错误 | 4 |
| ⚠️ 警告 | 1 |

## 🌍 环境分组

| 环境 | 容器数量 |
|------|----------|
| 未知环境 | 1 |

## 📋 问题详情

### ❌ 错误

- **livenessProbe 的 initialDelaySeconds (999s) 超过建议最大值 300s**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/broken-syntax.yaml`
  - 工作负载: Deployment/broken-deployment
  - 容器: broken-app

- **livenessProbe 的 periodSeconds (600s) 超过建议最大值 300s**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/broken-syntax.yaml`
  - 工作负载: Deployment/broken-deployment
  - 容器: broken-app

- **livenessProbe 的 timeoutSeconds (120s) 超过建议最大值 60s**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/broken-syntax.yaml`
  - 工作负载: Deployment/broken-deployment
  - 容器: broken-app

- **livenessProbe 的 failureThreshold (50s) 超过建议最大值 20s**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/broken-syntax.yaml`
  - 工作负载: Deployment/broken-deployment
  - 容器: broken-app

### ⚠️ 警告

- **容器 broken-app 缺少 readinessProbe**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/broken-syntax.yaml`
  - 工作负载: Deployment/broken-deployment
  - 容器: broken-app

## ❌ 解析错误（坏行记录）

- **YAMLException**: end of the stream or a document separator is expected in "/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/broken-syntax.yaml" (2:1)

 1 | another bad line with invalid syntax
 2 | : invalid: : yaml :
-----^
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/dirty/broken-syntax.yaml`
  - 行号: 41
  - 列号: 0

## 📦 探针配置详情

| 工作负载/容器 | 探针类型 | initialDelay(s) | period(s) | timeout(s) | failureThreshold |
|---------------|----------|-----------------|-----------|------------|------------------|
| broken-deployment/broken-app | liveness | 999 | 600 | 120 | 50 |

---
*报告由 K8s探针策略CLI 工具自动生成*