# K8s 探针策略分析报告

**生成时间**: 2026/5/17 11:43:01

## 📊 分析概览

| 指标 | 数值 |
|------|------|
| 文件总数 | 1 |
| 成功解析 | 1 |
| 工作负载数 | 2 |
| 容器总数 | 1 |

## 🔍 探针配置统计

| 探针类型 | 配置数量 | 覆盖率 |
|----------|----------|--------|
| LivenessProbe | 1 | 100% |
| ReadinessProbe | 1 | 100% |
| StartupProbe | 1 | 100% |

## ⚠️ 问题统计

| 类型 | 数量 |
|------|------|
| ❌ 错误 | 1 |
| ⚠️ 警告 | 0 |

## 🌍 环境分组

| 环境 | 容器数量 |
|------|----------|
| 生产环境 | 1 |

## 📋 问题详情

### ❌ 错误

- **startupProbe 的 failureThreshold (30s) 超过建议最大值 20s**
  - 文件: `/Users/lzy/pro/solo/workspaces/zy70580/test-data/normal/deployment-prod.yaml`
  - 工作负载: Deployment/web-service-prod
  - 容器: web-service

## 📦 探针配置详情

| 工作负载/容器 | 探针类型 | initialDelay(s) | period(s) | timeout(s) | failureThreshold |
|---------------|----------|-----------------|-----------|------------|------------------|
| web-service-prod/web-service | liveness | 30 | 10 | 5 | 3 |
|  | readiness | 10 | 5 | 3 | 2 |
|  | startup | 60 | 10 | 1 | 30 |

---
*报告由 K8s探针策略CLI 工具自动生成*