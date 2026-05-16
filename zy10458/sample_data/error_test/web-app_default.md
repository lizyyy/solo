# Kubernetes 发布时间线报告

**Deployment**: web-app  
**Namespace**: default  
**时间范围**: 2026-05-16 20:14:49 - 2026-05-16 20:19:49  

## 摘要

| 指标 | 数值 |
|------|------|
| 总事件数 | 4 |
| 错误事件 | 2 |
| 警告事件 | 0 |
| Pod 总数 | 2 |
| 就绪 Pod | 2 |
| 总重启次数 | 0 |
| ReplicaSet 数量 | 0 |

## 关键事件时间线

### 🔵 2026-05-16 20:14:49 - Pod web-app-7f98d7c6b4-abcde started

- **类型**: pod_start
- **对象**: Pod/web-app-7f98d7c6b4-abcde
- **描述**: Phase: Running, IP: 10.244.1.10, Restarts: 0

### 🔵 2026-05-16 20:15:49 - Pod web-app-7f98d7c6b4-fghij started

- **类型**: pod_start
- **对象**: Pod/web-app-7f98d7c6b4-fghij
- **描述**: Phase: Running, IP: 10.244.1.11, Restarts: 0

### 🔴 2026-05-16 20:17:49 - Failed

- **类型**: error
- **对象**: Pod/web-app-bad-image-xyz
- **描述**: Failed to pull image "nginx:invalid-tag": rpc error: code = Unknown desc = Error response from daemon: manifest for nginx:invalid-tag not found

### 🔴 2026-05-16 20:19:49 - BackOff

- **类型**: general
- **对象**: Pod/web-app-crash-abc
- **描述**: Back-off restarting failed container


## 镜像变更记录

*无镜像变更记录*

## Pod 状态概览

| Pod 名称 | 状态 | 就绪 | 重启次数 | 启动时间 |
|----------|------|------|----------|----------|
| web-app-7f98d7c6b4-abcde | Running | ✅ | 0 | 2026-05-16 20:14:49 |
| web-app-7f98d7c6b4-fghij | Running | ✅ | 0 | 2026-05-16 20:15:49 |

## ReplicaSet 信息

*无 ReplicaSet 记录*
