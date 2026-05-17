# OpenAPI 权限矩阵报告

生成时间: 2026/5/17 22:22:27

## 📊 统计摘要

| 指标 | 数值 |
|------|------|
| 总接口数 | 8 |
| 总角色数 | 4 |
| 鉴权覆盖率 | 75.0% |
| 已鉴权接口 | 6 |
| 公开接口 | 2 |
| 缺失项数 | 4 |
| 解析错误 | 0 |
| 重复接口 | 1 |

## 👥 角色统计

| 角色 | 接口数 | 占比 |
|------|--------|------|
| admin | 3 | 37.5% |
| guest | 4 | 50.0% |
| manager | 3 | 37.5% |
| user | 3 | 37.5% |

## 🔐 权限矩阵

| 方法 | 路径 | 摘要 | 鉴权 | admin | guest | manager | user |
|------|------|------|------|------|------|------|------|
| GET | `/api/users` | 获取用户列表 | ✅ | ✅ | ✅ | ✅ | - |
| POST | `/api/users` | 创建用户 | ✅ | ✅ | ✅ | - | - |
| GET | `/api/users/{id}` | 获取用户详情 | ✅ | ✅ | ✅ | ✅ | ✅ |
| PUT | `/api/users/{id}` | 更新用户 | ✅ | - | ✅ | - | - |
| DELETE | `/api/users/{id}` | 删除用户 | ❌ | - | - | - | - |
| GET | `/api/public/health` | 健康检查 | ❌ | - | - | - | - |
| GET | `/api/orders` | 获取订单列表 | ✅ | - | - | ✅ | ✅ |
| POST | `/api/orders` | 创建订单 | ✅ | - | - | - | ✅ |

## ⚠️ 缺失项详情

### no_auth_description (2)

| 方法 | 路径 | 说明 | 来源文件 |
|------|------|------|----------|
| PUT | `/api/users/{id}` | 接口缺少鉴权说明 | `/Users/lzy/pro/solo/workspaces/zy10552/openapi/example1.yaml` |
| POST | `/api/orders` | 接口缺少鉴权说明 | `/Users/lzy/pro/solo/workspaces/zy10552/openapi/example2.yaml` |

### no_auth_required (2)

| 方法 | 路径 | 说明 | 来源文件 |
|------|------|------|----------|
| DELETE | `/api/users/{id}` | 接口未配置鉴权要求 | `/Users/lzy/pro/solo/workspaces/zy10552/openapi/example1.yaml` |
| GET | `/api/public/health` | 接口未配置鉴权要求 | `/Users/lzy/pro/solo/workspaces/zy10552/openapi/example1.yaml` |

## 🔄 重复接口(已去重)

> 去重口径: 按 [method + path] 组合去重，保留首次出现的定义

| 方法 | 路径 | 首次出现 | 重复来源 |
|------|------|----------|----------|
| GET | `/api/users` | `/Users/lzy/pro/solo/workspaces/zy10552/openapi/example1.yaml` | `/Users/lzy/pro/solo/workspaces/zy10552/openapi/example2.yaml` |

## 📝 说明

- ✅ 表示具有该角色权限
- - 表示不具有或未配置
- 鉴权列: ✅ 表示需要鉴权，❌ 表示公开接口

---
*此报告由 openapi-permission-matrix 工具自动生成*