# Kubernetes 发布时间线报告

**Deployment**: web-app  
**Namespace**: default  
**时间范围**: 2026-05-16 20:07:49 - 2026-05-16 20:15:49  

## 摘要

| 指标 | 数值 |
|------|------|
| 总事件数 | 6 |
| 错误事件 | 0 |
| 警告事件 | 0 |
| Pod 总数 | 2 |
| 就绪 Pod | 2 |
| 总重启次数 | 0 |
| ReplicaSet 数量 | 1 |
| 期望副本数 | 2 |
| 已更新副本 | 2 |
| 就绪副本 | 2 |
| 可用副本 | 2 |
| 更新策略 | RollingUpdate |

## 关键事件时间线

### 🔵 2026-05-16 20:07:49 - ReplicaSet web-app-7f98d7c6b4 created

- **类型**: replicaset_create
- **对象**: ReplicaSet/web-app-7f98d7c6b4
- **描述**: Replicas: 2, Ready: 2

### 🔵 2026-05-16 20:12:49 - SuccessfulCreate

- **类型**: general
- **对象**: ReplicaSet/web-app-7f98d7c6b4
- **描述**: Created pod: web-app-7f98d7c6b4-abcde

### 🔵 2026-05-16 20:13:49 - Pulled

- **类型**: image_pull
- **对象**: Pod/web-app-7f98d7c6b4-abcde
- **描述**: Successfully pulled image "nginx:1.21"

### 🔵 2026-05-16 20:14:49 - Started

- **类型**: lifecycle
- **对象**: Pod/web-app-7f98d7c6b4-abcde
- **描述**: Started container nginx

### 🔵 2026-05-16 20:14:49 - Pod web-app-7f98d7c6b4-abcde started

- **类型**: pod_start
- **对象**: Pod/web-app-7f98d7c6b4-abcde
- **描述**: Phase: Running, IP: 10.244.1.10, Restarts: 0

### 🔵 2026-05-16 20:15:49 - Pod web-app-7f98d7c6b4-fghij started

- **类型**: pod_start
- **对象**: Pod/web-app-7f98d7c6b4-fghij
- **描述**: Phase: Running, IP: 10.244.1.11, Restarts: 0


✅ 无错误事件，发布状态良好。

## 镜像变更记录

*无镜像变更记录*

## Pod 状态概览

| Pod 名称 | 状态 | 就绪 | 重启次数 | 启动时间 |
|----------|------|------|----------|----------|
| web-app-7f98d7c6b4-abcde | Running | ✅ | 0 | 2026-05-16 20:14:49 |
| web-app-7f98d7c6b4-fghij | Running | ✅ | 0 | 2026-05-16 20:15:49 |

## ReplicaSet 信息

| ReplicaSet 名称 | 副本数 | 就绪 | 可用 | 创建时间 |
|---------------|--------|------|------|----------|
| web-app-7f98d7c6b4 | 2 | 2 | 2 | 2026-05-16 20:07:49 |
